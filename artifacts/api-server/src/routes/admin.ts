import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable, inquiriesTable, mroProfilesTable, listingAuditLogsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { GetAdminListingsQueryParams, AdminRemoveListingParams } from "@workspace/api-zod";
import { recomputeAndSave } from "../lib/trustScore";

const router: IRouter = Router();

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

// ── Admin auth guard ─────────────────────────────────────────────────────────
router.use("/admin", async (_req, res, next) => {
  const userId: number | undefined = (_req as any).session?.userId;
  const sessionUser = (_req as any).session?.user;

  // No session at all
  if (!userId && !sessionUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // If we have a session.user object (form login), check role directly
  if (sessionUser) {
    const role: string = sessionUser.activeRole ?? sessionUser.role ?? "";
    if (!ADMIN_ROLES.has(role)) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
    return;
  }

  // JSON login path: only userId in session — do a DB lookup
  try {
    const [found] = await db.select({ role: usersTable.role, activeRole: usersTable.activeRole })
      .from(usersTable).where(eq(usersTable.id, userId!)).limit(1);
    if (!found || !ADMIN_ROLES.has(found.activeRole ?? found.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  next();
});

// ── In-memory admin activity log ────────────────────────────────────────────
interface ActivityEntry {
  id: number;
  timestamp: string;
  actionType: string;
  target: string;
  reason: string | null;
  adminEmail: string;
}

const activityLog: ActivityEntry[] = [];
let activityCounter = 0;

function logActivity(actionType: string, target: string, adminEmail: string, reason?: string) {
  activityLog.unshift({
    id: ++activityCounter,
    timestamp: new Date().toISOString(),
    actionType,
    target,
    reason: reason ?? null,
    adminEmail,
  });
  if (activityLog.length > 200) activityLog.pop();
}

// ── In-memory seller strikes ─────────────────────────────────────────────────
const sellerStrikes: Record<number, number> = {};

// ── Serializers ──────────────────────────────────────────────────────────────
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
    certType: listing.certType ?? "None",
    certDocId: listing.certDocId ?? null,
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
    trustScore: seller.trustScore ?? 0,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

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

  const adminEmail = req.session?.user?.email ?? "admin";
  logActivity("remove_listing", `Listing #${updated.id} (${updated.partNumber})`, adminEmail);

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
      const ids = listingIds.map(l => l.id);
      const [inquiriesRow] = await db.select({ count: count() })
        .from(inquiriesTable)
        .where(inArray(inquiriesTable.listingId, ids));
      totalInquiriesCount = Number(inquiriesRow?.count ?? 0);
    }

    return serializeSeller(seller, Number(activeListingsRow?.count ?? 0), totalInquiriesCount);
  }));

  res.json(result);
});

router.patch("/admin/sellers/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { status, reason } = req.body as { status: string; reason?: string };

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

  const adminEmail = req.session?.user?.email ?? "admin";
  const actionType = status === "suspended" ? "suspend_seller" : "activate_seller";
  logActivity(actionType, `${updated.companyName} (${updated.email})`, adminEmail, reason);

  const [activeListingsRow] = await db.select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, updated.id), eq(listingsTable.status, "active")));

  res.json(serializeSeller(updated, Number(activeListingsRow?.count ?? 0), 0));
});

router.patch("/admin/sellers/:id/plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { plan } = req.body as { plan: string };

  if (!["free", "pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"].includes(plan)) {
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

  const adminEmail = req.session?.user?.email ?? "admin";
  logActivity("update_plan", `${updated.companyName} → ${plan}`, adminEmail);

  const [activeListingsRow] = await db.select({ count: count() })
    .from(listingsTable)
    .where(and(eq(listingsTable.sellerId, updated.id), eq(listingsTable.status, "active")));

  res.json(serializeSeller(updated, Number(activeListingsRow?.count ?? 0), 0));
});

router.post("/admin/sellers/:id/warn", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { reason, strike } = req.body as { reason: string; strike?: number };

  if (!reason) {
    res.status(400).json({ error: "Reason is required" });
    return;
  }

  const [seller] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "seller")));

  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const newStrikeCount = Math.min(3, strike ?? (sellerStrikes[id] ?? 0) + 1);
  sellerStrikes[id] = newStrikeCount;

  const adminEmail = req.session?.user?.email ?? "admin";
  logActivity(`warn_seller_strike_${newStrikeCount}`, `${seller.companyName} (${seller.email})`, adminEmail, reason);

  res.json({ success: true, strikeCount: newStrikeCount });
});

router.get("/admin/activity", async (_req, res): Promise<void> => {
  // Supplement in-memory log with recent listing audit log entries
  const auditRows = await db.select({ log: listingAuditLogsTable, listing: listingsTable, admin: usersTable })
    .from(listingAuditLogsTable)
    .leftJoin(listingsTable, eq(listingAuditLogsTable.listingId, listingsTable.id))
    .leftJoin(usersTable, eq(listingAuditLogsTable.adminId, usersTable.id))
    .orderBy(listingAuditLogsTable.createdAt)
    .limit(50);

  const auditEntries: ActivityEntry[] = auditRows.map((r, i) => ({
    id: -(i + 1),
    timestamp: r.log.createdAt?.toISOString() ?? new Date().toISOString(),
    actionType: r.log.action ?? "listing_action",
    target: r.listing ? `${r.listing.partNumber} (Listing #${r.listing.id})` : `Listing #${r.log.listingId}`,
    reason: r.log.metadata ? String(r.log.metadata) : null,
    adminEmail: r.admin?.email ?? "admin",
  }));

  const combined = [...activityLog, ...auditEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);

  res.json(combined);
});


router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Prevent admin from deleting themselves
  const sessionUserId = req.session?.userId ?? parseInt(req.session?.user?.id ?? "0", 10);
  if (sessionUserId === id) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  // Fetch user first
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Delete their listings first (FK constraint)
  await db.delete(listingsTable).where(eq(listingsTable.sellerId, id));

  // Delete MRO profile if any
  await db.delete(mroProfilesTable).where(eq(mroProfilesTable.userId, id));

  // Delete the user
  await db.delete(usersTable).where(eq(usersTable.id, id));

  const adminEmail = req.session?.user?.email ?? "admin";
  logActivity("delete_user", `${user.companyName ?? user.email} (id:${id})`, adminEmail);

  res.json({ ok: true, deleted: { id, email: user.email } });
});

export default router;
