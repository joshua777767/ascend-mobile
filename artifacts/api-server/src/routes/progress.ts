import { Router, type IRouter } from "express";
import { eq, desc, gte } from "drizzle-orm";
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
  let updatedGoalReachedAt = goalReachedAt;
  if (goalReached && !goalReachedAt && profile) {
    const now = new Date();
    await db.update(userProfilesTable)
      .set({ goalReachedAt: now })
      .where(eq(userProfilesTable.userId, getUserId(req)));
    updatedGoalReachedAt = now;
  }

  // Calculate streak from journals
  const journals = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, getUserId(req)))
    .orderBy(desc(journalEntriesTable.date));
  let currentStreak = 0;
  let prevDate: Date | null = null;
  for (const entry of journals) {
    const entryDate = new Date(entry.date);
    if (prevDate === null) {
      currentStreak = 1;
    } else {
      const diff = (prevDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
    prevDate = entryDate;
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
    goalReachedAt: goalReached ? (updatedGoalReachedAt ?? new Date().toISOString()) : null,
    lbsToGo: Math.round(lbsToGo * 10) / 10,
    dayStreak: currentStreak,
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

// ── Weekly Recap ─────────────────────────────────────────────────────────────
router.get("/progress/weekly-recap", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().slice(0, 10);
  const weekEnd = now.toISOString().slice(0, 10);

  const [meals, journals, reviews, weighIns, profile] = await Promise.all([
    db.select().from(mealsTable).where(eq(mealsTable.userId, userId)),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
    db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, userId)),
    db.select().from(weighInsTable).where(eq(weighInsTable.userId, userId)).orderBy(weighInsTable.loggedAt),
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)),
  ]);

  const weekMeals = meals.filter(m => m.loggedAt && m.loggedAt >= weekAgo);
  const weekJournals = journals.filter(j => j.date >= weekStart);
  const weekReviews = reviews.filter(r => r.date >= weekStart);

  const avgDailyScore = weekReviews.length > 0
    ? Math.round(weekReviews.reduce((s, r) => s + r.dailyScore, 0) / weekReviews.length)
    : 0;

  const bestReview = weekReviews.sort((a, b) => b.dailyScore - a.dailyScore)[0];
  const bestDay = bestReview
    ? new Date(bestReview.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })
    : null;

  // Weight change over the week
  const recentWeighIns = weighIns.filter(w => new Date(w.loggedAt) >= weekAgo);
  let lbsChange: number | null = null;
  if (recentWeighIns.length >= 2) {
    const diff = recentWeighIns[recentWeighIns.length - 1].weightKg - recentWeighIns[0].weightKg;
    lbsChange = Math.round(diff * 2.2046 * 10) / 10;
  } else if (weighIns.length >= 2) {
    const last = weighIns[weighIns.length - 1].weightKg;
    const prev = weighIns[weighIns.length - 2].weightKg;
    lbsChange = Math.round((last - prev) * 2.2046 * 10) / 10;
  }

  // Top win from best journal
  const bestJournal = weekJournals.sort((a, b) => (b.date > a.date ? 1 : -1))[0];
  const topWin = bestJournal?.biggestWin ?? null;

  // Headline
  const streak = profile[0]?.currentStreak ?? 0;
  let headline = "";
  if (avgDailyScore >= 80) headline = "Dominant week. Keep that standard.";
  else if (avgDailyScore >= 65) headline = "Solid week — momentum is building.";
  else if (weekMeals.length >= 10) headline = "You showed up. Build on it.";
  else if (streak >= 7) headline = `${streak}-day streak intact. Don't break it now.`;
  else headline = "Every week is a new shot. Make this one count.";

  res.json({
    weekStart,
    weekEnd,
    mealsLogged: weekMeals.length,
    journalDays: weekJournals.length,
    avgDailyScore,
    bestDay,
    streakDays: streak,
    lbsChange,
    topWin,
    headline,
  });
});

// ── Milestones ────────────────────────────────────────────────────────────────
router.get("/progress/milestones", async (req, res): Promise<void> => {
  const userId = getUserId(req);

  const [profile, meals, workouts, weighIns, journals] = await Promise.all([
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)),
    db.select().from(mealsTable).where(eq(mealsTable.userId, userId)),
    db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId)),
    db.select().from(weighInsTable).where(eq(weighInsTable.userId, userId)).orderBy(weighInsTable.loggedAt),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
  ]);

  const p = profile[0];
  const streak = p?.currentStreak ?? 0;
  const longestStreak = p?.currentStreak ?? 0; // use current; /progress/streak has full calc
  const totalMeals = meals.length;
  const totalWorkouts = workouts.length;

  // Weight lost
  const startKg = weighIns.length > 0 ? weighIns[0].weightKg : (p?.currentWeightKg ?? 0);
  const currentKg = weighIns.length > 0 ? weighIns[weighIns.length - 1].weightKg : (p?.currentWeightKg ?? 0);
  const goalKg = p?.goalWeightKg ?? currentKg;
  const isLosing = goalKg < startKg;
  const lbsLost = isLosing ? Math.max(0, (startKg - currentKg) * 2.2046) : 0;
  const lbsGained = !isLosing && goalKg > startKg ? Math.max(0, (currentKg - startKg) * 2.2046) : 0;

  type MilestoneCategory = "weight" | "streak" | "meals" | "consistency";
  type MS = { id: string; label: string; description: string; unlockedAt: string | null; category: MilestoneCategory };
  const milestones: MS[] = [];

  const unlock = (date: Date | null) => date ? date.toISOString() : null;
  const firstMeal = meals.length > 0 ? new Date(meals[0].loggedAt ?? Date.now()) : null;
  const firstJournal = journals.length > 0 ? new Date(journals[0].date + "T00:00:00") : null;
  const firstWorkout = workouts.length > 0 ? new Date(workouts[0].completedAt ?? Date.now()) : null;

  // Streak milestones
  for (const days of [3, 7, 14, 30, 60, 100]) {
    milestones.push({
      id: `streak_${days}`,
      label: `${days}-Day Streak`,
      description: `Log your mission for ${days} days in a row`,
      unlockedAt: streak >= days ? unlock(firstJournal) : null,
      category: "streak",
    });
  }

  // Weight milestones
  if (isLosing) {
    for (const lbs of [1, 5, 10, 15, 20, 25, 30]) {
      milestones.push({
        id: `lost_${lbs}lbs`,
        label: `Lost ${lbs} lb${lbs > 1 ? "s" : ""}`,
        description: `Drop ${lbs} lb${lbs > 1 ? "s" : ""} from your starting weight`,
        unlockedAt: lbsLost >= lbs ? unlock(weighIns.length > 0 ? new Date(weighIns[weighIns.length - 1].loggedAt) : null) : null,
        category: "weight",
      });
    }
  } else if (goalKg > startKg) {
    for (const lbs of [1, 5, 10, 15, 20]) {
      milestones.push({
        id: `gained_${lbs}lbs`,
        label: `Gained ${lbs} lb${lbs > 1 ? "s" : ""}`,
        description: `Add ${lbs} lb${lbs > 1 ? "s" : ""} from your starting weight`,
        unlockedAt: lbsGained >= lbs ? unlock(weighIns.length > 0 ? new Date(weighIns[weighIns.length - 1].loggedAt) : null) : null,
        category: "weight",
      });
    }
  }

  // Meal milestones
  for (const count of [1, 10, 25, 50, 100, 200]) {
    milestones.push({
      id: `meals_${count}`,
      label: `${count} Meal${count > 1 ? "s" : ""} Logged`,
      description: `Log ${count} meal${count > 1 ? "s" : ""} with the coach`,
      unlockedAt: totalMeals >= count ? unlock(firstMeal) : null,
      category: "meals",
    });
  }

  // Consistency milestones
  for (const count of [1, 7, 14, 30]) {
    milestones.push({
      id: `journal_${count}`,
      label: `${count} Journal${count > 1 ? "s" : ""}`,
      description: `Complete ${count} nightly journal${count > 1 ? "s" : ""}`,
      unlockedAt: journals.length >= count ? unlock(firstJournal) : null,
      category: "consistency",
    });
  }
  for (const count of [1, 5, 10, 25]) {
    milestones.push({
      id: `workouts_${count}`,
      label: `${count} Workout${count > 1 ? "s" : ""}`,
      description: `Log ${count} workout${count > 1 ? "s" : ""}`,
      unlockedAt: totalWorkouts >= count ? unlock(firstWorkout) : null,
      category: "consistency",
    });
  }

  res.json({ milestones });
});

export default router;
