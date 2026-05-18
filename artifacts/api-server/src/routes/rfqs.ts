import { Router, type IRouter } from "express";
import { db, rfqsTable, rfqResponsesTable, usersTable, listingsTable } from "@workspace/db";
import { eq, desc, like, or, count, and } from "drizzle-orm";
import { CreateRfqBody, CreateRfqResponseBody } from "@workspace/api-zod";
import { resolveEffectivePlan, FULL_ACCESS_PLANS } from "../lib/planEnforcement";

const router: IRouter = Router();

async function callerEffectivePlan(userId: number | undefined): Promise<string> {
  if (!userId) return "anonymous";
  return resolveEffectivePlan(userId);
}

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
    urgency: rfq.urgency ?? "standard",
    urgencyReason: rfq.urgencyReason ?? null,
    accessLevel,
    createdAt: rfq.createdAt?.toISOString?.() ?? rfq.createdAt,
    updatedAt: rfq.updatedAt?.toISOString?.() ?? rfq.updatedAt,
  };
}

// GET /rfqs
router.get("/rfqs", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;

  const conditions: any[] = [];
  if (status === "open" || status === "closed") conditions.push(eq(rfqsTable.status, status));
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

  // AOG RFQs surface first within each status group
  const [rows, [countRow]] = await Promise.all([
    db.select().from(rfqsTable).where(where)
      .orderBy(rfqsTable.urgency, desc(rfqsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: count() }).from(rfqsTable).where(where),
  ]);

  const plan = await callerEffectivePlan(req.session?.userId);
  const accessLevel: "full" | "limited" = FULL_ACCESS_PLANS.has(plan) ? "full" : "limited";

  res.json({
    rfqs: rows.map((r) => serializeRfq(r, accessLevel)),
    total: Number(countRow.count),
    page,
    limit,
    accessLevel,
  });
});

// POST /rfqs — public, no auth required
router.post("/rfqs", async (req, res): Promise<void> => {
  const parsed = CreateRfqBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data;

  // Validate: AOG requires urgency reason
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
      urgency: (data.urgency as any) ?? "standard",
      urgencyReason: data.urgency === "aog" ? (data.urgencyReason ?? null) : null,
    })
    .returning();

  const serialized = serializeRfq(rfq, "full");

  // AOG escalation — attach priority flag so client can show elevated notification
  if (rfq.urgency === "aog") {
    res.status(201).json({ ...serialized, _aogEscalation: true });
    return;
  }

  res.status(201).json(serialized);
});

// GET /rfqs/:id
router.get("/rfqs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const plan = await callerEffectivePlan(req.session?.userId);
  const accessLevel: "full" | "limited" = FULL_ACCESS_PLANS.has(plan) ? "full" : "limited";

  const rawResponses = await db
    .select({
      id: rfqResponsesTable.id,
      rfqId: rfqResponsesTable.rfqId,
      sellerId: rfqResponsesTable.sellerId,
      message: rfqResponsesTable.message,
      listingId: rfqResponsesTable.listingId,
      createdAt: rfqResponsesTable.createdAt,
      sellerCompanyName: usersTable.companyName,
      listingPartNumber: listingsTable.partNumber,
    })
    .from(rfqResponsesTable)
    .leftJoin(usersTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .leftJoin(listingsTable, eq(rfqResponsesTable.listingId, listingsTable.id))
    .where(eq(rfqResponsesTable.rfqId, id))
    .orderBy(desc(rfqResponsesTable.createdAt));

  const responses = rawResponses.map((r) => ({
    id: r.id,
    rfqId: r.rfqId,
    sellerId: r.sellerId,
    message: r.message,
    listingId: r.listingId ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    sellerCompanyName: r.sellerCompanyName ?? "",
    listingPartNumber: r.listingPartNumber ?? null,
  }));

  res.json({ rfq: serializeRfq(rfq, accessLevel), responses });
});

// POST /rfqs/:id/close
router.post("/rfqs/:id/close", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db
    .update(rfqsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(rfqsTable.id, id))
    .returning();

  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
  res.json(serializeRfq(rfq, "full"));
});

// POST /rfqs/:id/responses — Pro/Enterprise/Premium MRO only
router.post("/rfqs/:id/responses", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const plan = await callerEffectivePlan(userId);
  if (!FULL_ACCESS_PLANS.has(plan)) {
    res.status(402).json({
      error: "Responding to RFQs requires a Pro, Enterprise, or Premium MRO plan. Upgrade to unlock full buyer contact details and the ability to respond.",
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
  if (rfq.status === "closed") { res.status(400).json({ error: "This RFQ is closed" }); return; }

  const parsed = CreateRfqResponseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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

  res.status(201).json({
    id: response.id,
    rfqId: response.rfqId,
    sellerId: response.sellerId,
    message: response.message,
    listingId: response.listingId ?? null,
    createdAt: response.createdAt?.toISOString?.() ?? response.createdAt,
    sellerCompanyName: seller?.companyName ?? "",
    listingPartNumber,
  });
});

export default router;
