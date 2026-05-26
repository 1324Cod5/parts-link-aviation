import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@aeroparts.com";
const ADMIN_DEFAULT_PASSWORD = "password";

export async function seedAdmin(): Promise<void> {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));

    if (!existing) {
      const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10);
      await db.insert(usersTable).values({
        email: ADMIN_EMAIL,
        passwordHash,
        role: "super_admin",
        companyName: "Parts Link Aviation Admin",
        contactName: "Administrator",
        plan: "enterprise",
        mustChangePassword: true,
      });
      logger.info("Default admin account created — password change required on first login");
    } else if (existing.role !== "admin" && existing.role !== "super_admin") {
      // Promote to super_admin if somehow registered as another role
      await db.update(usersTable)
        .set({ role: "super_admin", updatedAt: new Date() })
        .where(eq(usersTable.id, existing.id));
      logger.info({ id: existing.id }, "Admin account promoted to super_admin");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}
