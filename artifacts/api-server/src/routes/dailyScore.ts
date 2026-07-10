import { Router, type IRouter } from "express";
import { eq, and, gte, lt } from "drizzle-orm";
import {
  db,
  dailyScoresTable,
  mealsTable,
  waterLogsTable,
  workoutsTable,
  journalEntriesTable,
  plansTable,
  userProfilesTable,
} from "@workspace/db";
import { getUserId, getUserToday, getLocalMidnightUtc } from "../middlewares/auth";

const router: IRouter = Router();

function getTodayUtcRange(req: any): { dayStart: Date; dayEnd: Date } {
  const tz = (req.headers["x-timezone"] as string | undefined) || "UTC";
  const dateStr = getUserToday(req);
  const dayStart = getLocalMidnightUtc(dateStr, tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}

function calculateDailyScore(
  todayCalories: number,
  todayProtein: number,
  todayWaterOz: number,
  hasWorkout: boolean,
  sleptOnTime: boolean,
  plan: any
): {
  totalScore: number;
  caloriesScore: number;
  proteinScore: number;
  waterScore: number;
  workoutScore: number;
  sleepScore: number;
} {
  const calTarget = plan?.calorieTarget ?? 2000;
  const proTarget = plan?.proteinTargetG ?? 150;
  const waterTarget = plan ? Math.round(plan.waterTargetL * 33.814) : 64;

  const caloriesScore = calTarget > 0 && todayCalories > 0
    ? Math.round(Math.min(todayCalories / calTarget, 1) * 35)
    : 0;
  const proteinScore = proTarget > 0 && todayProtein > 0
    ? Math.round(Math.min(todayProtein / proTarget, 1) * 35)
    : 0;
  const waterScore = waterTarget > 0 && todayWaterOz > 0
    ? Math.round(Math.min(todayWaterOz / waterTarget, 1) * 30)
    : 0;
  const workoutScore = 0;
  const sleepScore = 0;

  return {
    totalScore: caloriesScore + proteinScore + waterScore + workoutScore + sleepScore,
    caloriesScore,
    proteinScore,
    waterScore,
    workoutScore,
    sleepScore,
  };
}

router.get("/daily-score", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = getUserToday(req);
  const { dayStart, dayEnd } = getTodayUtcRange(req);

  const [plan, profile] = await Promise.all([
    db.select().from(plansTable).where(eq(plansTable.userId, userId)).then(r => r[0]),
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).then(r => r[0]),
  ]);

  // Get today's meals
  const meals = await db.select().from(mealsTable)
    .where(
      and(
        eq(mealsTable.userId, userId),
        gte(mealsTable.loggedAt, dayStart),
        lt(mealsTable.loggedAt, dayEnd),
      ),
    );
  const todayCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const todayProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);

  // Get today's water
  const waterLogs = await db.select().from(waterLogsTable)
    .where(and(eq(waterLogsTable.userId, userId), eq(waterLogsTable.date, today)));
  const todayWaterOz = waterLogs.reduce((s, w) => s + (w.amountOz ?? 0), 0);

  // Get today's workout
  const workouts = await db.select().from(workoutsTable)
    .where(
      and(
        eq(workoutsTable.userId, userId),
        gte(workoutsTable.completedAt, dayStart),
        lt(workoutsTable.completedAt, dayEnd),
      ),
    );
  const hasWorkout = workouts.length > 0;

  // Get today's journal for sleep
  const journals = await db.select().from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, userId),
        gte(journalEntriesTable.createdAt, dayStart),
        lt(journalEntriesTable.createdAt, dayEnd),
      ),
    );
  const sleptOnTime = journals.length > 0 ? journals[0].sleptOnTime : false;

  const breakdown = calculateDailyScore(todayCalories, todayProtein, todayWaterOz, hasWorkout, sleptOnTime, plan);

  // Check if existing daily score exists
  const [existing] = await db.select().from(dailyScoresTable)
    .where(
      and(
        eq(dailyScoresTable.userId, userId),
        eq(dailyScoresTable.date, today),
      ),
    )
    .limit(1);

  let scoreRow;
  if (existing) {
    [scoreRow] = await db.update(dailyScoresTable)
      .set(breakdown)
      .where(eq(dailyScoresTable.id, existing.id))
      .returning();
  } else {
    [scoreRow] = await db.insert(dailyScoresTable)
      .values({ userId, date: today, ...breakdown })
      .returning();
  }

  res.json({
    ...scoreRow,
    todayCalories,
    todayProtein,
    todayWaterOz,
    hasWorkout,
    calorieTarget: plan?.calorieTarget ?? 0,
    proteinTarget: plan?.proteinTargetG ?? 0,
    waterTarget: plan ? Math.round(plan.waterTargetL * 33.814) : 0,
  });
});

router.get("/daily-score/history", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const scores = await db.select()
    .from(dailyScoresTable)
    .where(eq(dailyScoresTable.userId, userId))
    .orderBy(dailyScoresTable.date);
  res.json(scores);
});

export default router;
