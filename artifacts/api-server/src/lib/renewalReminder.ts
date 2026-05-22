/**
 * Yearly renewal reminder emails.
 * Sends a reminder 30 days before the subscription renews for yearly billing users.
 * Runs once on startup and then every 24 hours.
 */
import { db, usersTable } from "@workspace/db";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REMINDER_DAYS_BEFORE = 30;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sendReminderEmail(user: {
  email: string;
  companyName: string;
  plan: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — skipping renewal reminder email");
    return;
  }

  const renewalDate = user.currentPeriodEnd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const planLabel =
    user.plan === "pro"
      ? "Parts Pro"
      : user.plan === "enterprise"
        ? "Enterprise"
        : user.plan;

  const body = {
    from: "AeroParts <no-reply@aeroparts.com>",
    to: [user.email],
    subject: `Your ${planLabel} subscription renews in ${REMINDER_DAYS_BEFORE} days`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #e2e8f0; background: #0d1b2e; padding: 32px; border-radius: 8px;">
        <h1 style="color: #ffffff; font-size: 22px; margin-bottom: 8px;">Subscription Renewal Reminder</h1>
        <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${user.companyName},</p>
        <p style="color: #cbd5e1; line-height: 1.6;">
          Your <strong style="color: #ffffff;">${planLabel} (Yearly)</strong> subscription is set to renew automatically on
          <strong style="color: #ffffff;">${renewalDate}</strong>.
        </p>
        <p style="color: #cbd5e1; line-height: 1.6;">
          No action is required — your subscription will continue uninterrupted and your card on file will be charged.
        </p>
        <p style="color: #cbd5e1; line-height: 1.6;">
          If you'd like to make any changes before the renewal, you can manage your billing details in the
          <a href="https://aeroparts.com/seller/subscription" style="color: #60a5fa;">subscription portal</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #1e3a5f; margin: 24px 0;" />
        <p style="color: #475569; font-size: 12px;">
          You're receiving this because you have an active yearly subscription on AeroParts Marketplace.
        </p>
      </div>
    `,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}

async function runRenewalReminders(): Promise<void> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);
    // Match users whose renewal falls in the 24-hour window around exactly 30 days from now.
    const windowEnd = new Date(windowStart.getTime() + INTERVAL_MS);

    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        companyName: usersTable.companyName,
        plan: usersTable.plan,
        currentPeriodEnd: usersTable.currentPeriodEnd,
        billingCycle: usersTable.billingCycle,
        subscriptionStatus: usersTable.subscriptionStatus,
      })
      .from(usersTable)
      .where(
        and(
          sql`${usersTable.billingCycle} = 'yearly'`,
          eq(usersTable.subscriptionStatus, "active"),
          gte(usersTable.currentPeriodEnd, windowStart),
          lte(usersTable.currentPeriodEnd, windowEnd),
        ),
      );

    if (users.length === 0) {
      logger.info("Renewal reminders: no upcoming yearly renewals in window");
      return;
    }

    logger.info({ count: users.length }, "Sending yearly renewal reminder emails");

    for (const user of users) {
      if (!user.currentPeriodEnd) continue;
      try {
        await sendReminderEmail({
          email: user.email,
          companyName: user.companyName,
          plan: user.plan,
          currentPeriodEnd: user.currentPeriodEnd,
        });
        logger.info({ userId: user.id, email: user.email }, "Renewal reminder sent");
      } catch (err) {
        logger.warn({ err, userId: user.id }, "Failed to send renewal reminder");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Error running renewal reminder job");
  }
}

export function startRenewalReminderJob(): void {
  // Run once on startup (after a short delay), then every 24 hours.
  setTimeout(() => {
    void runRenewalReminders();
    setInterval(() => void runRenewalReminders(), INTERVAL_MS);
  }, 10_000);
  logger.info("Renewal reminder job scheduled (daily, 30-day window)");
}
