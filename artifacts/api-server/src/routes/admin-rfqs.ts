import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, rfqsTable, rfqAdminActionsTable, usersTable } from "@workspace/db";
import { eq, desc, like, or, and, count } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function requireAdmin(req: any, res: any): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user || !ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user.id;
}

const AdminActionBody = z.object({
  action: z.enum(["close", "archive", "suspend", "reopen", "delete"]),
  reason: z.string().min(1, "Reason is required"),
});

const AdminUrgencyBody = z.object({
  urgency: z.enum(["aog", "critical", "high_priority", "standard", "planned"]),
  urgencyReason: z.string().nullable().optional(),
  reason: z.string().min(1, "Admin reason is required"),
});

const ACTION_STATUS_MAP = {
  close: "closed",
  archive: "archived",
  suspend: "suspended",
  reopen: "open",
  delete: "deleted",
} as const;

const VALID_STATUSES = new Set(["open", "closed", "archived", "suspended", "deleted"]);

function serializeRfq(rfq: any) {
  return {
    id: rfq.id,
    buyerName: rfq.buyerName,
    buyerEmail: rfq.buyerEmail ?? null,
    buyerCompany: rfq.buyerCompany ?? null,
    buyerPhone: rfq.buyerPhone ?? null,
    partNumber: rfq.partNumber,
    description: rfq.description,
    aircraftApplicability: rfq.aircraftApplicability ?? null,
    condition: rfq.condition ?? null,
    quantity: rfq.quantity,
    status: rfq.status,
    urgency: rfq.urgency ?? "standard",
    urgencyReason: rfq.urgencyReason ?? null,
    accessLevel: "full" as const,
    createdAt: rfq.createdAt?.toISOString?.() ?? rfq.createdAt,
    updatedAt: rfq.updatedAt?.toISOString?.() ?? rfq.updatedAt,
  };
}

function serializeAuditEntry(e: any) {
  return {
    id: e.id,
    rfqId: e.rfqId,
    adminId: e.adminId,
    action: e.action,
    reason: e.reason,
    createdAt: e.createdAt?.toISOString?.() ?? e.createdAt,
  };
}

// GET /admin/rfqs — admin: list all RFQs across all statuses
router.get("/admin/rfqs", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;

  const conditions: any[] = [];
  if (status && VALID_STATUSES.has(status)) {
    conditions.push(eq(rfqsTable.status, status as any));
  }
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        like(rfqsTable.partNumber, term),
        like(rfqsTable.description, term),
        like(rfqsTable.buyerName, term),
        like(rfqsTable.buyerCompany, term),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  // AOG items surface first in admin view
  const [rows, [countRow]] = await Promise.all([
    db.select().from(rfqsTable).where(where)
      .orderBy(rfqsTable.urgency, desc(rfqsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: count() }).from(rfqsTable).where(where),
  ]);

  res.json({ rfqs: rows.map(serializeRfq), total: Number(countRow.count), page, limit });
});

// POST /admin/rfqs/:id/action — admin: lifecycle management with audit log
router.post("/admin/rfqs/:id/action", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "action and reason are required" }); return; }

  const { action, reason } = parsed.data as { action: keyof typeof ACTION_STATUS_MAP; reason: string };
  const newStatus = ACTION_STATUS_MAP[action];

  const [rfq] = await db
    .update(rfqsTable)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(eq(rfqsTable.id, id))
    .returning();

  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const [auditEntry] = await db
    .insert(rfqAdminActionsTable)
    .values({ rfqId: id, adminId, action, reason })
    .returning();

  res.json({ rfq: serializeRfq(rfq), auditEntry: serializeAuditEntry(auditEntry) });
});

// PATCH /admin/rfqs/:id/urgency — admin: override urgency classification
router.patch("/admin/rfqs/:id/urgency", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminUrgencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "urgency and reason are required" }); return; }

  const { urgency, urgencyReason, reason } = parsed.data;

  if (urgency === "aog" && !urgencyReason?.trim()) {
    res.status(400).json({ error: "AOG urgency requires an urgency reason." });
    return;
  }

  const [rfq] = await db
    .update(rfqsTable)
    .set({
      urgency: urgency as any,
      urgencyReason: urgency === "aog" ? (urgencyReason ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(rfqsTable.id, id))
    .returning();

  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const [auditEntry] = await db
    .insert(rfqAdminActionsTable)
    .values({
      rfqId: id,
      adminId,
      action: "set_urgency",
      reason: `Urgency set to ${urgency.toUpperCase()}. ${reason}`,
    })
    .returning();

  res.json({ rfq: serializeRfq(rfq), auditEntry: serializeAuditEntry(auditEntry) });
});

// GET /admin/rfqs/:id/audit — admin: full audit trail for one RFQ
router.get("/admin/rfqs/:id/audit", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const entries = await db
    .select()
    .from(rfqAdminActionsTable)
    .where(eq(rfqAdminActionsTable.rfqId, id))
    .orderBy(desc(rfqAdminActionsTable.createdAt));

  res.json({ entries: entries.map(serializeAuditEntry) });
});

export default router;
