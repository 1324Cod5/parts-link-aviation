import { Router, type IRouter } from "express";
import { db, rfqsTable, rfqResponsesTable, usersTable, listingsTable, aogEscalationsTable } from "@workspace/db";
import { eq, desc, like, or, count, and, sql, inArray } from "drizzle-orm";
import { CreateRfqBody, CreateRfqResponseBody, SubmitRfqQuoteBody, AwardRfqQuoteBody } from "@workspace/api-zod";
import { FULL_ACCESS_PLANS } from "../lib/planEnforcement";
import {
  computeSellerStats,
  estimateMarketPrice,
  scoreSellerFull,
  buildAutoQuoteSuggestion,
  fetchActiveSellers,
} from "../lib/rfqAnalysis";
import { notifyRfqCreated, notifyQuoteAwarded } from "../lib/email";
import { startAogEscalation, resolveAogEscalation } from "../lib/aogEscalation";

const router: IRouter = Router();

// ─── Scoring tables ───────────────────────────────────────────────────────────

const URGENCY_SCORE: Record<string, number> = {
  aog: 40,
  urgent: 20,
  routine: 5,
};

const TIER_SCORE: Record<string, number> = {
  enterprise: 30,
  mro_premium: 30,
  pro: 20,
  mro_verified: 15,
  free: 0,
};

// ─── Serializers ─────────────────────────────────────────────────────────────

function serializeRfq(rfq: any, accessLevel: "full" | "limited") {
  return {
    id: rfq.id,
    buyerName: rfq.buyerName,
    buyerEmail: accessLevel === "full" ? rfq.buyerEmail : null,
    buyerCompany: accessLevel === "full" ? (rfq.buyerCompany ?? null) : null,
    buyerPhone: accessLevel === "full" ? (rfq.buyerPhone ?? null) : null,
    partNumber: rfq.partNumber,
    description: rfq.description,
    aircraftApplicability: rfq.aircraftApplicability ?? null,
    condition: rfq.condition ?? null,
    quantity: rfq.quantity,
    status: rfq.status,
    urgency: rfq.urgency ?? "routine",
    urgencyReason: rfq.urgencyReason ?? null,
    awardedResponseId: rfq.awardedResponseId ?? null,
    accessLevel,
    createdAt: rfq.createdAt?.toISOString?.() ?? rfq.createdAt,
    updatedAt: rfq.updatedAt?.toISOString?.() ?? rfq.updatedAt,
  };
}

function serializeResponse(r: any) {
  return {
    id: r.id,
    rfqId: r.rfqId,
    sellerId: r.sellerId,
    sellerCompanyName: r.sellerCompanyName ?? "",
    message: r.message,
    listingId: r.listingId ?? null,
    listingPartNumber: r.listingPartNumber ?? null,
    price: r.price ?? null,
    leadTimeDays: r.leadTimeDays ?? null,
    isQuote: r.isQuote ?? false,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  };
}

// ─── GET /rfqs ────────────────────────────────────────────────────────────────

router.get("/rfqs", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;

  const validStatuses = ["draft", "open", "quoted", "awarded", "closed", "archived", "suspended", "deleted"];
  const conditions: any[] = [];

  if (status && validStatuses.includes(status)) {
    conditions.push(eq(rfqsTable.status, status as any));
  }
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        like(rfqsTable.partNumber, term),
        like(rfqsTable.description, term),
        like(rfqsTable.aircraftApplicability, term),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db.select().from(rfqsTable).where(where)
      .orderBy(rfqsTable.urgency, desc(rfqsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: count() }).from(rfqsTable).where(where),
  ]);

  const plan = req.session?.user?.subscriptionTier ?? "free";
  const accessLevel: "full" | "limited" = FULL_ACCESS_PLANS.has(plan) ? "full" : "limited";

  res.json({
    rfqs: rows.map((r) => serializeRfq(r, accessLevel)),
    total: Number(countRow.count),
    page,
    limit,
    accessLevel,
  });
});

// ─── POST /rfqs — public, no auth required ────────────────────────────────────

router.post("/rfqs", async (req, res): Promise<void> => {
  const parsed = CreateRfqBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data;

  if (data.urgency === "aog" && !data.urgencyReason?.trim()) {
    res.status(400).json({ error: "AOG urgency requires an urgency reason describing the grounding situation." });
    return;
  }

  const [rfq] = await db
    .insert(rfqsTable)
    .values({
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      buyerCompany: data.buyerCompany ?? null,
      buyerPhone: data.buyerPhone ?? null,
      partNumber: data.partNumber,
      description: data.description,
      aircraftApplicability: data.aircraftApplicability ?? null,
      condition: data.condition ?? null,
      quantity: data.quantity,
      urgency: (data.urgency as any) ?? "routine",
      urgencyReason: data.urgency === "aog" ? (data.urgencyReason ?? null) : null,
    })
    .returning();

  const serialized = serializeRfq(rfq, "full");

  const rfqPayload = {
    id: rfq.id,
    partNumber: rfq.partNumber,
    description: rfq.description,
    quantity: rfq.quantity,
    urgency: rfq.urgency ?? "routine",
    aircraftApplicability: rfq.aircraftApplicability ?? null,
    condition: rfq.condition ?? null,
    buyerCompany: rfq.buyerCompany ?? null,
    createdAt: rfq.createdAt.toISOString(),
    urgencyReason: rfq.urgencyReason ?? null,
  };

  if (rfq.urgency === "aog") {
    void startAogEscalation(rfq.id, rfqPayload);
    res.status(201).json({ ...serialized, _aogEscalation: true });
    return;
  }

  void notifyRfqCreated(rfqPayload);
  res.status(201).json(serialized);
});

// ─── GET /rfqs/aog/active — Pro/Enterprise: active AOG RFQs + escalation state ─

router.get("/rfqs/aog/active", async (req, res): Promise<void> => {
  const sessionUser = req.session?.user;
  if (!sessionUser) { res.status(401).json({ error: "Not authenticated" }); return; }

  const plan = sessionUser.subscriptionTier ?? "free";
  if (!FULL_ACCESS_PLANS.has(plan)) {
    res.status(403).json({ error: "Pro or Enterprise plan required to access AOG alerts" });
    return;
  }

  const openAogRfqs = await db
    .select()
    .from(rfqsTable)
    .where(and(eq(rfqsTable.urgency, "aog" as "aog"), eq(rfqsTable.status, "open")))
    .orderBy(desc(rfqsTable.createdAt))
    .limit(30);

  const rfqIds = openAogRfqs.map(r => r.id);

  const escalations = rfqIds.length
    ? await db.select().from(aogEscalationsTable).where(inArray(aogEscalationsTable.rfqId, rfqIds))
    : [];

  const escMap = new Map(escalations.map(e => [e.rfqId, e]));

  res.json({
    rfqs: openAogRfqs.map(rfq => {
      const esc = escMap.get(rfq.id);
      return {
        id:                   rfq.id,
        partNumber:           rfq.partNumber,
        description:          rfq.description,
        quantity:             rfq.quantity,
        aircraftApplicability: rfq.aircraftApplicability ?? null,
        condition:            rfq.condition ?? null,
        urgencyReason:        rfq.urgencyReason ?? null,
        buyerName:            rfq.buyerName,
        buyerCompany:         rfq.buyerCompany ?? null,
        createdAt:            rfq.createdAt.toISOString(),
        escalation: esc ? {
          phase:            esc.phase,
          createdAt:        esc.createdAt.toISOString(),
          lastEscalatedAt:  esc.lastEscalatedAt.toISOString(),
        } : null,
      };
    }),
  });
});

// ─── GET /rfqs/:id ────────────────────────────────────────────────────────────

router.get("/rfqs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const plan = req.session?.user?.subscriptionTier ?? "free";
  const accessLevel: "full" | "limited" = FULL_ACCESS_PLANS.has(plan) ? "full" : "limited";

  const rawResponses = await db
    .select({
      id: rfqResponsesTable.id,
      rfqId: rfqResponsesTable.rfqId,
      sellerId: rfqResponsesTable.sellerId,
      message: rfqResponsesTable.message,
      listingId: rfqResponsesTable.listingId,
      price: rfqResponsesTable.price,
      leadTimeDays: rfqResponsesTable.leadTimeDays,
      isQuote: rfqResponsesTable.isQuote,
      createdAt: rfqResponsesTable.createdAt,
      sellerCompanyName: usersTable.companyName,
      listingPartNumber: listingsTable.partNumber,
    })
    .from(rfqResponsesTable)
    .leftJoin(usersTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .leftJoin(listingsTable, eq(rfqResponsesTable.listingId, listingsTable.id))
    .where(eq(rfqResponsesTable.rfqId, id))
    .orderBy(desc(rfqResponsesTable.createdAt));

  res.json({
    rfq: serializeRfq(rfq, accessLevel),
    responses: rawResponses.map(serializeResponse),
  });
});

// ─── POST /rfqs/:id/close ─────────────────────────────────────────────────────

router.post("/rfqs/:id/close", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db
    .update(rfqsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(rfqsTable.id, id))
    .returning();

  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  // Stop AOG escalation timers if this was an AOG RFQ
  if (rfq.urgency === "aog") void resolveAogEscalation(id);

  res.json(serializeRfq(rfq, "full"));
});

// ─── POST /rfqs/:id/responses — Pro/Enterprise/MRO Premium only ───────────────

router.post("/rfqs/:id/responses", async (req, res): Promise<void> => {
  const sessionUser = req.session?.user;
  if (!sessionUser) { res.status(401).json({ error: "Not authenticated" }); return; }

  const plan = sessionUser.subscriptionTier ?? "free";
  if (!FULL_ACCESS_PLANS.has(plan)) {
    res.status(402).json({
      error: "Responding to RFQs requires a Pro, Enterprise, or Premium MRO plan.",
      plan,
      requiredPlan: "pro",
      upgradeUrl: "/seller/subscription",
    });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
  if (rfq.status === "closed" || rfq.status === "awarded") {
    res.status(400).json({ error: `This RFQ is ${rfq.status}` });
    return;
  }

  const parsed = CreateRfqResponseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = parseInt(sessionUser.id);

  const [response] = await db
    .insert(rfqResponsesTable)
    .values({
      rfqId: id,
      sellerId: userId,
      message: parsed.data.message,
      listingId: parsed.data.listingId ?? null,
    })
    .returning();

  const [seller] = await db
    .select({ companyName: usersTable.companyName })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  let listingPartNumber: string | null = null;
  if (parsed.data.listingId) {
    const [listing] = await db
      .select({ partNumber: listingsTable.partNumber })
      .from(listingsTable)
      .where(eq(listingsTable.id, parsed.data.listingId));
    listingPartNumber = listing?.partNumber ?? null;
  }

  res.status(201).json(serializeResponse({
    ...response,
    sellerCompanyName: seller?.companyName ?? "",
    listingPartNumber,
  }));
});

// ─── POST /rfqs/:id/quote — Pro/Enterprise/MRO Premium: formal price quote ────

router.post("/rfqs/:id/quote", async (req, res): Promise<void> => {
  const sessionUser = req.session?.user;
  if (!sessionUser) { res.status(401).json({ error: "Not authenticated" }); return; }

  const plan = sessionUser.subscriptionTier ?? "free";
  if (!FULL_ACCESS_PLANS.has(plan)) {
    res.status(402).json({
      error: "Submitting quotes requires a Pro, Enterprise, or Premium MRO plan.",
      plan,
      requiredPlan: "pro",
      upgradeUrl: "/seller/subscription",
    });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SubmitRfqQuoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
  if (rfq.status === "closed" || rfq.status === "awarded" || rfq.status === "draft") {
    res.status(400).json({ error: `Cannot quote on an RFQ with status '${rfq.status}'` });
    return;
  }

  const userId = parseInt(sessionUser.id);
  const { price, leadTimeDays, message, listingId } = parsed.data;

  const [response] = await db
    .insert(rfqResponsesTable)
    .values({
      rfqId: id,
      sellerId: userId,
      message: message ?? "",
      listingId: listingId ?? null,
      price: String(price),
      leadTimeDays,
      isQuote: true,
    })
    .returning();

  // Auto-transition open → quoted when first quote arrives
  if (rfq.status === "open") {
    await db
      .update(rfqsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(rfqsTable.id, id));
  }

  const [seller] = await db
    .select({ companyName: usersTable.companyName })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  let listingPartNumber: string | null = null;
  if (listingId) {
    const [listing] = await db
      .select({ partNumber: listingsTable.partNumber })
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId));
    listingPartNumber = listing?.partNumber ?? null;
  }

  res.status(201).json(serializeResponse({
    ...response,
    sellerCompanyName: seller?.companyName ?? "",
    listingPartNumber,
  }));
});

// ─── POST /rfqs/:id/award — buyer awards a quote ──────────────────────────────

router.post("/rfqs/:id/award", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AwardRfqQuoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  if (rfq.status !== "open" && rfq.status !== "quoted") {
    res.status(400).json({ error: `RFQ cannot be awarded from status '${rfq.status}'` });
    return;
  }

  const [quote] = await db
    .select()
    .from(rfqResponsesTable)
    .where(and(
      eq(rfqResponsesTable.id, parsed.data.quoteId),
      eq(rfqResponsesTable.rfqId, id),
    ));
  if (!quote) { res.status(400).json({ error: "Quote not found on this RFQ" }); return; }

  const [updated] = await db
    .update(rfqsTable)
    .set({ status: "awarded", awardedResponseId: parsed.data.quoteId, updatedAt: new Date() })
    .where(eq(rfqsTable.id, id))
    .returning();

  void notifyQuoteAwarded(quote.sellerId, {
    rfqId: rfq.id,
    partNumber: rfq.partNumber,
    description: rfq.description,
    buyerName: rfq.buyerName,
    buyerCompany: rfq.buyerCompany ?? null,
  });

  res.json(serializeRfq(updated, "full"));
});

// ─── GET /rfqs/:id/matches — matching engine: ranked sellers ─────────────────

router.get("/rfqs/:id/matches", async (req, res): Promise<void> => {
  const sessionUser = req.session?.user;
  if (!sessionUser) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const urgencyScore = URGENCY_SCORE[rfq.urgency ?? "routine"] ?? 5;

  // Fetch active sellers with their total response count
  const sellers = await db
    .select({
      id: usersTable.id,
      companyName: usersTable.companyName,
      trustScore: usersTable.trustScore,
      trustBadge: usersTable.trustBadge,
      plan: usersTable.plan,
      responseCount: sql<number>`cast(count(${rfqResponsesTable.id}) as int)`,
    })
    .from(usersTable)
    .leftJoin(rfqResponsesTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .where(
      and(
        eq(usersTable.status, "active"),
        inArray(usersTable.role, ["seller"]),
      ),
    )
    .groupBy(usersTable.id)
    .limit(200);

  // Score each seller using weighted factors
  const scored = sellers.map((s) => {
    // Trust score contribution: 0–50 points
    const trustContrib = (Math.min(100, Math.max(0, s.trustScore)) / 100) * 50;

    // Subscription tier contribution: 0–30 points
    const tierContrib = TIER_SCORE[s.plan] ?? 0;

    // Response performance: 0–10 points, capped at 30 historical responses
    const responsePerfContrib = (Math.min(s.responseCount, 30) / 30) * 10;

    // Urgency alignment: AOG rfqs give bonus to aviation-verified+ sellers
    const isHighVerification =
      s.trustBadge === "aviation_verified" || s.trustBadge === "trusted_partner";
    // AOG always gets the maximum urgency bonus regardless of verification tier —
    // it is the highest-priority signal in the matching engine.
    const urgencyBonus =
      rfq.urgency === "aog"
        ? urgencyScore * (isHighVerification ? 0.5 : 0.35)
        : urgencyScore * 0.1;

    const raw = trustContrib + tierContrib + responsePerfContrib + urgencyBonus;

    return {
      sellerId: s.id,
      companyName: s.companyName,
      trustScore: s.trustScore,
      trustBadge: s.trustBadge,
      plan: s.plan,
      matchScore: Math.round(Math.min(100, raw) * 10) / 10,
      responseCount: s.responseCount,
    };
  });

  // Return top 20 by matchScore descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  res.json({ rfqId: id, urgency: rfq.urgency, sellers: scored.slice(0, 20) });
});

// ─── GET /rfqs/:id/recommendations — analysis engine ─────────────────────────

router.get("/rfqs/:id/recommendations", async (req, res): Promise<void> => {
  const sessionUser = req.session?.user;
  if (!sessionUser) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  // Run price estimation and seller fetch in parallel
  const [priceEstimate, sellers] = await Promise.all([
    estimateMarketPrice(rfq.partNumber, rfq.urgency ?? "routine", rfq.condition ?? null),
    fetchActiveSellers(),
  ]);

  // Compute enhanced stats for all fetched sellers in one DB round-trip
  const sellerIds = sellers.map((s) => s.id);
  const statsMap = await computeSellerStats(sellerIds);

  // Score each seller with the full model
  const rankedSellers = sellers
    .map((s) => scoreSellerFull(s, statsMap.get(s.id)!, rfq.urgency ?? "routine"))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);

  // Build auto-quote suggestion
  const autoQuoteSuggestion = buildAutoQuoteSuggestion(
    priceEstimate,
    rankedSellers,
    rfq.urgency ?? "routine",
    rfq.condition ?? null,
  );

  res.json({
    rfqId: id,
    urgency: rfq.urgency,
    priceEstimate,
    rankedSellers,
    autoQuoteSuggestion,
  });
});

export default router;
