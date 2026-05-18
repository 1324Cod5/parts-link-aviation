import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── Hardcoded test users (no DB, no bcrypt) ──────────────────────────────────
const TEST_USERS: Record<string, { password: string; role: string }> = {
  "admin@test.com":      { password: "Admin123!",  role: "admin" },
  "freeseller@test.com": { password: "Seller123!", role: "seller" },
};

const PLAN_BY_ROLE: Record<string, string> = {
  admin:  "admin",
  seller: "free",
};

const MAX_LISTINGS_BY_PLAN: Record<string, number | null> = {
  free:       5,
  pro:        50,
  enterprise: null,
  admin:      null,
};

function saveSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) =>
    (req as any).session.save((err: unknown) => (err ? reject(err) : resolve()))
  );
}

// POST /api/auth-test/login
// Native form submission. Sets both req.session.user (full object) and
// req.session.userId (from DB lookup) so every dashboard guard accepts the session.
router.post("/auth-test/login", async (req, res): Promise<void> => {
  const email: string    = (req.body?.email    ?? "").trim().toLowerCase();
  const password: string =  req.body?.password ?? "";

  console.log(`[auth-test] LOGIN ATTEMPT: ${email}`);

  const record = TEST_USERS[email];
  const userFound = !!record;
  console.log(`[auth-test] USER FOUND: ${userFound ? "yes" : "no"}`);

  if (!record || record.password !== password) {
    const msg = userFound ? "Wrong password." : "User not found.";
    console.log(`[auth-test] PASSWORD MATCH: no`);
    const p = new URLSearchParams({ error: msg, email });
    res.redirect(302, `/auth-test?${p}`);
    return;
  }

  console.log(`[auth-test] PASSWORD MATCH: yes`);

  // Look up real DB row so we can set userId (needed by dashboard route guards)
  let dbUserId: number | null = null;
  try {
    const [found] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    dbUserId = found?.id ?? null;
  } catch {
    // Non-fatal — bridge middleware will backfill on subsequent requests
  }

  const plan = PLAN_BY_ROLE[record.role] ?? "free";

  // Store full structured user object
  (req as any).session.user = {
    id:                 dbUserId !== null ? String(dbUserId) : email,
    email,
    role:               record.role,
    subscriptionTier:   plan,
    subscriptionStatus: "active",
    permissions: {
      canCreateListings: true,
      rfqFullAccess:     plan !== "free",
      maxListings:       MAX_LISTINGS_BY_PLAN[plan] ?? 5,
    },
  };

  // Also set numeric userId so route guards work without the bridge
  if (dbUserId !== null) {
    (req as any).session.userId = dbUserId;
  }

  await saveSession(req as any);
  const sid = (req as any).session.id;
  console.log(`[auth-test] SESSION CREATED: yes | id=${sid} | email=${email} | role=${record.role} | dbUserId=${dbUserId}`);

  res.redirect(302, "/auth-test");
});

// GET /api/auth-test/me
// Returns current session user as JSON (used by the debug panel).
router.get("/auth-test/me", (req, res): void => {
  const user   = (req as any).session?.user   ?? null;
  const userId = (req as any).session?.userId ?? null;
  console.log(`[auth-test] /me | sessionId=${(req as any).session?.id} | userId=${userId} | user=${JSON.stringify(user)}`);
  if (!user) {
    res.status(401).json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user });
});

// GET /api/auth-test/protected
// Simple guard: returns plain text or 401.
router.get("/auth-test/protected", (req, res): void => {
  const user = (req as any).session?.user ?? null;
  if (!user) {
    res.status(401).send("NOT AUTHENTICATED");
    return;
  }
  res.send(`Authenticated as ${user.email} (role: ${user.role}, plan: ${user.subscriptionTier})`);
});

// POST /api/auth-test/logout
// Destroys the session and redirects back to the test page.
router.post("/auth-test/logout", (req, res): void => {
  (req as any).session.destroy(() => {
    res.redirect(302, "/auth-test");
  });
});

export default router;
