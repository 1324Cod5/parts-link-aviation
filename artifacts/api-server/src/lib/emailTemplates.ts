/**
 * Email HTML templates — dark-navy-themed, inline styles for email client compat.
 */

// ─── Shared palette / primitives ──────────────────────────────────────────────

const BG        = "#0d1b2e";
const CARD      = "#132237";
const BORDER    = "#1e3a5a";
const SILVER    = "#bebebe";
const WHITE     = "#f8f8f8";
const MUTED     = "#7a8fa6";
const RED       = "#dc2626";
const GREEN     = "#16a34a";
const AMBER     = "#d97706";
const BLUE      = "#1d4ed8";

function base(content: string, accentColor = SILVER): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td>
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto 24px;">
        <tr>
          <td style="padding:0 0 16px;">
            <span style="font-size:20px;font-weight:700;color:${WHITE};letter-spacing:-0.5px;">Parts Link Aviation</span>
            <span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin:0 0 2px 6px;vertical-align:middle;"></span>
          </td>
        </tr>
      </table>
      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td style="background:${CARD};border:1px solid ${BORDER};border-radius:8px;padding:32px;">
            ${content}
          </td>
        </tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:24px auto 0;">
        <tr>
          <td style="padding:16px 0;border-top:1px solid ${BORDER};text-align:center;">
            <p style="margin:0;font-size:12px;color:${MUTED};">
              You're receiving this as a registered Parts Link Aviation seller.<br>
              <a href="{{unsubscribe_url}}" style="color:${MUTED};text-decoration:underline;">Manage notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function pill(text: string, bg: string, color: string): string {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`;
}

function section(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:6px 0;border-bottom:1px solid ${BORDER};">
      <span style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
    </td>
    <td style="padding:6px 0 6px 16px;border-bottom:1px solid ${BORDER};text-align:right;">
      <span style="font-size:14px;color:${WHITE};font-family:monospace;">${value}</span>
    </td>
  </tr>`;
}

function cta(label: string, href: string, bg = SILVER): string {
  return `
  <a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:${bg};color:${BG};font-size:14px;font-weight:600;border-radius:6px;text-decoration:none;">
    ${label}
  </a>`;
}

// ─── Seller profile shape used by templates ───────────────────────────────────

export interface TemplateSeller {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
}

// ─── RFQ Alert ────────────────────────────────────────────────────────────────

import type { RfqPayload } from "./email";

export function rfqAlertTemplate(
  seller: TemplateSeller,
  rfq: RfqPayload,
  isEnterprise: boolean,
): string {
  const urgencyColor = rfq.urgency === "aog" ? RED : rfq.urgency === "critical" ? AMBER : BLUE;
  const urgencyLabel = rfq.urgency.replace("_", " ").toUpperCase();

  const content = `
    <div style="margin-bottom:24px;">
      ${isEnterprise ? `<div style="margin-bottom:12px;">${pill("⚡ Exclusive Priority", AMBER + "22", AMBER)}</div>` : ""}
      ${pill(urgencyLabel, urgencyColor + "22", urgencyColor)}
      <h1 style="margin:16px 0 4px;font-size:24px;font-weight:700;color:${WHITE};">${rfq.partNumber}</h1>
      <p style="margin:0;font-size:15px;color:${MUTED};">${rfq.description}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${section("Quantity", String(rfq.quantity))}
      ${rfq.aircraftApplicability ? section("Aircraft", rfq.aircraftApplicability) : ""}
      ${rfq.condition ? section("Condition", rfq.condition) : ""}
      ${rfq.buyerCompany ? section("Buyer Company", rfq.buyerCompany) : ""}
      ${section("Posted", new Date(rfq.createdAt).toUTCString())}
    </table>

    <p style="font-size:14px;color:${MUTED};margin-bottom:8px;">
      ${isEnterprise
        ? "As an Enterprise seller, you're receiving this alert before other sellers. Respond quickly to maximize your chances."
        : "Log in to view full buyer details and submit a quote."}
    </p>
    ${cta("View RFQ & Respond →", `https://aeroparts.app/rfqs/${rfq.id}`)}
  `;
  return base(content, isEnterprise ? AMBER : SILVER);
}

// ─── AOG Alert ────────────────────────────────────────────────────────────────

export function aogAlertTemplate(
  seller: TemplateSeller,
  rfq: RfqPayload,
  isEnterprise: boolean,
): string {
  const content = `
    <div style="background:${RED}18;border:1px solid ${RED}44;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">🔴</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${RED};">AIRCRAFT ON GROUND</p>
      <p style="margin:4px 0 0;font-size:13px;color:${MUTED};">Immediate response requested</p>
    </div>
    ${isEnterprise ? `<div style="margin-bottom:16px;">${pill("⚡ Exclusive Enterprise Alert", AMBER + "22", AMBER)}</div>` : ""}
    <h2 style="margin:0 0 4px;font-size:20px;color:${WHITE};">${rfq.partNumber}</h2>
    <p style="margin:0 0 20px;color:${MUTED};font-size:14px;">${rfq.description}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${section("Quantity", String(rfq.quantity))}
      ${rfq.aircraftApplicability ? section("Aircraft", rfq.aircraftApplicability) : ""}
      ${rfq.buyerCompany ? section("Buyer Company", rfq.buyerCompany) : ""}
      ${rfq.urgencyReason ? section("AOG Reason", rfq.urgencyReason ?? "") : ""}
    </table>

    <p style="font-size:13px;color:${RED};font-weight:600;margin-bottom:4px;">
      ⚠️ AOG situations require same-day response. Act immediately.
    </p>
    ${cta("Respond to AOG RFQ →", `https://aeroparts.app/rfqs/${rfq.id}`, RED)}
  `;
  return base(content, RED);
}

// ─── Quote Awarded ────────────────────────────────────────────────────────────

export interface QuoteAwardedPayload {
  rfqId: number;
  partNumber: string;
  description: string;
  buyerName: string;
  buyerCompany: string | null;
}

export function quoteAwardedTemplate(
  seller: TemplateSeller,
  payload: QuoteAwardedPayload,
): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <p style="font-size:40px;margin:0 0 8px;">🏆</p>
      <h1 style="margin:0 0 8px;font-size:24px;color:${WHITE};">Quote Accepted!</h1>
      <p style="margin:0;font-size:15px;color:${MUTED};">Your quote for <strong style="color:${WHITE};">${payload.partNumber}</strong> has been selected.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${section("Part Number", payload.partNumber)}
      ${section("Description", payload.description)}
      ${section("Buyer Name", payload.buyerName)}
      ${payload.buyerCompany ? section("Buyer Company", payload.buyerCompany) : ""}
    </table>

    <p style="font-size:14px;color:${MUTED};margin-bottom:8px;">
      The buyer has selected your quote. Log in to view full contact details and coordinate delivery.
    </p>
    ${cta("View RFQ Details →", `https://aeroparts.app/rfqs/${payload.rfqId}`, GREEN)}
  `;
  return base(content, GREEN);
}

// ─── Certification Update ──────────────────────────────────────────────────────

export interface CertUpdatePayload {
  listingId: number;
  partNumber: string;
  documentType: string;
  verificationStatus: "approved" | "rejected";
  reviewNote: string | null;
}

export function certUpdateTemplate(
  seller: TemplateSeller,
  payload: CertUpdatePayload,
): string {
  const approved = payload.verificationStatus === "approved";
  const statusColor = approved ? GREEN : RED;
  const statusIcon  = approved ? "✅" : "❌";
  const statusLabel = approved ? "APPROVED" : "ACTION REQUIRED";

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <p style="font-size:36px;margin:0 0 8px;">${statusIcon}</p>
      <h1 style="margin:0 0 8px;font-size:22px;color:${WHITE};">Certification ${approved ? "Approved" : "Needs Attention"}</h1>
      <div style="margin:8px 0;">${pill(statusLabel, statusColor + "22", statusColor)}</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${section("Part Number", payload.partNumber)}
      ${section("Document Type", payload.documentType.replace(/_/g, " ").toUpperCase())}
      ${section("Status", payload.verificationStatus.toUpperCase())}
    </table>

    ${payload.reviewNote ? `
    <div style="background:${BORDER}55;border-left:3px solid ${statusColor};padding:12px 16px;border-radius:4px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Admin Note</p>
      <p style="margin:0;font-size:14px;color:${WHITE};">${payload.reviewNote}</p>
    </div>` : ""}

    ${cta("View Listing →", `https://aeroparts.app/listings/${payload.listingId}`, approved ? GREEN : AMBER)}
  `;
  return base(content, statusColor);
}

// ─── New Message Alert (seller notification) ──────────────────────────────────

export interface MessageConversationInfo {
  id: number;
  buyerName: string;
  buyerEmail: string;
  buyerCompany: string | null;
  subject: string | null;
  rfqId: number | null;
  listingId: number | null;
}

export function newMessageAlertTemplate(
  seller: TemplateSeller,
  conv: MessageConversationInfo,
  messageContent: string,
): string {
  const context = conv.rfqId
    ? `RFQ #${conv.rfqId}`
    : conv.listingId
      ? `Listing #${conv.listingId}`
      : "General inquiry";

  const content = `
    <h2 style="margin:0 0 4px;font-size:20px;color:${WHITE};">New Message</h2>
    <p style="margin:0 0 20px;color:${MUTED};font-size:14px;">A buyer has sent you a message on Parts Link Aviation.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${section("From", conv.buyerName)}
      ${conv.buyerCompany ? section("Company", conv.buyerCompany) : ""}
      ${section("Re", context)}
      ${conv.subject ? section("Subject", conv.subject) : ""}
    </table>

    <div style="background:${CARD};border:1px solid ${BORDER};border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:${MUTED};letter-spacing:0.05em;">Message</p>
      <p style="margin:0;color:${WHITE};font-size:14px;line-height:1.6;">${messageContent.replace(/\n/g, "<br>")}</p>
    </div>

    ${cta("View & Reply →", "https://aeroparts.app/seller/dashboard", BLUE)}
  `;
  return base(content, BLUE);
}

// ─── Seller Reply to Buyer ─────────────────────────────────────────────────────

export function sellerReplyTemplate(
  buyerName: string,
  sellerCompany: string,
  messageContent: string,
): string {
  const content = `
    <h2 style="margin:0 0 4px;font-size:20px;color:${WHITE};">Reply from ${sellerCompany}</h2>
    <p style="margin:0 0 20px;color:${MUTED};font-size:14px;">The seller has responded to your inquiry on Parts Link Aviation.</p>

    <div style="background:${CARD};border:1px solid ${BORDER};border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:${MUTED};letter-spacing:0.05em;">Message from ${sellerCompany}</p>
      <p style="margin:0;color:${WHITE};font-size:14px;line-height:1.6;">${messageContent.replace(/\n/g, "<br>")}</p>
    </div>

    <p style="color:${MUTED};font-size:12px;text-align:center;margin:0;">
      This message was sent via Parts Link Aviation in response to your inquiry.
    </p>
  `;
  return base(content, BLUE);
}

// ─── AOG Phased Escalation Alert ──────────────────────────────────────────────

interface AogPhaseConfig {
  label: string;
  color: string;
  note: string;
}

const AOG_PHASE_CONFIG: Record<string, AogPhaseConfig> = {
  immediate: {
    label: "⚡ FIRST ALERT — You are among the first 5 sellers to receive this",
    color: RED,
    note:  "Act immediately — you have a priority window over all other sellers.",
  },
  expanded: {
    label: "⏱️ 10-MINUTE ESCALATION — AOG still unresolved",
    color: AMBER,
    note:  "This AOG alert has been active for 10 minutes. Immediate response required.",
  },
  full: {
    label: "🚨 20-MINUTE ESCALATION — All sellers now notified",
    color: RED,
    note:  "Critical escalation — be the fastest responder to secure this order.",
  },
  critical: {
    label: "🚨 CRITICAL — 30 minutes elapsed with no resolution",
    color: RED,
    note:  "Extreme urgency. This aircraft remains grounded.",
  },
};

export function aogPhaseAlertTemplate(
  seller: TemplateSeller,
  rfq: RfqPayload,
  phase: string,
  isEnterprise: boolean,
): string {
  const pm = AOG_PHASE_CONFIG[phase] ?? AOG_PHASE_CONFIG.immediate;

  const content = `
    <div style="background:${RED}18;border:1px solid ${RED}44;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">🔴</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${RED};">AIRCRAFT ON GROUND</p>
      <p style="margin:6px 0 0;font-size:12px;color:${pm.color};font-weight:600;">${pm.label}</p>
    </div>
    ${isEnterprise ? `<div style="margin-bottom:16px;">${pill("⚡ Exclusive Enterprise Alert", AMBER + "22", AMBER)}</div>` : ""}
    <h2 style="margin:0 0 4px;font-size:20px;color:${WHITE};">${rfq.partNumber}</h2>
    <p style="margin:0 0 20px;color:${MUTED};font-size:14px;">${rfq.description}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${section("Quantity", String(rfq.quantity))}
      ${rfq.aircraftApplicability ? section("Aircraft", rfq.aircraftApplicability) : ""}
      ${rfq.buyerCompany ? section("Buyer Company", rfq.buyerCompany) : ""}
      ${rfq.urgencyReason ? section("AOG Reason", rfq.urgencyReason ?? "") : ""}
    </table>

    <div style="background:${pm.color}18;border-left:3px solid ${pm.color};padding:12px 16px;border-radius:4px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:${pm.color};font-weight:600;">${pm.note}</p>
    </div>
    ${cta("Respond to AOG RFQ →", `https://aeroparts.app/rfqs/${rfq.id}`, RED)}
  `;
  return base(content, RED);
}

// ─── Daily Digest ──────────────────────────────────────────────────────────────

export interface DigestData {
  newRfqCount:     number;
  aogCount:        number;
  trendingParts:   { partNumber: string; count: number }[];
  topAircraft:     { aircraft: string; count: number }[];
  topSearchTerms:  { term: string; count: number }[];
  periodLabel:     string; // e.g. "Last 24 hours"
}

export function dailyDigestTemplate(seller: TemplateSeller, data: DigestData): string {
  const partRows = data.trendingParts.slice(0, 5).map((p, i) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};">${i + 1}.</td>
      <td style="padding:8px 0 8px 12px;border-bottom:1px solid ${BORDER};font-family:monospace;color:${WHITE};">${p.partNumber}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDER};text-align:right;font-size:13px;color:${SILVER};">${p.count} inquiries</td>
    </tr>`
  ).join("");

  const aircraftRows = data.topAircraft.slice(0, 5).map((a, i) =>
    `<tr>
      <td style="padding:6px 0;font-size:13px;color:${MUTED};">${i + 1}.</td>
      <td style="padding:6px 0 6px 12px;font-size:14px;color:${WHITE};">${a.aircraft}</td>
      <td style="padding:6px 0;text-align:right;font-size:13px;color:${SILVER};">${a.count} RFQs</td>
    </tr>`
  ).join("");

  const content = `
    <h1 style="margin:0 0 4px;font-size:22px;color:${WHITE};">Daily Intelligence Report</h1>
    <p style="margin:0 0 28px;font-size:14px;color:${MUTED};">Hi ${seller.contactName}, here's your market summary for ${data.periodLabel}.</p>

    <!-- KPI row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="50%" style="padding:16px;background:${BG};border:1px solid ${BORDER};border-radius:6px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:${WHITE};font-family:monospace;">${data.newRfqCount}</p>
          <p style="margin:4px 0 0;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">New RFQs</p>
        </td>
        <td width="4%"></td>
        <td width="46%" style="padding:16px;background:${data.aogCount > 0 ? RED + "18" : BG};border:1px solid ${data.aogCount > 0 ? RED + "44" : BORDER};border-radius:6px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:${data.aogCount > 0 ? RED : WHITE};font-family:monospace;">${data.aogCount}</p>
          <p style="margin:4px 0 0;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">AOG Alerts</p>
        </td>
      </tr>
    </table>

    <!-- Trending parts -->
    ${data.trendingParts.length > 0 ? `
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:${SILVER};text-transform:uppercase;letter-spacing:0.5px;">🔥 Trending Parts</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${partRows}
    </table>` : ""}

    <!-- Top aircraft types -->
    ${data.topAircraft.length > 0 ? `
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:${SILVER};text-transform:uppercase;letter-spacing:0.5px;">✈️ High-Demand Aircraft Types</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${aircraftRows}
    </table>` : ""}

    ${cta("Browse Open RFQs →", "https://aeroparts.app/rfqs")}
  `;
  return base(content, SILVER);
}


// ─── Email Verification ────────────────────────────────────────────────────────

export function verificationEmailTemplate(contactName: string, verifyUrl: string): string {
  const NAVY = "#0a1628";
  const BLUE = "#1976d2";
  const GOLD = "#f5a623";
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background:${NAVY};font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:700;color:#fff;">Parts Link <span style="color:${GOLD};">Aviation</span></span>
    </div>
    <div style="background:#0d1f38;border-radius:12px;padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✉️</div>
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 12px;">Verify your email address</h1>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 32px;">Hi ${contactName}, click the button below to verify your Parts Link Aviation account. This link expires in 24 hours.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:${BLUE};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Verify Email Address</a>
      <p style="color:#475569;font-size:12px;margin:24px 0 0;">Or copy this link: <a href="${verifyUrl}" style="color:${BLUE};">${verifyUrl}</a></p>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">If you didn't create this account, you can ignore this email.</p>
  </div>
</body>
</html>`;
}
