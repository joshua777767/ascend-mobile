import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, waterLogsTable, plansTable } from "@workspace/db";
import { LogWaterBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getWaterSummary(userId: number): Promise<{ totalOz: number; targetOz: number; date: string }> {
  const date = todayString();
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));
  const targetOz = plan ? Math.round(plan.waterTargetL * 33.814) : 64;

  const rows = await db
    .select({ amountOz: waterLogsTable.amountOz })
    .from(waterLogsTable)
    .where(and(eq(waterLogsTable.userId, userId), eq(waterLogsTable.date, date)));

  const totalOz = rows.reduce((s, r) => s + r.amountOz, 0);
  return { totalOz, targetOz, date };
}

router.get("/water/today", async (req, res): Promise<void> => {
  try {
    const summary = await getWaterSummary(getUserId(req));
    res.json(summary);
  } catch (err) {
    logger.error({ err }, "Failed to get water summary");
    res.status(500).json({ error: "Failed to get water data." });
  }
});

router.post("/water", async (req, res): Promise<void> => {
  const parsed = LogWaterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amountOz } = parsed.data;
  if (amountOz < 1 || amountOz > 500) {
    res.status(400).json({ error: "Amount must be between 1 and 500 oz." });
    return;
  }

  try {
    const userId = getUserId(req);
    await db.insert(waterLogsTable).values({ userId, date: todayString(), amountOz });
    const summary = await getWaterSummary(userId);
    res.status(201).json(summary);
  } catch (err) {
    logger.error({ err }, "Failed to log water");
    res.status(500).json({ error: "Failed to log water." });
  }
});

export default router;
