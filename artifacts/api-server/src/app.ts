import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const app: Express = express();

// Trust the Replit reverse proxy so Express sees X-Forwarded-Proto: https.
// Without this, secure: true cookies are never sent because Express sees a
// plain-HTTP connection from the proxy (TLS is terminated upstream).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Standard middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session store (PostgreSQL-backed for persistence across restarts) ────────
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.use(
  session({
    store: new PgStore({
      pool: pgPool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET ?? "aeroparts-dev-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // SameSite=None is required for the Replit preview pane (cross-site iframe).
      // Secure=true is required by browsers when SameSite=None is set.
      // The Replit environment always serves over HTTPS, so this is safe.
      sameSite: "none",
      secure: true,
      maxAge: ADMIN_SESSION_TIMEOUT,
    },
  }),
);

// ─── Session bridge middleware ────────────────────────────────────────────────
// If a request carries a test-system session (req.session.user) but not the
// numeric userId that all route guards expect, do a single DB lookup and
// backfill req.session.userId so every downstream guard works unchanged.
app.use(async (req, _res, next) => {
  if (!req.session?.userId && req.session?.user?.email) {
    try {
      const [found] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, req.session.user.email))
        .limit(1);
      if (found) {
        req.session.userId = found.id;
        logger.debug({ email: req.session.user.email, userId: found.id }, "session bridge: backfilled userId");
      }
    } catch (err) {
      logger.warn({ err }, "session bridge: DB lookup failed — continuing without userId");
    }
  }
  next();
});

// ─── Public debug route — after session middleware, before all routers ─────────
app.get("/debug/session", (req, res) => {
  console.log("DEBUG SESSION ROUTE HIT");

  if (!req.session || !(req.session as any).user) {
    return res.json({
      sessionExists: false
    });
  }

  return res.json({
    sessionExists: true,
    user: (req.session as any).user
  });
});

// ─── Static file serving — uploads and documents ─────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/api/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

const DOCUMENTS_DIR = path.join(process.cwd(), "documents");
fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
app.use("/api/documents", express.static(DOCUMENTS_DIR, { maxAge: "7d" }));

app.use("/api", router);

export default app;
