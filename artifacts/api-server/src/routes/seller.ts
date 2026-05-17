import { Router, type IRouter } from "express";
import { db, listingsTable, inquiriesTable, usersTable, rfqsTable, rfqResponsesTable } from "@workspace/db";
import { eq, and, count, inArray, gte, sql } from "drizzle-orm";
import { resolveEffectivePlan, PLAN_LISTING_LIMITS, FULL_ACCESS_PLANS } from "../lib/planEnforcement";

const router: IRouter = Router();

function serializeListing(listing: any, seller: any) {
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
        }
      : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

router.get("/seller/listings", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rows = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(eq(listingsTable.sellerId, userId))
    .orderBy(listingsTable.createdAt);

  res.json(rows.map((r) => serializeListing(r.listing, r.seller)));
});

router.get("/seller/stats", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [totalListings] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const [activeListings] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.status, "active")));

  const [verifiedListings] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.badge, "verified")));

  const sellerListings = await db
    .select({ id: listingsTable.id })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const listingIds = sellerListings.map((l) => l.id);
  let totalInquiries = 0;
  if (listingIds.length > 0) {
    const [inq] = await db
      .select({ count: count() })
      .from(inquiriesTable)
      .where(inArray(inquiriesTable.listingId, listingIds));
    totalInquiries = Number(inq.count);
  }

  const effectivePlan = await resolveEffectivePlan(userId);
  const listingLimit = PLAN_LISTING_LIMITS[effectivePlan] ?? 5;
  const canAddListing = listingLimit === null || Number(activeListings.count) < listingLimit;

  res.json({
    totalListings: Number(totalListings.count),
    activeListings: Number(activeListings.count),
    verifiedListings: Number(verifiedListings.count),
    totalInquiries,
    plan: effectivePlan,
    listingLimit,
    canAddListing,
  });
});

// GET /seller/analytics — Pro, Enterprise, and Premium MRO only
router.get("/seller/analytics", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const effectivePlan = await resolveEffectivePlan(userId);

  if (!FULL_ACCESS_PLANS.has(effectivePlan)) {
    res.status(402).json({
      error: "Analytics require a Pro, Enterprise, or Premium MRO plan. Upgrade to unlock inquiry trends, top-performing parts, and RFQ metrics.",
      plan: effectivePlan,
      requiredPlan: "pro",
      upgradeUrl: "/seller/subscription",
    });
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sellerListings = await db
    .select({ id: listingsTable.id, partNumber: listingsTable.partNumber, description: listingsTable.description })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const listingIds = sellerListings.map((l) => l.id);

  let inquiryTrend: { date: string; count: number }[] = [];
  let topListings: { listingId: number; partNumber: string; description: string; inquiries: number }[] = [];

  if (listingIds.length > 0) {
    const rawTrend = await db
      .select({
        date: sql<string>`DATE(${inquiriesTable.createdAt})::text`,
        count: count(),
      })
      .from(inquiriesTable)
      .where(and(inArray(inquiriesTable.listingId, listingIds), gte(inquiriesTable.createdAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${inquiriesTable.createdAt})`)
      .orderBy(sql`DATE(${inquiriesTable.createdAt})`);

    inquiryTrend = rawTrend.map((r) => ({ date: r.date, count: Number(r.count) }));

    const rawTop = await db
      .select({ listingId: inquiriesTable.listingId, count: count() })
      .from(inquiriesTable)
      .where(inArray(inquiriesTable.listingId, listingIds))
      .groupBy(inquiriesTable.listingId)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    topListings = rawTop.map((r) => {
      const listing = sellerListings.find((l) => l.id === r.listingId);
      return {
        listingId: r.listingId,
        partNumber: listing?.partNumber ?? "",
        description: listing?.description ?? "",
        inquiries: Number(r.count),
      };
    });
  }

  let rfqResponses = 0;
  let rfqResponseRate = 0;

  // Full RFQ stats available to enterprise and mro_premium
  if (effectivePlan === "enterprise" || effectivePlan === "mro_premium") {
    const [[myResponseRow], [openRfqRow]] = await Promise.all([
      db.select({ count: count() }).from(rfqResponsesTable).where(eq(rfqResponsesTable.sellerId, userId)),
      db.select({ count: count() }).from(rfqsTable).where(eq(rfqsTable.status, "open")),
    ]);
    rfqResponses = Number(myResponseRow.count);
    const openTotal = Number(openRfqRow.count);
    rfqResponseRate = openTotal > 0 ? Math.round((rfqResponses / openTotal) * 100) / 100 : 0;
  }

  res.json({ plan: effectivePlan, inquiryTrend, topListings, rfqResponses, rfqResponseRate });
});

// GET /seller/rfqs — RFQ stats for dashboard
router.get("/seller/rfqs", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [[openRow], [myRow]] = await Promise.all([
    db.select({ count: count() }).from(rfqsTable).where(eq(rfqsTable.status, "open")),
    db.select({ count: count() }).from(rfqResponsesTable).where(eq(rfqResponsesTable.sellerId, userId)),
  ]);

  res.json({ openRfqs: Number(openRow.count), myResponses: Number(myRow.count) });
});

export default router;
