import { Router, type IRouter } from "express";
import { db, usersTable, listingsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { getEffectivePlan, PLAN_LISTING_LIMITS, FULL_ACCESS_PLANS, MRO_SERVICE_LIMITS } from "../lib/planEnforcement";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSubscriptionInfo(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const effectivePlan = getEffectivePlan(user);

  const [activeRow] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const activeListings = Number(activeRow.count);
  const listingLimit = PLAN_LISTING_LIMITS[effectivePlan] ?? 5;
  const canAddListing = listingLimit === null || activeListings < listingLimit;

  // Grace period days remaining
  let daysUntilGraceExpires: number | null = null;
  if (user.subscriptionStatus === "past_due" && user.gracePeriodEnd) {
    const ms = user.gracePeriodEnd.getTime() - Date.now();
    daysUntilGraceExpires = ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) : 0;
  }

  return {
    plan: user.plan,
    effectivePlan,
    subscriptionStatus: user.subscriptionStatus ?? null,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    gracePeriodEnd: user.gracePeriodEnd?.toISOString() ?? null,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    daysUntilGraceExpires,
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    activeListings,
    listingLimit,
    canAddListing,
    hasFullRfqAccess: FULL_ACCESS_PLANS.has(effectivePlan),
    mroServiceLimit: MRO_SERVICE_LIMITS[effectivePlan] ?? 1,
  };
}

function getBaseUrl(req: any): string {
  // In production use the real domain; in dev fall back to request origin.
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : `${req.protocol}://${req.get("host")}`;
}

// ─── GET /subscription ────────────────────────────────────────────────────────

router.get("/subscription", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const info = await getSubscriptionInfo(userId);
  if (!info) { res.status(404).json({ error: "User not found" }); return; }

  res.json(info);
});

// ─── GET /subscription/products ───────────────────────────────────────────────
// Returns available Stripe plans with price IDs so the frontend can build the pricing UI.

router.get("/subscription/products", async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id            AS product_id,
        p.name          AS product_name,
        p.description   AS product_description,
        p.metadata      AS product_metadata,
        pr.id           AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.metadata     AS price_metadata
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);

    // Group prices by product
    const map = new Map<string, any>();
    for (const row of rows.rows) {
      if (!map.has(String(row.product_id))) {
        map.set(String(row.product_id), {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata ?? {},
          prices: [],
        });
      }
      map.get(String(row.product_id)).prices.push({
        id: row.price_id,
        unitAmount: row.unit_amount,
        currency: row.currency,
        interval: (row.recurring as any)?.interval ?? null,
        metadata: row.price_metadata ?? {},
      });
    }

    const publishableKey = await getStripePublishableKey().catch(() => null);

    res.json({ products: Array.from(map.values()), publishableKey });
  } catch (err) {
    logger.warn({ err }, "Could not fetch Stripe products");
    res.json({ products: [], publishableKey: null });
  }
});

// ─── POST /subscription/checkout ─────────────────────────────────────────────
// Creates a Stripe Checkout session for the given priceId and returns the URL.

router.post("/subscription/checkout", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { priceId } = req.body;
  if (!priceId || typeof priceId !== "string") {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  try {
    const stripe = await getUncachableStripeClient();

    // Find or create the Stripe customer for this user.
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.companyName,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }

    const base = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${base}/seller/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/seller/subscription?cancelled=1`,
      subscription_data: {
        metadata: { userId: String(user.id) },
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Failed to create checkout session", detail: err.message });
  }
});

// ─── POST /subscription/portal ────────────────────────────────────────────────
// Creates a Stripe Billing Portal session so the user can manage their subscription.

router.post("/subscription/portal", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found. Subscribe to a plan first." });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const base = getBaseUrl(req);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/seller/subscription`,
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    logger.error({ err }, "Failed to create Stripe portal session");
    res.status(500).json({ error: "Failed to create billing portal session", detail: err.message });
  }
});

// ─── POST /subscription/cancel ────────────────────────────────────────────────
// Cancels the active subscription at period end.

router.post("/subscription/cancel", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription found." });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    // Cancel at period end (not immediately) to preserve access.
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({ ok: true, message: "Subscription will be cancelled at the end of the current billing period." });
  } catch (err: any) {
    logger.error({ err }, "Failed to cancel Stripe subscription");
    res.status(500).json({ error: "Failed to cancel subscription", detail: err.message });
  }
});

// ─── Legacy admin-only override endpoints ─────────────────────────────────────
// These allow admins to manually set a user's plan outside Stripe.

router.post("/subscription/admin-set-plan", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [caller] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (caller?.role !== "admin" && caller?.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { targetUserId, plan } = req.body;
  if (!targetUserId || !plan) {
    res.status(400).json({ error: "targetUserId and plan are required" });
    return;
  }

  const validPlans = ["free", "pro", "enterprise", "mro_verified", "mro_premium"];
  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
    return;
  }

  await db
    .update(usersTable)
    .set({
      plan: plan as any,
      subscriptionStatus: plan === "free" ? "cancelled" : "active",
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, Number(targetUserId)));

  res.json({ ok: true });
});

export { PLAN_LISTING_LIMITS };
export default router;
