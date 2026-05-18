import { Router } from "express";
import { db, usersTable } from "@workspace/db";

const router = Router();

router.get("/debug/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      email: usersTable.email,
      role: usersTable.role,
    })
    .from(usersTable)
    .orderBy(usersTable.id);

  res.json({
    count: users.length,
    users: users.map(u => ({
      email: u.email,
      role: u.role,
      exists: true,
    })),
  });
});

router.get("/debug/session", (req, res): void => {
  const user = (req as any).session?.user ?? null;
  if (!user) {
    res.type("text").send("No active session");
    return;
  }
  res.type("application/json").send(JSON.stringify(user, null, 2));
});

export default router;
