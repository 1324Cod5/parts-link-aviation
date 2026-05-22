/**
 * Subscription enforcement middleware.
 *
 * All guards here query the database fresh — never rely on stale session data.
 * This makes Stripe the authoritative source of truth: plan + subscription
 * status are always current, not a cached snapshot from login time.
 */
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEffectivePlan } from "./planEnforcement";

// ─── Shared DB lookup ─────────────────────────────────────────────────────────

async function fetchUserPlanRow(userId: number) {
  const [user] = await db
    .select({
      plan: usersTable.plan,
      role: usersTable.role,
      subscriptionStatus: usersTable.subscriptionStatus,
      gracePeriodEnd: usersTable.gracePeriodEnd,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user ?? null;
}

// ─── requirePlanMiddleware ────────────────────────────────────────────────────

/**
 * Returns Express middleware that enforces `allowedPlans` using a fresh DB query.
 *
 * On failure it returns one of two 402 shapes:
 *   - code "SUBSCRIPTION_INACTIVE" — user had the right plan but payment lapsed
 *   - code "PLAN_REQUIRED"         — user never had a qualifying plan
 *
 * Admin / super_admin users always pass regardless of plan.
 */
export function requirePlanMiddleware(allowedPlans: Set<string>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await fetchUserPlanRow(userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Admins bypass plan gates
    if (user.role === "admin" || user.role === "super_admin") {
      next();
      return;
    }

    const effectivePlan = getEffectivePlan(user);

    if (allowedPlans.has(effectivePlan)) {
      next();
      return;
    }

    // Distinguish "right plan, lapsed payment" from "wrong plan altogether"
    if (allowedPlans.has(user.plan) && effectivePlan !== user.plan) {
      res.status(402).json({
        error: "Your subscription is no longer active. Reactivate to access this feature.",
        code: "SUBSCRIPTION_INACTIVE",
        subscriptionStatus: user.subscriptionStatus,
        plan: user.plan,
        upgradeUrl: "/seller/subscription",
      });
    } else {
      const planList = [...allowedPlans]
        .map(p => p.replace(/_/g, " "))
        .join(", ");
      res.status(402).json({
        error: `This feature requires a ${planList} plan.`,
        code: "PLAN_REQUIRED",
        effectivePlan,
        requiredPlans: [...allowedPlans],
        upgradeUrl: "/pricing",
      });
    }
  };
}

// ─── requireAnyPaidPlanMiddleware ─────────────────────────────────────────────

const ANY_PAID_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium"]);

/**
 * Middleware that requires any active paid subscription.
 * Used for features like email alerts that are gated to paid plans.
 */
export const requireAnyPaidPlanMiddleware = requirePlanMiddleware(ANY_PAID_PLANS);

// ─── hasActivePaidPlan ────────────────────────────────────────────────────────

/**
 * Non-middleware helper — returns true when the seller currently has an
 * active paid plan. Used server-side before sending email notifications.
 */
export async function hasActivePaidPlan(userId: number): Promise<boolean> {
  const user = await fetchUserPlanRow(userId);
  if (!user) return false;
  const effectivePlan = getEffectivePlan(user);
  return ANY_PAID_PLANS.has(effectivePlan);
}
