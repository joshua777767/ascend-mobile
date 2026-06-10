import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getUserId } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * RevenueCat webhook handler.
 * RevenueCat sends events here when subscription status changes.
 * We update the user's isFreePro flag to match the entitlement state.
 */
router.post("/revenuecat/webhook", async (req, res): Promise<void> => {
  const event = req.body;
  const eventType = event?.event?.type;
  const appUserId = event?.event?.app_user_id;

  logger.info({ eventType, appUserId }, "RevenueCat webhook received");

  if (!appUserId) {
    res.status(400).json({ error: "Missing app_user_id" });
    return;
  }

  const userId = parseInt(appUserId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid app_user_id" });
    return;
  }

  const activeEntitlements = event?.event?.entitlements ?? {};
  const hasPro = activeEntitlements["pro"] !== undefined;

  try {
    await db
      .update(usersTable)
      .set({
        freePro: hasPro,
        freeProExpiresAt: hasPro
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null,
      })
      .where(eq(usersTable.id, userId));

    logger.info({ userId, hasPro }, "Updated user subscription status from RevenueCat");
    res.status(200).json({ updated: true, hasPro });
  } catch (err) {
    logger.error({ err, userId }, "Failed to update user from RevenueCat webhook");
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

/**
 * Get current user's subscription status from backend DB.
 * The client checks this on web; native iOS checks RevenueCat directly.
 */
router.get("/revenuecat/status", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    isPro: user.freePro,
    freePro: user.freePro,
    expiresAt: user.freeProExpiresAt,
  });
});

export default router;
