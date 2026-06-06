import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, userProfilesTable, plansTable, workoutsTable, weighInsTable, mealsTable, coachReviewsTable, journalEntriesTable } from "@workspace/db";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/progress/summary", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));
  const weighIns = await db.select().from(weighInsTable).where(eq(weighInsTable.userId, getUserId(req))).orderBy(weighInsTable.loggedAt);
  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, getUserId(req)));
  const reviews = await db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, getUserId(req)));
  const meals = await db.select().from(mealsTable).where(eq(mealsTable.userId, getUserId(req))).orderBy(desc(mealsTable.loggedAt));

  // Latest single weigh-in used for display + progress calculation
  const currentWeightKg = weighIns.length > 0
    ? weighIns[weighIns.length - 1].weightKg
    : profile?.currentWeightKg ?? 0;

  const startWeightKg = weighIns.length > 0
    ? weighIns[0].weightKg
    : profile?.currentWeightKg ?? 0;

  const goalWeightKg = profile?.goalWeightKg ?? currentWeightKg;

  const totalChange = Math.abs(startWeightKg - goalWeightKg);
  const currentChange = Math.abs(startWeightKg - currentWeightKg);
  const progressPercent = totalChange > 0 ? Math.min(100, (currentChange / totalChange) * 100) : 0;

  // Goal reached detection: use 7-day average to avoid single-day fluctuations
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentWeighIns = weighIns.filter(w => new Date(w.loggedAt) >= sevenDaysAgo);
  const avg7DayWeightKg = recentWeighIns.length > 0
    ? recentWeighIns.reduce((s, w) => s + w.weightKg, 0) / recentWeighIns.length
    : currentWeightKg;

  const isLosing = goalWeightKg < startWeightKg;
  const isGaining = goalWeightKg > startWeightKg;
  const withinThreshold = Math.abs(avg7DayWeightKg - goalWeightKg) <= 0.5;
  const goalReached = (isLosing || isGaining) ? withinThreshold : false;
  const goalReachedAt = profile?.goalReachedAt ?? null;

  // If goal just reached now, record it
  if (goalReached && !goalReachedAt && profile) {
    await db.update(userProfilesTable)
      .set({ goalReachedAt: new Date() })
      .where(eq(userProfilesTable.userId, getUserId(req)));
  }

  const avgScore = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.dailyScore, 0) / reviews.length
    : 0;

  const lbsToGo = Math.abs(currentWeightKg - goalWeightKg) * 2.2046226;

  res.json({
    currentWeightKg,
    goalWeightKg,
    startWeightKg,
    progressPercent: Math.round(progressPercent * 10) / 10,
    goalReached,
    goalReachedAt: goalReached ? (goalReachedAt ?? new Date().toISOString()) : null,
    lbsToGo: Math.round(lbsToGo * 10) / 10,
    dayStreak: 0,
    totalWorkouts: workouts.length,
    avgDailyScore: Math.round(avgScore * 10) / 10,
    weeklyWeighIns: weighIns.slice(-8),
    recentMeals: meals.slice(0, 5),
  });
});

router.get("/progress/streak", async (req, res): Promise<void> => {
  const journals = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, getUserId(req)))
    .orderBy(desc(journalEntriesTable.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let prevDate: Date | null = null;

  for (const entry of journals) {
    const entryDate = new Date(entry.date);
    if (prevDate === null) {
      streak = 1;
    } else {
      const diff = (prevDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    prevDate = entryDate;
    if (streak > longestStreak) longestStreak = streak;
  }
  currentStreak = streak;

  // Recalculate longest
  let tempStreak = 0;
  let tempPrev: Date | null = null;
  for (const entry of journals) {
    const entryDate = new Date(entry.date);
    if (tempPrev === null) {
      tempStreak = 1;
    } else {
      const diff = (tempPrev.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 1;
      }
    }
    tempPrev = entryDate;
  }
  if (tempStreak > longestStreak) longestStreak = tempStreak;

  res.json({
    currentStreak,
    longestStreak,
    lastActiveDate: journals.length > 0 ? journals[0].date : new Date().toISOString().split("T")[0],
  });
});

export default router;
