import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db, sellerApiKeysTable, listingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/csv",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are accepted"));
    }
  },
});

function requireSeller(req: any, res: any, next: any) {
  if (!req.session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  next();
}

// ─── GET /seller/api-keys ─────────────────────────────────────────────────────
router.get("/seller/api-keys", requireSeller, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const keys = await db.select({
    id: sellerApiKeysTable.id,
    label: sellerApiKeysTable.label,
    keyPrefix: sellerApiKeysTable.keyPrefix,
    active: sellerApiKeysTable.active,
    createdAt: sellerApiKeysTable.createdAt,
    lastUsedAt: sellerApiKeysTable.lastUsedAt,
  }).from(sellerApiKeysTable)
    .where(and(eq(sellerApiKeysTable.sellerId, userId), eq(sellerApiKeysTable.active, true)));
  res.json({ keys });
});

// ─── POST /seller/api-keys ────────────────────────────────────────────────────
router.post("/seller/api-keys", requireSeller, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const { label } = req.body as { label?: string };

  const rawKey = "pla_" + crypto.randomBytes(32).toString("hex");
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);

  const [created] = await db.insert(sellerApiKeysTable).values({
    sellerId: userId,
    keyHash,
    keyPrefix,
    label: label?.trim() || "API Key",
  }).returning({
    id: sellerApiKeysTable.id,
    label: sellerApiKeysTable.label,
    keyPrefix: sellerApiKeysTable.keyPrefix,
    createdAt: sellerApiKeysTable.createdAt,
  });

  logger.info({ userId, keyId: created.id }, "API key created");
  res.status(201).json({ ...created, rawKey });
});

// ─── DELETE /seller/api-keys/:id ─────────────────────────────────────────────
router.delete("/seller/api-keys/:id", requireSeller, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const keyId = parseInt(req.params.id, 10);
  if (isNaN(keyId)) { res.status(400).json({ error: "Invalid key ID" }); return; }

  const [existing] = await db.select().from(sellerApiKeysTable)
    .where(and(eq(sellerApiKeysTable.id, keyId), eq(sellerApiKeysTable.sellerId, userId)));
  if (!existing) { res.status(404).json({ error: "Key not found" }); return; }

  await db.update(sellerApiKeysTable).set({ active: false }).where(eq(sellerApiKeysTable.id, keyId));
  res.json({ ok: true });
});

// ─── POST /seller/inventory/import ───────────────────────────────────────────
router.post(
  "/seller/inventory/import",
  requireSeller,
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const userId = req.session!.userId as number;

    let rows: Record<string, any>[] = [];
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } catch (err: any) {
      res.status(400).json({ error: "Failed to parse file: " + err.message });
      return;
    }

    if (rows.length === 0) {
      res.status(400).json({ error: "File is empty or has no data rows" });
      return;
    }

    const VALID_CONDITIONS = ["new", "overhauled", "serviceable", "as_removed", "repaired"];
    const VALID_SALE_TYPES = ["outright", "exchange", "both"];

    const results: { row: number; status: "created" | "error"; partNumber?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const partNumber = String(row["part_number"] ?? row["Part Number"] ?? row["PartNumber"] ?? "").trim();
      const description = String(row["description"] ?? row["Description"] ?? "").trim();
      const condition = String(row["condition"] ?? row["Condition"] ?? "serviceable").toLowerCase().replace(/ /g, "_").trim();
      const manufacturer = String(row["manufacturer"] ?? row["Manufacturer"] ?? "Unknown").trim();
      const quantity = parseInt(String(row["quantity"] ?? row["Quantity"] ?? "1"), 10) || 1;
      const rawPrice = String(row["price"] ?? row["Price"] ?? "").trim();
      const price = rawPrice && !isNaN(parseFloat(rawPrice)) ? parseFloat(rawPrice).toFixed(2) : null;
      const aircraftApplicability = String(row["aircraft_applicability"] ?? row["Aircraft Applicability"] ?? row["aircraft"] ?? "").trim() || null;
      const saleType = String(row["sale_type"] ?? row["Sale Type"] ?? "outright").toLowerCase().trim();
      const traceHistory = String(row["trace_history"] ?? row["Trace History"] ?? row["notes"] ?? row["Notes"] ?? "").trim() || null;

      if (!partNumber) {
        results.push({ row: i + 2, status: "error", error: "part_number is required" });
        continue;
      }
      if (!description) {
        results.push({ row: i + 2, status: "error", partNumber, error: "description is required" });
        continue;
      }
      if (!VALID_CONDITIONS.includes(condition)) {
        results.push({ row: i + 2, status: "error", partNumber, error: `Invalid condition "${condition}". Must be one of: ${VALID_CONDITIONS.join(", ")}` });
        continue;
      }
      const finalSaleType = VALID_SALE_TYPES.includes(saleType) ? saleType : "outright";

      try {
        await db.insert(listingsTable).values({
          partNumber,
          description,
          manufacturer: manufacturer || "Unknown",
          condition: condition as any,
          saleType: finalSaleType as any,
          quantity,
          price: price as any,
          aircraftApplicability,
          traceHistory,
          sellerId: userId,
        });
        results.push({ row: i + 2, status: "created", partNumber });
      } catch (err: any) {
        results.push({ row: i + 2, status: "error", partNumber, error: err.message });
      }
    }

    const created = results.filter(r => r.status === "created").length;
    const errors = results.filter(r => r.status === "error").length;
    logger.info({ userId, created, errors, total: rows.length }, "Inventory import completed");
    res.json({ ok: true, total: rows.length, created, errors, results });
  },
);

// ─── POST /seller/inventory/sync (API key auth) ───────────────────────────────
router.post("/seller/inventory/sync", async (req, res): Promise<void> => {
  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) { res.status(401).json({ error: "X-API-Key header required" }); return; }

  const prefix = rawKey.substring(0, 12);
  const candidates = await db.select().from(sellerApiKeysTable)
    .where(and(eq(sellerApiKeysTable.keyPrefix, prefix), eq(sellerApiKeysTable.active, true)));

  let sellerId: number | null = null;
  let matchedKeyId: number | null = null;
  for (const candidate of candidates) {
    if (await bcrypt.compare(rawKey, candidate.keyHash)) {
      sellerId = candidate.sellerId;
      matchedKeyId = candidate.id;
      break;
    }
  }
  if (!sellerId || !matchedKeyId) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  await db.update(sellerApiKeysTable).set({ lastUsedAt: new Date() }).where(eq(sellerApiKeysTable.id, matchedKeyId));

  const parts = req.body?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ error: "Body must contain a non-empty 'parts' array" });
    return;
  }

  const VALID_CONDITIONS = ["new", "overhauled", "serviceable", "as_removed", "repaired"];
  const VALID_SALE_TYPES = ["outright", "exchange", "both"];

  const results: { index: number; status: "created" | "error"; partNumber?: string; error?: string }[] = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const condition = (p.condition ?? "serviceable").toLowerCase().replace(/ /g, "_");
    const saleType = VALID_SALE_TYPES.includes((p.saleType ?? "outright").toLowerCase()) ? (p.saleType ?? "outright").toLowerCase() : "outright";

    if (!p.partNumber || !p.description) {
      results.push({ index: i, status: "error", error: "partNumber and description are required" });
      continue;
    }
    if (!VALID_CONDITIONS.includes(condition)) {
      results.push({ index: i, status: "error", partNumber: p.partNumber, error: `Invalid condition "${condition}"` });
      continue;
    }
    try {
      await db.insert(listingsTable).values({
        partNumber: String(p.partNumber).trim(),
        description: String(p.description).trim(),
        manufacturer: String(p.manufacturer ?? "Unknown").trim(),
        condition: condition as any,
        saleType: saleType as any,
        quantity: parseInt(p.quantity) || 1,
        price: p.price != null && !isNaN(parseFloat(p.price)) ? parseFloat(p.price).toFixed(2) as any : null,
        aircraftApplicability: p.aircraftApplicability ?? null,
        traceHistory: p.notes ?? p.traceHistory ?? null,
        sellerId,
      });
      results.push({ index: i, status: "created", partNumber: p.partNumber });
    } catch (err: any) {
      results.push({ index: i, status: "error", partNumber: p.partNumber, error: err.message });
    }
  }

  const created = results.filter(r => r.status === "created").length;
  const errors = results.filter(r => r.status === "error").length;
  res.json({ ok: true, total: parts.length, created, errors, results });
});

export default router;
