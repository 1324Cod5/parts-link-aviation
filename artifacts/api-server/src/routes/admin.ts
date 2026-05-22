import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable, inquiriesTable, mroProfilesTable, listingAuditLogsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { GetAdminListingsQueryParams, AdminRemoveListingParams } from "@workspace/api-zod";
import { recomputeAndSave } from "../lib/trustScore";

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
      trustScore: seller.trustScore ?? 0,
      trustBadge: seller.trustBadge ?? "unverified",
    } : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

function serializeSeller(seller: any, activeListings: number, totalInquiries: number) {
  return {
    id: seller.id,
    email: seller.email,
    companyName: seller.companyName,
    contactName: seller.contactName,
    phone: seller.phone ?? null,
    country: seller.country ?? null,
    plan: seller.plan,
    planExpiresAt: seller.planExpiresAt ? seller.planExpiresAt.toISOString() : null,
    status: seller.status ?? "active",
    createdAt: seller.createdAt.toISOString(),
    activeListings,
    totalInquiries,
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

router.get("/admin/listings/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(eq(listingsTable.id, id));

  if (!rows.length) { res.status(404).json({ error: "Listing not found" }); return; }

  res.json(serializeListing(rows[0].listing, rows[0].seller));
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

  const adminId = req.session?.user?.id;
  if (adminId) {
    await db.insert(listingAuditLogsTable).values({
      listingId: updated.id,
      adminId: parseInt(String(adminId), 10),
      action: "remove",
    });
  }

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  void recomputeAndSave(updated.sellerId);
  res.json(serializeListing(updated, seller));
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [totalListings] = await db.select({ count: count() }).from(listingsTable);
  const [totalSellers] = await db.select({ count: count() }).from(usersTable)
    .where(eq(usersTable.role, "seller"));
  const [activeSellers] = await db.select({ count: count() }).from(usersTable)
    .where(and(eq(usersTable.role, "seller"), eq(usersTable.status, "active")));
  const [suspendedSellers] = await db.select({ count: count() }).from(usersTable)
    .where(and(eq(usersTable.role, "seller"), eq(usersTable.status, "suspended")));
  const [pendingVerification] = await db.select({ count: count() }).from(listingsTable)
    .where(eq(listingsTable.badge, "pending_verification"));
  const [totalInquiries] = await db.select({ count: count() }).from(inquiriesTable);
  const [totalMroRow] = await db.select({ count: count() }).from(mroProfilesTable);

  res.json({
    totalListings: Number(totalListings.count),
    totalSellers: Number(totalSellers.count),
    activeSellers: Number(activeSellers.count),
    suspendedSellers: Number(suspendedSellers.count),
    pendingVerification: Number(pendingVerification.count),
    totalInquiries: Number(totalInquiries.count),
    openRfqs: 0,
    totalMro: Number(totalMroRow.count),
  });
});

router.get("/admin/sellers", async (_req, res): Promise<void> => {
  const sellers = await db.select().from(usersTable).where(eq(usersTable.role, "seller"));

  const result = await Promise.all(sellers.map(async (seller) => {
    const [activeListingsRow] = await db.select({ count: count() })
      .from(listingsTable)
      .where(and(eq(listingsTable.sellerId, seller.id), eq(listingsTable.status, "active")));

    const listingIds = await db.select({ id: listingsTable.id })
      .from(listingsTable)
      .where(eq(listingsTable.sellerId, seller.id));

    let totalInquiriesCount = 0;
    if (listingIds.length > 0) {
      const [inquiriesRow] = await db.select({ count: count() })
        .from(inquiriesTable)
        .where(sql`${inquiriesTable.listingId} = ANY(${listingIds.map(l => l.id)})`);
      totalInquiriesCount = Number(inquiriesRow?.count ?? 0);
    }

    return serializeSeller(seller, Number(activeListingsRow?.count ?? 0), totalInquiriesCount);
  }));

  res.json(result);
});

router.patch("/admin/sellers/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { status } = req.body as { status: string };

  if (!["active", "suspended"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ status: status as any, updatedAt: new Date() })
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "seller")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const [activeListingsRow] = await db.select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, updated.id), eq(listingsTable.status, "active")));

  res.json(serializeSeller(updated, Number(activeListingsRow?.count ?? 0), 0));
});

router.patch("/admin/sellers/:id/plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { plan } = req.body as { plan: string };

  if (!["free", "pro", "enterprise"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ plan: plan as any, updatedAt: new Date() })
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "seller")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const [activeListingsRow] = await db.select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, updated.id), eq(listingsTable.status, "active")));

  res.json(serializeSeller(updated, Number(activeListingsRow?.count ?? 0), 0));
});

export default router;
