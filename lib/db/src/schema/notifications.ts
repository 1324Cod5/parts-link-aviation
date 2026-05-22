import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  emailEnabled:  boolean("email_enabled").notNull().default(true),
  rfqAlerts:     boolean("rfq_alerts").notNull().default(true),
  aogAlerts:     boolean("aog_alerts").notNull().default(true),
  dailyDigest:   boolean("daily_digest").notNull().default(true),
  demandAlerts:    boolean("demand_alerts").notNull().default(true),
  emailOnMessage:  boolean("email_on_message").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;
