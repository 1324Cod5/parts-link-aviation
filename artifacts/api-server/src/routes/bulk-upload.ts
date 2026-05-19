import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, listingsTable, usersTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { PLAN_LISTING_LIMITS } from "../lib/planEnforcement";

const router: IRouter = Router();

// ─── Multer (memory storage — we never persist the spreadsheet) ───────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "text/csv" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".csv");
    cb(null, ok);
  },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CONDITIONS = new Set(["new", "overhauled", "serviceable", "as_removed", "repaired"]);
const VALID_SALE_TYPES = new Set(["outright", "exchange", "both"]);

// Human-readable price-type aliases that sellers commonly write
const SALE_TYPE_ALIASES: Record<string, string> = {
  "outright sale": "outright",
  "for sale": "outright",
  "exchange only": "exchange",
  "outright/exchange": "both",
  "both": "both",
};

// Condition aliases
const CONDITION_ALIASES: Record<string, string> = {
  "as removed": "as_removed",
  "as-removed": "as_removed",
  "oh": "overhauled",
  "new surplus": "new",
};

// ─── Row parsing helpers ──────────────────────────────────────────────────────

function normalise(v: unknown): string {
  return String(v ?? "").trim();
}

function resolveCondition(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (VALID_CONDITIONS.has(lower)) return lower;
  return CONDITION_ALIASES[lower] ?? null;
}

function resolveSaleType(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (VALID_SALE_TYPES.has(lower)) return lower;
  return SALE_TYPE_ALIASES[lower] ?? null;
}

// Column header normalisation — strip spaces, lowercase, drop punctuation
function headerKey(h: string) {
  return h.toLowerCase().replace(/[\s\-_/]+/g, "");
}

const HEADER_MAP: Record<string, string> = {
  partnumber: "partNumber",
  part: "partNumber",
  "part#": "partNumber",
  partno: "partNumber",
  description: "description",
  desc: "description",
  manufacturer: "manufacturer",
  mfr: "manufacturer",
  mfg: "manufacturer",
  maker: "manufacturer",
  aircrafttype: "aircraftApplicability",
  aircraft: "aircraftApplicability",
  applicability: "aircraftApplicability",
  actype: "aircraftApplicability",
  condition: "condition",
  cond: "condition",
  quantity: "quantity",
  qty: "quantity",
  pricetype: "saleType",
  saletype: "saleType",
  type: "saleType",
  price: "price",
  unitprice: "price",
};

interface ParsedRow {
  rowNumber: number;
  partNumber: string;
  description: string;
  manufacturer: string;
  aircraftApplicability: string | null;
  condition: string;
  saleType: string;
  quantity: number;
  price: number | null;
}

interface InvalidRow {
  rowNumber: number;
  rawData: Record<string, unknown>;
  errors: string[];
}

function parseRows(
  rawRows: Record<string, unknown>[],
): { valid: ParsedRow[]; invalid: InvalidRow[] } {
  const valid: ParsedRow[] = [];
  const invalid: InvalidRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // 1-indexed, row 1 = header
    const errors: string[] = [];

    // Map headers
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const canonical = HEADER_MAP[headerKey(k)];
      if (canonical) mapped[canonical] = v;
    }

    const partNumber = normalise(mapped.partNumber);
    const description = normalise(mapped.description);
    const manufacturer = normalise(mapped.manufacturer) || "Unknown";
    const aircraftRaw = normalise(mapped.aircraftApplicability);
    const conditionRaw = normalise(mapped.condition);
    const saleTypeRaw = normalise(mapped.saleType);
    const quantityRaw = normalise(mapped.quantity);
    const priceRaw = normalise(mapped.price);

    if (!partNumber) errors.push("Part Number is required");
    if (!description) errors.push("Description is required");

    const condition = resolveCondition(conditionRaw);
    if (!conditionRaw) {
      errors.push("Condition is required");
    } else if (!condition) {
      errors.push(
        `Invalid condition "${conditionRaw}" — must be one of: new, overhauled, serviceable, as_removed, repaired`,
      );
    }

    const saleType = resolveSaleType(saleTypeRaw);
    if (!saleTypeRaw) {
      errors.push("Price Type is required");
    } else if (!saleType) {
      errors.push(
        `Invalid price type "${saleTypeRaw}" — must be one of: outright, exchange, both`,
      );
    }

    const quantity = parseInt(quantityRaw, 10);
    if (!quantityRaw) {
      errors.push("Quantity is required");
    } else if (isNaN(quantity) || quantity < 1) {
      errors.push("Quantity must be a positive integer");
    }

    let price: number | null = null;
    if (priceRaw && priceRaw !== "" && priceRaw.toLowerCase() !== "poa") {
      const parsed = parseFloat(priceRaw.replace(/[$,]/g, ""));
      if (isNaN(parsed) || parsed < 0) {
        errors.push("Price must be a positive number (or leave blank for POA)");
      } else {
        price = parsed;
      }
    }

    if (errors.length > 0) {
      invalid.push({ rowNumber, rawData: raw, errors });
    } else {
      valid.push({
        rowNumber,
        partNumber,
        description,
        manufacturer,
        aircraftApplicability: aircraftRaw || null,
        condition: condition!,
        saleType: saleType!,
        quantity,
        price,
      });
    }
  });

  return { valid, invalid };
}

// ─── Template CSV ─────────────────────────────────────────────────────────────

const TEMPLATE_CSV = [
  "Part Number,Description,Manufacturer,Aircraft Type,Condition,Quantity,Price Type,Price",
  "GE90-115B-FAN,Fan Blade Assembly,GE Aviation,B777,overhauled,4,outright,12500",
  "CFM56-5B-HPT,High Pressure Turbine Blade,CFM International,A320,serviceable,12,exchange,",
  "PW4000-94-OIL,Oil Pressure Sensor,Pratt & Whitney,B747,new,6,both,875",
].join("\r\n");

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /seller/bulk-upload/template — download the CSV template
router.get("/seller/bulk-upload/template", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="aeroparts-bulk-template.csv"');
  res.send(TEMPLATE_CSV);
});

// POST /seller/bulk-upload/parse — parse and validate a .xlsx or .csv file
router.post(
  "/seller/bulk-upload/parse",
  (req: Request, res: Response, next) => {
    const userId = req.session?.userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    next();
  },
  upload.single("file"),
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let rawRows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    } catch {
      res.status(400).json({ error: "Could not parse file. Please use the provided template." });
      return;
    }

    if (rawRows.length === 0) {
      res.status(400).json({ error: "The file contains no data rows." });
      return;
    }

    const { valid, invalid } = parseRows(rawRows);

    res.json({
      valid,
      invalid,
      totalRows: rawRows.length,
      fileName: req.file.originalname,
    });
  },
);

// POST /seller/bulk-upload/import — create listings from validated rows
router.post("/seller/bulk-upload/import", async (req: Request, res: Response): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { rows } = req.body as { rows: ParsedRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No rows provided" });
    return;
  }

  // Fetch plan limits
  const [seller] = await db
    .select({ plan: usersTable.plan, subscriptionStatus: usersTable.subscriptionStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const effectivePlan = req.session?.user?.subscriptionTier ?? seller?.plan ?? "free";
  const limit = PLAN_LISTING_LIMITS[effectivePlan] ?? 5;

  let remainingSlots: number | null = null;
  if (limit !== null) {
    const [activeRow] = await db
      .select({ count: count() })
      .from(listingsTable)
      .where(and(eq(listingsTable.sellerId, userId), eq(listingsTable.status, "active")));
    const active = Number(activeRow.count);
    remainingSlots = Math.max(0, limit - active);
  }

  // Slice to remaining capacity
  const toImport = remainingSlots !== null ? rows.slice(0, remainingSlots) : rows;
  const skipped = rows.length - toImport.length;
  const limitReached = skipped > 0;

  if (toImport.length === 0) {
    res.json({ imported: 0, skipped: rows.length, limitReached: true, listingIds: [], remainingSlots: 0 });
    return;
  }

  // Re-validate each row before inserting
  const validConditions = ["new", "overhauled", "serviceable", "as_removed", "repaired"] as const;
  const validSaleTypes = ["outright", "exchange", "both"] as const;

  const values = toImport
    .filter(
      (r) =>
        r.partNumber &&
        r.description &&
        validConditions.includes(r.condition as (typeof validConditions)[number]) &&
        validSaleTypes.includes(r.saleType as (typeof validSaleTypes)[number]) &&
        r.quantity >= 1,
    )
    .map((r) => ({
      partNumber: r.partNumber,
      description: r.description,
      manufacturer: r.manufacturer || "Unknown",
      aircraftApplicability: r.aircraftApplicability ?? null,
      condition: r.condition as (typeof validConditions)[number],
      saleType: r.saleType as (typeof validSaleTypes)[number],
      quantity: r.quantity,
      price: r.price != null ? String(r.price) : null,
      certificationDocs: [] as string[],
      photos: [] as string[],
      sellerId: userId,
    }));

  const inserted = await db.insert(listingsTable).values(values).returning({ id: listingsTable.id });
  const listingIds = inserted.map((r) => r.id);

  res.json({
    imported: listingIds.length,
    skipped,
    limitReached,
    listingIds,
    remainingSlots,
  });
});

export default router;
