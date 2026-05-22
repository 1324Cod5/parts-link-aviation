import { Router, type IRouter } from "express";
import { db, usersTable, vendorVerificationRequestsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

function requireSeller(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function serializeRequest(r: any, seller?: any) {
  return {
    id: r.id,
    sellerId: r.sellerId,
    status: r.status,
    certificationUrl: r.certificationUrl ?? null,
    businessName: r.businessName ?? null,
    notes: r.notes ?? null,
    reviewedBy: r.reviewedBy ?? null,
    reviewNote: r.reviewNote ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : (r.reviewedAt ?? null),
    seller: seller
      ? {
          id: seller.id,
          companyName: seller.companyName,
          email: seller.email,
          country: seller.country ?? null,
          sellerType: seller.sellerType ?? "private",
          plan: seller.plan,
          trustBadge: seller.trustBadge,
        }
      : undefined,
  };
}

// ─── Seller: get own verification request status ──────────────────────────────

router.get("/seller/vendor-verification", requireSeller, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const [request] = await db
    .select()
    .from(vendorVerificationRequestsTable)
    .where(eq(vendorVerificationRequestsTable.sellerId, userId))
    .orderBy(desc(vendorVerificationRequestsTable.createdAt))
    .limit(1);

  if (!request) {
    res.json(null);
    return;
  }

  res.json(serializeRequest(request));
});

// ─── Seller: submit verification request ─────────────────────────────────────

const SubmitVerifSchema = z.object({
  certificationUrl: z.string().url().optional(),
  businessName: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
});

router.post("/seller/vendor-verification", requireSeller, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  // Check existing pending request
  const [existing] = await db
    .select({ id: vendorVerificationRequestsTable.id, status: vendorVerificationRequestsTable.status })
    .from(vendorVerificationRequestsTable)
    .where(
      and(
        eq(vendorVerificationRequestsTable.sellerId, userId),
        eq(vendorVerificationRequestsTable.status, "pending"),
      ),
    );

  if (existing) {
    res.status(409).json({ error: "A pending verification request already exists" });
    return;
  }

  const parsed = SubmitVerifSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const [inserted] = await db
    .insert(vendorVerificationRequestsTable)
    .values({
      sellerId: userId,
      status: "pending",
      certificationUrl: parsed.data.certificationUrl ?? null,
      businessName: parsed.data.businessName,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(serializeRequest(inserted));
});

// ─── Admin: list all verification requests ───────────────────────────────────

router.get("/admin/vendor-verification", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      request: vendorVerificationRequestsTable,
      seller: usersTable,
    })
    .from(vendorVerificationRequestsTable)
    .leftJoin(usersTable, eq(vendorVerificationRequestsTable.sellerId, usersTable.id))
    .orderBy(desc(vendorVerificationRequestsTable.createdAt));

  const pending = rows.filter(r => r.request.status === "pending").map(r => serializeRequest(r.request, r.seller));
  const reviewed = rows.filter(r => r.request.status !== "pending").map(r => serializeRequest(r.request, r.seller));

  res.json({
    total: rows.length,
    pendingCount: pending.length,
    requests: [...pending, ...reviewed],
  });
});

// ─── Admin: approve ───────────────────────────────────────────────────────────

router.post("/admin/vendor-verification/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.session!.userId!;
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(vendorVerificationRequestsTable)
    .where(eq(vendorVerificationRequestsTable.id, requestId));

  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  const { reviewNote } = req.body ?? {};

  await db
    .update(vendorVerificationRequestsTable)
    .set({
      status: "approved",
      reviewedBy: adminId,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(vendorVerificationRequestsTable.id, requestId));

  // Promote seller to verified_vendor
  await db
    .update(usersTable)
    .set({ sellerType: "verified_vendor" })
    .where(eq(usersTable.id, request.sellerId));

  res.json({ success: true, sellerId: request.sellerId, sellerType: "verified_vendor" });
});

// ─── Admin: reject ────────────────────────────────────────────────────────────

router.post("/admin/vendor-verification/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.session!.userId!;
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(vendorVerificationRequestsTable)
    .where(eq(vendorVerificationRequestsTable.id, requestId));

  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  const { reviewNote } = req.body ?? {};

  await db
    .update(vendorVerificationRequestsTable)
    .set({
      status: "rejected",
      reviewedBy: adminId,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(vendorVerificationRequestsTable.id, requestId));

  res.json({ success: true, sellerId: request.sellerId });
});

export default router;
