import { Router, type IRouter } from "express";
import { db, mroProfilesTable, serviceQuoteRequestsTable, usersTable } from "@workspace/db";
import { eq, desc, count, and, ilike, sql } from "drizzle-orm";
import { CreateMroProfileBody, UpdateMroProfileBody, CreateServiceQuoteRequestBody, AdminSetMroStatusBody } from "@workspace/api-zod";
import { MRO_SERVICE_LIMITS } from "../lib/planEnforcement";

const router: IRouter = Router();

function serializeMro(m: any) {
  return {
    id: m.id,
    userId: m.userId ?? null,
    companyName: m.companyName,
    description: m.description ?? null,
    website: m.website ?? null,
    country: m.country,
    city: m.city ?? null,
    contactName: m.contactName,
    contactEmail: m.contactEmail,
    contactPhone: m.contactPhone ?? null,
    aircraftTypes: m.aircraftTypes ?? [],
    partNumbersServiced: m.partNumbersServiced ?? [],
    serviceTypes: m.serviceTypes ?? [],
    certifications: m.certifications ?? [],
    turnaroundTime: m.turnaroundTime ?? null,
    warranty: m.warranty ?? null,
    capabilityDocuments: m.capabilityDocuments ?? [],
    status: m.status,
    featured: m.featured ?? false,
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
  };
}

// GET /mro
router.get("/mro", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const q = req.query.q as string | undefined;
  const aircraftType = req.query.aircraftType as string | undefined;
  const serviceType = req.query.serviceType as string | undefined;
  const certification = req.query.certification as string | undefined;
  const country = req.query.country as string | undefined;
  const partNumber = req.query.partNumber as string | undefined;

  const conditions: any[] = [eq(mroProfilesTable.status, "active")];

  if (q) {
    conditions.push(
      sql`(${mroProfilesTable.companyName} ILIKE ${"%" + q + "%"} OR ${mroProfilesTable.description} ILIKE ${"%" + q + "%"})`,
    );
  }
  if (aircraftType) conditions.push(sql`${mroProfilesTable.aircraftTypes} @> ARRAY[${aircraftType}]::text[]`);
  if (serviceType) conditions.push(sql`${mroProfilesTable.serviceTypes} @> ARRAY[${serviceType}]::text[]`);
  if (certification) conditions.push(sql`${mroProfilesTable.certifications} @> ARRAY[${certification}]::text[]`);
  if (country) conditions.push(ilike(mroProfilesTable.country, `%${country}%`));
  if (partNumber) conditions.push(sql`${mroProfilesTable.partNumbersServiced} @> ARRAY[${partNumber}]::text[]`);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db.select().from(mroProfilesTable).where(where)
      .orderBy(desc(mroProfilesTable.featured), desc(mroProfilesTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: count() }).from(mroProfilesTable).where(where),
  ]);

  res.json({ profiles: rows.map(serializeMro), total: Number(countRow.count), page, limit });
});

// POST /mro
router.post("/mro", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const existing = await db.select({ id: mroProfilesTable.id }).from(mroProfilesTable)
    .where(eq(mroProfilesTable.userId, userId)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "You already have an MRO profile. Use PUT to update it." });
    return;
  }

  const parsed = CreateMroProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  const plan = req.session?.user?.subscriptionTier ?? "free";
  const serviceLimit = MRO_SERVICE_LIMITS[plan] ?? 1;
  const serviceTypes = d.serviceTypes ?? [];

  if (serviceLimit !== null && serviceTypes.length > serviceLimit) {
    res.status(402).json({
      error: `Your ${plan} plan allows up to ${serviceLimit} service type${serviceLimit === 1 ? "" : "s"}. You submitted ${serviceTypes.length}. Upgrade to list more services.`,
      plan,
      serviceTypeLimit: serviceLimit,
      submitted: serviceTypes.length,
      upgradeUrl: "/seller/subscription",
    });
    return;
  }

  // Enterprise and Premium MRO accounts get featured placement
  const featured = plan === "enterprise" || plan === "mro_premium";

  const [mro] = await db.insert(mroProfilesTable).values({
    userId,
    companyName: d.companyName,
    description: d.description ?? null,
    website: d.website ?? null,
    country: d.country,
    city: d.city ?? null,
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    contactPhone: d.contactPhone ?? null,
    aircraftTypes: d.aircraftTypes ?? [],
    partNumbersServiced: d.partNumbersServiced ?? [],
    serviceTypes,
    certifications: d.certifications ?? [],
    turnaroundTime: d.turnaroundTime ?? null,
    warranty: d.warranty ?? null,
    capabilityDocuments: d.capabilityDocuments ?? [],
    featured,
    status: "active",
  }).returning();

  res.status(201).json(serializeMro(mro));
});

// GET /mro/:id
router.get("/mro/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [mro] = await db.select().from(mroProfilesTable).where(eq(mroProfilesTable.id, id));
  if (!mro) { res.status(404).json({ error: "MRO not found" }); return; }

  const [countRow] = await db.select({ count: count() }).from(serviceQuoteRequestsTable)
    .where(eq(serviceQuoteRequestsTable.mroId, id));

  res.json({ profile: serializeMro(mro), quoteRequestCount: Number(countRow.count) });
});

// PUT /mro/:id
router.put("/mro/:id", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [mro] = await db.select().from(mroProfilesTable).where(eq(mroProfilesTable.id, id));
  if (!mro) { res.status(404).json({ error: "MRO not found" }); return; }

  const [user] = await db.select({ role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  if (mro.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateMroProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;

  if (!isAdmin && d.serviceTypes !== undefined) {
    const plan = req.session?.user?.subscriptionTier ?? "free";
    const serviceLimit = MRO_SERVICE_LIMITS[plan] ?? 1;
    if (serviceLimit !== null && d.serviceTypes.length > serviceLimit) {
      res.status(402).json({
        error: `Your ${plan} plan allows up to ${serviceLimit} service type${serviceLimit === 1 ? "" : "s"}. You submitted ${d.serviceTypes.length}. Upgrade to list more services.`,
        plan,
        serviceTypeLimit: serviceLimit,
        submitted: d.serviceTypes.length,
        upgradeUrl: "/seller/subscription",
      });
      return;
    }
  }

  const [updated] = await db.update(mroProfilesTable).set({
    companyName: d.companyName ?? mro.companyName,
    description: d.description !== undefined ? (d.description ?? null) : mro.description,
    website: d.website !== undefined ? (d.website ?? null) : mro.website,
    country: d.country ?? mro.country,
    city: d.city !== undefined ? (d.city ?? null) : mro.city,
    contactName: d.contactName ?? mro.contactName,
    contactEmail: d.contactEmail ?? mro.contactEmail,
    contactPhone: d.contactPhone !== undefined ? (d.contactPhone ?? null) : mro.contactPhone,
    aircraftTypes: d.aircraftTypes ?? mro.aircraftTypes,
    partNumbersServiced: d.partNumbersServiced ?? mro.partNumbersServiced,
    serviceTypes: d.serviceTypes ?? mro.serviceTypes,
    certifications: d.certifications ?? mro.certifications,
    turnaroundTime: d.turnaroundTime !== undefined ? (d.turnaroundTime ?? null) : mro.turnaroundTime,
    warranty: d.warranty !== undefined ? (d.warranty ?? null) : mro.warranty,
    capabilityDocuments: d.capabilityDocuments ?? mro.capabilityDocuments,
    updatedAt: new Date(),
  }).where(eq(mroProfilesTable.id, id)).returning();

  res.json(serializeMro(updated));
});

// POST /mro/:id/quote-requests
router.post("/mro/:id/quote-requests", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [mro] = await db.select({ id: mroProfilesTable.id, status: mroProfilesTable.status })
    .from(mroProfilesTable).where(eq(mroProfilesTable.id, id));
  if (!mro) { res.status(404).json({ error: "MRO not found" }); return; }
  if (mro.status !== "active") { res.status(400).json({ error: "MRO is not currently accepting requests" }); return; }

  const parsed = CreateServiceQuoteRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  const [sqr] = await db.insert(serviceQuoteRequestsTable).values({
    mroId: id,
    requesterName: d.requesterName,
    requesterEmail: d.requesterEmail,
    requesterCompany: d.requesterCompany ?? null,
    requesterPhone: d.requesterPhone ?? null,
    partNumber: d.partNumber,
    description: d.description,
    aircraftType: d.aircraftType ?? null,
    serviceType: d.serviceType ?? null,
    quantity: d.quantity,
    urgency: d.urgency as any,
  }).returning();

  res.status(201).json({
    id: sqr.id, mroId: sqr.mroId, requesterName: sqr.requesterName,
    requesterEmail: sqr.requesterEmail, requesterCompany: sqr.requesterCompany ?? null,
    requesterPhone: sqr.requesterPhone ?? null, partNumber: sqr.partNumber,
    description: sqr.description, aircraftType: sqr.aircraftType ?? null,
    serviceType: sqr.serviceType ?? null, quantity: sqr.quantity,
    urgency: sqr.urgency, status: sqr.status,
    createdAt: sqr.createdAt?.toISOString?.() ?? sqr.createdAt,
  });
});

// GET /seller/mro-profile
router.get("/seller/mro-profile", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [mro] = await db.select().from(mroProfilesTable)
    .where(eq(mroProfilesTable.userId, userId)).limit(1);
  if (!mro) { res.status(404).json({ error: "No MRO profile found" }); return; }

  const plan = req.session?.user?.subscriptionTier ?? "free";
  const serviceTypeLimit = MRO_SERVICE_LIMITS[plan] ?? 1;

  res.json({ ...serializeMro(mro), serviceTypeLimit, plan });
});

// GET /admin/mro
router.get("/admin/mro", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role !== "admin" && user?.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = 50;
  const offset = (page - 1) * limit;

  const [rows, [countRow]] = await Promise.all([
    db.select().from(mroProfilesTable).orderBy(desc(mroProfilesTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(mroProfilesTable),
  ]);

  res.json({ profiles: rows.map(serializeMro), total: Number(countRow.count), page, limit });
});

// POST /admin/mro/:id/status
router.post("/admin/mro/:id/status", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role !== "admin" && user?.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminSetMroStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [mro] = await db.update(mroProfilesTable)
    .set({ status: parsed.data.status as any, updatedAt: new Date() })
    .where(eq(mroProfilesTable.id, id)).returning();
  if (!mro) { res.status(404).json({ error: "MRO not found" }); return; }

  res.json(serializeMro(mro));
});

export default router;
