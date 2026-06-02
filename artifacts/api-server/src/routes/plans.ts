import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, plansTable } from "@workspace/db";
import { generatePlan } from "../lib/planGenerator";
import { USER_ID } from "./users";

const router: IRouter = Router();

function formatPlan(plan: any) {
  return {
    ...plan,
    keyHabits: JSON.parse(plan.keyHabits || "[]"),
  };
}

router.get("/plans/current", async (req, res): Promise<void> => {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID)).orderBy(plansTable.createdAt);
  if (!plan) {
    res.status(404).json({ error: "No plan found" });
    return;
  }
  res.json(formatPlan(plan));
});

router.post("/plans/current", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
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
  await db.delete(plansTable).where(eq(plansTable.userId, USER_ID));

  const [plan] = await db.insert(plansTable).values({
    userId: USER_ID,
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
  }).returning();

  res.status(201).json(formatPlan(plan));
});

export default router;
