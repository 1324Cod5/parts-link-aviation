import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getStripeSync } from "./stripeClient";
import { logger } from "./lib/logger";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Payload must be a Buffer. Ensure the webhook route is registered BEFORE express.json().",
      );
    }

    // 1. Let stripe-replit-sync validate the signature and sync to stripe.* schema tables.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // 2. Parse the verified event and sync our users table accordingly.
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

    if (type.startsWith("customer.subscription.")) {
      await WebhookHandlers.handleSubscriptionObject(obj, type);
    } else if (type === "invoice.payment_succeeded" || type === "invoice.payment_failed") {
      const subscriptionId = obj.subscription;
      if (!subscriptionId) return;

      // Query the synced stripe schema for the latest subscription state.
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
    }
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

    // Map Stripe subscription status → our subscription_status enum.
    let ourStatus: "active" | "trial" | "past_due" | "cancelled" | "suspended";
    const stripeStatus = String(sub.status ?? "");
    switch (stripeStatus) {
      case "active":
        ourStatus = "active";
        break;
      case "trialing":
        ourStatus = "trial";
        break;
      case "past_due":
      case "incomplete":
        ourStatus = "past_due";
        break;
      case "canceled":
        ourStatus = "cancelled";
        break;
      case "unpaid":
        ourStatus = "suspended";
        break;
      default:
        ourStatus = "cancelled";
    }

    // Override status for payment events.
    if (eventType === "payment_succeeded") ourStatus = "active";
    if (eventType === "payment_failed") ourStatus = "past_due";

    // Derive the plan from the Stripe price's product metadata.
    let newPlan = user.plan;
    const priceId =
      (sub.items as any)?.data?.[0]?.price?.id ??
      (sub.plan as any)?.id ??
      null;

    if (priceId) {
      try {
        const priceResult = await db.execute(sql`
          SELECT p.metadata
          FROM stripe.prices pr
          JOIN stripe.products p ON p.id = pr.product
          WHERE pr.id = ${priceId}
        `);
        const metadata = priceResult.rows[0]?.metadata as Record<string, string> | undefined;
        if (metadata?.plan) {
          newPlan = metadata.plan as any;
        }
      } catch (err) {
        logger.warn({ err, priceId }, "Could not resolve plan from Stripe price metadata");
      }
    }

    // Derive billing cycle (monthly | yearly) from the Stripe price interval.
    let billingCycle: "monthly" | "yearly" = user.billingCycle as "monthly" | "yearly" ?? "monthly";
    if (priceId) {
      try {
        const intervalResult = await db.execute(sql`
          SELECT recurring->>'interval' AS interval
          FROM stripe.prices
          WHERE id = ${priceId}
        `);
        const interval = intervalResult.rows[0]?.interval as string | undefined;
        if (interval === "year") billingCycle = "yearly";
        else if (interval === "month") billingCycle = "monthly";
      } catch (err) {
        logger.warn({ err, priceId }, "Could not resolve billing interval from Stripe price");
      }
    }

    // Grace period: 7 days after the subscription period end on payment failure.
    const rawPeriodEnd = sub.current_period_end;
    const currentPeriodEnd = rawPeriodEnd ? new Date(Number(rawPeriodEnd) * 1000) : null;

    let gracePeriodEnd: Date | null = null;
    if (ourStatus === "past_due" && currentPeriodEnd) {
      gracePeriodEnd = new Date(currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // Clear grace period when payment is recovered.
    if (eventType === "payment_succeeded") gracePeriodEnd = null;

    // Downgrade to free on cancellation / suspension.
    if (ourStatus === "cancelled" || ourStatus === "suspended") {
      newPlan = "free";
    }

    const rawTrialEnd = sub.trial_end;
    const trialEndsAt = rawTrialEnd ? new Date(Number(rawTrialEnd) * 1000) : null;

    await db
      .update(usersTable)
      .set({
        subscriptionStatus: ourStatus,
        stripeSubscriptionId: String(sub.id),
        plan: newPlan as any,
        currentPeriodEnd,
        gracePeriodEnd,
        trialEndsAt,
        billingCycle,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    logger.info(
      { userId: user.id, plan: newPlan, status: ourStatus, eventType },
      "User subscription synced from Stripe webhook",
    );
  }
}
