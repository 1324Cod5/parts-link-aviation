import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runFraudScan, computeSellerRiskProfile, AUTO_SUSPEND_THRESHOLD } from "../lib/fraudDetection";
import { predictRfqWinners } from "../lib/rfqPrediction";
import { generateDemandReport } from "../lib/demandIntelligence";

const router: IRouter = Router();

// ─── Admin auth guard ─────────────────────────────────────────────────────────

function requireAdmin(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  db.select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then(([user]) => {
      if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      next();
    })
    .catch(() => res.status(500).json({ error: "Internal server error" }));
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/fraud
 * Full fraud scan of all active sellers.
 */
router.get("/admin/intelligence/fraud", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await runFraudScan();
    res.json(result);
  } catch (err) {
    req.log?.error(err, "fraud scan failed");
    res.status(500).json({ error: "Fraud scan failed" });
  }
});

/**
 * GET /api/admin/intelligence/fraud/:sellerId
 * Risk profile for a single seller.
 */
router.get("/admin/intelligence/fraud/:sellerId", requireAdmin, async (req, res): Promise<void> => {
  const sellerId = parseInt(req.params.sellerId, 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }
  try {
    const profile = await computeSellerRiskProfile(sellerId);
    if (!profile) { res.status(404).json({ error: "Seller not found" }); return; }
    res.json(profile);
  } catch (err) {
    req.log?.error(err, "seller risk profile failed");
    res.status(500).json({ error: "Failed to compute risk profile" });
  }
});

/**
 * POST /api/admin/intelligence/fraud/:sellerId/suspend
 * Manually suspend a seller via the intelligence panel.
 */
router.post("/admin/intelligence/fraud/:sellerId/suspend", requireAdmin, async (req, res): Promise<void> => {
  const sellerId = parseInt(req.params.sellerId, 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }
  try {
    await db
      .update(usersTable)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(usersTable.id, sellerId));
    res.json({ success: true, sellerId, action: "suspended" });
  } catch (err) {
    req.log?.error(err, "intelligence suspend failed");
    res.status(500).json({ error: "Failed to suspend seller" });
  }
});

/**
 * POST /api/admin/intelligence/fraud/auto-suspend
 * Auto-suspend all sellers at or above the critical risk threshold.
 */
router.post("/admin/intelligence/fraud/auto-suspend", requireAdmin, async (req, res): Promise<void> => {
  try {
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

    res.json({ success: true, suspendedCount: suspended.length, suspendedIds: suspended });
  } catch (err) {
    req.log?.error(err, "auto-suspend failed");
    res.status(500).json({ error: "Auto-suspend failed" });
  }
});

// ─── RFQ Prediction ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/rfqs/:rfqId/predictions
 * Predicted winner ranking for a specific RFQ.
 */
router.get("/admin/intelligence/rfqs/:rfqId/predictions", requireAdmin, async (req, res): Promise<void> => {
  const rfqId = parseInt(req.params.rfqId, 10);
  if (isNaN(rfqId)) { res.status(400).json({ error: "Invalid RFQ ID" }); return; }
  try {
    const result = await predictRfqWinners(rfqId);
    if (!result) { res.status(404).json({ error: "RFQ not found" }); return; }
    res.json(result);
  } catch (err) {
    req.log?.error(err, "rfq prediction failed");
    res.status(500).json({ error: "Prediction failed" });
  }
});

// ─── Demand Intelligence ──────────────────────────────────────────────────────

/**
 * GET /api/admin/intelligence/demand
 * Full demand intelligence report.
 * Query param: ?window=30 (days, default 30)
 */
router.get("/admin/intelligence/demand", requireAdmin, async (req, res): Promise<void> => {
  const rawWindow = req.query.window;
  const windowDays = rawWindow ? Math.min(90, Math.max(7, parseInt(String(rawWindow), 10))) : 30;
  try {
    const report = await generateDemandReport(windowDays);
    res.json(report);
  } catch (err) {
    req.log?.error(err, "demand report failed");
    res.status(500).json({ error: "Demand report failed" });
  }
});

export default router;
