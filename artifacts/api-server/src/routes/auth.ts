import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
  GetCurrentUserResponse,
  ChangePasswordBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function serializeUser(user: typeof usersTable.$inferSelect) {
  return GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    contactName: user.contactName,
    phone: user.phone,
    country: user.country,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  });
}

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

  req.session!.userId = user.id;
  res.status(201).json({ user: serializeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    // Generic message to avoid user enumeration
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  // Check if account is suspended
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account has been suspended. Contact support." });
    return;
  }

  // Check if account is locked out
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

  // Success — reset lockout counters
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session!.userId = user.id;
  res.json({ user: serializeUser(user) });
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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(serializeUser(user));
});

export default router;
