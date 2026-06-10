import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getUserId, getUserToday, addDaysInUserTz } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/streak", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  res.json({
    currentStreak: profile?.currentStreak ?? 0,
    lastStreakDate: profile?.lastStreakDate ?? null,
  });
});

// One-time reclaim: moves lastStreakDate back one day so the user's next POST /streak
// sees a consecutive day and increments correctly. Used when yesterday's qualifying
// score wasn't captured because the feature wasn't yet deployed.
// Guard: only runs when lastStreakDate === today AND currentStreak === 1.
router.post("/streak/reclaim", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = getUserToday(req);
  const yesterday = addDaysInUserTz(req, today, -1);

  const [profile] = await db
    .select({ currentStreak: userProfilesTable.currentStreak, lastStreakDate: userProfilesTable.lastStreakDate })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Only correct when today was just recorded as Day 1 (deployment gap scenario)
  if (profile.lastStreakDate !== today || profile.currentStreak !== 1) {
    res.json({ currentStreak: profile.currentStreak, lastStreakDate: profile.lastStreakDate });
    return;
  }

  await db
    .update(userProfilesTable)
    .set({ lastStreakDate: yesterday })
    .where(eq(userProfilesTable.userId, userId));

  res.json({ currentStreak: 1, lastStreakDate: yesterday });
});

router.post("/streak", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const today = getUserToday(req);
  const last = profile.lastStreakDate;
  let currentStreak = profile.currentStreak ?? 0;

  if (last === today) {
    // Already counted today
  } else if (last === addDaysInUserTz(req, today, -1)) {
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
