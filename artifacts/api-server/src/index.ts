import app from "./app";
import { logger } from "./lib/logger";
import { seedAdmin } from "./lib/seed-admin";
import { seedTestAccounts } from "./lib/seed-test-accounts";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recomputeAndSave } from "./lib/trustScore";
import { resumeAogEscalations } from "./lib/aogEscalation";
import { startRenewalReminderJob } from "./lib/renewalReminder";

// ─── Startup DB migration ───────────────────────────────────────────────────
async function runMigrations() {
  const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const sqls = [
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE",
              "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT",
                  "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP",
                    ];
                      for (const sql of sqls) {
                          try { await pool.query(sql); } catch (e: any) { logger.warn({ msg: e.message }, "migration warning"); }
                            }
                              await pool.end();
                                logger.info("DB migrations applied");
                                }

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await runMigrations();
    await seedAdmin();
  await seedTestAccounts();

  // Re-arm AOG escalation timers for any unresolved AOG RFQs (fire-and-forget)
  void resumeAogEscalations();

  // Schedule yearly renewal reminder emails (30 days before renewal)
  startRenewalReminderJob();

  // Recompute trust scores for all sellers on startup (fire-and-forget)
  void (async () => {
    try {
      const sellers = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.role, "seller"));
      await Promise.all(sellers.map(s => recomputeAndSave(s.id)));
      logger.info({ count: sellers.length }, "Trust scores recomputed");
    } catch (err) {
      logger.warn({ err }, "Trust score startup recompute failed (non-fatal)");
    }
  })();
});
