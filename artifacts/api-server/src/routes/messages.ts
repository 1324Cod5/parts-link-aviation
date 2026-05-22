import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, conversationsTable, messagesTable, usersTable, notificationPreferencesTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { FULL_ACCESS_PLANS } from "../lib/planEnforcement";
import { sendNewMessageAlert, sendBuyerReplyAlert } from "../lib/email";
import { logger } from "../lib/logger";
import type { MessageConversationInfo } from "../lib/emailTemplates";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): boolean {
  if (!req.session?.user) { res.status(401).json({ error: "Not authenticated" }); return false; }
  return true;
}

function toConvInfo(conv: typeof conversationsTable.$inferSelect): MessageConversationInfo {
  return {
    id:           conv.id,
    buyerName:    conv.buyerName,
    buyerEmail:   conv.buyerEmail,
    buyerCompany: conv.buyerCompany ?? null,
    subject:      conv.subject ?? null,
    rfqId:        conv.rfqId ?? null,
    listingId:    conv.listingId ?? null,
  };
}

function serializeConv(conv: typeof conversationsTable.$inferSelect, extra: Record<string, unknown> = {}) {
  return {
    id:           conv.id,
    rfqId:        conv.rfqId ?? null,
    listingId:    conv.listingId ?? null,
    sellerId:     conv.sellerId,
    buyerName:    conv.buyerName,
    buyerEmail:   conv.buyerEmail,
    buyerCompany: conv.buyerCompany ?? null,
    subject:      conv.subject ?? null,
    isResolved:   conv.isResolved,
    createdAt:    conv.createdAt.toISOString(),
    updatedAt:    conv.updatedAt.toISOString(),
    ...extra,
  };
}

function serializeMsg(msg: typeof messagesTable.$inferSelect) {
  return { ...msg, createdAt: msg.createdAt.toISOString() };
}

function maskBuyer(conv: ReturnType<typeof serializeConv>, isFreeTier: boolean) {
  if (isFreeTier) return { ...conv, buyerEmail: null };
  return conv;
}

const CreateConvSchema = z.object({
  sellerId:       z.coerce.number().int().positive(),
  buyerName:      z.string().min(1).max(100),
  buyerEmail:     z.email(),
  buyerCompany:   z.string().max(100).nullish(),
  rfqId:          z.coerce.number().int().positive().nullish(),
  listingId:      z.coerce.number().int().positive().nullish(),
  subject:        z.string().max(200).nullish(),
  initialMessage: z.string().min(1).max(5000),
});

const SendMsgSchema = z.object({
  content:    z.string().min(1).max(5000),
  buyerEmail: z.string().nullish(),
});

// ─── POST /conversations — buyer creates conversation (no auth required) ───────

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConvSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const { sellerId, buyerName, buyerEmail, buyerCompany, rfqId, listingId, subject, initialMessage } = parsed.data;

  const [seller] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(and(eq(usersTable.id, sellerId), eq(usersTable.role, "seller")));
  if (!seller) { res.status(404).json({ error: "Seller not found" }); return; }

  const [conv] = await db
    .insert(conversationsTable)
    .values({
      sellerId,
      buyerName, buyerEmail,
      buyerCompany: buyerCompany ?? null,
      rfqId: rfqId ?? null,
      listingId: listingId ?? null,
      subject: subject ?? null,
    })
    .returning();

  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId: conv.id, senderType: "buyer", content: initialMessage })
    .returning();

  void sendNewMessageAlert(sellerId, toConvInfo(conv), initialMessage).catch(err =>
    logger.warn({ err, convId: conv.id }, "messages: sendNewMessageAlert failed"),
  );

  res.status(201).json({
    conversation: serializeConv(conv),
    message:      serializeMsg(msg),
  });
});

// ─── GET /conversations/unread-count — seller (MUST be before /:id routes) ────

router.get("/conversations/unread-count", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const sellerId = Number(req.session!.user!.id);

  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(and(
      eq(conversationsTable.sellerId, sellerId),
      eq(messagesTable.isRead, false),
      eq(messagesTable.senderType, "buyer"),
    ));

  res.json({ count: row?.count ?? 0 });
});

// ─── GET /conversations — seller's conversation list ──────────────────────────

router.get("/conversations", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const sellerId  = Number(req.session!.user!.id);
  const plan      = req.session!.user!.subscriptionTier ?? "free";
  const isFreeTier = !FULL_ACCESS_PLANS.has(plan);

  const rows = await db
    .select({
      id:           conversationsTable.id,
      rfqId:        conversationsTable.rfqId,
      listingId:    conversationsTable.listingId,
      sellerId:     conversationsTable.sellerId,
      buyerName:    conversationsTable.buyerName,
      buyerEmail:   conversationsTable.buyerEmail,
      buyerCompany: conversationsTable.buyerCompany,
      subject:      conversationsTable.subject,
      isResolved:   conversationsTable.isResolved,
      createdAt:    conversationsTable.createdAt,
      updatedAt:    conversationsTable.updatedAt,
      unreadCount:  sql<number>`cast(count(${messagesTable.id}) filter (where ${messagesTable.isRead} = false and ${messagesTable.senderType} = 'buyer') as int)`,
      lastMessage:  sql<string | null>`(select content from messages where conversation_id = ${conversationsTable.id} order by created_at desc limit 1)`,
    })
    .from(conversationsTable)
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(eq(conversationsTable.sellerId, sellerId))
    .groupBy(conversationsTable.id)
    .orderBy(desc(conversationsTable.updatedAt));

  const conversations = rows.map(r => maskBuyer(
    serializeConv(r, { unreadCount: r.unreadCount, lastMessage: r.lastMessage }),
    isFreeTier,
  ));

  res.json({ conversations });
});

// ─── GET /conversations/:id/messages — seller views thread ────────────────────

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const sellerId   = Number(req.session!.user!.id);
  const plan       = req.session!.user!.subscriptionTier ?? "free";
  const isFreeTier = !FULL_ACCESS_PLANS.has(plan);

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.sellerId, sellerId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Auto-mark buyer messages as read when seller opens the thread
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.conversationId, id), eq(messagesTable.senderType, "buyer")));

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.json({
    conversation: maskBuyer(serializeConv(conv), isFreeTier),
    messages:     msgs.map(serializeMsg),
  });
});

// ─── POST /conversations/:id/messages — seller replies or buyer follows up ────

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SendMsgSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { content, buyerEmail } = parsed.data;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const sessionUser = req.session?.user;
  let senderType: "buyer" | "seller";
  let senderId: number | null = null;

  if (sessionUser && (Number(sessionUser.id) === conv.sellerId || sessionUser.role === "admin")) {
    senderType = "seller";
    senderId   = Number(sessionUser.id);
  } else if (buyerEmail && buyerEmail === conv.buyerEmail) {
    senderType = "buyer";
  } else {
    res.status(403).json({ error: "Not authorized to send to this conversation" });
    return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId: id, senderType, senderId, content })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));

  if (senderType === "seller" && sessionUser) {
    const [sellerUser] = await db
      .select({ companyName: usersTable.companyName })
      .from(usersTable)
      .where(eq(usersTable.id, Number(sessionUser.id)));
    void sendBuyerReplyAlert(toConvInfo(conv), content, sellerUser?.companyName ?? "The seller")
      .catch(err => logger.warn({ err, convId: id }, "messages: sendBuyerReplyAlert failed"));
  } else if (senderType === "buyer") {
    void sendNewMessageAlert(conv.sellerId, toConvInfo(conv), content)
      .catch(err => logger.warn({ err, convId: id }, "messages: sendNewMessageAlert (follow-up) failed"));
  }

  res.status(201).json({ message: serializeMsg(msg) });
});

// ─── PATCH /conversations/:id/read ────────────────────────────────────────────

router.patch("/conversations/:id/read", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const sellerId = Number(req.session!.user!.id);
  const [conv] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.sellerId, sellerId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.conversationId, id), eq(messagesTable.senderType, "buyer")));

  res.json({ ok: true });
});

// ─── GET /seller/notifications/message-alerts ─────────────────────────────────

router.get("/seller/notifications/message-alerts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const userId = Number(req.session!.user!.id);

  const [prefs] = await db
    .select({ emailOnMessage: notificationPreferencesTable.emailOnMessage })
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));

  res.json({ emailOnMessage: prefs?.emailOnMessage ?? true });
});

// ─── PATCH /seller/notifications/message-alerts ───────────────────────────────

router.patch("/seller/notifications/message-alerts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const userId = Number(req.session!.user!.id);

  const { emailOnMessage } = req.body;
  if (typeof emailOnMessage !== "boolean") {
    res.status(400).json({ error: "emailOnMessage must be a boolean" });
    return;
  }

  const [existing] = await db
    .select({ id: notificationPreferencesTable.id })
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));

  if (existing) {
    await db
      .update(notificationPreferencesTable)
      .set({ emailOnMessage, updatedAt: new Date() })
      .where(eq(notificationPreferencesTable.userId, userId));
  } else {
    await db
      .insert(notificationPreferencesTable)
      .values({ userId, emailOnMessage });
  }

  res.json({ ok: true, emailOnMessage });
});

export default router;
