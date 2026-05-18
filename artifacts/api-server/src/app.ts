import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

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

// ─── Stripe webhook MUST be registered BEFORE express.json() ─────────────────
// The webhook handler needs the raw Buffer body, not parsed JSON.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const sig = Array.isArray(signature) ? signature[0] : signature;

    if (!Buffer.isBuffer(req.body)) {
      logger.error("Stripe webhook body is not a Buffer — check middleware order");
      res.status(500).json({ error: "Webhook processing error" });
      return;
    }

    try {
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook processing failed");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// ─── Standard middleware (after webhook route) ────────────────────────────────
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

// ─── Public debug routes (registered before all auth middleware & router) ─────
// Must stay here — above the session bridge and the main /api router —
// so no auth middleware or route guard can ever intercept them.
app.get("/api/debug/session", (req, res) => {
  console.log("DEBUG SESSION ROUTE HIT");
  const user = (req as any).session?.user ?? null;
  if (!user) {
    res.json({ sessionExists: false });
    return;
  }
  res.json({ sessionExists: true, user });
});

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

app.use("/api", router);

export default app;
