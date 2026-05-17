import { Router, type IRouter } from "express";
import { db, listingsTable, inquiriesTable, usersTable, rfqsTable, rfqResponsesTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";

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
    seller: seller ? {
      id: seller.id,
      companyName: seller.companyName,
      contactName: seller.contactName,
      email: seller.email,
      phone: seller.phone,
      country: seller.country,
    } : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

router.get("/seller/listings", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rows = await db.select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(eq(listingsTable.sellerId, userId))
    .orderBy(listingsTable.createdAt);

  res.json(rows.map(r => serializeListing(r.listing, r.seller)));
});

router.get("/seller/stats", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [totalListings] = await db.select({ count: count() }).from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const [activeListings] = await db.select({ count: count() }).from(listingsTable)
    .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.status, "active")));

  const [verifiedListings] = await db.select({ count: count() }).from(listingsTable)
    .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.badge, "verified")));

  const sellerListings = await db.select({ id: listingsTable.id }).from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const listingIds = sellerListings.map(l => l.id);
  let totalInquiries = 0;
  if (listingIds.length > 0) {
    const [inq] = await db.select({ count: count() }).from(inquiriesTable)
      .where(inArray(inquiriesTable.listingId, listingIds));
    totalInquiries = Number(inq.count);
  }

  const [sellerUser] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const plan = sellerUser?.plan ?? "free";
  const PLAN_LIMITS: Record<string, number | null> = { free: 5, pro: 50, enterprise: null };
  const listingLimit = PLAN_LIMITS[plan];
  const canAddListing = listingLimit === null || Number(activeListings.count) < listingLimit;

  res.json({
    totalListings: Number(totalListings.count),
    activeListings: Number(activeListings.count),
    verifiedListings: Number(verifiedListings.count),
    totalInquiries,
    plan,
    listingLimit,
    canAddListing,
  });
});

// GET /seller/rfqs — RFQ stats for dashboard
router.get("/seller/rfqs", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [[openRow], [myRow]] = await Promise.all([
    db.select({ count: count() }).from(rfqsTable).where(eq(rfqsTable.status, "open")),
    db.select({ count: count() }).from(rfqResponsesTable).where(eq(rfqResponsesTable.sellerId, userId)),
  ]);

  res.json({
    openRfqs: Number(openRow.count),
    myResponses: Number(myRow.count),
  });
});

export default router;
