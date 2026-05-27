import { pgTable, serial, text, boolean, timestamp, integer, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const certDocumentsTable = pgTable("cert_documents", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  issuingAuthority: text("issuing_authority"),
  docDate: date("doc_date"),
  aircraftApplicability: text("aircraft_applicability"),
  fileUrl: text("file_url").notNull(),
  originalFilename: text("original_filename").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CertDocument = typeof certDocumentsTable.$inferSelect;
export type InsertCertDocument = typeof certDocumentsTable.$inferInsert;

export const certDocumentListingsTable = pgTable("cert_document_listings", {
  certDocId: integer("cert_doc_id").notNull().references(() => certDocumentsTable.id, { onDelete: "cascade" }),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
});
