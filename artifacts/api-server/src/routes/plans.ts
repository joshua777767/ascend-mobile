import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, userProfilesTable, plansTable } from "@workspace/db";
import { generatePlan } from "../lib/planGenerator";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

function formatPlan(plan: any) {
  return {
    ...plan,
    keyHabits: JSON.parse(plan.keyHabits || "[]"),
    dailyCalorieTargets: plan.dailyCalorieTargets
      ? JSON.parse(plan.dailyCalorieTargets)
      : null,
  };
}

function planFields(generated: ReturnType<typeof generatePlan>) {
  return {
    goalType: generated.goalType,
    calorieTarget: generated.calorieTarget,
    proteinTargetG: generated.proteinTargetG,
    waterTargetL: generated.waterTargetL,
    stepsTarget: generated.stepsTarget,
    sleepTargetHours: generated.sleepTargetHours,
    weeklyPace: generated.weeklyPace,
    workoutSchedule: generated.workoutSchedule,
    keyHabits: JSON.stringify(generated.keyHabits),
    coachNotes: generated.coachNotes,
    warnings: generated.warnings,
    restDayCalorieTarget: generated.restDayCalorieTarget,
    gymDayCalorieTarget: generated.gymDayCalorieTarget,
    practiceDayCalorieTarget: generated.practiceDayCalorieTarget,
    gameDayCalorieTarget: generated.gameDayCalorieTarget,
    dailyCalorieTargets: generated.dailyCalorieTargets
      ? JSON.stringify(generated.dailyCalorieTargets)
      : null,
  };
}

async function refreshPlanIfStale(userId: number, existingPlan: typeof plansTable.$inferSelect) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (!profile) return existingPlan;

  const generated = generatePlan({
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  } as any);
  const fields = planFields(generated);
  const isStale = Object.entries(fields).some(
    ([key, value]) => (existingPlan as any)[key] !== value,
  );
  if (!isStale) return existingPlan;

  const [refreshed] = await db
    .update(plansTable)
    .set(fields)
    .where(eq(plansTable.id, existingPlan.id))
    .returning();
  return refreshed ?? existingPlan;
}

router.get("/plans/current", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.userId, userId))
    .orderBy(desc(plansTable.createdAt))
    .limit(1);
  if (!plan) {
    res.status(404).json({ error: "No plan found" });
    return;
  }
  res.json(formatPlan(await refreshPlanIfStale(userId, plan)));
});

// Alias for backward compatibility
router.get("/plan", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.userId, userId))
    .orderBy(desc(plansTable.createdAt))
    .limit(1);
  if (!plan) {
    res.status(404).json({ error: "No plan found" });
    return;
  }
  res.json(formatPlan(await refreshPlanIfStale(userId, plan)));
});

router.post("/plans/current", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  if (!profile) {
    res.status(404).json({ error: "Profile not found. Complete onboarding first." });
    return;
  }

  const profileWithArrays = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  };

  const generated = generatePlan(profileWithArrays as any);

  // Delete old plan and create new one
  await db.delete(plansTable).where(eq(plansTable.userId, getUserId(req)));

  const [plan] = await db.insert(plansTable).values({
    userId: getUserId(req),
    ...planFields(generated),
  }).returning();

  res.status(201).json(formatPlan(plan));
});

export default router;
