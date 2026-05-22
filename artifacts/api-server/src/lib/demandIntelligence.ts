import { db, rfqsTable, listingsTable } from "@workspace/db";
import { eq, and, sql, gte, count } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendingPart {
  partNumber: string;
  rfqCount: number;
  aogCount: number;
  urgentCount: number;
  routineCount: number;
  activeListings: number;
  coverageRatio: number;        // listings / rfqs (0 = shortage, ≥1 = covered)
  trend: "rising" | "stable" | "shortage";
}

export interface AogDayPoint {
  date: string;      // ISO date string YYYY-MM-DD
  aogCount: number;
  urgentCount: number;
  routineCount: number;
  totalCount: number;
}

export interface AircraftDemandTrend {
  aircraftType: string;
  rfqCount: number;
  aogCount: number;
  topParts: string[];
}

export interface InventoryShortage {
  partNumber: string;
  rfqCount: number;
  aogCount: number;
  activeListings: number;
  lastRequested: string;
  urgencyLevel: "critical" | "high" | "medium";
}

export interface DemandIntelligenceReport {
  generatedAt: string;
  windowDays: number;
  trendingParts: TrendingPart[];
  aogDailySpikes: AogDayPoint[];
  aircraftDemandTrends: AircraftDemandTrend[];
  inventoryShortages: InventoryShortage[];
  summary: {
    totalRfqs: number;
    aogRfqs: number;
    uniquePartsRequested: number;
    uniqueAircraftTypes: number;
    partsCoveredByInventory: number;
    partsWithShortage: number;
  };
}

// ─── Demand Intelligence Engine ───────────────────────────────────────────────

export async function generateDemandReport(windowDays = 30): Promise<DemandIntelligenceReport> {
  const since = new Date(Date.now() - windowDays * 86400000);

  // ── 1. Trending parts ────────────────────────────────────────────────────
  const partRfqRows = await db
    .select({
      partNumber: rfqsTable.partNumber,
      urgency: rfqsTable.urgency,
      createdAt: rfqsTable.createdAt,
    })
    .from(rfqsTable)
    .where(
      and(
        gte(rfqsTable.createdAt, since),
        sql`${rfqsTable.status} NOT IN ('deleted', 'archived')`,
      ),
    );

  // Aggregate by part number
  const partMap = new Map<string, { aog: number; urgent: number; routine: number; lastSeen: Date }>();
  for (const row of partRfqRows) {
    const pn = row.partNumber.trim().toUpperCase();
    const existing = partMap.get(pn) ?? { aog: 0, urgent: 0, routine: 0, lastSeen: new Date(0) };
    if (row.urgency === "aog") existing.aog++;
    else if (row.urgency === "urgent") existing.urgent++;
    else existing.routine++;
    if (row.createdAt > existing.lastSeen) existing.lastSeen = row.createdAt;
    partMap.set(pn, existing);
  }

  // Get active listing counts for all requested parts
  const requestedParts = [...partMap.keys()];
  const listingCountMap = new Map<string, number>();

  if (requestedParts.length > 0) {
    const listingRows = await db
      .select({
        partNumberUpper: sql<string>`upper(trim(${listingsTable.partNumber}))`,
        cnt: sql<number>`cast(count(*) as int)`,
      })
      .from(listingsTable)
      .where(
        and(
          eq(listingsTable.status, "active"),
          sql`upper(trim(${listingsTable.partNumber})) = ANY(ARRAY[${sql.join(requestedParts.map(p => sql`${p}`), sql`, `)}])`,
        ),
      )
      .groupBy(sql`upper(trim(${listingsTable.partNumber}))`);

    for (const row of listingRows) {
      listingCountMap.set(row.partNumberUpper, row.cnt);
    }
  }

  const trendingParts: TrendingPart[] = [...partMap.entries()]
    .map(([pn, stats]) => {
      const rfqCount = stats.aog + stats.urgent + stats.routine;
      const activeListings = listingCountMap.get(pn) ?? 0;
      const coverageRatio = rfqCount > 0 ? activeListings / rfqCount : 1;
      const trend: TrendingPart["trend"] =
        coverageRatio === 0 ? "shortage" : stats.aog > 2 ? "rising" : "stable";
      return {
        partNumber: pn,
        rfqCount,
        aogCount: stats.aog,
        urgentCount: stats.urgent,
        routineCount: stats.routine,
        activeListings,
        coverageRatio: Math.round(coverageRatio * 100) / 100,
        trend,
      };
    })
    .sort((a, b) => b.rfqCount - a.rfqCount)
    .slice(0, 15);

  // ── 2. AOG daily spikes (last 14 days) ───────────────────────────────────
  const aogSince = new Date(Date.now() - 14 * 86400000);
  const dailyRows = await db
    .select({
      date: sql<string>`to_char(${rfqsTable.createdAt}::date, 'YYYY-MM-DD')`,
      urgency: rfqsTable.urgency,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(rfqsTable)
    .where(
      and(
        gte(rfqsTable.createdAt, aogSince),
        sql`${rfqsTable.status} NOT IN ('deleted', 'archived')`,
      ),
    )
    .groupBy(sql`to_char(${rfqsTable.createdAt}::date, 'YYYY-MM-DD')`, rfqsTable.urgency)
    .orderBy(sql`to_char(${rfqsTable.createdAt}::date, 'YYYY-MM-DD')`);

  const dayMap = new Map<string, { aog: number; urgent: number; routine: number }>();
  for (const row of dailyRows) {
    const day = dayMap.get(row.date) ?? { aog: 0, urgent: 0, routine: 0 };
    if (row.urgency === "aog") day.aog += row.cnt;
    else if (row.urgency === "urgent") day.urgent += row.cnt;
    else day.routine += row.cnt;
    dayMap.set(row.date, day);
  }

  const aogDailySpikes: AogDayPoint[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      aogCount: counts.aog,
      urgentCount: counts.urgent,
      routineCount: counts.routine,
      totalCount: counts.aog + counts.urgent + counts.routine,
    }));

  // ── 3. Aircraft demand trends ─────────────────────────────────────────────
  const aircraftRows = await db
    .select({
      aircraft: rfqsTable.aircraftApplicability,
      partNumber: rfqsTable.partNumber,
      urgency: rfqsTable.urgency,
    })
    .from(rfqsTable)
    .where(
      and(
        gte(rfqsTable.createdAt, since),
        sql`${rfqsTable.aircraftApplicability} IS NOT NULL AND trim(${rfqsTable.aircraftApplicability}) != ''`,
        sql`${rfqsTable.status} NOT IN ('deleted', 'archived')`,
      ),
    );

  const aircraftMap = new Map<string, { rfq: number; aog: number; parts: Set<string> }>();
  for (const row of aircraftRows) {
    const ac = (row.aircraft ?? "").trim().split(",")[0].trim().toUpperCase();
    if (!ac) continue;
    const entry = aircraftMap.get(ac) ?? { rfq: 0, aog: 0, parts: new Set() };
    entry.rfq++;
    if (row.urgency === "aog") entry.aog++;
    entry.parts.add(row.partNumber.trim().toUpperCase());
    aircraftMap.set(ac, entry);
  }

  const aircraftDemandTrends: AircraftDemandTrend[] = [...aircraftMap.entries()]
    .map(([ac, stats]) => ({
      aircraftType: ac,
      rfqCount: stats.rfq,
      aogCount: stats.aog,
      topParts: [...stats.parts].slice(0, 5),
    }))
    .sort((a, b) => b.rfqCount - a.rfqCount)
    .slice(0, 10);

  // ── 4. Inventory shortages ────────────────────────────────────────────────
  const shortageRows = await db
    .select({
      partNumber: rfqsTable.partNumber,
      urgency: rfqsTable.urgency,
      createdAt: rfqsTable.createdAt,
    })
    .from(rfqsTable)
    .where(
      and(
        gte(rfqsTable.createdAt, since),
        sql`${rfqsTable.status} NOT IN ('deleted', 'archived')`,
      ),
    );

  const shortageMap = new Map<string, { rfq: number; aog: number; lastSeen: Date }>();
  for (const row of shortageRows) {
    const pn = row.partNumber.trim().toUpperCase();
    const entry = shortageMap.get(pn) ?? { rfq: 0, aog: 0, lastSeen: new Date(0) };
    entry.rfq++;
    if (row.urgency === "aog") entry.aog++;
    if (row.createdAt > entry.lastSeen) entry.lastSeen = row.createdAt;
    shortageMap.set(pn, entry);
  }

  const inventoryShortages: InventoryShortage[] = [];
  for (const [pn, stats] of shortageMap.entries()) {
    const activeListings = listingCountMap.get(pn) ?? 0;
    if (activeListings < 2) {
      const urgencyLevel: InventoryShortage["urgencyLevel"] =
        stats.aog > 0 ? "critical" : stats.rfq >= 3 ? "high" : "medium";
      inventoryShortages.push({
        partNumber: pn,
        rfqCount: stats.rfq,
        aogCount: stats.aog,
        activeListings,
        lastRequested: stats.lastSeen.toISOString(),
        urgencyLevel,
      });
    }
  }

  inventoryShortages.sort((a, b) => {
    const levelOrder = { critical: 0, high: 1, medium: 2 };
    const levelDiff = levelOrder[a.urgencyLevel] - levelOrder[b.urgencyLevel];
    return levelDiff !== 0 ? levelDiff : b.rfqCount - a.rfqCount;
  });

  // ── 5. Summary ────────────────────────────────────────────────────────────
  const totalRfqs = partRfqRows.length;
  const aogRfqs = partRfqRows.filter(r => r.urgency === "aog").length;
  const uniquePartsRequested = partMap.size;
  const uniqueAircraftTypes = aircraftMap.size;
  const partsCoveredByInventory = [...partMap.keys()].filter(pn => (listingCountMap.get(pn) ?? 0) >= 1).length;
  const partsWithShortage = inventoryShortages.length;

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    trendingParts,
    aogDailySpikes,
    aircraftDemandTrends,
    inventoryShortages: inventoryShortages.slice(0, 20),
    summary: {
      totalRfqs,
      aogRfqs,
      uniquePartsRequested,
      uniqueAircraftTypes,
      partsCoveredByInventory,
      partsWithShortage,
    },
  };
}
