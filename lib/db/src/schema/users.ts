import { pgTable, serial, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "admin", "super_admin"]);
export const userPlanEnum = pgEnum("user_plan", ["free", "pro", "enterprise"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("seller"),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone"),
  country: text("country"),
  plan: userPlanEnum("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  status: userStatusEnum("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
