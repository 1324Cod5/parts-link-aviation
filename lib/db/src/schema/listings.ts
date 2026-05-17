import { pgTable, serial, text, timestamp, pgEnum, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const conditionEnum = pgEnum("condition", ["new", "overhauled", "serviceable", "as_removed", "repaired"]);
export const saleTypeEnum = pgEnum("sale_type", ["outright", "exchange", "both"]);
export const badgeEnum = pgEnum("badge", ["pending_verification", "documentation_reviewed", "verified"]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "removed"]);

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  partNumber: text("part_number").notNull(),
  description: text("description").notNull(),
  aircraftApplicability: text("aircraft_applicability"),
  manufacturer: text("manufacturer").notNull(),
  condition: conditionEnum("condition").notNull(),
  saleType: saleTypeEnum("sale_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price", { precision: 12, scale: 2 }),
  certificationDocs: text("certification_docs").array().notNull().default([]),
  photos: text("photos").array().notNull().default([]),
  traceHistory: text("trace_history"),
  badge: badgeEnum("badge").notNull().default("pending_verification"),
  status: listingStatusEnum("status").notNull().default("active"),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
