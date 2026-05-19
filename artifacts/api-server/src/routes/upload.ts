import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ─── Storage config ───────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = crypto.randomBytes(14).toString("hex");
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Use JPEG, PNG, WebP or GIF.`));
    }
  },
});

// ─── Route ────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// Auth guard runs before multer so unauthenticated requests never touch disk.
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.post(
  "/upload",
  requireAuth,
  upload.array("images", 5),
  (req: Request, res: Response): void => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No images provided" });
      return;
    }

    const urls = files.map((f) => `/api/uploads/${f.filename}`);
    res.status(201).json({ urls });
  },
);

// Multer error handler — catches file-type and size rejections.
router.use(
  "/upload",
  (err: any, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large — maximum 10 MB per image."
          : err.code === "LIMIT_FILE_COUNT"
            ? "Too many files — maximum 5 images per upload."
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

export default router;
