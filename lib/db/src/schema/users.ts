import { pgTable, serial, text, timestamp, boolean, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "admin", "super_admin"]);
export const sellerTypeEnum = pgEnum("seller_type", ["private", "verified_vendor"]);
export const vendorVerifStatusEnum = pgEnum("vendor_verif_status", ["pending", "approved", "rejected"]);
export const userPlanEnum = pgEnum("user_plan", ["free", "pro", "enterprise", "mro_verified", "mro_premium", "mro_provider", "mission_control"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trial", "past_due", "cancelled", "suspended",
]);
export const trustBadgeEnum = pgEnum("trust_badge", [
  "unverified", "document_verified", "aviation_verified", "trusted_partner",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("seller"),
  // Option A: single account per email, multiple roles
  roles: text("roles").array().notNull().default(sql`ARRAY['seller']::text[]`),
  activeRole: text("active_role").notNull().default("seller"),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone"),
  country: text("country"),
  sellerType: sellerTypeEnum("seller_type").notNull().default("private"),
  plan: userPlanEnum("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  status: userStatusEnum("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Login security: lockout tracking
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  // Stripe subscription tracking
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end"),
  gracePeriodEnd: timestamp("grace_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Billing cycle (monthly | yearly) — updated from Stripe webhook on subscription events
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  // Trust scoring
  trustScore: integer("trust_score").notNull().default(0),
  trustBadge: trustBadgeEnum("trust_badge").notNull().default("unverified"),
  trustScoreBreakdown: jsonb("trust_score_breakdown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Email verification — TODO: run drizzle db:push or migration after deploying
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const vendorVerificationRequestsTable = pgTable("vendor_verification_requests", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  status: vendorVerifStatusEnum("status").notNull().default("pending"),
  certificationUrl: text("certification_url"),
  businessName: text("business_name"),
  notes: text("notes"),
  reviewedBy: integer("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export type VendorVerificationRequest = typeof vendorVerificationRequestsTable.$inferSelect;
