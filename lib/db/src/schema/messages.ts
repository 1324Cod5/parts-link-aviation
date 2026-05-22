import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { listingsTable } from "./listings";
import { rfqsTable } from "./rfqs";

export const conversationsTable = pgTable("conversations", {
  id:           serial("id").primaryKey(),
  rfqId:        integer("rfq_id").references(() => rfqsTable.id, { onDelete: "set null" }),
  listingId:    integer("listing_id").references(() => listingsTable.id, { onDelete: "set null" }),
  sellerId:     integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  buyerName:    text("buyer_name").notNull(),
  buyerEmail:   text("buyer_email").notNull(),
  buyerCompany: text("buyer_company"),
  subject:      text("subject"),
  isResolved:   boolean("is_resolved").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messagesTable = pgTable("messages", {
  id:             serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderType:     text("sender_type").notNull(), // 'buyer' | 'seller'
  senderId:       integer("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  content:        text("content").notNull(),
  isRead:         boolean("is_read").notNull().default(false),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
