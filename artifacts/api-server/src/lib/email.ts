/**
 * Email service — wraps Resend.
 *
 * When RESEND_API_KEY is absent the service logs to stdout instead of sending,
 * so the rest of the system works without the secret during development.
 */
import { Resend } from "resend";
import { db, usersTable, notificationPreferencesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";
import {
  rfqAlertTemplate,
  aogAlertTemplate,
  aogPhaseAlertTemplate,
  newMessageAlertTemplate,
  sellerReplyTemplate,
  quoteAwardedTemplate,
  certUpdateTemplate,
  dailyDigestTemplate,
  type DigestData,
  type MessageConversationInfo,
} from "./emailTemplates";

// ─── Client ───────────────────────────────────────────────────────────────────

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL ?? "AeroParts Notifications <notifications@aeroparts.app>";

let resend: Resend | null = null;
if (KEY) {
  resend = new Resend(KEY);
} else {
  logger.warn("RESEND_API_KEY not set — emails will be logged only");
}

// ─── Internal send helper ─────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    logger.info({ to, subject }, "[EMAIL LOG — no key]");
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    logger.info({ to, subject }, "email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "email send failed");
  }
}

// ─── Plan eligibility ─────────────────────────────────────────────────────────

const EMAIL_PLANS = new Set(["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]);

interface EligibleSeller {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  plan: string;
  prefs: {
    emailEnabled: boolean;
    rfqAlerts: boolean;
    aogAlerts: boolean;
    dailyDigest: boolean;
    demandAlerts: boolean;
  } | null;
}

/** Fetch all Pro/Enterprise sellers with their notification preferences. */
async function fetchEligibleSellers(): Promise<EligibleSeller[]> {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      companyName: usersTable.companyName,
      contactName: usersTable.contactName,
      plan: usersTable.plan,
      emailEnabled:  notificationPreferencesTable.emailEnabled,
      rfqAlerts:     notificationPreferencesTable.rfqAlerts,
      aogAlerts:     notificationPreferencesTable.aogAlerts,
      dailyDigest:   notificationPreferencesTable.dailyDigest,
      demandAlerts:  notificationPreferencesTable.demandAlerts,
    })
    .from(usersTable)
    .leftJoin(
      notificationPreferencesTable,
      eq(notificationPreferencesTable.userId, usersTable.id),
    )
    .where(inArray(usersTable.plan, ["pro", "enterprise", "mro_verified", "mro_premium", "mro_provider"]));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    companyName: r.companyName,
    contactName: r.contactName,
    plan: r.plan,
    prefs: r.emailEnabled !== null
      ? {
          emailEnabled: r.emailEnabled ?? true,
          rfqAlerts:    r.rfqAlerts ?? true,
          aogAlerts:    r.aogAlerts ?? true,
          dailyDigest:  r.dailyDigest ?? true,
          demandAlerts: r.demandAlerts ?? true,
        }
      : null,
  }));
}

function wantsRfqAlerts(seller: EligibleSeller): boolean {
  if (!seller.prefs) return true; // default: on
  return seller.prefs.emailEnabled && seller.prefs.rfqAlerts;
}

function wantsAogAlerts(seller: EligibleSeller): boolean {
  if (!seller.prefs) return true;
  return seller.prefs.emailEnabled && seller.prefs.aogAlerts;
}

function wantsDemandAlerts(seller: EligibleSeller): boolean {
  if (!seller.prefs) return true;
  return seller.prefs.emailEnabled && seller.prefs.demandAlerts;
}

function wantsDigest(seller: EligibleSeller): boolean {
  if (!seller.prefs) return true;
  return seller.prefs.emailEnabled && seller.prefs.dailyDigest;
}

// ─── Public email triggers ────────────────────────────────────────────────────

export interface RfqPayload {
  id: number;
  partNumber: string;
  description: string;
  quantity: number;
  urgency: string;
  aircraftApplicability: string | null;
  condition: string | null;
  buyerCompany: string | null;
  createdAt: string;
  urgencyReason?: string | null;
}

/**
 * Notify eligible sellers about a new RFQ.
 * Enterprise sellers receive an immediate "Exclusive Priority Alert".
 * Pro sellers receive the standard alert (fire-and-forget, 15s delay).
 */
export async function notifyRfqCreated(rfq: RfqPayload): Promise<void> {
  const sellers = await fetchEligibleSellers();

  const enterprise = sellers.filter(
    (s) => s.plan === "enterprise" && wantsRfqAlerts(s),
  );
  const pro = sellers.filter(
    (s) => s.plan !== "enterprise" && wantsRfqAlerts(s),
  );

  // Enterprise — immediate, exclusive label
  for (const s of enterprise) {
    const subject = `⚡ Exclusive RFQ Alert: ${rfq.partNumber} — ${rfq.urgency.toUpperCase()}`;
    await send(s.email, subject, rfqAlertTemplate(s, rfq, true));
  }

  // Pro — slight delay so enterprise always arrives first
  if (pro.length > 0) {
    setTimeout(async () => {
      for (const s of pro) {
        const subject = `New RFQ Alert: ${rfq.partNumber}`;
        await send(s.email, subject, rfqAlertTemplate(s, rfq, false));
      }
    }, 15_000);
  }
}

/**
 * Notify ALL eligible sellers about a new AOG RFQ (maximum urgency).
 * Enterprise get an extra "Exclusive" label.
 */
export async function notifyAogRfq(rfq: RfqPayload): Promise<void> {
  const sellers = await fetchEligibleSellers();
  const eligible = sellers.filter((s) => wantsAogAlerts(s));

  for (const s of eligible) {
    const isEnterprise = s.plan === "enterprise";
    const subject = `🔴 AOG ALERT: ${rfq.partNumber} — Aircraft on Ground${isEnterprise ? " (Exclusive Priority)" : ""}`;
    await send(s.email, subject, aogAlertTemplate(s, rfq, isEnterprise));
  }
}

// ─── AOG phased escalation alert ─────────────────────────────────────────────

export interface AogEscalationSeller {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  plan: string;
}

/**
 * Send a phased AOG escalation alert to a specific list of sellers.
 * Phase: "immediate" | "expanded" | "full" | "critical"
 */
export async function sendAogPhaseAlert(
  rfq: RfqPayload,
  sellers: AogEscalationSeller[],
  phase: string,
): Promise<void> {
  const phaseLabel =
    phase === "immediate" ? "PRIORITY ALERT" :
    phase === "expanded"  ? "ESCALATED — 10 MIN" :
    phase === "full"      ? "CRITICAL ESCALATION — 20 MIN" : "CRITICAL";

  for (const s of sellers) {
    const subject = `🔴 AOG ${phaseLabel}: ${rfq.partNumber}`;
    const html = aogPhaseAlertTemplate(
      { id: s.id, email: s.email, companyName: s.companyName, contactName: s.contactName },
      rfq,
      phase,
      s.plan === "enterprise",
    );
    await send(s.email, subject, html);
  }
}

// ─── Messaging alerts ────────────────────────────────────────────────────────

/**
 * Notify a seller when a buyer sends them a new message.
 * Respects the seller's emailOnMessage notification preference.
 */
export async function sendNewMessageAlert(
  sellerId: number,
  conv: MessageConversationInfo,
  messageContent: string,
): Promise<void> {
  const [seller] = await db
    .select({
      id:           usersTable.id,
      email:        usersTable.email,
      contactName:  usersTable.contactName,
      companyName:  usersTable.companyName,
      emailEnabled: notificationPreferencesTable.emailEnabled,
      emailOnMessage: notificationPreferencesTable.emailOnMessage,
    })
    .from(usersTable)
    .leftJoin(notificationPreferencesTable, eq(notificationPreferencesTable.userId, usersTable.id))
    .where(eq(usersTable.id, sellerId));

  if (!seller) return;
  if (seller.emailEnabled === false || seller.emailOnMessage === false) return;

  const subject = conv.subject
    ? `New message: ${conv.subject}`
    : `New message from ${conv.buyerName}`;

  const html = newMessageAlertTemplate(
    { id: seller.id, email: seller.email, contactName: seller.contactName, companyName: seller.companyName },
    conv,
    messageContent,
  );
  await send(seller.email, subject, html);
}

/**
 * Notify a buyer when the seller replies to their message.
 */
export async function sendBuyerReplyAlert(
  conv: MessageConversationInfo,
  messageContent: string,
  sellerCompany: string,
): Promise<void> {
  const html = sellerReplyTemplate(conv.buyerName, sellerCompany, messageContent);
  await send(conv.buyerEmail, `Reply from ${sellerCompany} — AeroParts`, html);
}

export interface QuoteAwardedPayload {
  rfqId: number;
  partNumber: string;
  description: string;
  buyerName: string;
  buyerCompany: string | null;
}

/** Tell the winning seller their quote was selected. */
export async function notifyQuoteAwarded(
  sellerId: number,
  payload: QuoteAwardedPayload,
): Promise<void> {
  const [seller] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, sellerId));
  if (!seller || !EMAIL_PLANS.has(seller.plan)) return;

  const subject = `🏆 Quote Accepted: ${payload.partNumber}`;
  await send(
    seller.email,
    subject,
    quoteAwardedTemplate(
      { id: seller.id, email: seller.email, companyName: seller.companyName, contactName: seller.contactName },
      payload,
    ),
  );
}

export interface CertUpdatePayload {
  listingId: number;
  partNumber: string;
  documentType: string;
  verificationStatus: "approved" | "rejected";
  reviewNote: string | null;
}

/** Notify the listing's seller when a cert doc is approved or rejected. */
export async function notifyCertUpdate(
  sellerId: number,
  payload: CertUpdatePayload,
): Promise<void> {
  const [seller] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, sellerId));
  if (!seller) return;

  const approved = payload.verificationStatus === "approved";
  const subject = approved
    ? `✅ Certification Approved: ${payload.partNumber}`
    : `❌ Certification Needs Attention: ${payload.partNumber}`;
  await send(
    seller.email,
    subject,
    certUpdateTemplate(
      { id: seller.id, email: seller.email, companyName: seller.companyName, contactName: seller.contactName },
      payload,
    ),
  );
}

/** Send daily digest to all eligible sellers who have opted in. */
export async function sendDailyDigest(data: DigestData): Promise<number> {
  const sellers = await fetchEligibleSellers();
  const eligible = sellers.filter((s) => wantsDigest(s));

  let sent = 0;
  for (const s of eligible) {
    const subject = `📊 AeroParts Daily Intelligence — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
    await send(s.email, subject, dailyDigestTemplate(s, data));
    sent++;
  }
  return sent;
}
