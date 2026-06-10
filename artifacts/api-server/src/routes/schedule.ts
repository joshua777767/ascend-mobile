import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, userProfilesTable, plansTable, scheduleOverridesTable } from "@workspace/db";
import { generateDailySchedule } from "../lib/scheduleGenerator";
import { getUserId, getUserToday } from "../middlewares/auth";
import { UpdateScheduleItemBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface ScheduleItem {
  time: string;
  activity: string;
  type: string;
  notes: string | null;
  status: string | null;
}

async function getScheduleItems(userId: number, req: Request): Promise<{ items: ScheduleItem[]; todaysMission: string }> {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));

  const today = getUserToday(req);

  if (!profile || !plan) {
    return {
      items: [
        { time: "06:30", activity: "Wake up", type: "health", notes: "Complete your profile to get a personalized schedule.", status: "active" },
        { time: "22:30", activity: "Sleep", type: "sleep", notes: null, status: "active" },
      ],
      todaysMission: "Complete your onboarding to get your personalized daily schedule.",
    };
  }

  const profileWithArrays = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
    _timeZone: req.headers["x-timezone"] as string | undefined,
  };

  const baseItems = generateDailySchedule(profileWithArrays as any, plan);
  const overrides = await db.select().from(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.userId, userId), eq(scheduleOverridesTable.date, today)));

  const items: ScheduleItem[] = baseItems.map((item) => {
    const override = overrides.find((o) => o.activity === item.activity && o.type === item.type);
    return {
      time: override?.time ?? item.time,
      activity: item.activity,
      type: item.type,
      notes: item.notes,
      status: override?.status ?? "active",
    };
  });

  const keyHabits: string[] = (() => { try { return JSON.parse(plan.keyHabits); } catch { return []; } })();
  const todaysMission = keyHabits[0] ?? plan.coachNotes.split(".")[0] ?? "Execute your plan today.";

  return { items, todaysMission };
}

router.get("/schedule/today", async (req, res): Promise<void> => {
  const { items, todaysMission } = await getScheduleItems(getUserId(req), req);
  const today = getUserToday(req);
  res.json({ date: today, items, todaysMission });
});

router.patch("/schedule/today", async (req, res): Promise<void> => {
  const parsed = UpdateScheduleItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserId(req);
  const today = getUserToday(req);
  const data = parsed.data;

  // Upsert override
  const [existing] = await db.select().from(scheduleOverridesTable)
    .where(and(
      eq(scheduleOverridesTable.userId, userId),
      eq(scheduleOverridesTable.date, today),
      eq(scheduleOverridesTable.activity, data.activity),
      eq(scheduleOverridesTable.type, data.type),
    ));

  if (existing) {
    await db.update(scheduleOverridesTable)
      .set({
        time: data.time ?? existing.time,
        status: data.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(scheduleOverridesTable.id, existing.id));
  } else {
    await db.insert(scheduleOverridesTable).values({
      userId,
      date: today,
      activity: data.activity,
      type: data.type,
      time: data.time ?? "00:00",
      status: data.status ?? "active",
    });
  }

  const { items, todaysMission } = await getScheduleItems(userId, req);
  res.json({ date: today, items, todaysMission });
});

export default router;
