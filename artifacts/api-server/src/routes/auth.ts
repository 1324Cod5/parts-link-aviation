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
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended. Contact support." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

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
