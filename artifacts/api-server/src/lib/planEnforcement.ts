import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Plan capability tables ────────────────────────────────────────────────────

/** Maximum active parts listings per plan. null = unlimited. */
export const PLAN_LISTING_LIMITS: Record<string, number | null> = {
  free: 5,
  pro: 50,
  enterprise: null,
  mro_verified: 5,
  mro_premium: 20,
};

/** Maximum MRO service types per plan. null = unlimited. */
export const MRO_SERVICE_LIMITS: Record<string, number | null> = {
  free: 1,
  pro: 15,
  enterprise: null,
  mro_verified: 10,
  mro_premium: null,
};

/** Plans that get full RFQ buyer contact details and can post RFQ responses. */
export const FULL_ACCESS_PLANS = new Set(["pro", "enterprise", "mro_premium"]);

/** Plans that get analytics access. */
export const ANALYTICS_PLANS = new Set(["pro", "enterprise", "mro_premium"]);

// ─── Effective plan resolution ────────────────────────────────────────────────

type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "suspended" | null;

interface PlanUser {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  gracePeriodEnd: Date | null;
}

/**
 * Returns the effective plan for a user given their subscription state.
 *
 * Rules:
 *  - active / trial                  → full paid plan
 *  - past_due within 7-day grace     → full paid plan (grace period)
 *  - past_due after grace expired    → free
 *  - cancelled / suspended / null    → free (no active subscription)
 */
export function getEffectivePlan(user: PlanUser): string {
  const status = user.subscriptionStatus;

  if (!status || status === "active" || status === "trial") {
    return user.plan;
  }

  if (status === "past_due") {
    if (user.gracePeriodEnd && new Date() < user.gracePeriodEnd) {
      return user.plan; // Still within 7-day grace period
    }
    return "free";
  }

  // cancelled or suspended
  return "free";
}

/**
 * Fetches user row from DB and returns the effective plan.
 * Returns "free" if the user is not found.
 */
export async function resolveEffectivePlan(userId: number): Promise<string> {
  const [user] = await db
    .select({
      plan: usersTable.plan,
      subscriptionStatus: usersTable.subscriptionStatus,
      gracePeriodEnd: usersTable.gracePeriodEnd,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return "free";
  return getEffectivePlan(user);
}
