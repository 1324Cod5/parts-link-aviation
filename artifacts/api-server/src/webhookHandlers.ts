import Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getStripeSync } from "./stripeClient";
import { logger } from "./lib/logger";

const STRIPE_API_VERSION = "2025-08-27.basil" as any;

const PRICE_PLAN_MAP: Record<string, "pro" | "enterprise" | "mission_control"> = {
  "price_1TbO7VLizlhnDGCHA637d5aj": "pro",
  "price_1TbO7eLizlhnDGCHEnspozSd": "enterprise",
  "price_1TbO7pLizlhnDGCHIGNJLoUd": "mission_control",
};

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Payload must be a Buffer. Ensure the webhook route is registered BEFORE express.json().",
      );
    }

    // ── Path A: env-var Stripe keys (bypasses stripe-replit-sync) ──────────────
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        throw new Error(`Stripe webhook signature verification failed: ${err.message}`);
      }
      await WebhookHandlers.syncUserFromEvent(event as any);
      return;
    }

    // ── Path B: Replit connectors (stripe-replit-sync) ─────────────────────────
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      await WebhookHandlers.syncUserFromEvent(event);
    } catch (err) {
      logger.warn({ err }, "Failed to sync user from Stripe webhook event");
    }
  }

  static async syncUserFromEvent(event: any): Promise<void> {
    const { type, data } = event;
    const obj = data?.object;
    if (!obj) return;

    if (type === "checkout.session.completed") {
      await WebhookHandlers.handleCheckoutCompleted(obj);
    } else if (type.startsWith("customer.subscription.")) {
      await WebhookHandlers.handleSubscriptionObject(obj, type);
    } else if (type === "invoice.payment_succeeded" || type === "invoice.payment_failed") {
      const subscriptionId = obj.subscription;
      if (!subscriptionId) return;

      if (process.env.STRIPE_WEBHOOK_SECRET) {
        // Env-var path: look up subscription directly from Stripe API
        if (process.env.STRIPE_SECRET_KEY) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            await WebhookHandlers.handleSubscriptionObject(
              sub,
              type === "invoice.payment_succeeded" ? "payment_succeeded" : "payment_failed",
            );
          } catch (err) {
            logger.warn({ err, subscriptionId }, "Could not retrieve subscription from Stripe");
          }
        }
      } else {
        // stripe-replit-sync path: query synced stripe schema tables
        try {
          const result = await db.execute(
            sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
          );
          const sub = result.rows[0];
          if (sub) {
            await WebhookHandlers.handleSubscriptionObject(
              sub,
              type === "invoice.payment_succeeded" ? "payment_succeeded" : "payment_failed",
            );
          }
        } catch (err) {
          logger.warn({ err, subscriptionId }, "Could not query stripe.subscriptions");
        }
      }
    }
  }

  static async handleCheckoutCompleted(session: any): Promise<void> {
    const customerId = session.customer as string | null;
    const customerEmail = (session.customer_email ?? session.customer_details?.email) as string | null;

    let user: typeof usersTable.$inferSelect | undefined;

    if (customerId) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, customerId));
    }
    if (!user && customerEmail) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.email, customerEmail));
    }

    if (!user) {
      logger.warn({ customerId, customerEmail }, "checkout.session.completed: no user found");
      return;
    }

    // Resolve plan from line item price ID
    const priceId: string | undefined = (session.line_items as any)?.data?.[0]?.price?.id;
    const plan = priceId ? PRICE_PLAN_MAP[priceId] : undefined;

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

    await db.update(usersTable).set({
      subscriptionStatus: "active",
      ...(plan ? { plan: plan as any } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));

    logger.info({ userId: user.id, plan, subscriptionId }, "checkout.session.completed: plan updated");
  }

  static async handleSubscriptionObject(sub: any, eventType: string): Promise<void> {
    const customerId = sub.customer;
    if (!customerId) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId));
    if (!user) {
      logger.warn({ customerId }, "Stripe webhook: no user found for customer");
      return;
    }

    let ourStatus: "active" | "trial" | "past_due" | "cancelled" | "suspended";
    const stripeStatus = String(sub.status ?? "");
    switch (stripeStatus) {
      case "active":        ourStatus = "active";    break;
      case "trialing":      ourStatus = "trial";     break;
      case "past_due":
      case "incomplete":    ourStatus = "past_due";  break;
      case "canceled":      ourStatus = "cancelled"; break;
      case "unpaid":        ourStatus = "suspended"; break;
      default:              ourStatus = "cancelled";
    }

    if (eventType === "payment_succeeded") ourStatus = "active";
    if (eventType === "payment_failed")    ourStatus = "past_due";

    let newPlan = user.plan;
    const priceId =
      (sub.items as any)?.data?.[0]?.price?.id ??
      (sub.plan as any)?.id ??
      null;

    if (priceId) {
      // Hardcoded map first (always reliable)
      if (PRICE_PLAN_MAP[priceId]) {
        newPlan = PRICE_PLAN_MAP[priceId] as any;
      } else {
        // Try synced stripe schema
        try {
          const priceResult = await db.execute(sql`
            SELECT p.metadata
            FROM stripe.prices pr
            JOIN stripe.products p ON p.id = pr.product
            WHERE pr.id = ${priceId}
          `);
          const metadata = priceResult.rows[0]?.metadata as Record<string, string> | undefined;
          if (metadata?.plan) newPlan = metadata.plan as any;
        } catch (err) {
          logger.warn({ err, priceId }, "Could not resolve plan from Stripe price metadata");
        }
      }
    }

    let billingCycle: "monthly" | "yearly" = (user.billingCycle as "monthly" | "yearly") ?? "monthly";
    if (priceId) {
      try {
        const intervalResult = await db.execute(sql`
          SELECT recurring->>'interval' AS interval
          FROM stripe.prices WHERE id = ${priceId}
        `);
        const interval = intervalResult.rows[0]?.interval as string | undefined;
        if (interval === "year") billingCycle = "yearly";
        else if (interval === "month") billingCycle = "monthly";
      } catch (_) { /* ignore */ }
    }

    const rawPeriodEnd = sub.current_period_end;
    const currentPeriodEnd = rawPeriodEnd ? new Date(Number(rawPeriodEnd) * 1000) : null;

    let gracePeriodEnd: Date | null = null;
    if (ourStatus === "past_due" && currentPeriodEnd) {
      gracePeriodEnd = new Date(currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    if (eventType === "payment_succeeded") gracePeriodEnd = null;

    if (ourStatus === "cancelled" || ourStatus === "suspended") newPlan = "free";

    const rawTrialEnd = sub.trial_end;
    const trialEndsAt = rawTrialEnd ? new Date(Number(rawTrialEnd) * 1000) : null;

    await db.update(usersTable).set({
      subscriptionStatus: ourStatus,
      stripeSubscriptionId: String(sub.id),
      plan: newPlan as any,
      currentPeriodEnd,
      gracePeriodEnd,
      trialEndsAt,
      billingCycle,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));

    logger.info({ userId: user.id, plan: newPlan, status: ourStatus, eventType }, "User subscription synced");
  }
}
