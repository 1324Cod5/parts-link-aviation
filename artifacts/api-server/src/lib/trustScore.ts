import { db, usersTable, listingsTable, inquiriesTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

export type TrustBadge = "unverified" | "document_verified" | "aviation_verified" | "trusted_partner";

export interface TrustScoreBreakdown {
  certDocScore: number;
  certDocMax: 30;
  listingAccuracyScore: number;
  listingAccuracyMax: 20;
  transactionScore: number;
  transactionMax: 15;
  responseTimeScore: number;
  responseTimeMax: 10;
  disputePenalty: number;
  subscriptionBoost: number;
  subscriptionBoostMax: 10;
  total: number;
  badge: TrustBadge;
}

function badgeFromScore(score: number): TrustBadge {
  if (score >= 90) return "trusted_partner";
  if (score >= 70) return "aviation_verified";
  if (score >= 40) return "document_verified";
  return "unverified";
}

export async function computeTrustScore(userId: number): Promise<TrustScoreBreakdown> {
  const [user] = await db.select({
    plan: usersTable.plan,
    subscriptionStatus: usersTable.subscriptionStatus,
  }).from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    const zeroBadge: TrustBadge = "unverified";
    return {
      certDocScore: 0, certDocMax: 30,
      listingAccuracyScore: 0, listingAccuracyMax: 20,
      transactionScore: 0, transactionMax: 15,
      responseTimeScore: 0, responseTimeMax: 10,
      disputePenalty: 0, subscriptionBoost: 0, subscriptionBoostMax: 10,
      total: 0, badge: zeroBadge,
    };
  }

  // ── Cert doc score (0–30) ──────────────────────────────────────────────────
  // Max badge level across all the seller's active listings
  const activeListings = await db.select({
    badge: listingsTable.badge,
    hasDocs: sql<boolean>`cardinality(${listingsTable.certificationDocs}) > 0`,
    hasPhotos: sql<boolean>`cardinality(${listingsTable.photos}) > 0`,
    hasTrace: sql<boolean>`${listingsTable.traceHistory} IS NOT NULL`,
    hasApplicability: sql<boolean>`${listingsTable.aircraftApplicability} IS NOT NULL`,
  }).from(listingsTable).where(
    and(eq(listingsTable.sellerId, userId), eq(listingsTable.status, "active"))
  );

  let certDocScore = 0;
  const hasVerified = activeListings.some(l => l.badge === "verified");
  const hasDocReviewed = activeListings.some(l => l.badge === "documentation_reviewed");
  if (hasVerified) certDocScore = 30;
  else if (hasDocReviewed) certDocScore = 15;

  // ── Listing accuracy score (0–20) ──────────────────────────────────────────
  // Average completeness across active listings
  let listingAccuracyScore = 0;
  if (activeListings.length > 0) {
    const totalPoints = activeListings.reduce((sum, l) => {
      let pts = 0;
      if (l.hasPhotos) pts += 7;
      if (l.hasTrace) pts += 7;
      if (l.hasApplicability) pts += 6;
      return sum + pts;
    }, 0);
    listingAccuracyScore = Math.round((totalPoints / activeListings.length / 20) * 20);
  }

  // ── Transaction history score (0–15) ──────────────────────────────────────
  // Total inquiries received across all listings
  const listingIds = await db.select({ id: listingsTable.id })
    .from(listingsTable).where(eq(listingsTable.sellerId, userId));

  let totalInquiries = 0;
  if (listingIds.length > 0) {
    const ids = listingIds.map(l => l.id);
    const [row] = await db.select({ n: count() }).from(inquiriesTable)
      .where(sql`${inquiriesTable.listingId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])`);
    totalInquiries = Number(row?.n ?? 0);
  }
  let transactionScore = 0;
  if (totalInquiries >= 16) transactionScore = 15;
  else if (totalInquiries >= 6) transactionScore = 10;
  else if (totalInquiries >= 1) transactionScore = 5;

  // ── Response time score (0–10) ─────────────────────────────────────────────
  // Proxy: active listing count (engagement indicator)
  const activeCount = activeListings.length;
  let responseTimeScore = 0;
  if (activeCount >= 6) responseTimeScore = 10;
  else if (activeCount >= 3) responseTimeScore = 7;
  else if (activeCount >= 1) responseTimeScore = 3;

  // ── Dispute penalty (0 to –25) ────────────────────────────────────────────
  const [removedRow] = await db.select({ n: count() }).from(listingsTable)
    .where(and(
      eq(listingsTable.sellerId, userId),
      sql`${listingsTable.status} IN ('removed', 'deleted')`,
    ));
  const removedCount = Number(removedRow?.n ?? 0);
  const disputePenalty = Math.max(-25, removedCount * -10);

  // ── Subscription boost (0–10) ─────────────────────────────────────────────
  const isActiveSubscription = user.subscriptionStatus === "active" || user.subscriptionStatus === "trial";
  let subscriptionBoost = 0;
  if (isActiveSubscription) {
    if (user.plan === "enterprise" || user.plan === "mro_premium") subscriptionBoost = 10;
    else if (user.plan === "pro" || user.plan === "mro_verified") subscriptionBoost = 5;
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  const raw = certDocScore + listingAccuracyScore + transactionScore + responseTimeScore
    + disputePenalty + subscriptionBoost;
  const total = Math.min(100, Math.max(0, raw));
  const badge = badgeFromScore(total);

  return {
    certDocScore, certDocMax: 30,
    listingAccuracyScore, listingAccuracyMax: 20,
    transactionScore, transactionMax: 15,
    responseTimeScore, responseTimeMax: 10,
    disputePenalty, subscriptionBoost, subscriptionBoostMax: 10,
    total, badge,
  };
}

/**
 * Recomputes and persists the trust score + badge for a seller.
 * Fire-and-forget safe — errors are logged but not thrown.
 */
export async function recomputeAndSave(userId: number): Promise<void> {
  try {
    const result = await computeTrustScore(userId);
    await db.update(usersTable).set({
      trustScore: result.total,
      trustBadge: result.badge,
      trustScoreBreakdown: result as any,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[trustScore] recomputeAndSave failed for user", userId, err);
  }
}
