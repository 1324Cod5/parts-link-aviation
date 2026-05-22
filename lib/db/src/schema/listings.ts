import { pgTable, serial, text, timestamp, pgEnum, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const conditionEnum = pgEnum("condition", ["new", "overhauled", "serviceable", "as_removed", "repaired"]);
export const saleTypeEnum = pgEnum("sale_type", ["outright", "exchange", "both"]);
export const badgeEnum = pgEnum("badge", ["pending_verification", "documentation_reviewed", "verified"]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "removed", "suspended", "pending_review", "deleted"]);
export const docTypeEnum = pgEnum("doc_type", ["faa_8130_3", "easa_form_1", "tcca_form_1", "overhaul_report", "test_report", "coa", "other"]);
export const docVerificationEnum = pgEnum("doc_verification_status", ["pending", "approved", "rejected"]);

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
  featured: boolean("featured").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;

export const listingDocumentsTable = pgTable("listing_documents", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  documentType: docTypeEnum("document_type").notNull().default("other"),
  fileUrl: text("file_url").notNull(),
  verificationStatus: docVerificationEnum("verification_status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ListingDocument = typeof listingDocumentsTable.$inferSelect;

export const listingAuditLogsTable = pgTable("listing_audit_logs", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ListingAuditLog = typeof listingAuditLogsTable.$inferSelect;
