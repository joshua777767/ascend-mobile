import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, workoutsTable, userProfilesTable, plansTable } from "@workspace/db";
import { CreateWorkoutBody, CompleteWorkoutParams } from "@workspace/api-zod";
import { getTodayWorkout } from "../lib/workoutGenerator";
import { USER_ID } from "./users";

const router: IRouter = Router();

router.get("/workouts", async (req, res): Promise<void> => {
  const workouts = await db.select().from(workoutsTable)
    .where(eq(workoutsTable.userId, USER_ID))
    .orderBy(desc(workoutsTable.completedAt));
  res.json(workouts);
});

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workout] = await db.insert(workoutsTable).values({
    userId: USER_ID,
    ...parsed.data,
  }).returning();
  res.status(201).json(workout);
});

router.get("/workouts/today", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));

  if (!profile || !plan) {
    // Return a default workout
    res.json({
      day: new Date().toLocaleDateString("en-US", { weekday: "long" }),
      name: "Active Recovery",
      type: "cardio",
      exercises: [
        { name: "Brisk Walk", sets: 1, reps: "30 min", restSeconds: 0, coachTip: "Move every day. No exceptions." },
      ],
    });
    return;
  }

  const profileWithArrays = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  };

  const workout = getTodayWorkout(profileWithArrays as any, plan);
  res.json(workout);
});

router.patch("/workouts/:id/complete", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [workout] = await db.select().from(workoutsTable).where(eq(workoutsTable.id, id));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(workout);
});

export default router;
