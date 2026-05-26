import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { waitlistEmailsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const bodySchema = z.object({
  email: z.email(),
  source: z.string().optional(),
});

router.post("/waitlist-emails", async (req, res): Promise<void> => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  const { email, source } = parsed.data;
  await db
    .insert(waitlistEmailsTable)
    .values({ email: email.trim().toLowerCase(), source: source ?? "homepage" })
    .onConflictDoNothing();
  res.json({ success: true });
});

export default router;
