import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, plansTable } from "@workspace/db";
import { generateDailySchedule } from "../lib/scheduleGenerator";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/schedule/today", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));

  if (!profile || !plan) {
    res.json({
      date: new Date().toISOString().split("T")[0],
      items: [
        { time: "06:30", activity: "Wake up", type: "health", notes: "Complete your profile to get a personalized schedule." },
        { time: "22:30", activity: "Sleep", type: "sleep", notes: null },
      ],
      todaysMission: "Complete your onboarding to get your personalized daily schedule.",
    });
    return;
  }

  const profileWithArrays = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  };

  const items = generateDailySchedule(profileWithArrays as any, plan);
  const keyHabits: string[] = (() => { try { return JSON.parse(plan.keyHabits); } catch { return []; } })();
  const todaysMission = keyHabits[0] ?? plan.coachNotes.split(".")[0] ?? "Execute your plan today.";

  res.json({
    date: new Date().toISOString().split("T")[0],
    items,
    todaysMission,
  });
});

export default router;
