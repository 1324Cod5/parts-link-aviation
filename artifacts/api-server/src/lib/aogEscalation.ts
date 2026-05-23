/**
 * AOG Escalation Service
 *
 * Manages the phased notification pipeline for AOG (Aircraft on Ground) RFQs.
 *
 * Phase timeline:
 *   immediate →  top 5 ranked Pro/Enterprise sellers notified at creation
 *   expanded  →  top 10 sellers after 10 minutes
 *   full      →  all Pro/Enterprise sellers after 20 minutes
 *   critical  →  status marker only at 30 minutes (no further notifications)
 */

import {
  db, rfqsTable, usersTable, rfqResponsesTable, aogEscalationsTable,
} from "@workspace/db";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { sendAogPhaseAlert } from "./email";
import type { RfqPayload } from "./email";

export type AogPhase = "immediate" | "expanded" | "full" | "critical";

const PHASE_DELAYS_MS = {
  expanded: 10 * 60 * 1_000,
  full:     20 * 60 * 1_000,
  critical: 30 * 60 * 1_000,
} as const;

// ─── In-memory timer registry ──────────────────────────────────────────────────

const activeTimers = new Map<number, NodeJS.Timeout[]>();

function clearTimers(rfqId: number): void {
  const timers = activeTimers.get(rfqId);
  if (timers) { timers.forEach(clearTimeout); activeTimers.delete(rfqId); }
}

// ─── Seller ranking ────────────────────────────────────────────────────────────

interface RankedSeller {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  plan: string;
  score: number;
}

const TIER_SCORE: Record<string, number> = { enterprise: 30, mro_premium: 30, mro_provider: 20, pro: 20 };

async function getAogRankedSellers(): Promise<RankedSeller[]> {
  const sellers = await db
    .select({
      id:            usersTable.id,
      email:         usersTable.email,
      companyName:   usersTable.companyName,
      contactName:   usersTable.contactName,
      plan:          usersTable.plan,
      trustScore:    usersTable.trustScore,
      responseCount: sql<number>`cast(count(${rfqResponsesTable.id}) as int)`,
    })
    .from(usersTable)
    .leftJoin(rfqResponsesTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .where(
      and(
        eq(usersTable.status, "active"),
        eq(usersTable.role, "seller"),
        inArray(usersTable.plan, ["pro", "enterprise", "mro_premium"]),
      ),
    )
    .groupBy(usersTable.id);

  return sellers
    .map(s => ({
      id:          s.id,
      email:       s.email,
      companyName: s.companyName,
      contactName: s.contactName,
      plan:        s.plan,
      score: (Math.min(100, Math.max(0, s.trustScore)) / 100) * 50
           + (TIER_SCORE[s.plan] ?? 0)
           + (Math.min(s.responseCount, 30) / 30) * 10,
    }))
    .sort((a, b) => b.score - a.score);
}

// ─── DB persistence ────────────────────────────────────────────────────────────

async function persistEscalation(rfqId: number, phase: AogPhase, newIds: number[]): Promise<void> {
  const [existing] = await db
    .select({ notifiedSellerIds: aogEscalationsTable.notifiedSellerIds })
    .from(aogEscalationsTable)
    .where(eq(aogEscalationsTable.rfqId, rfqId));

  if (existing) {
    const merged = [...new Set([...(existing.notifiedSellerIds ?? []), ...newIds])];
    await db
      .update(aogEscalationsTable)
      .set({ phase, notifiedSellerIds: merged, lastEscalatedAt: new Date() })
      .where(eq(aogEscalationsTable.rfqId, rfqId));
  } else {
    await db.insert(aogEscalationsTable).values({ rfqId, phase, notifiedSellerIds: newIds });
  }
}

async function getEscalation(rfqId: number) {
  const [row] = await db
    .select()
    .from(aogEscalationsTable)
    .where(eq(aogEscalationsTable.rfqId, rfqId));
  return row ?? null;
}

async function isRfqStillOpen(rfqId: number): Promise<boolean> {
  const [row] = await db
    .select({ status: rfqsTable.status })
    .from(rfqsTable)
    .where(eq(rfqsTable.id, rfqId));
  return row?.status === "open";
}

// ─── Phase executor ────────────────────────────────────────────────────────────

const PHASE_TARGETS: Record<Exclude<AogPhase, "critical">, number | null> = {
  immediate: 5,
  expanded:  10,
  full:      null, // all sellers
};

async function executePhase(
  rfqId:           number,
  rfq:             RfqPayload,
  phase:           AogPhase,
  allSellers:      RankedSeller[],
  alreadyNotified: Set<number>,
): Promise<void> {
  if (phase === "critical") {
    await persistEscalation(rfqId, "critical", []);
    logger.warn({ rfqId }, "AOG RFQ reached CRITICAL escalation — 30 min with no resolution");
    return;
  }

  const target    = PHASE_TARGETS[phase];
  const slice     = target === null ? allSellers : allSellers.slice(0, target);
  const toNotify  = slice.filter(s => !alreadyNotified.has(s.id));

  if (toNotify.length > 0) {
    await sendAogPhaseAlert(rfq, toNotify, phase);
  }
  await persistEscalation(rfqId, phase, toNotify.map(s => s.id));
}

function resolvedIds(esc: { notifiedSellerIds: number[] | null } | null): Set<number> {
  return new Set<number>(Array.isArray(esc?.notifiedSellerIds) ? esc!.notifiedSellerIds : []);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Called immediately when an AOG RFQ is created. */
export async function startAogEscalation(rfqId: number, rfq: RfqPayload): Promise<void> {
  logger.info({ rfqId }, "AOG escalation: starting");

  let allSellers: RankedSeller[];
  try {
    allSellers = await getAogRankedSellers();
  } catch (err) {
    logger.error({ err, rfqId }, "AOG escalation: failed to rank sellers");
    return;
  }

  // Phase 1 — immediate: top 5 right now
  try {
    await executePhase(rfqId, rfq, "immediate", allSellers, new Set());
  } catch (err) {
    logger.error({ err, rfqId }, "AOG escalation: immediate phase failed");
  }

  // Schedule phases 2–4
  const timers: NodeJS.Timeout[] = [];

  for (const [phase, delayMs] of [
    ["expanded", PHASE_DELAYS_MS.expanded],
    ["full",     PHASE_DELAYS_MS.full],
    ["critical", PHASE_DELAYS_MS.critical],
  ] as const) {
    const t = setTimeout(async () => {
      try {
        const esc = await getEscalation(rfqId);
        if (esc?.resolvedAt || !(await isRfqStillOpen(rfqId))) { clearTimers(rfqId); return; }
        const sellers  = await getAogRankedSellers();
        const notified = resolvedIds(esc);
        await executePhase(rfqId, rfq, phase, sellers, notified);
      } catch (err) {
        logger.error({ err, rfqId, phase }, "AOG escalation: phase failed");
      }
    }, delayMs);
    timers.push(t);
  }

  activeTimers.set(rfqId, timers);
}

/** Call when the RFQ is closed, awarded, or cancelled to stop further escalations. */
export async function resolveAogEscalation(rfqId: number): Promise<void> {
  clearTimers(rfqId);
  try {
    const esc = await getEscalation(rfqId);
    if (esc && !esc.resolvedAt) {
      await db
        .update(aogEscalationsTable)
        .set({ resolvedAt: new Date() })
        .where(eq(aogEscalationsTable.rfqId, rfqId));
    }
    logger.info({ rfqId }, "AOG escalation: resolved");
  } catch (err) {
    logger.error({ err, rfqId }, "AOG escalation: failed to mark resolved");
  }
}

/** Re-arm timers on server restart for any still-open AOG escalations. */
export async function resumeAogEscalations(): Promise<void> {
  try {
    const unresolved = await db
      .select()
      .from(aogEscalationsTable)
      .where(isNull(aogEscalationsTable.resolvedAt));

    for (const esc of unresolved) {
      const rfqId   = esc.rfqId;
      const elapsed = Date.now() - esc.createdAt.getTime();

      if (!(await isRfqStillOpen(rfqId))) continue;

      const [rfqRow] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, rfqId));
      if (!rfqRow) continue;

      const rfq: RfqPayload = {
        id: rfqRow.id, partNumber: rfqRow.partNumber, description: rfqRow.description,
        quantity: rfqRow.quantity, urgency: rfqRow.urgency ?? "aog",
        aircraftApplicability: rfqRow.aircraftApplicability ?? null,
        condition: rfqRow.condition ?? null, buyerCompany: rfqRow.buyerCompany ?? null,
        createdAt: rfqRow.createdAt.toISOString(), urgencyReason: rfqRow.urgencyReason ?? null,
      };

      const alreadyNotified = resolvedIds(esc);
      const timers: NodeJS.Timeout[] = [];

      for (const [phase, delayMs] of [
        ["expanded", PHASE_DELAYS_MS.expanded],
        ["full",     PHASE_DELAYS_MS.full],
        ["critical", PHASE_DELAYS_MS.critical],
      ] as const) {
        const remaining = delayMs - elapsed;
        if (remaining <= 0) continue;

        const t = setTimeout(async () => {
          try {
            const e       = await getEscalation(rfqId);
            if (e?.resolvedAt || !(await isRfqStillOpen(rfqId))) { clearTimers(rfqId); return; }
            const sellers  = await getAogRankedSellers();
            const notified = resolvedIds(e);
            notified.forEach(id => alreadyNotified.add(id));
            await executePhase(rfqId, rfq, phase, sellers, notified);
          } catch (err) {
            logger.error({ err, rfqId, phase }, "AOG resumed phase failed");
          }
        }, remaining);
        timers.push(t);
      }

      if (timers.length) {
        activeTimers.set(rfqId, timers);
        logger.info({ rfqId, timers: timers.length, elapsedMin: Math.round(elapsed / 60_000) }, "AOG escalation: timers re-armed");
      }
    }
  } catch (err) {
    logger.error({ err }, "AOG escalation: startup resume failed (non-fatal)");
  }
}
