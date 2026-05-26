import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const STRIPE_API_VERSION = "2025-08-27.basil" as any;

// Hardcoded price → plan mapping (from the owner's Stripe account)
const PRICE_PLAN_MAP: Record<string, "pro" | "enterprise" | "mission_control"> = {
  "price_1TbO7VLizlhnDGCHA637d5aj": "pro",
  "price_1TbO7eLizlhnDGCHEnspozSd": "enterprise",
  "price_1TbO7pLizlhnDGCHIGNJLoUd": "mission_control",
};

const PLAN_NAMES: Record<string, string> = {
  pro: "Solo Operator",
  enterprise: "Fleet Manager",
  mission_control: "Mission Control",
};

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured in Replit Secrets");
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

function getBaseUrl(req: any): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : `${req.protocol}://${req.get("host")}`;
}

// ─── POST /stripe/create-checkout-session ────────────────────────────────────
router.post("/stripe/create-checkout-session", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { priceId } = req.body as { priceId?: string };
  if (!priceId || typeof priceId !== "string") {
    res.status(400).json({ error: "priceId is required" });
    return;
  }
  if (!PRICE_PLAN_MAP[priceId]) {
    res.status(400).json({ error: "Unrecognised priceId" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  try {
    const stripe = getStripeClient();

    // Find or create Stripe customer
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.companyName,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db.update(usersTable)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }

    const base = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${base}/seller/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/seller/subscription/cancel`,
      currency: "usd",
      subscription_data: {
        metadata: { userId: String(user.id) },
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: err.message ?? "Failed to create checkout session" });
  }
});

// ─── POST /stripe/verify-session ─────────────────────────────────────────────
// Called by the success page to confirm payment and update plan in DB.
router.post("/stripe/verify-session", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "subscription"],
    });

    if (session.status !== "complete" && session.payment_status !== "paid") {
      res.status(400).json({ error: "Payment not completed" });
      return;
    }

    // Extract priceId from session line items
    const priceId: string | undefined = (session.line_items as any)?.data?.[0]?.price?.id;
    const plan = priceId ? PRICE_PLAN_MAP[priceId] : undefined;

    if (!plan) {
      res.status(400).json({ error: "Could not determine plan from session" });
      return;
    }

    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as any)?.id ?? null;
    const customerId = typeof session.customer === "string"
      ? session.customer
      : (session.customer as any)?.id ?? null;

    await db.update(usersTable)
      .set({
        plan: plan as any,
        subscriptionStatus: "active",
        stripeSubscriptionId: subscriptionId,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    logger.info({ userId, plan, subscriptionId }, "Plan updated via verify-session");
    res.json({ ok: true, plan, planName: PLAN_NAMES[plan] ?? plan });
  } catch (err: any) {
    logger.error({ err }, "Failed to verify Stripe session");
    res.status(500).json({ error: err.message ?? "Failed to verify session" });
  }
});

export default router;
