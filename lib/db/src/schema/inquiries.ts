import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { listingsTable } from "./listings";

export const inquiriesTable = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone"),
  buyerCompany: text("buyer_company"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInquirySchema = createInsertSchema(inquiriesTable).omit({ id: true, createdAt: true });
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiriesTable.$inferSelect;
