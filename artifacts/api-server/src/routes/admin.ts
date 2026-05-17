import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable, inquiriesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { GetAdminListingsQueryParams, AdminRemoveListingParams } from "@workspace/api-zod";

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

router.get("/admin/listings", async (req, res): Promise<void> => {
  const parsed = GetAdminListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions: any[] = [];
  if (parsed.data.badge) conditions.push(eq(listingsTable.badge, parsed.data.badge as any));
  if (parsed.data.status) conditions.push(eq(listingsTable.status, parsed.data.status as any));

  const rows = await db.select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(listingsTable.createdAt);

  res.json(rows.map(r => serializeListing(r.listing, r.seller)));
});

router.patch("/admin/listings/:id/remove", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminRemoveListingParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db.update(listingsTable)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(listingsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  res.json(serializeListing(updated, seller));
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [totalListings] = await db.select({ count: count() }).from(listingsTable);
  const [totalSellers] = await db.select({ count: count() }).from(usersTable)
    .where(eq(usersTable.role, "seller"));
  const [pendingVerification] = await db.select({ count: count() }).from(listingsTable)
    .where(eq(listingsTable.badge, "pending_verification"));
  const [totalInquiries] = await db.select({ count: count() }).from(inquiriesTable);

  res.json({
    totalListings: Number(totalListings.count),
    totalSellers: Number(totalSellers.count),
    pendingVerification: Number(pendingVerification.count),
    totalInquiries: Number(totalInquiries.count),
  });
});

export default router;
