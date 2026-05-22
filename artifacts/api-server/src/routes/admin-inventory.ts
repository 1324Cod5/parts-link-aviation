import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable, listingAuditLogsTable } from "@workspace/db";
import { eq, and, or, ilike, count, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { recomputeAndSave } from "../lib/trustScore";

const router: IRouter = Router();

// ─── Auth guard ───────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

function requireAdmin(req: any, res: any): boolean {
  const user = req.session?.user;
  if (!user || !ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// ─── Audit writer ─────────────────────────────────────────────────────────────

function toNum(v: string | number): number {
  return typeof v === "number" ? v : parseInt(v, 10);
}

async function writeAudit(
  listingId: number,
  adminId: string | number,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(listingAuditLogsTable).values({
    listingId,
    adminId: toNum(adminId),
    action,
    metadata: metadata ?? null,
  });
}

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeListing(listing: any, seller: any) {
  return {
    id: listing.id,
    partNumber: listing.partNumber,
    description: listing.description,
    aircraftApplicability: listing.aircraftApplicability ?? null,
    manufacturer: listing.manufacturer,
    condition: listing.condition,
    saleType: listing.saleType,
    quantity: listing.quantity,
    price: listing.price ? parseFloat(listing.price) : null,
    certificationDocs: listing.certificationDocs ?? [],
    photos: listing.photos ?? [],
    traceHistory: listing.traceHistory ?? null,
    badge: listing.badge,
    status: listing.status,
    featured: listing.featured ?? false,
    deletedAt: listing.deletedAt ? listing.deletedAt.toISOString() : null,
    deletedBy: listing.deletedBy ?? null,
    sellerId: listing.sellerId,
    seller: seller
      ? {
          id: seller.id,
          companyName: seller.companyName,
          contactName: seller.contactName,
          email: seller.email,
          plan: seller.plan,
          trustScore: seller.trustScore ?? 0,
          trustBadge: seller.trustBadge ?? "unverified",
        }
      : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

// ─── Input schemas ────────────────────────────────────────────────────────────

const AdminListingInput = z.object({
  sellerId:             z.number().int().positive(),
  partNumber:           z.string().min(1),
  description:          z.string().min(1),
  manufacturer:         z.string().min(1),
  condition:            z.enum(["new", "overhauled", "serviceable", "as_removed", "repaired"]),
  saleType:             z.enum(["outright", "exchange", "both"]),
  quantity:             z.number().int().positive().default(1),
  price:                z.number().positive().optional().nullable(),
  aircraftApplicability:z.string().optional().nullable(),
  certificationDocs:    z.array(z.string()).optional().default([]),
  photos:               z.array(z.string()).optional().default([]),
  traceHistory:         z.string().optional().nullable(),
  badge:                z.enum(["pending_verification", "documentation_reviewed", "verified"]).optional(),
  featured:             z.boolean().optional().default(false),
});

const AdminListingUpdate = AdminListingInput.omit({ sellerId: true }).partial();

const SuspendBody = z.object({
  reason: z.string().optional(),
});

// ─── GET /admin/inventory ─────────────────────────────────────────────────────

router.get("/admin/inventory", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const page   = Math.max(1, parseInt(String(req.query.page  ?? "1")));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const badge  = req.query.badge  as string | undefined;
  const q      = req.query.q      as string | undefined;
  const featured = req.query.featured as string | undefined;

  const conditions: any[] = [];
  if (status) conditions.push(eq(listingsTable.status, status as any));
  if (badge)  conditions.push(eq(listingsTable.badge, badge as any));
  if (featured === "true") conditions.push(eq(listingsTable.featured, true));
  if (q) {
    conditions.push(or(
      ilike(listingsTable.partNumber, `%${q}%`),
      ilike(listingsTable.description, `%${q}%`),
      ilike(listingsTable.manufacturer, `%${q}%`),
    ));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ count: count() }).from(listingsTable).where(where);

  const rows = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(where)
    .orderBy(desc(listingsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Status counts for filter UI
  const statusCounts = await db
    .select({ status: listingsTable.status, n: count() })
    .from(listingsTable)
    .groupBy(listingsTable.status);

  res.json({
    listings: rows.map((r) => serializeListing(r.listing, r.seller)),
    total: Number(totalRow?.count ?? 0),
    page,
    limit,
    statusCounts: Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.n)])),
  });
});

// ─── GET /admin/inventory/:id ────────────────────────────────────────────────

router.get("/admin/inventory/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select({ listing: listingsTable, seller: usersTable })
    .from(listingsTable)
    .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(eq(listingsTable.id, id));

  if (!row) { res.status(404).json({ error: "Listing not found" }); return; }

  res.json(serializeListing(row.listing, row.seller));
});

// ─── POST /admin/inventory ────────────────────────────────────────────────────

router.post("/admin/inventory", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const parsed = AdminListingInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;

  const [listing] = await db
    .insert(listingsTable)
    .values({
      partNumber:            d.partNumber,
      description:           d.description,
      manufacturer:          d.manufacturer,
      condition:             d.condition as any,
      saleType:              d.saleType as any,
      quantity:              d.quantity,
      price:                 d.price != null ? String(d.price) : null,
      aircraftApplicability: d.aircraftApplicability ?? null,
      certificationDocs:     d.certificationDocs ?? [],
      photos:                d.photos ?? [],
      traceHistory:          d.traceHistory ?? null,
      badge:                 (d.badge ?? "pending_verification") as any,
      featured:              d.featured ?? false,
      sellerId:              d.sellerId,
    })
    .returning();

  await writeAudit(listing.id, admin.id, "create", { partNumber: d.partNumber, sellerId: d.sellerId });

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, listing.sellerId));
  res.status(201).json(serializeListing(listing, seller));
});

// ─── PATCH /admin/inventory/:id ──────────────────────────────────────────────

router.patch("/admin/inventory/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminListingUpdate.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;

  const updateData: any = { updatedAt: new Date() };
  if (d.partNumber           !== undefined) updateData.partNumber           = d.partNumber;
  if (d.description          !== undefined) updateData.description          = d.description;
  if (d.manufacturer         !== undefined) updateData.manufacturer         = d.manufacturer;
  if (d.condition            !== undefined) updateData.condition            = d.condition;
  if (d.saleType             !== undefined) updateData.saleType             = d.saleType;
  if (d.quantity             !== undefined) updateData.quantity             = d.quantity;
  if (d.price                !== undefined) updateData.price                = d.price != null ? String(d.price) : null;
  if (d.aircraftApplicability!== undefined) updateData.aircraftApplicability= d.aircraftApplicability;
  if (d.certificationDocs    !== undefined) updateData.certificationDocs    = d.certificationDocs;
  if (d.photos               !== undefined) updateData.photos               = d.photos;
  if (d.traceHistory         !== undefined) updateData.traceHistory         = d.traceHistory;
  if (d.badge                !== undefined) updateData.badge                = d.badge;
  if (d.featured             !== undefined) updateData.featured             = d.featured;

  const [updated] = await db
    .update(listingsTable)
    .set(updateData)
    .where(eq(listingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }

  await writeAudit(id, admin.id, "edit", { fields: Object.keys(d) });

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  res.json(serializeListing(updated, seller));
});

// ─── POST /admin/inventory/:id/suspend ───────────────────────────────────────

router.post("/admin/inventory/:id/suspend", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SuspendBody.safeParse(req.body);
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;

  const [updated] = await db
    .update(listingsTable)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(and(
      eq(listingsTable.id, id),
      sql`${listingsTable.status} NOT IN ('deleted', 'removed')`,
    ))
    .returning();

  if (!updated) { res.status(404).json({ error: "Listing not found or already deleted" }); return; }

  await writeAudit(id, admin.id, "suspend", reason ? { reason } : undefined);

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated.sellerId));
  res.json(serializeListing(updated, seller));
});

// ─── POST /admin/inventory/:id/restore ───────────────────────────────────────

router.post("/admin/inventory/:id/restore", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (existing.status === "deleted" || existing.status === "removed") {
    res.status(400).json({ error: "Cannot restore a deleted listing" });
    return;
  }

  const [updated] = await db
    .update(listingsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(listingsTable.id, id))
    .returning();

  await writeAudit(id, admin.id, "restore");
  void recomputeAndSave(updated!.sellerId);

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated!.sellerId));
  res.json(serializeListing(updated, seller));
});

// ─── DELETE /admin/inventory/:id — soft delete ────────────────────────────────

router.delete("/admin/inventory/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(listingsTable)
    .set({
      status:    "deleted",
      deletedAt: new Date(),
      deletedBy: toNum(admin.id),
      updatedAt: new Date(),
    })
    .where(eq(listingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Listing not found" }); return; }

  await writeAudit(id, admin.id, "delete");
  void recomputeAndSave(updated.sellerId);

  res.json({ ok: true });
});

// ─── PATCH /admin/inventory/:id/feature ──────────────────────────────────────

router.patch("/admin/inventory/:id/feature", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const admin = req.session.user!;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }

  const newFeatured = !existing.featured;

  const [updated] = await db
    .update(listingsTable)
    .set({ featured: newFeatured, updatedAt: new Date() })
    .where(eq(listingsTable.id, id))
    .returning();

  await writeAudit(id, admin.id, newFeatured ? "feature" : "unfeature");

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, updated!.sellerId));
  res.json(serializeListing(updated, seller));
});

// ─── GET /admin/inventory/:id/audit ──────────────────────────────────────────

router.get("/admin/inventory/:id/audit", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const logs = await db
    .select({
      id:          listingAuditLogsTable.id,
      action:      listingAuditLogsTable.action,
      metadata:    listingAuditLogsTable.metadata,
      createdAt:   listingAuditLogsTable.createdAt,
      adminId:     listingAuditLogsTable.adminId,
      adminEmail:  usersTable.email,
      adminName:   usersTable.contactName,
    })
    .from(listingAuditLogsTable)
    .leftJoin(usersTable, eq(listingAuditLogsTable.adminId, usersTable.id))
    .where(eq(listingAuditLogsTable.listingId, id))
    .orderBy(desc(listingAuditLogsTable.createdAt));

  res.json(logs.map((l) => ({
    id:        l.id,
    action:    l.action,
    metadata:  l.metadata,
    createdAt: l.createdAt.toISOString(),
    admin: {
      id:    l.adminId,
      email: l.adminEmail ?? null,
      name:  l.adminName ?? null,
    },
  })));
});

export default router;
