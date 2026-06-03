import app from "./app";
import { logger } from "./lib/logger";
import { seedAdmin } from "./lib/seed-admin";
import { seedTestAccounts } from "./lib/seed-test-accounts";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recomputeAndSave } from "./lib/trustScore";
import { resumeAogEscalations } from "./lib/aogEscalation";
import { startRenewalReminderJob } from "./lib/renewalReminder";

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
