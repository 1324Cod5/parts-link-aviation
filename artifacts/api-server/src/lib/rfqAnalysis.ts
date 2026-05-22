import { db, rfqsTable, rfqResponsesTable, usersTable } from "@workspace/db";
import { eq, and, sql, inArray, like, or, isNotNull } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SellerStats {
  totalResponses: number;
  totalQuotes: number;
  wins: number;
  winRate: number;
  avgResponseTimeHours: number | null;
  avgQuotedPrice: number | null;
  pricingAccuracy: number | null;
}

export interface ScoredSeller {
  sellerId: number;
  companyName: string;
  trustScore: number;
  trustBadge: string;
  plan: string;
  matchScore: number;
  responseCount: number;
  totalQuotes: number;
  winRate: number;
  avgResponseTimeHours: number | null;
  pricingAccuracy: number | null;
}

export interface PriceEstimate {
  low: number;
  mid: number;
  high: number;
  currency: string;
  dataPoints: number;
  confidence: "low" | "medium" | "high";
  urgencyAdjusted: boolean;
}

export interface AutoQuoteSuggestion {
  suggestedPrice: number;
  suggestedLeadTimeDays: number;
  topSeller: ScoredSeller | null;
  rationale: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Urgency price multipliers — AOG commands a significant premium. */
const URGENCY_PRICE_MULTIPLIER: Record<string, number> = {
  aog: 1.35,
  urgent: 1.15,
  routine: 1.00,
};

/** Default lead times (days) per urgency, used when no historical data exists. */
const DEFAULT_LEAD_TIME_DAYS: Record<string, number> = {
  aog: 3,
  urgent: 7,
  routine: 14,
};

/** Condition price multipliers relative to new/unknown. */
const CONDITION_PRICE_MULTIPLIER: Record<string, number> = {
  new: 1.00,
  overhauled: 0.82,
  serviceable: 0.68,
  as_removed: 0.50,
  repaired: 0.72,
};

/** Subscription tier bonus in the enhanced scoring model (out of 25 pts). */
const TIER_SCORE: Record<string, number> = {
  enterprise: 25,
  mro_premium: 25,
  pro: 17,
  mro_verified: 12,
  free: 0,
};

/** Urgency alignment bonus ceiling per urgency level (used in scoring). */
const URGENCY_ALIGNMENT_MAX: Record<string, number> = {
  aog: 10,
  urgent: 5,
  routine: 2,
};

// ─── Seller stats ─────────────────────────────────────────────────────────────

/**
 * Fetches per-seller performance stats for an array of seller IDs.
 * Returns a Map keyed by sellerId.
 */
export async function computeSellerStats(
  sellerIds: number[],
): Promise<Map<number, SellerStats>> {
  if (sellerIds.length === 0) return new Map();

  // Quote-level stats: wins, total quotes, avg price, avg response time
  const quoteStats = await db
    .select({
      sellerId: rfqResponsesTable.sellerId,
      totalResponses: sql<number>`cast(count(*) as int)`,
      totalQuotes: sql<number>`cast(count(*) filter (where ${rfqResponsesTable.isQuote} = true) as int)`,
      wins: sql<number>`cast(count(*) filter (where ${rfqsTable.awardedResponseId} = ${rfqResponsesTable.id}) as int)`,
      avgResponseHours: sql<number | null>`avg(
        extract(epoch from (${rfqResponsesTable.createdAt} - ${rfqsTable.createdAt})) / 3600.0
      )`,
      avgPrice: sql<number | null>`avg(
        cast(${rfqResponsesTable.price} as numeric)
      ) filter (where ${rfqResponsesTable.isQuote} = true and ${rfqResponsesTable.price} is not null)`,
    })
    .from(rfqResponsesTable)
    .leftJoin(rfqsTable, eq(rfqResponsesTable.rfqId, rfqsTable.id))
    .where(inArray(rfqResponsesTable.sellerId, sellerIds))
    .groupBy(rfqResponsesTable.sellerId);

  // Market median: median price of all awarded quotes (for pricingAccuracy baseline)
  const marketPriceRows = await db
    .select({ price: rfqResponsesTable.price })
    .from(rfqResponsesTable)
    .innerJoin(
      rfqsTable,
      and(
        eq(rfqResponsesTable.rfqId, rfqsTable.id),
        eq(rfqsTable.awardedResponseId, rfqResponsesTable.id),
      ),
    )
    .where(isNotNull(rfqResponsesTable.price));

  const marketMedian = computeMedian(
    marketPriceRows.map((r) => parseFloat(r.price ?? "0")).filter((p) => p > 0),
  );

  const result = new Map<number, SellerStats>();

  for (const row of quoteStats) {
    const totalQuotes = row.totalQuotes ?? 0;
    const wins = row.wins ?? 0;
    const winRate = totalQuotes > 0 ? wins / totalQuotes : 0;
    const avgResponseHours =
      row.avgResponseHours != null ? Math.round(Number(row.avgResponseHours) * 10) / 10 : null;
    const avgPrice = row.avgPrice != null ? Number(row.avgPrice) : null;

    // Pricing accuracy: 1 - |sellerAvgPrice - marketMedian| / marketMedian, clamped 0-1
    let pricingAccuracy: number | null = null;
    if (avgPrice != null && marketMedian != null && marketMedian > 0) {
      const deviation = Math.abs(avgPrice - marketMedian) / marketMedian;
      pricingAccuracy = Math.max(0, Math.round((1 - Math.min(deviation, 1)) * 100) / 100);
    }

    result.set(row.sellerId, {
      totalResponses: row.totalResponses ?? 0,
      totalQuotes,
      wins,
      winRate: Math.round(winRate * 1000) / 1000,
      avgResponseTimeHours: avgResponseHours,
      avgQuotedPrice: avgPrice,
      pricingAccuracy,
    });
  }

  // Sellers with no responses get zero stats
  for (const id of sellerIds) {
    if (!result.has(id)) {
      result.set(id, {
        totalResponses: 0,
        totalQuotes: 0,
        wins: 0,
        winRate: 0,
        avgResponseTimeHours: null,
        avgQuotedPrice: null,
        pricingAccuracy: null,
      });
    }
  }

  return result;
}

// ─── Price estimation ─────────────────────────────────────────────────────────

/**
 * Estimates market price range for a part based on historical quote data.
 * Applies urgency and condition multipliers to the base price.
 */
export async function estimateMarketPrice(
  partNumber: string,
  urgency: string,
  condition: string | null,
): Promise<PriceEstimate> {
  // Exact match first, then fuzzy match on part number
  const historicalQuotes = await db
    .select({
      price: rfqResponsesTable.price,
      leadTimeDays: rfqResponsesTable.leadTimeDays,
    })
    .from(rfqResponsesTable)
    .innerJoin(rfqsTable, eq(rfqResponsesTable.rfqId, rfqsTable.id))
    .where(
      and(
        eq(rfqResponsesTable.isQuote, true),
        isNotNull(rfqResponsesTable.price),
        or(
          eq(rfqsTable.partNumber, partNumber),
          like(rfqsTable.partNumber, `%${partNumber}%`),
          like(rfqsTable.partNumber, partNumber.substring(0, Math.max(4, partNumber.length - 2)) + "%"),
        ),
      ),
    )
    .limit(200);

  const prices = historicalQuotes
    .map((q) => parseFloat(q.price ?? "0"))
    .filter((p) => p > 0);

  const dataPoints = prices.length;

  const urgencyMult = URGENCY_PRICE_MULTIPLIER[urgency] ?? 1.0;
  const conditionMult = condition ? (CONDITION_PRICE_MULTIPLIER[condition] ?? 1.0) : 1.0;
  const totalMult = urgencyMult * conditionMult;
  const urgencyAdjusted = urgency !== "routine";

  if (dataPoints === 0) {
    // No historical data — return a zeroed estimate with "low" confidence
    return {
      low: 0,
      mid: 0,
      high: 0,
      currency: "USD",
      dataPoints: 0,
      confidence: "low",
      urgencyAdjusted,
    };
  }

  prices.sort((a, b) => a - b);

  const rawLow = prices[Math.floor(dataPoints * 0.1)] ?? prices[0];
  const rawMid = computeMedian(prices) ?? prices[0];
  const rawHigh = prices[Math.ceil(dataPoints * 0.9) - 1] ?? prices[dataPoints - 1];

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    low: round2(rawLow * totalMult),
    mid: round2(rawMid * totalMult),
    high: round2(rawHigh * totalMult),
    currency: "USD",
    dataPoints,
    confidence: dataPoints >= 10 ? "high" : dataPoints >= 3 ? "medium" : "low",
    urgencyAdjusted,
  };
}

// ─── Enhanced seller scoring ──────────────────────────────────────────────────

/**
 * Computes the enhanced composite match score for one seller.
 *
 * Factor breakdown (max 100 pts):
 *   Trust score       0–50 pts
 *   Subscription tier 0–25 pts
 *   Win rate          0–10 pts
 *   Response speed     0–8 pts  (faster = higher)
 *   Pricing accuracy   0–7 pts
 */
export function scoreSellerFull(
  seller: {
    id: number;
    companyName: string;
    trustScore: number;
    trustBadge: string;
    plan: string;
    responseCount: number;
  },
  stats: SellerStats,
  urgency: string,
): ScoredSeller {
  // Trust score: 0–50
  const trustContrib = (Math.min(100, Math.max(0, seller.trustScore)) / 100) * 50;

  // Tier: 0–25
  const tierContrib = TIER_SCORE[seller.plan] ?? 0;

  // Win rate: 0–10
  const winContrib = stats.winRate * 10;

  // Response speed: 0–8 (diminishing returns on very fast responses)
  let speedContrib = 0;
  if (stats.avgResponseTimeHours != null) {
    const h = stats.avgResponseTimeHours;
    if (h <= 1) speedContrib = 8;
    else if (h <= 4) speedContrib = 6.5;
    else if (h <= 12) speedContrib = 5;
    else if (h <= 24) speedContrib = 3;
    else if (h <= 48) speedContrib = 1.5;
    else speedContrib = 0;
  }

  // Pricing accuracy: 0–7
  const priceContrib = stats.pricingAccuracy != null ? stats.pricingAccuracy * 7 : 0;

  // Urgency alignment bonus: AOG rfqs favour aviation-verified+ sellers
  const alignmentMax = URGENCY_ALIGNMENT_MAX[urgency] ?? 3;
  const isHighVerification =
    seller.trustBadge === "aviation_verified" || seller.trustBadge === "trusted_partner";
  const alignmentBonus = isHighVerification ? alignmentMax : alignmentMax * 0.25;

  const raw = trustContrib + tierContrib + winContrib + speedContrib + priceContrib + alignmentBonus;

  return {
    sellerId: seller.id,
    companyName: seller.companyName,
    trustScore: seller.trustScore,
    trustBadge: seller.trustBadge,
    plan: seller.plan,
    matchScore: Math.round(Math.min(100, raw) * 10) / 10,
    responseCount: seller.responseCount,
    totalQuotes: stats.totalQuotes,
    winRate: stats.winRate,
    avgResponseTimeHours: stats.avgResponseTimeHours,
    pricingAccuracy: stats.pricingAccuracy,
  };
}

// ─── Auto-quote suggestion ────────────────────────────────────────────────────

/**
 * Derives a suggested price, lead time, and top seller recommendation.
 * Returns null if there is insufficient data to make a confident suggestion.
 */
export function buildAutoQuoteSuggestion(
  priceEstimate: PriceEstimate,
  rankedSellers: ScoredSeller[],
  urgency: string,
  condition: string | null,
): AutoQuoteSuggestion | null {
  const topSeller = rankedSellers[0] ?? null;

  // Need at least low-confidence price data to make a suggestion
  if (priceEstimate.mid === 0) {
    if (!topSeller) return null;
    // No price data — suggest default lead time only
    const leadTime = DEFAULT_LEAD_TIME_DAYS[urgency] ?? 14;
    return {
      suggestedPrice: 0,
      suggestedLeadTimeDays: leadTime,
      topSeller,
      rationale: `No historical price data found for this part number. Lead time is estimated from urgency level (${urgency}). Contact ${topSeller.companyName} directly for pricing.`,
    };
  }

  const suggestedPrice = priceEstimate.mid;
  const leadTime = DEFAULT_LEAD_TIME_DAYS[urgency] ?? 14;

  const conditionNote = condition && condition !== "new"
    ? ` Condition '${condition}' applied a price adjustment.`
    : "";

  const confidenceNote =
    priceEstimate.confidence === "high"
      ? `based on ${priceEstimate.dataPoints} historical quotes (high confidence)`
      : priceEstimate.confidence === "medium"
        ? `based on ${priceEstimate.dataPoints} historical quotes (medium confidence)`
        : `based on limited data (${priceEstimate.dataPoints} quotes — low confidence)`;

  const urgencyNote = priceEstimate.urgencyAdjusted
    ? ` A ${urgency.replace("_", " ")} urgency premium has been applied.`
    : "";

  const rationale =
    `Suggested price of $${suggestedPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ` +
    `is derived from the market median price ${confidenceNote}.${urgencyNote}${conditionNote} ` +
    `Lead time of ${leadTime} days reflects standard ${urgency.replace("_", " ")} urgency timelines.` +
    (topSeller ? ` Top-ranked seller: ${topSeller.companyName} (match score: ${topSeller.matchScore}/100).` : "");

  return {
    suggestedPrice,
    suggestedLeadTimeDays: leadTime,
    topSeller,
    rationale,
  };
}

// ─── Fetch all active sellers ─────────────────────────────────────────────────

/**
 * Fetches all active sellers from the users table with their response counts.
 * Used by the recommendations engine.
 */
export async function fetchActiveSellers() {
  return db
    .select({
      id: usersTable.id,
      companyName: usersTable.companyName,
      trustScore: usersTable.trustScore,
      trustBadge: usersTable.trustBadge,
      plan: usersTable.plan,
      responseCount: sql<number>`cast(count(${rfqResponsesTable.id}) as int)`,
    })
    .from(usersTable)
    .leftJoin(rfqResponsesTable, eq(rfqResponsesTable.sellerId, usersTable.id))
    .where(
      and(
        eq(usersTable.status, "active"),
        eq(usersTable.role, "seller"),
      ),
    )
    .groupBy(usersTable.id)
    .limit(300);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeMedian(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
