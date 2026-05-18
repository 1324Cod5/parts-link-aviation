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

export default router;
