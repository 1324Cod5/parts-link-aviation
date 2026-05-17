import app from "./app";
import { logger } from "./lib/logger";
import { seedAdmin } from "./lib/seed-admin";
import { seedTestAccounts } from "./lib/seed-test-accounts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    // 1. Create the stripe schema and all managed tables (idempotent).
    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    // 2. Get StripeSync instance.
    const { getStripeSync } = await import("./stripeClient");
    const stripeSync = await getStripeSync();

    // 3. Register or update the managed webhook endpoint.
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Stripe webhook configured");
    }

    // 4. Backfill all existing Stripe data into local stripe.* tables.
    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err: Error) => logger.warn({ err }, "Stripe backfill failed (non-fatal)"));
  } catch (err) {
    logger.warn({ err }, "Stripe initialization failed — server will start without Stripe");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedAdmin();
  await seedTestAccounts();
  await initStripe();
});
