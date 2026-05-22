import { db, usersTable, listingsTable } from "@workspace/db";
import { eq, and, sql, count, ne } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFlag {
  type: "duplicate_listings" | "abnormal_pricing" | "missing_certs" | "dispute_history" | "velocity_risk";
  severity: "low" | "medium" | "high";
  detail: string;
  score: number;
}

export interface SellerRiskProfile {
  sellerId: number;
  email: string;
  companyName: string;
  status: string;
  plan: string;
  trustScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  flags: RiskFlag[];
  activeListings: number;
  removedListings: number;
  duplicateGroups: number;
  abnormalPricingCount: number;
  missingCertCount: number;
  createdAt: string;
}

export interface FraudScanResult {
  scannedAt: string;
  totalSellers: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  autoSuspended: number;
  sellers: SellerRiskProfile[];
}

// ─── Risk score components (0–100 total) ─────────────────────────────────────
// duplicate_listings:  0–30
// abnormal_pricing:    0–25
// missing_certs:       0–20
// dispute_history:     0–15
// velocity_risk:       0–10

function riskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function computeMedian(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── Per-seller scan ──────────────────────────────────────────────────────────

export async function computeSellerRiskProfile(sellerId: number): Promise<SellerRiskProfile | null> {
  const [seller] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      companyName: usersTable.companyName,
      status: usersTable.status,
      plan: usersTable.plan,
      trustScore: usersTable.trustScore,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, sellerId));

  if (!seller) return null;

  const allListings = await db
    .select({
      id: listingsTable.id,
      partNumber: listingsTable.partNumber,
      price: listingsTable.price,
      badge: listingsTable.badge,
      status: listingsTable.status,
      certificationDocs: listingsTable.certificationDocs,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, sellerId));

  const activeListings = allListings.filter(l => l.status === "active");
  const removedListings = allListings.filter(l => l.status === "removed" || l.status === "deleted");

  const flags: RiskFlag[] = [];
  let riskScore = 0;

  // ── 1. Duplicate listings (0–30) ─────────────────────────────────────────
  const partNumberGroups = new Map<string, number>();
  for (const l of activeListings) {
    const pn = l.partNumber.trim().toUpperCase();
    partNumberGroups.set(pn, (partNumberGroups.get(pn) ?? 0) + 1);
  }
  const duplicateGroups = [...partNumberGroups.values()].filter(n => n > 1).length;
  const duplicateScore = Math.min(30, duplicateGroups * 10);
  riskScore += duplicateScore;
  if (duplicateGroups > 0) {
    const severity = duplicateGroups >= 3 ? "high" : duplicateGroups >= 2 ? "medium" : "low";
    flags.push({
      type: "duplicate_listings",
      severity,
      detail: `${duplicateGroups} part number group${duplicateGroups > 1 ? "s" : ""} with duplicate active listings`,
      score: duplicateScore,
    });
  }

  // ── 2. Abnormal pricing (0–25) ─────────────────────────────────────────────
  // Compare each listing's price to the marketplace median for that part number
  let abnormalPricingCount = 0;
  const pricedListings = activeListings.filter(l => l.price != null);

  for (const listing of pricedListings) {
    const pn = listing.partNumber.trim().toUpperCase();
    // Get other sellers' prices for same part number
    const marketRows = await db
      .select({ price: listingsTable.price })
      .from(listingsTable)
      .where(
        and(
          eq(listingsTable.status, "active"),
          sql`upper(trim(${listingsTable.partNumber})) = ${pn}`,
          ne(listingsTable.sellerId, sellerId),
        ),
      );

    const marketPrices = marketRows
      .map(r => parseFloat(r.price ?? "0"))
      .filter(p => p > 0);

    if (marketPrices.length >= 2) {
      const median = computeMedian(marketPrices)!;
      const listingPrice = parseFloat(listing.price ?? "0");
      if (median > 0) {
        const ratio = listingPrice / median;
        if (ratio > 5 || ratio < 0.15) {
          abnormalPricingCount++;
        }
      }
    }
  }
  const abnormalPricingScore = Math.min(25, abnormalPricingCount * 12);
  riskScore += abnormalPricingScore;
  if (abnormalPricingCount > 0) {
    flags.push({
      type: "abnormal_pricing",
      severity: abnormalPricingCount >= 2 ? "high" : "medium",
      detail: `${abnormalPricingCount} listing${abnormalPricingCount > 1 ? "s" : ""} priced >5x or <15% of market median`,
      score: abnormalPricingScore,
    });
  }

  // ── 3. Missing certifications (0–20) ──────────────────────────────────────
  const missingCertListings = activeListings.filter(
    l => (!l.certificationDocs || l.certificationDocs.length === 0) && l.badge === "pending_verification",
  );
  const missingCertCount = missingCertListings.length;
  const missingRatio = activeListings.length > 0 ? missingCertCount / activeListings.length : 0;
  const missingCertScore = Math.round(Math.min(20, missingRatio * 20));
  riskScore += missingCertScore;
  if (missingCertCount > 0 && missingRatio > 0.3) {
    flags.push({
      type: "missing_certs",
      severity: missingRatio >= 0.8 ? "high" : missingRatio >= 0.5 ? "medium" : "low",
      detail: `${missingCertCount} active listing${missingCertCount > 1 ? "s" : ""} (${Math.round(missingRatio * 100)}%) have no certification documents`,
      score: missingCertScore,
    });
  }

  // ── 4. Dispute history / removed listings (0–15) ──────────────────────────
  const removedCount = removedListings.length;
  const disputeScore = Math.min(15, removedCount * 5);
  riskScore += disputeScore;
  if (removedCount > 0) {
    flags.push({
      type: "dispute_history",
      severity: removedCount >= 3 ? "high" : removedCount >= 2 ? "medium" : "low",
      detail: `${removedCount} listing${removedCount > 1 ? "s" : ""} removed or deleted (admin action or seller dispute)`,
      score: disputeScore,
    });
  }

  // ── 5. Velocity risk (0–10) — new seller with high listing volume ──────────
  const ageDays = (Date.now() - new Date(seller.createdAt).getTime()) / 86400000;
  const isNewSeller = ageDays < 30;
  const velocityScore = isNewSeller && activeListings.length > 5 ? 10 : isNewSeller && activeListings.length > 2 ? 5 : 0;
  riskScore += velocityScore;
  if (velocityScore > 0) {
    flags.push({
      type: "velocity_risk",
      severity: velocityScore >= 10 ? "high" : "medium",
      detail: `New seller (${Math.round(ageDays)}d old) with ${activeListings.length} active listings`,
      score: velocityScore,
    });
  }

  const finalScore = Math.min(100, riskScore);

  return {
    sellerId: seller.id,
    email: seller.email,
    companyName: seller.companyName,
    status: seller.status,
    plan: seller.plan,
    trustScore: seller.trustScore,
    riskScore: finalScore,
    riskLevel: riskLevel(finalScore),
    flags,
    activeListings: activeListings.length,
    removedListings: removedCount,
    duplicateGroups,
    abnormalPricingCount,
    missingCertCount,
    createdAt: seller.createdAt.toISOString(),
  };
}

// ─── Full platform scan ───────────────────────────────────────────────────────

export async function runFraudScan(): Promise<FraudScanResult> {
  const sellers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.role} IN ('seller') AND ${usersTable.status} != 'suspended'`);

  const profiles: SellerRiskProfile[] = [];
  for (const { id } of sellers) {
    const profile = await computeSellerRiskProfile(id);
    if (profile) profiles.push(profile);
  }

  profiles.sort((a, b) => b.riskScore - a.riskScore);

  const criticalCount = profiles.filter(p => p.riskLevel === "critical").length;
  const highCount = profiles.filter(p => p.riskLevel === "high").length;
  const mediumCount = profiles.filter(p => p.riskLevel === "medium").length;
  const lowCount = profiles.filter(p => p.riskLevel === "low").length;

  return {
    scannedAt: new Date().toISOString(),
    totalSellers: profiles.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    autoSuspended: 0,
    sellers: profiles,
  };
}

// ─── Auto-suspend high-risk sellers ──────────────────────────────────────────

export const AUTO_SUSPEND_THRESHOLD = 80;

export async function autoSuspendHighRiskSellers(): Promise<number[]> {
  const scan = await runFraudScan();
  const toSuspend = scan.sellers.filter(s => s.riskScore >= AUTO_SUSPEND_THRESHOLD);
  const suspended: number[] = [];

  for (const seller of toSuspend) {
    await db
      .update(usersTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(usersTable.id, seller.sellerId));
    suspended.push(seller.sellerId);
  }

  return suspended;
}
