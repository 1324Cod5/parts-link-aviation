import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { z } from "zod/v4";
import { db, usersTable, mroProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "../lib/email";
import { logger } from "../lib/logger";
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
  resolveUserContext,
  FULL_ACCESS_PLANS,
  ANALYTICS_PLANS,
  PLAN_LISTING_LIMITS,
  type ComputedRole,
} from "../lib/planEnforcement";

const router: IRouter = Router();

// ─── Disposable email domain blocklist ────────────────────────────────────────────
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org",
      "tempmail.com","temp-mail.org","temp-mail.io","throwaway.email","dispostable.com",
        "maildrop.cc","yopmail.com","yopmail.fr","trashmail.com","trashmail.me",
          "trashmail.net","trashmail.at","trashmail.io","trashmail.org",
            "fakeinbox.com","sharklasers.com","grr.la","spam4.me","spamgourmet.com",
              "mailnull.com","getonemail.com","filzmail.com","discardmail.com",
                "spamfree.eu","binkmail.com","owlpic.com","spambox.us","spambog.com",
                  "smellfear.com","selfdestructingmail.com","spamavert.com",
                  ]);

                  function isDisposableEmail(email: string): boolean {
                    const domain = email.split("@")[1]?.toLowerCase();
                      if (!domain) return true;
                        return DISPOSABLE_EMAIL_DOMAINS.has(domain);
                        }

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const switchRoleSchema = z.object({
  role: z.enum(["buyer", "seller", "admin"]),
});

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
 * Computes effectivePlan + computedRole using the user's activeRole.
 * Returns null if the computed role is not a valid system role.
 */
function deriveRole(
  user: typeof usersTable.$inferSelect,
  hasMroProfile: boolean,
): { effectivePlan: string; computedRole: ComputedRole } | null {
  // Use activeRole for context-sensitive role derivation; fall back to role for
  // accounts created before Option A migration.
  const activeRole = user.activeRole ?? user.role;
  const effectivePlan = getEffectivePlan({
    role: activeRole,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    gracePeriodEnd: user.gracePeriodEnd,
  });
  const computedRole = getComputedRole(activeRole, effectivePlan, hasMroProfile);
  if (!computedRole) return null;
  assertValidComputedRole(computedRole);
  return { effectivePlan, computedRole };
}

function serializeUser(
  user: typeof usersTable.$inferSelect,
  computedRole: ComputedRole,
) {
  const activeRole = user.activeRole ?? user.role;
  const roles = user.roles ?? [user.role];

  return GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: activeRole,         // backward-compat: equals activeRole
    roles,
    activeRole,
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

  const { password, contactName, phone, country } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

    // Block disposable/fake email domains
      if (isDisposableEmail(email)) {
          res.status(400).json({ error: "Please use a real business or personal email address. Disposable email addresses are not accepted." });
              return;
                }

  // Get requested role from body — default to "seller" if not provided.
  const requestedRole: "buyer" | "seller" = req.body.role === "buyer" ? "buyer" : "seller";

  // Company name: required for sellers, defaults to contact name for buyers.
  const companyName: string =
    typeof parsed.data.companyName === "string" && parsed.data.companyName.trim()
      ? parsed.data.companyName.trim()
      : requestedRole === "buyer"
        ? contactName
        : "";

  if (requestedRole === "seller" && !companyName) {
    res.status(400).json({ error: "Company name is required for seller accounts." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    role: requestedRole,
    roles: [requestedRole],
    activeRole: requestedRole,
    companyName,
    contactName,
    phone: phone ?? null,
    country: country ?? null,
  }).returning();

  const computedRole = getComputedRole(requestedRole, "free", false)!;

  // Generate email verification token
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.update(usersTable)
    .set({ emailVerificationToken: verifyToken, emailVerificationExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));
  try {
    await sendVerificationEmail(user.email, user.contactName ?? user.email, verifyToken);
  } catch (emailErr) {
    logger.warn({ emailErr }, "Failed to send verification email");
  }

  res.status(201).json({ message: "Registration successful. Please check your email to verify your account.", requiresVerification: true });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

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

  // Check email verification
  if (!user.emailVerified) {
    res.status(403).json({ error: "EMAIL_NOT_VERIFIED", message: "Please verify your email address before logging in." });
    return;
  }

  // Success — reset lockout counters
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session!.userId = user.id;
  console.log(`LOGIN SUCCESS | email=${email} | userId=${user.id} | activeRole=${user.activeRole ?? user.role} | computedRole=${derived.computedRole}`);

  await new Promise<void>((resolve, reject) =>
    req.session!.save(err => (err ? reject(err) : resolve()))
  );

  const sessionId = req.session!.id;
  console.log(`COOKIE SET | sessionId=${sessionId} | userId=${user.id}`);

  res.json({ user: serializeUser(user, derived.computedRole) });
});

// ─── Form-based login (native browser POST → server-side redirect) ────────────
router.post("/auth/login-form", async (req, res): Promise<void> => {
  const rawEmail: string = (req.body?.email ?? "").trim().toLowerCase();
  const password: string = req.body?.password ?? "";
  const loginPage = "/seller/login";

  const errorRedirect = (msg: string) => {
    const params = new URLSearchParams({ error: msg, email: rawEmail });
    res.redirect(302, `${loginPage}?${params.toString()}`);
  };

  console.log(`LOGIN ATTEMPT: ${rawEmail}`);

  if (!rawEmail || !password) {
    return errorRedirect("Email and password are required.");
  }

  // User lookup
  const rows = await db
    .select({ user: usersTable, mroProfileId: mroProfilesTable.id })
    .from(usersTable)
    .leftJoin(mroProfilesTable, eq(mroProfilesTable.userId, usersTable.id))
    .where(eq(usersTable.email, rawEmail));

  const found = rows.length > 0;
  console.log(`USER FOUND: ${found ? "yes" : "no"}`);

  if (!found) {
    return errorRedirect("Invalid email or password.");
  }

  const { user, mroProfileId } = rows[0];
  const hasMroProfile = mroProfileId != null;

  if (user.status === "suspended") {
    return errorRedirect("This account has been suspended. Contact support.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return errorRedirect(`Account locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  // Password check
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  console.log(`PASSWORD MATCH: ${passwordMatch ? "yes" : "no"}`);

  if (!passwordMatch) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
    const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
    await db.update(usersTable)
      .set({ failedLoginAttempts: newAttempts, lockedUntil: lockUntil, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    const msg = shouldLock
      ? `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in 15 minutes.`
      : `Invalid email or password. ${MAX_FAILED_ATTEMPTS - newAttempts} attempt${MAX_FAILED_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`;
    return errorRedirect(msg);
  }

  // Role check
  const derived = deriveRole(user, hasMroProfile);
  if (!derived) {
    return errorRedirect("This account does not have a valid system role. Contact support.");
  }

  // Check email verification (skip for admin accounts)
  const _roles = user.roles ?? [user.role];
  if (!user.emailVerified && !_roles.includes("admin") && user.role !== "admin") {
    return res.redirect(`/seller/login?error=email_not_verified&email=${encodeURIComponent(user.email)}`);
  }

  // Reset lockout counters on success
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // For the admin portal (form-based login): if the user has "admin" anywhere
  // in their roles array (or as their primary role), treat this as an admin
  // login regardless of their current activeRole setting. This allows dual-role
  // accounts (admin + seller on the same email) to reach /admin/dashboard while
  // still having activeRole="seller" for main-site logins.
  const userRoles = user.roles ?? [user.role];
  const hasAdminRole = userRoles.includes("admin") || user.role === "admin";
  const sessionActiveRole = hasAdminRole ? "admin" : (user.activeRole ?? user.role);

  // Map to a simple base role for session + redirect
  const baseRole: string = hasAdminRole
    ? "admin"
    : derived.computedRole === "buyer"
      ? "buyer"
      : derived.computedRole.startsWith("mro_")
        ? "mro"
        : "seller";

  const effectivePlan = getEffectivePlan({
    role: sessionActiveRole,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    gracePeriodEnd: user.gracePeriodEnd,
  });
  req.session!.userId = user.id;
  req.session!.user = {
    id: String(user.id),
    email: user.email,
    role: sessionActiveRole,
    roles: userRoles,
    activeRole: sessionActiveRole,
    subscriptionTier: effectivePlan,
    subscriptionStatus: "active",
    permissions: {
      canCreateListings: baseRole === "seller" || baseRole === "mro" || baseRole === "admin",
      rfqFullAccess: FULL_ACCESS_PLANS.has(effectivePlan),
      maxListings: PLAN_LISTING_LIMITS[effectivePlan] ?? 5,
    },
  };
  await new Promise<void>((resolve, reject) =>
    req.session!.save(err => (err ? reject(err) : resolve()))
  );

  console.log(`SESSION CREATED: yes | sessionId=${req.session!.id} | userId=${user.id} | activeRole=${sessionActiveRole} | baseRole=${baseRole}`);

  if (baseRole === "admin") {
    res.redirect(302, user.mustChangePassword ? "/admin/change-password" : "/admin/dashboard");
  } else if (baseRole === "seller" || baseRole === "mro") {
    res.redirect(302, "/seller/dashboard");
  } else if (baseRole === "buyer") {
    res.redirect(302, "/marketplace");
  } else {
    return errorRedirect("Unrecognised account role. Contact support.");
  }
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


router.patch("/auth/update-profile", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { companyName, contactName } = req.body ?? {};
  if (!companyName && !contactName) {
    res.status(400).json({ error: "At least one field (companyName or contactName) is required." });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof companyName === "string" && companyName.trim()) {
    updates.companyName = companyName.trim();
  }
  if (typeof contactName === "string" && contactName.trim()) {
    updates.contactName = contactName.trim();
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

  const result = await fetchUserWithMro(userId);
  if (!result) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const derived = deriveRole(result.user, result.hasMroProfile);
  if (!derived) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({ user: serializeUser(result.user, derived.computedRole) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session!.destroy(() => {});
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  const cookieHeader = req.headers.cookie ?? "NONE";
  const hasSid = cookieHeader.includes("connect.sid");
  if (!userId) {
    console.log(`SESSION MISSING | sessionId=${req.session?.id ?? "none"} | hasCookie=${hasSid} | cookie=${cookieHeader.slice(0, 120)}`);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  console.log(`SESSION FOUND | sessionId=${req.session!.id} | userId=${userId}`);

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

// ─── GET /permissions/me ──────────────────────────────────────────────────────
router.get("/permissions/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const ctx = await resolveUserContext(userId);
  if (!ctx) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { effectivePlan, computedRole } = ctx;

  res.json({
    computedRole,
    plan: effectivePlan,
    canViewFullRfqs: FULL_ACCESS_PLANS.has(effectivePlan),
    canRespondToRfqs: FULL_ACCESS_PLANS.has(effectivePlan),
    canViewAnalytics: ANALYTICS_PLANS.has(effectivePlan),
    listingLimit: PLAN_LISTING_LIMITS[effectivePlan] ?? 5,
    canUploadCertifications: computedRole !== "admin",
  });
});

// ─── POST /user/switch-role ───────────────────────────────────────────────────
// Switches the active role for the current session. The requested role must
// exist in the user's `roles` array — you cannot switch to a role you don't have.
router.post("/user/switch-role", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = switchRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { role: newRole } = parsed.data;

  const result = await fetchUserWithMro(userId);
  if (!result) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { user, hasMroProfile } = result;

  // Validate the requested role is one this account actually has
  const userRoles = user.roles ?? [user.role];
  if (!userRoles.includes(newRole)) {
    res.status(400).json({
      error: `Role "${newRole}" is not available on this account. Available roles: ${userRoles.join(", ")}`,
    });
    return;
  }

  // Update activeRole in DB
  await db.update(usersTable)
    .set({ activeRole: newRole, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  // Re-derive role with new activeRole
  const updatedUser = { ...user, activeRole: newRole };
  const derived = deriveRole(updatedUser, hasMroProfile);
  if (!derived) {
    res.status(400).json({ error: "Invalid role combination. Contact support." });
    return;
  }

  console.log(`ROLE SWITCH | userId=${userId} | from=${user.activeRole} | to=${newRole} | computedRole=${derived.computedRole}`);
  res.json({ user: serializeUser(updatedUser, derived.computedRole) });
});

// ─── Debug bypass (development only) ─────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  router.get("/debug/login-free-seller", async (req, res): Promise<void> => {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "freeseller@test.com"))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Debug user freeseller@test.com not found. Run seed first." });
      return;
    }

    req.session!.userId = user.id;

    await new Promise<void>((resolve, reject) => {
      req.session!.save((err) => { if (err) reject(err); else resolve(); });
    });

    console.log(`DEBUG LOGIN | userId=${user.id} | email=${user.email} | sessionId=${req.session!.id}`);

    res.redirect("/seller/dashboard");
  });
}

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.query as { token: string };
  if (!token) {
    res.redirect("/seller/login?error=invalid_token");
    return;
  }

  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.emailVerificationToken, token))
    .limit(1);

  if (!user) {
    res.redirect("/seller/login?error=invalid_token");
    return;
  }
  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    res.redirect("/seller/login?error=token_expired");
    return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.redirect("/seller/login?verified=true");
});

export default router;
