import { Router, type IRouter } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  db,
  weeklyReviewsTable,
  mealsTable,
  waterLogsTable,
  workoutsTable,
  journalEntriesTable,
  weighInsTable,
  userProfilesTable,
  plansTable,
  coachReviewsTable,
} from "@workspace/db";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId, getUserToday, addDaysInUserTz, getLocalMidnightUtc } from "../middlewares/auth";

const router: IRouter = Router();

const LBS = 2.2046226;

function computeGoalDatePredictor(
  weighIns: Array<{ weightKg: number; loggedAt: Date | string }>,
  profile: any,
  plan: any
): { currentPace: number | null; estimatedGoalDate: string | null; status: string } {
  if (weighIns.length < 2 || !profile?.goalWeightKg) {
    return { currentPace: null, estimatedGoalDate: null, status: "on_track" };
  }

  const startKg = weighIns[0].weightKg;
  const currentKg = weighIns[weighIns.length - 1].weightKg;
  const goalKg = profile.goalWeightKg;

  // Weeks elapsed since first weigh-in
  const firstDate = new Date(weighIns[0].loggedAt ?? Date.now());
  const lastDate = new Date(weighIns[weighIns.length - 1].loggedAt ?? Date.now());
  const weeksElapsed = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const lbsChange = (currentKg - startKg) * LBS;
  const currentPace = lbsChange / weeksElapsed; // lbs per week

  const lbsToGo = (goalKg - currentKg) * LBS;
  const weeksToGo = currentPace !== 0 ? lbsToGo / currentPace : null;
  const estimatedGoalDate = weeksToGo !== null && weeksToGo > 0
    ? new Date(lastDate.getTime() + weeksToGo * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  const targetPace = plan?.goalType === "muscle_gain" ? 0.4 : 1.0;
  const status = currentPace === 0
    ? "on_track"
    : goalKg < startKg
      ? currentPace < -targetPace * 1.5 ? "ahead" : currentPace > targetPace ? "behind" : "on_track"
      : currentPace > targetPace * 1.5 ? "ahead" : currentPace < targetPace * 0.3 ? "behind" : "on_track";

  return { currentPace: Math.round(currentPace * 10) / 10, estimatedGoalDate, status };
}

async function generateWeeklyReview(
  weekData: any,
  profile: any,
  plan: any
): Promise<{ streakSummary: string; whatToImprove: string; goalPace: string; coachMessage: string }> {
  const prompt = `You are a strict but warm transformation coach. Weekly review:

User: ${profile?.name?.split(" ")[0] ?? "User"}
Goal: ${plan?.goalType ?? "general"}
Week weight change: ${weekData.weightChangeLbs.toFixed(1)} lbs
Calorie consistency: ${weekData.calorieConsistency}/7 days
Protein consistency: ${weekData.proteinConsistency}/7 days
Water consistency: ${weekData.waterConsistency}/7 days
Workout consistency: ${weekData.workoutConsistency}/7 days
Streak: ${weekData.currentStreak} days

Respond ONLY as valid JSON:
{
  "streakSummary": "1-2 sentences on streak momentum",
  "whatToImprove": "1 concrete thing to focus on next week",
  "goalPace": "1 sentence on whether they're on pace",
  "coachMessage": "2-3 sentences, warm but direct, celebrating wins and calling out the gap"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return {
      streakSummary: parsed.streakSummary || `${weekData.currentStreak} days strong. Keep it going.`,
      whatToImprove: parsed.whatToImprove || "Lock in your protein every day. That's the foundation.",
      goalPace: parsed.goalPace || "Stay consistent. The pace will follow.",
      coachMessage: parsed.coachMessage || "Good week. You're building. Next week: hit the basics harder.",
    };
  } catch (err) {
    logger.error({ err }, "Weekly review AI generation failed");
    return {
      streakSummary: `${weekData.currentStreak} days strong. Keep it going.`,
      whatToImprove: "Lock in your protein every day. That's the foundation.",
      goalPace: "Stay consistent. The pace will follow.",
      coachMessage: "Good week. You're building. Next week: hit the basics harder.",
    };
  }
}

router.get("/weekly-review", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = getUserToday(req);

  // Get the latest weekly review
  const [latestReview] = await db.select().from(weeklyReviewsTable)
    .where(eq(weeklyReviewsTable.userId, userId))
    .orderBy(desc(weeklyReviewsTable.createdAt))
    .limit(1);

  if (latestReview) {
    res.json(latestReview);
    return;
  }

  res.status(404).json({ error: "No weekly review yet" });
});

router.post("/weekly-review", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = getUserToday(req);
  const weekEnd = today;
  const weekStart = addDaysInUserTz(req, today, -6);

  const { dayStart: wStartUtc, dayEnd: wEndUtc } = (() => {
    const tz = (req.headers["x-timezone"] as string | undefined) || "UTC";
    const start = getLocalMidnightUtc(weekStart, tz);
    const end = getLocalMidnightUtc(weekEnd, tz);
    return { dayStart: start, dayEnd: new Date(end.getTime() + 24 * 60 * 60 * 1000) };
  })();

  const [profile, plan, meals, waterLogs, workouts, journals, weighIns, reviews] = await Promise.all([
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).then(r => r[0]),
    db.select().from(plansTable).where(eq(plansTable.userId, userId)).then(r => r[0]),
    db.select().from(mealsTable).where(eq(mealsTable.userId, userId)).then(r => r.filter(m => m.loggedAt && m.loggedAt >= wStartUtc && m.loggedAt < wEndUtc)),
    db.select().from(waterLogsTable).where(eq(waterLogsTable.userId, userId)).then(r => r.filter(w => w.date >= weekStart && w.date <= weekEnd)),
    db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId)).then(r => r.filter(w => w.completedAt && w.completedAt >= wStartUtc && w.completedAt < wEndUtc)),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)).then(r => r.filter(j => j.date >= weekStart && j.date <= weekEnd)),
    db.select().from(weighInsTable).where(eq(weighInsTable.userId, userId)).orderBy(weighInsTable.loggedAt),
    db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, userId)).then(r => r.filter(rv => rv.date >= weekStart && rv.date <= weekEnd)),
  ]);

  const dayCount = 7;

  // Count days where target was met
  const daysInWeek = Array.from({ length: dayCount }, (_, i) => {
    const d = addDaysInUserTz(req, weekStart, i);
    return d;
  });

  const mealDates = new Set(meals.map(m => m.loggedAt ? new Date(m.loggedAt).toLocaleDateString("en-CA", { timeZone: (req.headers["x-timezone"] as string | undefined) || "UTC" }) : ""));
  const waterDates = new Set(waterLogs.map(w => w.date));
  const workoutDates = new Set(workouts.map(w => w.completedAt ? new Date(w.completedAt).toLocaleDateString("en-CA", { timeZone: (req.headers["x-timezone"] as string | undefined) || "UTC" }) : ""));
  const journalDates = new Set(journals.map(j => j.date));

  const calorieTarget = plan?.calorieTarget ?? 2000;
  const proteinTarget = plan?.proteinTargetG ?? 150;
  const waterTarget = plan ? Math.round(plan.waterTargetL * 33.814) : 64;

  let calorieDays = 0;
  let proteinDays = 0;
  let waterDays = 0;
  let workoutDays = 0;
  let sleepDays = 0;

  for (const d of daysInWeek) {
    const dayMeals = meals.filter(m => m.loggedAt && new Date(m.loggedAt).toLocaleDateString("en-CA", { timeZone: (req.headers["x-timezone"] as string | undefined) || "UTC" }) === d);
    const dayWater = waterLogs.filter(w => w.date === d);
    const dayWorkouts = workouts.filter(w => w.completedAt && new Date(w.completedAt).toLocaleDateString("en-CA", { timeZone: (req.headers["x-timezone"] as string | undefined) || "UTC" }) === d);
    const dayJournals = journals.filter(j => j.date === d);

    const dayCals = dayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const dayPro = dayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const dayWaterTotal = dayWater.reduce((s, w) => s + (w.amountOz ?? 0), 0);

    if (dayCals >= calorieTarget * 0.9) calorieDays++;
    if (dayPro >= proteinTarget * 0.9) proteinDays++;
    if (dayWaterTotal >= waterTarget * 0.9) waterDays++;
    if (dayWorkouts.length > 0) workoutDays++;
    if (dayJournals.length > 0 && dayJournals[0].sleptOnTime) sleepDays++;
  }

  // Weight change over the week
  const weekWeighIns = weighIns.filter(w => w.loggedAt && w.loggedAt >= wStartUtc && w.loggedAt < wEndUtc);
  let weightChangeLbs = 0;
  if (weekWeighIns.length >= 2) {
    const diff = weekWeighIns[weekWeighIns.length - 1].weightKg - weekWeighIns[0].weightKg;
    weightChangeLbs = Math.round(diff * LBS * 10) / 10;
  } else if (weighIns.length >= 2) {
    const last = weighIns[weighIns.length - 1].weightKg;
    const prev = weighIns[weighIns.length - 2].weightKg;
    weightChangeLbs = Math.round((last - prev) * LBS * 10) / 10;
  }

  // Goal date predictor
  const predictor = computeGoalDatePredictor(weighIns, profile, plan);

  const weekData = {
    weightChangeLbs,
    calorieConsistency: calorieDays,
    proteinConsistency: proteinDays,
    waterConsistency: waterDays,
    workoutConsistency: workoutDays,
    currentStreak: profile?.currentStreak ?? 0,
  };

  const aiReview = await generateWeeklyReview(weekData, profile, plan);

  // Count existing weekly reviews for week number
  const existingCount = await db.select({ id: weeklyReviewsTable.id })
    .from(weeklyReviewsTable)
    .where(eq(weeklyReviewsTable.userId, userId));
  const weekNumber = existingCount.length + 1;

  const [review] = await db.insert(weeklyReviewsTable).values({
    userId,
    weekNumber,
    startDate: weekStart,
    endDate: weekEnd,
    weightChangeLbs,
    calorieConsistency: calorieDays,
    proteinConsistency: proteinDays,
    waterConsistency: waterDays,
    workoutConsistency: workoutDays,
    streakSummary: aiReview.streakSummary,
    whatToImprove: aiReview.whatToImprove,
    goalPace: aiReview.goalPace,
    estimatedGoalDate: predictor.estimatedGoalDate,
    status: predictor.status,
    coachMessage: aiReview.coachMessage,
  }).returning();

  res.status(201).json({
    ...review,
    currentPace: predictor.currentPace,
    estimatedGoalDate: predictor.estimatedGoalDate,
    status: predictor.status,
  });
});

export default router;
