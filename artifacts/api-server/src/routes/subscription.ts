import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { listingsTable } from "@workspace/db";
import { UpgradePlanBody } from "@workspace/api-zod";

const router: IRouter = Router();

const PLAN_LIMITS: Record<string, number | null> = {
  free: 5,
  pro: 50,
  enterprise: null,
};

async function getSubscriptionInfo(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const [activeRow] = await db
    .select({ count: count() })
    .from(listingsTable)
    .where(eq(listingsTable.sellerId, userId));

  const activeListings = Number(activeRow.count);
  const limit = PLAN_LIMITS[user.plan];
  const canAddListing = limit === null || activeListings < limit;

  return {
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    activeListings,
    listingLimit: limit,
    canAddListing,
  };
}

router.get("/subscription", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const info = await getSubscriptionInfo(userId);
  if (!info) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(info);
});

router.post("/subscription/upgrade", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = UpgradePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { plan } = parsed.data;

  // Calculate expiry: 30 days from now
  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.update(usersTable)
    .set({ plan: plan as any, planExpiresAt, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const info = await getSubscriptionInfo(userId);
  res.json(info);
});

router.post("/subscription/downgrade", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  await db.update(usersTable)
    .set({ plan: "free", planExpiresAt: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const info = await getSubscriptionInfo(userId);
  res.json(info);
});

export { PLAN_LIMITS };
export default router;
