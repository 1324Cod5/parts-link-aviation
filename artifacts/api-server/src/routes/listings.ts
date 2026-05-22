import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable, inquiriesTable, listingDocumentsTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, or, count, sql } from "drizzle-orm";
import {
  GetListingsQueryParams,
  GetListingParams,
  UpdateListingParams,
  UpdateListingBody,
  DeleteListingParams,
  UpdateListingBadgeParams,
  UpdateListingBadgeBody,
  GetInquiriesParams,
  CreateInquiryParams,
  CreateInquiryBody,
  CreateListingBody,
} from "@workspace/api-zod";
import { PLAN_LISTING_LIMITS, getEffectivePlan } from "../lib/planEnforcement";
import { recomputeAndSave } from "../lib/trustScore";

const router: IRouter = Router();

// Priority sort: enterprise/mro_premium first, then pro/mro_verified, then free.
// Also respects subscription status — lapsed accounts lose their priority.
const PLAN_ORDER_SQL = sql<number>`
  CASE
    WHEN ${usersTable.subscriptionStatus} IN ('cancelled', 'suspended') THEN 2
    WHEN ${usersTable.subscriptionStatus} = 'past_due'
         AND ${usersTable.gracePeriodEnd} IS NOT NULL
         AND ${usersTable.gracePeriodEnd} < NOW() THEN 2
    WHEN ${usersTable.plan} IN ('enterprise', 'mro_premium') THEN 0
    WHEN ${usersTable.plan} IN ('pro', 'mro_verified') THEN 1
    ELSE 2
  END`;

function serializeDoc(d: any) {
  return {
    id: d.id,
    listingId: d.listingId,
    fileName: d.fileName,
    documentType: d.documentType,
    fileUrl: d.fileUrl,
    verificationStatus: d.verificationStatus,
    reviewNote: d.reviewNote ?? null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

function serializeListing(listing: any, seller: any, documents?: any[]) {
  return {
    id: listing.id,
    partNumber: listing.partNumber,
    description: listing.description,
    aircraftApplicability: listing.aircraftApplicability,
    manufacturer: listing.manufacturer,
    condition: listing.condition,
    saleType: listing.saleType,
    quantity: listing.quantity,
    price: listing.price ? parseFloat(listing.price) : null,
    certificationDocs: listing.certificationDocs ?? [],
    photos: listing.photos ?? [],
    documents: documents ? documents.map(serializeDoc) : [],
    traceHistory: listing.traceHistory,
    badge: listing.badge,
    status: listing.status,
    sellerId: listing.sellerId,
    seller: seller
      ? {
          id: seller.id,
          companyName: seller.companyName,
          contactName: seller.contactName,
          email: seller.email,
          phone: seller.phone,
          country: seller.country,
          plan: seller.plan,
          trustScore: seller.trustScore ?? 0,
          trustBadge: seller.trustBadge ?? "unverified",
        }
      : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

router.get("/listings/stats", async (_req, res): Promise<void> => {
  const [totalListings] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.status, "active"));

  const [verifiedSellers] = await db
    .select({ count: sql<number>`count(distinct ${listingsTable.sellerId})` })
    .from(listingsTable)
    .where(and(eq(listingsTable.badge, "verified"), eq(listingsTable.status, "active")));

  const [totalManufacturers] = await db
    .select({ count: sql<number>`count(distinct ${listingsTable.manufacturer})` })
    .from(listingsTable)
    .where(eq(listingsTable.status, "active"));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentListings] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.status, "active"), gte(listingsTable.createdAt, sevenDaysAgo)));

  const byCondition = await db
    .select({ condition: listingsTable.condition, count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.status, "active"))
    .groupBy(listingsTable.condition);

  const byBadge = await db
    .select({ badge: listingsTable.badge, count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.status, "active"))
    .groupBy(listingsTable.badge);

  res.json({
    totalListings: Number(totalListings.count),
    verifiedSellers: Number(verifiedSellers.count),
    totalManufacturers: Number(totalManufacturers.count),
    recentListings: Number(recentListings.count),
    byCondition: byCondition.map((r) => ({ condition: r.condition, count: Number(r.count) })),
    byBadge: byBadge.map((r) => ({ badge: r.badge, count: Number(r.count) })),
  });
});

router.get("/listings/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(and(eq(listingsTable.badge, "verified"), eq(listingsTable.status, "active")))
    .limit(8);

  res.json(rows.map((r) => serializeListing(r.listing, r.seller)));
});

router.get("/listings", async (req, res): Promise<void> => {
  const parsed = GetListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q, aircraft, condition, saleType, manufacturer, badge, minPrice, maxPrice, page, limit } =
    parsed.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  const conditions: any[] = [eq(listingsTable.status, "active")];

  if (q) {
    conditions.push(
      or(
        ilike(listingsTable.partNumber, `%${q}%`),
        ilike(listingsTable.description, `%${q}%`),
        ilike(listingsTable.manufacturer, `%${q}%`),
      ),
    );
  }
  if (aircraft) conditions.push(ilike(listingsTable.aircraftApplicability, `%${aircraft}%`));
  if (condition) conditions.push(eq(listingsTable.condition, condition as any));
  if (saleType) conditions.push(eq(listingsTable.saleType, saleType as any));
  if (manufacturer) conditions.push(ilike(listingsTable.manufacturer, `%${manufacturer}%`));
  if (badge) conditions.push(eq(listingsTable.badge, badge as any));
  if (minPrice != null) conditions.push(gte(listingsTable.price, String(minPrice)));
  if (maxPrice != null) conditions.push(lte(listingsTable.price, String(maxPrice)));

  const whereClause = and(...conditions);

  const [totalResult] = await db
    .select({ count: count() })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(whereClause);

  const rows = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(whereClause)
    .orderBy(PLAN_ORDER_SQL, sql`${listingsTable.createdAt} DESC`)
    .limit(limit ?? 20)
    .offset(offset);

  res.json({
    listings: rows.map((r) => serializeListing(r.listing, r.seller)),
    total: Number(totalResult.count),
    page: page ?? 1,
    limit: limit ?? 20,
  });
});

router.post("/listings", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (seller) {
    const effectivePlan = getEffectivePlan(seller);
    const limit = PLAN_LISTING_LIMITS[effectivePlan] ?? 5;
    if (limit !== null) {
      const [activeRow] = await db
        .select({ count: count() })
        .from(listingsTable)
        .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.status, "active")));
      const activeListings = Number(activeRow.count);
      if (activeListings >= limit) {
        res.status(402).json({
          error: `You have reached the ${limit}-listing limit for your ${effectivePlan} plan. Upgrade to add more listings.`,
          plan: effectivePlan,
          activeListings,
          listingLimit: limit,
          upgradeUrl: "/seller/subscription",
        });
        return;
      }
    }
  }

  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [listing] = await db
    .insert(listingsTable)
    .values({
      ...parsed.data,
      price: parsed.data.price != null ? String(parsed.data.price) : null,
      sellerId: userId,
      certificationDocs: parsed.data.certificationDocs ?? [],
      photos: parsed.data.photos ?? [],
    })
    .returning();

  // Create document records if provided
  const rawDocs = (req.body as any).documents as any[] | undefined;
  if (Array.isArray(rawDocs) && rawDocs.length > 0) {
    const toInsert = rawDocs.slice(0, 10).filter((d: any) => d?.fileUrl);
    if (toInsert.length > 0) {
      await db.insert(listingDocumentsTable).values(
        toInsert.map((d: any) => ({
          listingId: listing.id,
          fileName: d.fileName ?? "document",
          documentType: d.documentType ?? "other",
          fileUrl: d.fileUrl,
        })),
      );
    }
  }

  const documents = await db
    .select()
    .from(listingDocumentsTable)
    .where(eq(listingDocumentsTable.listingId, listing.id))
    .orderBy(listingDocumentsTable.createdAt);

  void recomputeAndSave(userId);
  res.status(201).json(serializeListing(listing, seller, documents));
});

router.get("/listings/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetListingParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(eq(listingsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const documents = await db
    .select()
    .from(listingDocumentsTable)
    .where(eq(listingDocumentsTable.listingId, params.data.id))
    .orderBy(listingDocumentsTable.createdAt);

  res.json(serializeListing(row.listing, row.seller, documents));
});

router.patch("/listings/:id", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateListingParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateListingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (existing.sellerId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.price != null) updateData.price = String(parsed.data.price);
  delete updateData.documents;

  const [updated] = await db
    .update(listingsTable)
    .set(updateData)
    .where(eq(listingsTable.id, params.data.id))
    .returning();

  // Replace documents if provided
  const rawDocs = (req.body as any).documents as any[] | undefined;
  if (Array.isArray(rawDocs)) {
    await db.delete(listingDocumentsTable).where(eq(listingDocumentsTable.listingId, params.data.id));
    const toInsert = rawDocs.slice(0, 10).filter((d: any) => d?.fileUrl);
    if (toInsert.length > 0) {
      await db.insert(listingDocumentsTable).values(
        toInsert.map((d: any) => ({
          listingId: params.data.id,
          fileName: d.fileName ?? "document",
          documentType: d.documentType ?? "other",
          fileUrl: d.fileUrl,
        })),
      );
    }
  }

  const documents = await db
    .select()
    .from(listingDocumentsTable)
    .where(eq(listingDocumentsTable.listingId, params.data.id))
    .orderBy(listingDocumentsTable.createdAt);

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  void recomputeAndSave(updated.sellerId);
  res.json(serializeListing(updated, seller, documents));
});

router.delete("/listings/:id", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteListingParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (existing.sellerId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(listingsTable).where(eq(listingsTable.id, params.data.id));
  void recomputeAndSave(existing.sellerId);
  res.sendStatus(204);
});

router.patch("/listings/:id/badge", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateListingBadgeParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateListingBadgeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(listingsTable)
    .set({ badge: parsed.data.badge, updatedAt: new Date() })
    .where(eq(listingsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  void recomputeAndSave(updated.sellerId);
  res.json(serializeListing(updated, seller));
});

router.get("/listings/:id/inquiries", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetInquiriesParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const inquiries = await db
    .select()
    .from(inquiriesTable)
    .where(eq(inquiriesTable.listingId, params.data.id))
    .orderBy(inquiriesTable.createdAt);

  res.json(inquiries.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })));
});

router.post("/listings/:id/inquiries", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateInquiryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CreateInquiryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [inquiry] = await db
    .insert(inquiriesTable)
    .values({ listingId: params.data.id, ...parsed.data })
    .returning();

  res.status(201).json({ ...inquiry, createdAt: inquiry.createdAt.toISOString() });
});

export default router;
