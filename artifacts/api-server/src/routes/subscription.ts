import { Router, type IRouter } from "express";
import { db, usersTable, listingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
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
    billingCycle: (user.billingCycle ?? "monthly") as "monthly" | "yearly",
  };
}

// ─── GET /subscription ────────────────────────────────────────────────────────

router.get("/subscription", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const info = await getSubscriptionInfo(userId);
  if (!info) { res.status(404).json({ error: "User not found" }); return; }

  res.json(info);
});

// ─── POST /subscription/admin-set-plan ───────────────────────────────────────
// Admin-only: manually set a user's plan.

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

  const validPlans = ["free", "pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"];
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

  logger.info({ targetUserId, plan }, "Admin set plan");
  res.json({ ok: true });
});

export { PLAN_LISTING_LIMITS };
export default router;
