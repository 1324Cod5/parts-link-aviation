import { db, usersTable, mroProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Plan capability tables ────────────────────────────────────────────────────

/** Maximum active parts listings per plan. null = unlimited. */
export const PLAN_LISTING_LIMITS: Record<string, number | null> = {
  free: 5,
  pro: 500,
  enterprise: null,
  mro_verified: 5,
  mro_premium: null,
  mro_provider: 500,
};

/** Maximum MRO service types per plan. null = unlimited. */
export const MRO_SERVICE_LIMITS: Record<string, number | null> = {
  free: 1,
  pro: 15,
  enterprise: null,
  mro_verified: 10,
  mro_premium: null,
  mro_provider: null,
};

/** Plans that get full RFQ buyer contact details and can post RFQ responses. */
export const FULL_ACCESS_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

/** Plans that get analytics access. */
export const ANALYTICS_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

/** Plans that can use bulk upload. */
export const BULK_UPLOAD_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

/** Plans that receive instant RFQ email alerts. */
export const EMAIL_ALERT_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

/** Plans that receive AOG push notifications. */
export const AOG_NOTIFICATION_PLANS = new Set(["pro", "enterprise"]);

/** Plans that get the intelligence dashboard and predictive alerts. */
export const INTELLIGENCE_PLANS = new Set(["enterprise"]);

/** Plans that require an active Stripe subscription to be valid. */
const PAID_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

// ─── Computed role ─────────────────────────────────────────────────────────────

/**
 * The 8 valid combined roles in the system.
 * Derived at runtime from activeRole + effectivePlan + hasMroProfile.
 */
export const VALID_COMPUTED_ROLES = [
  "admin",
  "buyer",
  "seller_free",
  "seller_pro",
  "seller_enterprise",
  "mro_free",
  "mro_verified",
  "mro_premium",
  "mro_provider",
] as const;

export type ComputedRole = (typeof VALID_COMPUTED_ROLES)[number];

/**
 * Throws if the given value is not one of the valid computed roles.
 * Use this at every trust boundary before acting on a role value.
 */
export function assertValidComputedRole(role: unknown): asserts role is ComputedRole {
  if (
    role !== "admin" &&
    role !== "buyer" &&
    role !== "seller_free" &&
    role !== "seller_pro" &&
    role !== "seller_enterprise" &&
    role !== "mro_free" &&
    role !== "mro_verified" &&
    role !== "mro_premium" &&
    role !== "mro_provider"
  ) {
    throw new Error(`Invalid role: ${String(role)}`);
  }
}

/**
 * Derives the combined role from the user's activeRole, effective plan, and
 * whether they have an MRO profile.
 *
 * Returns null if the combination is not a recognised valid role.
 */
export function getComputedRole(
  activeRole: string,
  effectivePlan: string,
  hasMroProfile: boolean,
): ComputedRole | null {
  if (activeRole === "admin" || activeRole === "super_admin") return "admin";

  // Buyer role: no plan/MRO profile needed
  if (activeRole === "buyer") return "buyer";

  if (activeRole === "seller") {
    switch (effectivePlan) {
      case "pro":
        return "seller_pro";
      case "enterprise":
        return "seller_enterprise";
      case "mro_verified":
        return "mro_verified";
      case "mro_premium":
        return "mro_premium";
      case "mro_provider":
        return "mro_provider";
      case "free":
        return hasMroProfile ? "mro_free" : "seller_free";
      default:
        return null;
    }
  }

  // Any unrecognised role has no valid computed role
  return null;
}

// ─── Effective plan resolution ────────────────────────────────────────────────

type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "suspended" | null;

interface PlanUser {
  role: string;
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  gracePeriodEnd: Date | null;
}

/**
 * Returns the effective plan for a user given their subscription state.
 *
 * Rules:
 *  - admin / super_admin                  → bypass subscription check; return stored plan
 *  - buyer                                → always free (no subscription)
 *  - active / trial                       → full paid plan
 *  - past_due within 7-day grace          → full paid plan (grace period)
 *  - past_due after grace expired         → free
 *  - cancelled / suspended                → free
 *  - null status + paid plan              → free  ← prevents silent enterprise grants
 *  - null status + free plan              → free
 */
export function getEffectivePlan(user: PlanUser): string {
  // Admins always get their stored plan — they are not subscription-gated.
  if (user.role === "admin" || user.role === "super_admin") {
    return user.plan;
  }

  // Buyers don't have subscriptions
  if (user.role === "buyer") {
    return "free";
  }

  const status = user.subscriptionStatus;

  if (status === "active" || status === "trial") {
    return user.plan;
  }

  if (status === "past_due") {
    if (user.gracePeriodEnd && new Date() < user.gracePeriodEnd) {
      return user.plan; // Still within 7-day grace period
    }
    return "free";
  }

  // null, cancelled, or suspended:
  // A paid plan MUST have an active subscription — never grant it silently.
  if (PAID_PLANS.has(user.plan)) {
    return "free";
  }

  return "free";
}

/**
 * Fetches user row from DB and returns the effective plan.
 * Returns "free" if the user is not found.
 */
export async function resolveEffectivePlan(userId: number): Promise<string> {
  const [user] = await db
    .select({
      role: usersTable.activeRole,
      plan: usersTable.plan,
      subscriptionStatus: usersTable.subscriptionStatus,
      gracePeriodEnd: usersTable.gracePeriodEnd,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return "free";
  return getEffectivePlan(user);
}

/**
 * Fetches user + MRO profile presence from DB and returns
 * the effective plan AND computed role in one call.
 * Returns null if the user is not found or the computed role is invalid.
 */
export async function resolveUserContext(userId: number): Promise<{
  effectivePlan: string;
  computedRole: ComputedRole;
  hasMroProfile: boolean;
} | null> {
  const rows = await db
    .select({
      role: usersTable.activeRole,
      plan: usersTable.plan,
      subscriptionStatus: usersTable.subscriptionStatus,
      gracePeriodEnd: usersTable.gracePeriodEnd,
      mroProfileId: mroProfilesTable.id,
    })
    .from(usersTable)
    .leftJoin(mroProfilesTable, eq(mroProfilesTable.userId, usersTable.id))
    .where(eq(usersTable.id, userId));

  if (!rows.length) return null;

  const row = rows[0];
  const hasMroProfile = row.mroProfileId != null;
  const effectivePlan = getEffectivePlan({
    role: row.role,
    plan: row.plan,
    subscriptionStatus: row.subscriptionStatus,
    gracePeriodEnd: row.gracePeriodEnd,
  });
  const computedRole = getComputedRole(row.role, effectivePlan, hasMroProfile);

  if (!computedRole) return null;

  return { effectivePlan, computedRole, hasMroProfile };
}
