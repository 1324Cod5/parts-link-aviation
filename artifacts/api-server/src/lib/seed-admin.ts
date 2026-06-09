import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ── Standard admin accounts ──────────────────────────────────────────────────
const ADMINS = [
  { email: "admin@partslinkaviation.com", password: "PartslinkAdmin2024!", name: "Partslink Admin" },
  ];

// ── Owner seller account (separate from admin, persisted across restarts) ────
// badboys6112@hotmail.com — seller-only, plan: pro, for the main marketplace.
// Kept here (not in seed-test-accounts.ts) so it is never wiped on restart.
const OWNER_SELLER = {
  email: "badboys6112@hotmail.com",
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

      const passwordHash = await bcrypt.hash(admin.password, 10);

      if (rows.length === 0) {
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

        await db.update(usersTable)
          .set({
            role: "admin",
            roles: ["admin"],
            activeRole: "admin",
            passwordHash,
            contactName: admin.name,
            companyName: "Parts Link Aviation Admin",
            plan: "enterprise",
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

  // ── Owner seller account ───────────────────────────────────────────────────
  try {
    const sellerEmail = OWNER_SELLER.email.trim().toLowerCase();
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, sellerEmail));

    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash(OWNER_SELLER.password, 10);
      await db.insert(usersTable).values({
        email: sellerEmail,
        passwordHash,
        role: "seller",
        roles: ["seller"],
        activeRole: "seller",
        companyName: OWNER_SELLER.companyName,
        contactName: OWNER_SELLER.contactName,
        plan: "pro",
        subscriptionStatus: "active",
        status: "active",
        mustChangePassword: false,
      });
      logger.info({ email: sellerEmail }, "Owner seller account created");
    } else {
      // Account exists — update credentials and plan but never wipe listings
      const canonical = [...rows].sort((a, b) => a.id - b.id)[0];
      const passwordHash = await bcrypt.hash(OWNER_SELLER.password, 10);
      await db.update(usersTable)
        .set({
          role: "seller",
          roles: ["seller"],
          activeRole: "seller",
          passwordHash,
          companyName: OWNER_SELLER.companyName,
          contactName: OWNER_SELLER.contactName,
          plan: "pro",
          subscriptionStatus: "active",
          status: "active",
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, canonical.id));
      logger.info({ id: canonical.id, email: sellerEmail }, "Owner seller account ensured");
    }
  } catch (err) {
    logger.error({ err, email: OWNER_SELLER.email }, "Failed to seed owner seller account");
  }
}
