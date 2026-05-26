import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ADMINS = [
  { email: "admin@aeroparts.com", password: "password",  name: "Administrator" },
  { email: "admin@test.com",      password: "Admin123!", name: "Test Administrator" },
];

// Site owner: dual-role account (admin + seller on the same email)
const OWNER = {
  email: "kadainr@gmail.com",
  password: "1324Tracy!",
  contactName: "Kadain R",
  companyName: "Parts Link Aviation",
};

export async function seedAdmin(): Promise<void> {
  // ── Standard admin accounts ────────────────────────────────────────────────
  for (const admin of ADMINS) {
    try {
      const normalizedEmail = admin.email.trim().toLowerCase();

      const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

      if (rows.length === 0) {
        const passwordHash = await bcrypt.hash(admin.password, 10);
        await db.insert(usersTable).values({
          email: normalizedEmail,
          passwordHash,
          role: "admin",
          roles: ["admin"],
          activeRole: "admin",
          companyName: "Parts Link Aviation Admin",
          contactName: admin.name,
          plan: "enterprise",
          mustChangePassword: false,
        });
        logger.info({ email: normalizedEmail }, "Admin account created");
      } else {
        const sorted = [...rows].sort((a, b) => a.id - b.id);
        const canonical = sorted[0];

        for (const dup of sorted.slice(1)) {
          await db.delete(usersTable).where(eq(usersTable.id, dup.id));
          logger.info({ id: dup.id }, "Removed duplicate admin account");
        }

        const passwordHash = await bcrypt.hash(admin.password, 10);
        await db.update(usersTable)
          .set({
            role: "admin",
            roles: ["admin"],
            activeRole: "admin",
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

  // ── Owner account: admin + seller dual-role ────────────────────────────────
  // Single row in users table; active_role="seller" so main-site login lands
  // on the seller dashboard. The form-based admin portal login detects the
  // "admin" entry in roles[] and redirects to /admin/dashboard regardless.
  try {
    const ownerEmail = OWNER.email.trim().toLowerCase();
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, ownerEmail));

    const passwordHash = await bcrypt.hash(OWNER.password, 10);

    if (rows.length === 0) {
      await db.insert(usersTable).values({
        email: ownerEmail,
        passwordHash,
        role: "admin",
        roles: ["admin", "seller"],
        activeRole: "seller",
        companyName: OWNER.companyName,
        contactName: OWNER.contactName,
        plan: "pro",
        subscriptionStatus: "active",
        mustChangePassword: false,
      });
      logger.info({ email: ownerEmail }, "Owner account created");
    } else {
      const canonical = [...rows].sort((a, b) => a.id - b.id)[0];
      await db.update(usersTable)
        .set({
          role: "admin",
          roles: ["admin", "seller"],
          activeRole: "seller",
          passwordHash,
          companyName: OWNER.companyName,
          contactName: OWNER.contactName,
          plan: "pro",
          subscriptionStatus: "active",
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, canonical.id));
      logger.info({ id: canonical.id, email: ownerEmail }, "Owner account ensured");
    }
  } catch (err) {
    logger.error({ err, email: OWNER.email }, "Failed to seed owner account");
  }
}
