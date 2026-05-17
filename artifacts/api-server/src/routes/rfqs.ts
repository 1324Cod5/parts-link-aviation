import { Router, type IRouter } from "express";
import { db, rfqsTable, rfqResponsesTable, usersTable, listingsTable } from "@workspace/db";
import { eq, desc, like, or, count, and } from "drizzle-orm";
import { CreateRfqBody, CreateRfqResponseBody } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRfq(rfq: any) {
  return {
    id: rfq.id,
    buyerName: rfq.buyerName,
    buyerEmail: rfq.buyerEmail,
    buyerCompany: rfq.buyerCompany ?? null,
    buyerPhone: rfq.buyerPhone ?? null,
    partNumber: rfq.partNumber,
    description: rfq.description,
    aircraftApplicability: rfq.aircraftApplicability ?? null,
    condition: rfq.condition ?? null,
    quantity: rfq.quantity,
    status: rfq.status,
    createdAt: rfq.createdAt?.toISOString?.() ?? rfq.createdAt,
    updatedAt: rfq.updatedAt?.toISOString?.() ?? rfq.updatedAt,
  };
}

// GET /rfqs
router.get("/rfqs", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;

  const conditions: any[] = [];
  if (status === "open" || status === "closed") {
    conditions.push(eq(rfqsTable.status, status));
  }
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(
      like(rfqsTable.partNumber, term),
      like(rfqsTable.description, term),
      like(rfqsTable.aircraftApplicability, term),
    ));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db.select().from(rfqsTable)
      .where(where)
      .orderBy(desc(rfqsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(rfqsTable).where(where),
  ]);

  res.json({
    rfqs: rows.map(serializeRfq),
    total: Number(countRow.count),
    page,
    limit,
  });
});

// POST /rfqs
router.post("/rfqs", async (req, res): Promise<void> => {
  const parsed = CreateRfqBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [rfq] = await db.insert(rfqsTable).values({
    buyerName: data.buyerName,
    buyerEmail: data.buyerEmail,
    buyerCompany: data.buyerCompany ?? null,
    buyerPhone: data.buyerPhone ?? null,
    partNumber: data.partNumber,
    description: data.description,
    aircraftApplicability: data.aircraftApplicability ?? null,
    condition: data.condition ?? null,
    quantity: data.quantity,
  }).returning();

  res.status(201).json(serializeRfq(rfq));
});

// GET /rfqs/:id
router.get("/rfqs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

  const rawResponses = await db
    .select({
      id: rfqResponsesTable.id,
      rfqId: rfqResponsesTable.rfqId,
      sellerId: rfqResponsesTable.sellerId,
      message: rfqResponsesTable.message,
      listingId: rfqResponsesTable.listingId,
      createdAt: rfqResponsesTable.createdAt,
      sellerCompanyName: usersTable.companyName,
      listingPartNumber: listingsTable.partNumber,
    })
    .from(rfqResponsesTable)
    .leftJoin(usersTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .leftJoin(listingsTable, eq(rfqResponsesTable.listingId, listingsTable.id))
    .where(eq(rfqResponsesTable.rfqId, id))
    .orderBy(desc(rfqResponsesTable.createdAt));

  const responses = rawResponses.map(r => ({
    id: r.id,
    rfqId: r.rfqId,
    sellerId: r.sellerId,
    message: r.message,
    listingId: r.listingId ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    sellerCompanyName: r.sellerCompanyName ?? "",
    listingPartNumber: r.listingPartNumber ?? null,
  }));

  res.json({ rfq: serializeRfq(rfq), responses });
});

// POST /rfqs/:id/close
router.post("/rfqs/:id/close", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.update(rfqsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(rfqsTable.id, id))
    .returning();

  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
  res.json(serializeRfq(rfq));
});

// POST /rfqs/:id/responses
router.post("/rfqs/:id/responses", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
  if (rfq.status === "closed") { res.status(400).json({ error: "This RFQ is closed" }); return; }

  const parsed = CreateRfqResponseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [response] = await db.insert(rfqResponsesTable).values({
    rfqId: id,
    sellerId: userId,
    message: parsed.data.message,
    listingId: parsed.data.listingId ?? null,
  }).returning();

  const [seller] = await db.select({ companyName: usersTable.companyName })
    .from(usersTable).where(eq(usersTable.id, userId));

  let listingPartNumber: string | null = null;
  if (parsed.data.listingId) {
    const [listing] = await db.select({ partNumber: listingsTable.partNumber })
      .from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId));
    listingPartNumber = listing?.partNumber ?? null;
  }

  res.status(201).json({
    id: response.id,
    rfqId: response.rfqId,
    sellerId: response.sellerId,
    message: response.message,
    listingId: response.listingId ?? null,
    createdAt: response.createdAt?.toISOString?.() ?? response.createdAt,
    sellerCompanyName: seller?.companyName ?? "",
    listingPartNumber,
  });
});

export default router;
