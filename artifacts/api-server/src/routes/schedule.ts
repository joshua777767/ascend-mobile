import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, userProfilesTable, plansTable, scheduleOverridesTable } from "@workspace/db";
import { generateDailySchedule } from "../lib/scheduleGenerator";
import { getUserId, getUserToday } from "../middlewares/auth";
import { UpdateScheduleItemBody, CreateCustomTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface ScheduleItem {
  id?: number;
  time: string;
  activity: string;
  type: string;
  notes: string | null;
  status: string | null;
  isCustom?: boolean;
}

async function getScheduleItems(userId: number, req: Request): Promise<{ items: ScheduleItem[]; todaysMission: string }> {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));

  const today = getUserToday(req);

  const allOverrides = await db.select().from(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.userId, userId), eq(scheduleOverridesTable.date, today)));

  // Custom user-created tasks
  const customTasks: ScheduleItem[] = allOverrides
    .filter(o => o.isCustom)
    .map(o => ({
      id: o.id,
      time: o.time,
      activity: o.activity,
      type: o.type,
      notes: o.notes ?? null,
      status: o.status,
      isCustom: true,
    }));

  if (!profile || !plan) {
    const items: ScheduleItem[] = [
      { time: "06:30", activity: "Wake up", type: "health", notes: "Complete your profile to get a personalized schedule.", status: "active" },
      { time: "22:30", activity: "Sleep", type: "sleep", notes: null, status: "active" },
      ...customTasks,
    ].sort((a, b) => a.time.localeCompare(b.time));
    return { items, todaysMission: "Complete your onboarding to get your personalized daily schedule." };
  }

  const profileWithArrays = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
    _timeZone: req.headers["x-timezone"] as string | undefined,
  };

  const baseItems = generateDailySchedule(profileWithArrays as any, plan);
  const nonCustomOverrides = allOverrides.filter(o => !o.isCustom);

  const generatedItems: ScheduleItem[] = baseItems.map((item) => {
    const override = nonCustomOverrides.find(o => o.activity === item.activity && o.type === item.type);
    return {
      time: override?.time ?? item.time,
      activity: item.activity,
      type: item.type,
      notes: item.notes,
      status: override?.status ?? "active",
    };
  });

  const items: ScheduleItem[] = [...generatedItems, ...customTasks]
    .sort((a, b) => a.time.localeCompare(b.time));

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

// ── POST /schedule/today/custom — create a user-defined task ─────────────────
router.post("/schedule/today/custom", async (req, res): Promise<void> => {
  const parsed = CreateCustomTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserId(req);
  const today = getUserToday(req);
  const { activity, type, time, notes } = parsed.data;

  await db.insert(scheduleOverridesTable).values({
    userId,
    date: today,
    activity,
    type,
    time,
    notes: notes ?? null,
    isCustom: true,
    status: "active",
  });

  const { items, todaysMission } = await getScheduleItems(userId, req);
  res.status(201).json({ date: today, items, todaysMission });
});

// ── DELETE /schedule/today/custom/:id — delete a user-defined task ───────────
router.delete("/schedule/today/custom/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = getUserId(req);

  const [row] = await db.select().from(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.id, id), eq(scheduleOverridesTable.userId, userId)));

  if (!row || !row.isCustom) {
    res.status(404).json({ error: "Custom task not found" });
    return;
  }

  await db.delete(scheduleOverridesTable).where(eq(scheduleOverridesTable.id, id));

  const todayStr = getUserToday(req);
  const { items, todaysMission } = await getScheduleItems(userId, req);
  res.json({ date: todayStr, items, todaysMission });
});

export default router;
