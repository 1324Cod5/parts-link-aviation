import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, certDocumentsTable, certDocumentListingsTable, listingsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";

const router: IRouter = Router();

const CERT_DOC_DIR = path.join(process.cwd(), "uploads", "cert-docs");
fs.mkdirSync(CERT_DOC_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CERT_DOC_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

function serializeCertDoc(doc: any, linkedCount = 0) {
  return {
    id: doc.id,
    sellerId: doc.sellerId,
    docType: doc.docType,
    issuingAuthority: doc.issuingAuthority ?? null,
    docDate: doc.docDate ?? null,
    aircraftApplicability: doc.aircraftApplicability ?? null,
    fileUrl: doc.fileUrl,
    originalFilename: doc.originalFilename,
    flagged: doc.flagged ?? false,
    linkedListings: linkedCount,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

// GET /seller/cert-documents
router.get("/seller/cert-documents", async (req: Request, res: Response): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const docs = await db
    .select()
    .from(certDocumentsTable)
    .where(eq(certDocumentsTable.sellerId, userId))
    .orderBy(certDocumentsTable.createdAt);

  if (docs.length === 0) {
    res.json({ documents: [] });
    return;
  }

  const docIds = docs.map(d => d.id);
  const links = await db
    .select({ certDocId: certDocumentListingsTable.certDocId, count: count() })
    .from(certDocumentListingsTable)
    .where(inArray(certDocumentListingsTable.certDocId, docIds))
    .groupBy(certDocumentListingsTable.certDocId);

  const countMap = Object.fromEntries(links.map(l => [l.certDocId, Number(l.count)]));

  res.json({ documents: docs.map(d => serializeCertDoc(d, countMap[d.id] ?? 0)) });
});

// POST /seller/cert-documents
router.post(
  "/seller/cert-documents",
  (req: Request, res: Response, next) => {
    const userId = req.session?.userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    next();
  },
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.session?.userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { docType, issuingAuthority, docDate, aircraftApplicability } = req.body as Record<string, string>;

    if (!docType) {
      res.status(400).json({ error: "docType is required" });
      return;
    }

    const fileUrl = `/uploads/cert-docs/${req.file.filename}`;

    const [inserted] = await db.insert(certDocumentsTable).values({
      sellerId: userId,
      docType,
      issuingAuthority: issuingAuthority || null,
      docDate: docDate || null,
      aircraftApplicability: aircraftApplicability || null,
      fileUrl,
      originalFilename: req.file.originalname,
    }).returning();

    res.status(201).json({ document: serializeCertDoc(inserted, 0) });
  },
);

// POST /seller/cert-documents/:id/link
router.post("/seller/cert-documents/:id/link", async (req: Request, res: Response): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const certDocId = parseInt(req.params.id as string, 10);
  if (isNaN(certDocId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [doc] = await db.select().from(certDocumentsTable)
    .where(and(eq(certDocumentsTable.id, certDocId), eq(certDocumentsTable.sellerId, userId)));

  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  const { listingIds } = req.body as { listingIds: number[] };
  if (!Array.isArray(listingIds)) {
    res.status(400).json({ error: "listingIds must be an array" });
    return;
  }

  // Verify all listings belong to this seller
  if (listingIds.length > 0) {
    const owned = await db.select({ id: listingsTable.id })
      .from(listingsTable)
      .where(and(
        inArray(listingsTable.id, listingIds),
        eq(listingsTable.sellerId, userId),
      ));
    const ownedIds = owned.map(l => l.id);

    // Remove old links for this doc
    await db.delete(certDocumentListingsTable)
      .where(eq(certDocumentListingsTable.certDocId, certDocId));

    // Insert new links
    if (ownedIds.length > 0) {
      await db.insert(certDocumentListingsTable)
        .values(ownedIds.map(lid => ({ certDocId, listingId: lid })))
        .onConflictDoNothing();

      // Update certDocId on each linked listing
      await db.update(listingsTable)
        .set({ certDocId, updatedAt: new Date() })
        .where(inArray(listingsTable.id, ownedIds));
    }
  } else {
    // Unlink all — clear links and certDocId on listings
    await db.delete(certDocumentListingsTable)
      .where(eq(certDocumentListingsTable.certDocId, certDocId));

    await db.update(listingsTable)
      .set({ certDocId: null, updatedAt: new Date() })
      .where(and(
        eq(listingsTable.sellerId, userId),
        eq(listingsTable.certDocId, certDocId),
      ));
  }

  const [linkCount] = await db
    .select({ count: count() })
    .from(certDocumentListingsTable)
    .where(eq(certDocumentListingsTable.certDocId, certDocId));

  res.json({ document: serializeCertDoc(doc, Number(linkCount?.count ?? 0)) });
});

// PATCH /admin/cert-documents/:id/flag
router.patch("/admin/cert-documents/:id/flag", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { flagged } = req.body as { flagged: boolean };

  const [updated] = await db.update(certDocumentsTable)
    .set({ flagged: !!flagged })
    .where(eq(certDocumentsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Document not found" }); return; }

  res.json({ document: serializeCertDoc(updated) });
});

// GET /admin/sellers/:id/cert-documents
router.get("/admin/sellers/:id/cert-documents", async (req: Request, res: Response): Promise<void> => {
  const sellerId = parseInt(req.params.id as string, 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const docs = await db
    .select()
    .from(certDocumentsTable)
    .where(eq(certDocumentsTable.sellerId, sellerId))
    .orderBy(certDocumentsTable.createdAt);

  if (docs.length === 0) {
    res.json({ documents: [] });
    return;
  }

  const docIds = docs.map(d => d.id);
  const links = await db
    .select({ certDocId: certDocumentListingsTable.certDocId, count: count() })
    .from(certDocumentListingsTable)
    .where(inArray(certDocumentListingsTable.certDocId, docIds))
    .groupBy(certDocumentListingsTable.certDocId);

  const countMap = Object.fromEntries(links.map(l => [l.certDocId, Number(l.count)]));

  res.json({ documents: docs.map(d => serializeCertDoc(d, countMap[d.id] ?? 0)) });
});

export default router;
