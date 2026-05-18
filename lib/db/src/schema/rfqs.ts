import { pgTable, serial, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const rfqStatusEnum  = pgEnum("rfq_status",  ["open", "closed", "archived", "suspended", "deleted"]);
export const rfqUrgencyEnum = pgEnum("rfq_urgency", ["aog", "critical", "high_priority", "standard", "planned"]);

export const rfqsTable = pgTable("rfqs", {
  id: serial("id").primaryKey(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerCompany: text("buyer_company"),
  buyerPhone: text("buyer_phone"),
  partNumber: text("part_number").notNull(),
  description: text("description").notNull(),
  aircraftApplicability: text("aircraft_applicability"),
  condition: text("condition"),
  quantity: integer("quantity").notNull().default(1),
  status: rfqStatusEnum("status").notNull().default("open"),
  urgency: rfqUrgencyEnum("urgency").notNull().default("standard"),
  urgencyReason: text("urgency_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rfqResponsesTable = pgTable("rfq_responses", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => rfqsTable.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  listingId: integer("listing_id").references(() => listingsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfqAdminActionsTable = pgTable("rfq_admin_actions", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => rfqsTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRfqSchema = createInsertSchema(rfqsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRfqResponseSchema = createInsertSchema(rfqResponsesTable).omit({ id: true, createdAt: true });
export const insertRfqAdminActionSchema = createInsertSchema(rfqAdminActionsTable).omit({ id: true, createdAt: true });

export type InsertRfq = z.infer<typeof insertRfqSchema>;
export type Rfq = typeof rfqsTable.$inferSelect;
export type RfqResponse = typeof rfqResponsesTable.$inferSelect;
export type RfqAdminAction = typeof rfqAdminActionsTable.$inferSelect;
