import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, mroProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
  GetCurrentUserResponse,
  ChangePasswordBody,
} from "@workspace/api-zod";
import {
  getEffectivePlan,
  getComputedRole,
  assertValidComputedRole,
  type ComputedRole,
} from "../lib/planEnforcement";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches the user + MRO profile presence from DB.
 * Returns null if not found.
 */
async function fetchUserWithMro(userId: number) {
  const rows = await db
    .select({
      user: usersTable,
      mroProfileId: mroProfilesTable.id,
    })
    .from(usersTable)
    .leftJoin(mroProfilesTable, eq(mroProfilesTable.userId, usersTable.id))
    .where(eq(usersTable.id, userId));

  if (!rows.length) return null;
  return { user: rows[0].user, hasMroProfile: rows[0].mroProfileId != null };
}

/**
 * Computes effectivePlan + computedRole for a user row.
 * Returns null if the computed role is not a valid system role.
 */
function deriveRole(
  user: typeof usersTable.$inferSelect,
  hasMroProfile: boolean,
): { effectivePlan: string; computedRole: ComputedRole } | null {
  const effectivePlan = getEffectivePlan({
    role: user.role,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    gracePeriodEnd: user.gracePeriodEnd,
  });
  const computedRole = getComputedRole(user.role, effectivePlan, hasMroProfile);
  if (!computedRole) return null;
  assertValidComputedRole(computedRole);
  return { effectivePlan, computedRole };
}

function serializeUser(
  user: typeof usersTable.$inferSelect,
  computedRole: ComputedRole,
) {
  return GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    computedRole,
    companyName: user.companyName,
    contactName: user.contactName,
    phone: user.phone,
    country: user.country,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    subscriptionStatus: user.subscriptionStatus ?? null,
    mustChangePassword: user.mustChangePassword,
    trustScore: user.trustScore ?? 0,
    trustBadge: user.trustBadge ?? "unverified",
    trustScoreBreakdown: user.trustScoreBreakdown ?? null,
    createdAt: user.createdAt.toISOString(),
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, companyName, contactName, phone, country } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    role: "seller",
    companyName,
    contactName,
    phone: phone ?? null,
    country: country ?? null,
  }).returning();

  // New registrations always start as seller_free — no MRO profile yet
  const computedRole = getComputedRole("seller", "free", false)!;
  req.session!.userId = user.id;
  res.status(201).json({ user: serializeUser(user, computedRole) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  // Fetch user + MRO profile in one query
  const rows = await db
    .select({
      user: usersTable,
      mroProfileId: mroProfilesTable.id,
    })
    .from(usersTable)
    .leftJoin(mroProfilesTable, eq(mroProfilesTable.userId, usersTable.id))
    .where(eq(usersTable.email, email));

  if (!rows.length) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const { user, mroProfileId } = rows[0];
  const hasMroProfile = mroProfileId != null;

  // Check suspension
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account has been suspended. Contact support." });
    return;
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({
      error: `Account locked after too many failed attempts. Try again in ${remaining} minute${remaining === 1 ? "" : "s"}.`,
      lockedUntil: user.lockedUntil.toISOString(),
    });
    return;
  }

  // Validate password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await db.update(usersTable)
      .set({
        failedLoginAttempts: newAttempts,
        lockedUntil: shouldLock ? lockedUntil : user.lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    if (shouldLock) {
      res.status(429).json({
        error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in 15 minutes.`,
        lockedUntil: lockedUntil!.toISOString(),
      });
    } else {
      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      res.status(401).json({
        error: `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
      });
    }
    return;
  }

  // Derive and validate the computed role — deny login if not a recognised role
  const derived = deriveRole(user, hasMroProfile);
  if (!derived) {
    res.status(403).json({
      error: "This account does not have a valid system role. Contact support.",
    });
    return;
  }

  // Success — reset lockout counters
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session!.userId = user.id;
  res.json({ user: serializeUser(user, derived.computedRole) });
});

router.patch("/auth/change-password", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session!.destroy(() => {});
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = await fetchUserWithMro(userId);
  if (!result) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { user, hasMroProfile } = result;
  const derived = deriveRole(user, hasMroProfile);
  if (!derived) {
    // Role became invalid (e.g. account type changed) — treat as unauthenticated
    req.session!.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(serializeUser(user, derived.computedRole));
});

export default router;
