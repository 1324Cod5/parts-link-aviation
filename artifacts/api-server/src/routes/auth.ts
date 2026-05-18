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
  resolveUserContext,
  FULL_ACCESS_PLANS,
  ANALYTICS_PLANS,
  PLAN_LISTING_LIMITS,
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

  const { password, companyName, contactName, phone, country } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

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

  // Success — reset lockout counters
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session!.userId = user.id;
  console.log(`LOGIN SUCCESS | email=${email} | userId=${user.id} | role=${derived.computedRole}`);

  // Explicitly save the session before responding so the cookie is guaranteed
  // to be committed to the store before the browser makes its next request.
  await new Promise<void>((resolve, reject) =>
    req.session!.save(err => (err ? reject(err) : resolve()))
  );

  const sessionId = req.session!.id;
  console.log(`COOKIE SET | sessionId=${sessionId} | userId=${user.id}`);

  res.json({ user: serializeUser(user, derived.computedRole) });
});

// ─── Form-based login (native browser POST → server-side redirect) ────────────
// This endpoint is called by the HTML login form (not AJAX/fetch).
// Because the response is a browser navigation (302), the Set-Cookie header is
// always stored — unlike AJAX fetch responses, which browsers block in cross-site
// iframe contexts (e.g. Replit preview pane).
//
// On success  → redirects to the appropriate dashboard by role.
// On failure  → redirects back to /seller/login?error=<msg>&email=<email>
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

  // Reset lockout counters on success
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // Set session with both formats for maximum compatibility
  const effectivePlan = getEffectivePlan(user);
  req.session!.userId = user.id;
  req.session!.user = {
    id: String(user.id),
    email: user.email,
    role: derived.computedRole,
    subscriptionTier: effectivePlan,
    subscriptionStatus: "active",
    permissions: {
      canCreateListings: true,
      rfqFullAccess: FULL_ACCESS_PLANS.has(effectivePlan),
      maxListings: PLAN_LISTING_LIMITS[effectivePlan] ?? 5,
    },
  };
  await new Promise<void>((resolve, reject) =>
    req.session!.save(err => (err ? reject(err) : resolve()))
  );

  const sessionCreated = !!req.session?.userId;
  console.log(`SESSION CREATED: ${sessionCreated ? "yes" : "no"} | sessionId=${req.session!.id} | userId=${user.id} | role=${derived.computedRole}`);

  // Redirect to the correct dashboard by role
  if (derived.computedRole === "admin") {
    res.redirect(302, user.mustChangePassword ? "/admin/change-password" : "/admin");
  } else if (derived.computedRole.startsWith("seller_")) {
    res.redirect(302, "/seller/dashboard");
  } else if (derived.computedRole.startsWith("mro_")) {
    res.redirect(302, "/mro");
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
// Returns the current user's server-derived permissions.
// All permission checks MUST be derived server-side via this endpoint.
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

// ─── Debug bypass (development only) ─────────────────────────────────────────
// Visit /api/debug/login-free-seller to instantly create an authenticated session
// for the free seller test account without going through the login form.
// This lets us verify dashboard routing/session independently of the login flow.
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

export default router;
