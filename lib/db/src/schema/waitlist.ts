import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistEmailsTable = pgTable("waitlist_emails", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("homepage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WaitlistEmail = typeof waitlistEmailsTable.$inferSelect;
