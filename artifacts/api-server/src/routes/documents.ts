import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db, listingDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Storage ──────────────────────────────────────────────────────────────────

const DOCUMENTS_DIR = path.join(process.cwd(), "documents");
fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCUMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const unique = crypto.randomBytes(14).toString("hex");
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXT = new Set([".pdf", ".docx", ".jpg", ".jpeg", ".png"]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.originalname}. Use PDF, DOCX, JPG, or PNG.`));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.session?.user?.role;
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function serializeDoc(doc: any) {
  return {
    id: doc.id,
    listingId: doc.listingId,
    fileName: doc.fileName,
    documentType: doc.documentType,
    fileUrl: doc.fileUrl,
    verificationStatus: doc.verificationStatus,
    reviewNote: doc.reviewNote ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// POST /upload-documents — sellers upload cert documents (file only, no DB record yet)
router.post(
  "/upload-documents",
  requireAuth,
  upload.array("files", 10),
  (req: Request, res: Response): void => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const documents = files.map((f) => ({
      fileName: f.originalname,
      fileUrl: `/api/documents/${f.filename}`,
      mimeType: f.mimetype,
    }));

    res.status(201).json({ documents });
  },
);

// Multer error handler for /upload-documents
router.use(
  "/upload-documents",
  (err: any, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large — maximum 20 MB per document."
          : err.code === "LIMIT_FILE_COUNT"
            ? "Too many files — maximum 10 documents per upload."
            : err.message;
      res.status(400).json({ error: msg });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Upload failed" });
  },
);

// GET /listings/:id/documents — get all documents for a listing
router.get("/listings/:id/documents", async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const docs = await db
    .select()
    .from(listingDocumentsTable)
    .where(eq(listingDocumentsTable.listingId, id))
    .orderBy(listingDocumentsTable.createdAt);

  res.json({ documents: docs.map(serializeDoc) });
});

// PATCH /documents/:id — admin: approve or reject a document
router.patch(
  "/documents/:id",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { verificationStatus, reviewNote } = req.body as {
      verificationStatus?: "pending" | "approved" | "rejected";
      reviewNote?: string | null;
    };

    const allowed = new Set(["pending", "approved", "rejected"]);
    if (!verificationStatus || !allowed.has(verificationStatus)) {
      res.status(400).json({ error: "verificationStatus must be pending | approved | rejected" });
      return;
    }

    const updateData: any = {
      verificationStatus,
      updatedAt: new Date(),
    };
    if (reviewNote !== undefined) updateData.reviewNote = reviewNote ?? null;

    const [updated] = await db
      .update(listingDocumentsTable)
      .set(updateData)
      .where(eq(listingDocumentsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Document not found" }); return; }

    res.json(serializeDoc(updated));
  },
);

export default router;
