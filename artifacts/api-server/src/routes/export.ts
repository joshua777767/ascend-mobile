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
  goalCheckInsTable,
} from "@workspace/db";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/users/export", async (req, res): Promise<void> => {
  const userId = getUserId(req);

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));
  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId));
  const meals = await db.select().from(mealsTable).where(eq(mealsTable.userId, userId));
  const journals = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  const reviews = await db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, userId));
  const weighIns = await db.select().from(weighInsTable).where(eq(weighInsTable.userId, userId));
  const chats = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  const waterLogs = await db.select().from(waterLogsTable).where(eq(waterLogsTable.userId, userId));
  const overrides = await db.select().from(scheduleOverridesTable).where(eq(scheduleOverridesTable.userId, userId));
  const checkIns = await db.select().from(goalCheckInsTable).where(eq(goalCheckInsTable.userId, userId));

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId,
    profile: profile
      ? {
          ...profile,
          goals: JSON.parse(profile.goals || "[]"),
          skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
          digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
        }
      : null,
    plan: plan
      ? {
          ...plan,
          keyHabits: JSON.parse(plan.keyHabits || "[]"),
          coachNotes: JSON.parse(plan.coachNotes || "[]"),
        }
      : null,
    workouts,
    meals,
    journals,
    reviews,
    weighIns,
    chatMessages: chats,
    waterLogs,
    scheduleOverrides: overrides,
    goalCheckIns: checkIns,
  };

  res.json(exportData);
});

export default router;
