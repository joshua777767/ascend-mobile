import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  plansTable,
  workoutsTable,
  mealsTable,
  journalEntriesTable,
  coachReviewsTable,
  weighInsTable,
  chatMessagesTable,
  waterLogsTable,
  scheduleOverridesTable,
} from "@workspace/db";
import { CreateUserProfileBody, UpdateUserProfileBody, UpdateGoalBody } from "@workspace/api-zod";
import { getUserId } from "../middlewares/auth";
import { generatePlan } from "../lib/planGenerator";

const router: IRouter = Router();

function safeParseArr(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseProfileArrays(profile: typeof userProfilesTable.$inferSelect) {
  return {
    ...profile,
    goals: safeParseArr(profile.goals),
    skinConcerns: safeParseArr(profile.skinConcerns),
    digestionConcerns: safeParseArr(profile.digestionConcerns),
  };
}

router.get("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(parseProfileArrays(profile));
});

function validateWeights(body: any): string | null {
  if (body.currentWeightKg !== undefined && (body.currentWeightKg < 20 || body.currentWeightKg > 300)) {
    return "Current weight must be between 20 and 300 kg. Please verify your entry.";
  }
  if (body.goalWeightKg !== undefined && (body.goalWeightKg < 20 || body.goalWeightKg > 300)) {
    return "Goal weight must be between 20 and 300 kg. Please verify your entry.";
  }
  return null;
}

router.post("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weightError = validateWeights(parsed.data);
  if (weightError) {
    res.status(400).json({ error: weightError });
    return;
  }

  const { goals, skinConcerns, digestionConcerns, ...rest } = parsed.data as any;

  const values = {
    ...rest,
    userId,
    goals: JSON.stringify(goals || []),
    skinConcerns: JSON.stringify(skinConcerns || []),
    digestionConcerns: JSON.stringify(digestionConcerns || []),
  };

  // Upsert by userId
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let profile;
  if (existing.length > 0) {
    [profile] = await db.update(userProfilesTable).set(values).where(eq(userProfilesTable.userId, userId)).returning();
  } else {
    [profile] = await db.insert(userProfilesTable).values(values).returning();
  }

  res.status(201).json(parseProfileArrays(profile));
});

router.patch("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weightError = validateWeights(parsed.data);
  if (weightError) {
    res.status(400).json({ error: weightError });
    return;
  }

  const { goals, ...rest } = parsed.data as any;
  const setValues: Record<string, unknown> = { ...rest };
  if (goals !== undefined) {
    setValues.goals = JSON.stringify(goals);
  }

  // When gymAccess changes, clear any stored custom workout schedule so the
  // new access level takes effect immediately on the next workout fetch.
  if (rest.gymAccess !== undefined) {
    const [existing] = await db.select({ gymAccess: userProfilesTable.gymAccess })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));
    if (existing && existing.gymAccess !== rest.gymAccess) {
      setValues.customWorkoutSchedule = null;
      setValues.ownSchedule = null;
      setValues.hasOwnSchedule = null;
    }
  }

  const [profile] = await db
    .update(userProfilesTable)
    .set(setValues as any)
    .where(eq(userProfilesTable.userId, userId))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Regenerate plan when plan-relevant fields change
  const PLAN_RELEVANT_FIELDS = [
    "goals", "currentWeightKg", "goalWeightKg", "heightCm", "age", "gender",
    "fitnessLevel", "gymAccess", "equipment", "workoutDaysPerWeek",
    "preferredWorkoutTime", "sport", "sportSchedule", "sportCustom",
    "hasOwnSchedule", "activityLevel", "dietStyle", "targetDate",
    "customWorkoutSchedule",
  ] as const;
  const triggerRegen = PLAN_RELEVANT_FIELDS.some(f => f in setValues);

  let updatedPlan: (typeof plansTable.$inferSelect) | null = null;
  if (triggerRegen) {
    try {
      const [existingPlan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));
      const newPlan = generatePlan(profile as any);
      const planFields = {
        goalType: newPlan.goalType,
        calorieTarget: newPlan.calorieTarget,
        proteinTargetG: newPlan.proteinTargetG,
        waterTargetL: newPlan.waterTargetL,
        stepsTarget: newPlan.stepsTarget,
        sleepTargetHours: newPlan.sleepTargetHours,
        weeklyPace: newPlan.weeklyPace,
        workoutSchedule: newPlan.workoutSchedule,
        keyHabits: JSON.stringify(newPlan.keyHabits),
        coachNotes: newPlan.coachNotes,
        warnings: newPlan.warnings,
        restDayCalorieTarget: newPlan.restDayCalorieTarget,
        practiceDayCalorieTarget: newPlan.practiceDayCalorieTarget,
        gameDayCalorieTarget: newPlan.gameDayCalorieTarget,
        dailyCalorieTargets: newPlan.dailyCalorieTargets
          ? JSON.stringify(newPlan.dailyCalorieTargets)
          : null,
      };
      let saved: typeof plansTable.$inferSelect | undefined;
      if (existingPlan) {
        [saved] = await db.update(plansTable).set(planFields).where(eq(plansTable.userId, userId)).returning();
      } else {
        [saved] = await db.insert(plansTable).values({ userId, ...planFields }).returning();
      }
      updatedPlan = saved ?? null;
    } catch (err) {
      req.log.warn({ err }, "Plan regen after profile patch failed; continuing");
    }
  }

  const profileOut = parseProfileArrays(profile);
  res.json(updatedPlan ? { ...profileOut, plan: updatedPlan } : profileOut);
});

// Update goal: set a new goal weight and reset goal tracking
router.patch("/users/profile/goal", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!existing) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [profile] = await db
    .update(userProfilesTable)
    .set({
      goalWeightKg: parsed.data.goalWeightKg,
      goals: JSON.stringify(parsed.data.goals),
      goalReachedAt: null,
      currentWeightKg: parsed.data.currentWeightKg ?? existing.currentWeightKg,
    })
    .where(eq(userProfilesTable.userId, userId))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(parseProfileArrays(profile));
});

// Reset my profile: wipe all of this user's data so they can re-onboard.
router.delete("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  await db.delete(scheduleOverridesTable).where(eq(scheduleOverridesTable.userId, userId));
  await db.delete(waterLogsTable).where(eq(waterLogsTable.userId, userId));
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  await db.delete(weighInsTable).where(eq(weighInsTable.userId, userId));
  await db.delete(coachReviewsTable).where(eq(coachReviewsTable.userId, userId));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(mealsTable).where(eq(mealsTable.userId, userId));
  await db.delete(workoutsTable).where(eq(workoutsTable.userId, userId));
  await db.delete(plansTable).where(eq(plansTable.userId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  res.status(204).end();
});

export default router;
