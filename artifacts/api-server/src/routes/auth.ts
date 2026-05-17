import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterUserBody,
  LoginUserBody,
  GetCurrentUserResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  const userResponse = GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    contactName: user.contactName,
    phone: user.phone,
    country: user.country,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  });

  res.status(201).json({ user: userResponse });
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

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session!.userId = user.id;

  const userResponse = GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    contactName: user.contactName,
    phone: user.phone,
    country: user.country,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  });

  res.json({ user: userResponse });
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

  const userResponse = GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    contactName: user.contactName,
    phone: user.phone,
    country: user.country,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  });

  res.json(userResponse);
});

export default router;
