import { db, usersTable, listingsTable, rfqsTable, rfqResponsesTable } from "@workspace/db";
import { eq, and, sql, inArray, isNotNull } from "drizzle-orm";
import { computeSellerStats } from "./rfqAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictedSeller {
  sellerId: number;
  companyName: string;
  email: string;
  plan: string;
  sellerType: string;
  trustScore: number;
  trustBadge: string;
  predictedScore: number;
  scoreBreakdown: {
    trustScorePoints: number;
    winRatePoints: number;
    pricingAccuracyPoints: number;
    responseSpeedPoints: number;
    planTierPoints: number;
    inventoryMatchBonus: number;
    verifiedVendorBonus: number;
  };
  winRate: number;
  totalQuotes: number;
  wins: number;
  avgResponseTimeHours: number | null;
  avgQuotedPrice: number | null;
  hasMatchingListing: boolean;
  rank: number;
}

export interface RfqPredictionResult {
  rfqId: number;
  partNumber: string;
  urgency: string;
  condition: string | null;
  aircraftApplicability: string | null;
  predictedAt: string;
  eligibleSellers: number;
  predictions: PredictedSeller[];
}

// ─── Scoring weights (total 100 pts) ─────────────────────────────────────────
const WEIGHTS = {
  trustScore: 30,       // normalized 0–100 → 0–30 pts
  winRate: 25,          // historical win rate → 0–25 pts
  pricingAccuracy: 20,  // how close to market median → 0–20 pts
  responseSpeed: 15,    // lower avg hours = more pts → 0–15 pts
  planTier: 10,         // subscription tier → 0–10 pts
};

const PLAN_TIER_SCORE: Record<string, number> = {
  enterprise:   10,
  mro_premium:  10,
  pro:           7,
  mro_provider:  7,
  mro_verified:  5,
  free:          0,
};

/** Converts avg response time (hours) to 0–15 speed score. Faster = higher. */
function responseSpeedPoints(avgHours: number | null): number {
  if (avgHours === null) return 5;  // neutral when unknown
  if (avgHours <= 2)  return 15;
  if (avgHours <= 6)  return 12;
  if (avgHours <= 24) return 9;
  if (avgHours <= 72) return 5;
  return 2;
}

// ─── Prediction engine ────────────────────────────────────────────────────────

export async function predictRfqWinners(rfqId: number): Promise<RfqPredictionResult | null> {
  const [rfq] = await db
    .select({
      id: rfqsTable.id,
      partNumber: rfqsTable.partNumber,
      urgency: rfqsTable.urgency,
      condition: rfqsTable.condition,
      aircraftApplicability: rfqsTable.aircraftApplicability,
    })
    .from(rfqsTable)
    .where(eq(rfqsTable.id, rfqId));

  if (!rfq) return null;

  // All active sellers eligible to respond
  const activeSellers = await db
    .select({
      id: usersTable.id,
      companyName: usersTable.companyName,
      email: usersTable.email,
      plan: usersTable.plan,
      sellerType: usersTable.sellerType,
      trustScore: usersTable.trustScore,
      trustBadge: usersTable.trustBadge,
    })
    .from(usersTable)
    .where(
      and(
        sql`${usersTable.role} IN ('seller')`,
        eq(usersTable.status, "active"),
      ),
    );

  if (activeSellers.length === 0) {
    return {
      rfqId: rfq.id,
      partNumber: rfq.partNumber,
      urgency: rfq.urgency,
      condition: rfq.condition,
      aircraftApplicability: rfq.aircraftApplicability,
      predictedAt: new Date().toISOString(),
      eligibleSellers: 0,
      predictions: [],
    };
  }

  const sellerIds = activeSellers.map(s => s.id);
  const statsMap = await computeSellerStats(sellerIds);

  // Check which sellers have a listing matching the part number or aircraft applicability
  const partNumUpper = rfq.partNumber.trim().toUpperCase();
  const matchingListings = await db
    .select({ sellerId: listingsTable.sellerId })
    .from(listingsTable)
    .where(
      and(
        inArray(listingsTable.sellerId, sellerIds),
        eq(listingsTable.status, "active"),
        sql`upper(trim(${listingsTable.partNumber})) = ${partNumUpper}`,
      ),
    );
  const sellersWithInventory = new Set(matchingListings.map(l => l.sellerId));

  // Score each seller
  const scored: PredictedSeller[] = activeSellers.map(seller => {
    const stats = statsMap.get(seller.id) ?? {
      totalResponses: 0, totalQuotes: 0, wins: 0, winRate: 0,
      avgResponseTimeHours: null, avgQuotedPrice: null, pricingAccuracy: null,
    };

    const trustScorePoints    = Math.round((seller.trustScore / 100) * WEIGHTS.trustScore);
    const winRatePoints        = Math.round(stats.winRate * WEIGHTS.winRate);
    const pricingPoints        = Math.round((stats.pricingAccuracy ?? 0.5) * WEIGHTS.pricingAccuracy);
    const speedPoints          = responseSpeedPoints(stats.avgResponseTimeHours);
    const planPoints           = PLAN_TIER_SCORE[seller.plan] ?? 0;
    const inventoryBonus       = sellersWithInventory.has(seller.id) ? 5 : 0;
    const verifiedVendorBonus  = seller.sellerType === "verified_vendor" ? 8 : 0;

    const predictedScore = Math.min(100,
      trustScorePoints + winRatePoints + pricingPoints + speedPoints + planPoints + inventoryBonus + verifiedVendorBonus
    );

    return {
      sellerId: seller.id,
      companyName: seller.companyName,
      email: seller.email,
      plan: seller.plan,
      sellerType: seller.sellerType,
      trustScore: seller.trustScore,
      trustBadge: seller.trustBadge,
      predictedScore,
      scoreBreakdown: {
        trustScorePoints,
        winRatePoints,
        pricingAccuracyPoints: pricingPoints,
        responseSpeedPoints: speedPoints,
        planTierPoints: planPoints,
        inventoryMatchBonus: inventoryBonus,
        verifiedVendorBonus,
      },
      winRate: stats.winRate,
      totalQuotes: stats.totalQuotes,
      wins: stats.wins,
      avgResponseTimeHours: stats.avgResponseTimeHours,
      avgQuotedPrice: stats.avgQuotedPrice,
      hasMatchingListing: sellersWithInventory.has(seller.id),
      rank: 0,
    };
  });

  scored.sort((a, b) => b.predictedScore - a.predictedScore);
  scored.forEach((s, i) => { s.rank = i + 1; });

  return {
    rfqId: rfq.id,
    partNumber: rfq.partNumber,
    urgency: rfq.urgency,
    condition: rfq.condition,
    aircraftApplicability: rfq.aircraftApplicability,
    predictedAt: new Date().toISOString(),
    eligibleSellers: activeSellers.length,
    predictions: scored.slice(0, 10),
  };
}
