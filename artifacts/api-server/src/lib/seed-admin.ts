import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "./logger";

const ADMINS = [
  { email: "admin@aeroparts.com", password: "password",  name: "Administrator" },
  { email: "admin@test.com",      password: "Admin123!", name: "Test Administrator" },
];

export async function seedAdmin(): Promise<void> {
  for (const admin of ADMINS) {
    try {
      const normalizedEmail = admin.email.trim().toLowerCase();

      // Fetch ALL rows with this email (duplicates may exist from failed seeds)
      const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

      if (rows.length === 0) {
        // Fresh insert
        const passwordHash = await bcrypt.hash(admin.password, 10);
        await db.insert(usersTable).values({
          email: normalizedEmail,
          passwordHash,
          role: "admin",
          companyName: "Parts Link Aviation Admin",
          contactName: admin.name,
          plan: "enterprise",
          mustChangePassword: false,
        });
        logger.info({ email: normalizedEmail }, "Admin account created");
      } else {
        // Keep the row with the lowest ID as canonical; delete the rest
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        const canonical = sorted[0];

        for (const dup of sorted.slice(1)) {
          await db.delete(usersTable).where(eq(usersTable.id, dup.id));
          logger.info({ id: dup.id }, "Removed duplicate admin account");
        }

        // Promote canonical to admin with correct password
        const passwordHash = await bcrypt.hash(admin.password, 10);
        await db.update(usersTable)
          .set({
            role: "admin",
            passwordHash,
            contactName: admin.name,
            companyName: "Parts Link Aviation Admin",
            mustChangePassword: false,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, canonical.id));

        logger.info({ id: canonical.id, email: normalizedEmail }, "Admin account ensured");
      }
    } catch (err) {
      logger.error({ err, email: admin.email }, "Failed to seed admin account");
    }
  }
}
