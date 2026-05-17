import { pgTable, serial, text, timestamp, pgEnum, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const mroStatusEnum = pgEnum("mro_status", ["pending", "active", "suspended"]);
export const sqrStatusEnum = pgEnum("sqr_status", ["open", "responded", "closed"]);
export const urgencyEnum = pgEnum("sqr_urgency", ["standard", "urgent", "aog"]);

export const mroProfilesTable = pgTable("mro_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  description: text("description"),
  website: text("website"),
  country: text("country").notNull(),
  city: text("city"),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  aircraftTypes: text("aircraft_types").array().notNull().default([]),
  partNumbersServiced: text("part_numbers_serviced").array().notNull().default([]),
  serviceTypes: text("service_types").array().notNull().default([]),
  certifications: text("certifications").array().notNull().default([]),
  turnaroundTime: text("turnaround_time"),
  warranty: text("warranty"),
  capabilityDocuments: text("capability_documents").array().notNull().default([]),
  status: mroStatusEnum("status").notNull().default("active"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serviceQuoteRequestsTable = pgTable("service_quote_requests", {
  id: serial("id").primaryKey(),
  mroId: integer("mro_id").notNull().references(() => mroProfilesTable.id, { onDelete: "cascade" }),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requesterCompany: text("requester_company"),
  requesterPhone: text("requester_phone"),
  partNumber: text("part_number").notNull(),
  description: text("description").notNull(),
  aircraftType: text("aircraft_type"),
  serviceType: text("service_type"),
  quantity: integer("quantity").notNull().default(1),
  urgency: urgencyEnum("urgency").notNull().default("standard"),
  status: sqrStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMroProfileSchema = createInsertSchema(mroProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceQuoteRequestSchema = createInsertSchema(serviceQuoteRequestsTable).omit({ id: true, createdAt: true });
export type InsertMroProfile = z.infer<typeof insertMroProfileSchema>;
export type MroProfile = typeof mroProfilesTable.$inferSelect;
export type ServiceQuoteRequest = typeof serviceQuoteRequestsTable.$inferSelect;
