import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Hardcoded test users (no DB, no bcrypt) ──────────────────────────────────
const TEST_USERS: Record<string, { password: string; role: string }> = {
  "admin@test.com":      { password: "Admin123!",  role: "admin" },
  "freeseller@test.com": { password: "Seller123!", role: "seller" },
};

// Helper: save session and resolve
function saveSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) =>
    (req as any).session.save((err: unknown) => (err ? reject(err) : resolve()))
  );
}

// POST /api/auth-test/login
// Native form submission endpoint.  Sets req.session.user and redirects.
router.post("/auth-test/login", async (req, res): Promise<void> => {
  const email: string  = (req.body?.email    ?? "").trim().toLowerCase();
  const password: string = req.body?.password ?? "";

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

  (req as any).session.user = { email, role: record.role };

  await saveSession(req as any);
  const sid = (req as any).session.id;
  console.log(`[auth-test] SESSION CREATED: yes | id=${sid} | email=${email} | role=${record.role}`);

  res.redirect(302, "/auth-test");
});

// GET /api/auth-test/me
// Returns the current session user as JSON (used by the debug panel).
router.get("/auth-test/me", (req, res): void => {
  const user = (req as any).session?.user ?? null;
  console.log(`[auth-test] /me | sessionId=${(req as any).session?.id} | user=${JSON.stringify(user)}`);
  if (!user) {
    res.status(401).json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user });
});

// GET /api/auth-test/protected
// Returns a plain-text "Authenticated as [email]" message, or 401.
router.get("/auth-test/protected", (req, res): void => {
  const user = (req as any).session?.user ?? null;
  if (!user) {
    res.status(401).send("NOT AUTHENTICATED");
    return;
  }
  res.send(`Authenticated as ${user.email}`);
});

// POST /api/auth-test/logout
// Destroys the session and redirects back to the test page.
router.post("/auth-test/logout", (req, res): void => {
  (req as any).session.destroy(() => {
    res.redirect(302, "/auth-test");
  });
});

export default router;
