import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get("/streak", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  res.json({
    currentStreak: profile?.currentStreak ?? 0,
    lastStreakDate: profile?.lastStreakDate ?? null,
  });
});

router.post("/streak", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const today = todayStr();
  const last = profile.lastStreakDate;
  let currentStreak = profile.currentStreak ?? 0;

  if (last === today) {
    // Already counted today
  } else if (last === addDays(today, -1)) {
    // Consecutive day
    currentStreak += 1;
  } else {
    // Missed a day or fresh start
    currentStreak = 1;
  }

  await db
    .update(userProfilesTable)
    .set({ currentStreak, lastStreakDate: today })
    .where(eq(userProfilesTable.userId, userId));

  res.json({ currentStreak, lastStreakDate: today });
});

export default router;
