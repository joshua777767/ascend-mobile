import { Router } from "express";
import { eq, sql, count, desc, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  userProfilesTable,
  plansTable,
  mealsTable,
  chatMessagesTable,
  waterLogsTable,
  coachReviewsTable,
  journalEntriesTable,
  weighInsTable,
  workoutsTable,
} from "@workspace/db";
import { getUserId } from "../middlewares/auth";
import { logger } from "../lib/logger";

const OWNER_EMAIL = "joshquag2010@icloud.com";

const router = Router();

const today = sql`date_trunc('day', now())`;
const weekAgo = sql`now() - interval '7 days'`;

async function requireOwner(req: any, res: any): Promise<boolean> {
  const userId = getUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  return true;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  // ── Global stats ──
  const [{ count: totalUsers }] = await db.select({ count: count() }).from(usersTable);
  const [{ count: newUsersToday }] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(gte(usersTable.createdAt, today));
  const [{ count: mealsToday }] = await db
    .select({ count: count() })
    .from(mealsTable)
    .where(gte(mealsTable.loggedAt, today));
  const [{ count: mealScansToday }] = await db
    .select({ count: count() })
    .from(mealsTable)
    .where(sql`${mealsTable.loggedAt} >= ${today} and ${mealsTable.imageUrl} is not null`);
  const [{ count: coachMessagesToday }] = await db
    .select({ count: count() })
    .from(chatMessagesTable)
    .where(gte(chatMessagesTable.createdAt, today));
  const [{ count: waterLogsToday }] = await db
    .select({ count: count() })
    .from(waterLogsTable)
    .where(gte(waterLogsTable.createdAt, today));
  const [{ count: weeklyCheckins }] = await db
    .select({ count: count() })
    .from(coachReviewsTable)
    .where(gte(coachReviewsTable.createdAt, weekAgo));

  // Active users today (any activity across core tables)
  const activeTodayRows = await db.execute<{ user_id: number }>(sql`
    select distinct user_id from (
      select user_id from meals where logged_at >= ${today}
      union select user_id from water_logs where created_at >= ${today}
      union select user_id from chat_messages where created_at >= ${today}
      union select user_id from coach_reviews where created_at >= ${today}
      union select user_id from journal_entries where created_at >= ${today}
    ) as active
  `);
  const activeUsersToday = activeTodayRows.rows.length;

  // ── User list with per-user stats ──
  const allUsers = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
      freePro: usersTable.freePro,
      freeProExpiresAt: usersTable.freeProExpiresAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const allProfiles = await db
    .select({ userId: userProfilesTable.userId, name: userProfilesTable.name, currentStreak: userProfilesTable.currentStreak })
    .from(userProfilesTable);

  const profileMap = new Map(allProfiles.map(p => [p.userId, p]));

  const mealCounts = await db.execute<{ user_id: number; c: number }>(sql`
    select user_id, count(*) as c from meals group by user_id
  `);
  const scanCounts = await db.execute<{ user_id: number; c: number }>(sql`
    select user_id, count(*) as c from meals where image_url is not null group by user_id
  `);
  const chatCounts = await db.execute<{ user_id: number; c: number }>(sql`
    select user_id, count(*) as c from chat_messages group by user_id
  `);

  // Last activity from all activity tables (no users table, different column name)
  const lastActivityRows = await db.execute<{ user_id: number; last_active: string }>(sql`
    select user_id, max(created_at) as last_active from (
      select user_id, logged_at as created_at from meals
      union all select user_id, created_at from water_logs
      union all select user_id, created_at from chat_messages
      union all select user_id, created_at from coach_reviews
      union all select user_id, created_at from journal_entries
    ) as combined
    group by user_id
  `);

  const mostActiveRows = await db.execute<{ user_id: number; c: number }>(sql`
    select user_id, count(*) as c from (
      select user_id from meals
      union all select user_id from water_logs
      union all select user_id from chat_messages
      union all select user_id from coach_reviews
      union all select user_id from journal_entries
    ) as combined
    group by user_id
    order by count(*) desc
  `);

  const mealCountMap = new Map(mealCounts.rows.map(r => [r.user_id, r.c]));
  const scanCountMap = new Map(scanCounts.rows.map(r => [r.user_id, r.c]));
  const chatCountMap = new Map(chatCounts.rows.map(r => [r.user_id, r.c]));
  const lastActivityMap = new Map(lastActivityRows.rows.map(r => [r.user_id, r.last_active]));
  const mostActiveMap = new Map(mostActiveRows.rows.map(r => [r.user_id, r.c]));

  const userList = allUsers.map(u => {
    const p = profileMap.get(u.id);
    const isFreePro = u.freePro && (!u.freeProExpiresAt || u.freeProExpiresAt > new Date());
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSince = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / msPerDay);
    const trialDay = Math.min(7, daysSince + 1);
    return {
      id: u.id,
      email: u.email,
      name: p?.name ?? null,
      signedUpAt: u.createdAt,
      lastActive: lastActivityMap.get(u.id) ?? null,
      profileCompleted: profileMap.has(u.id),
      mealsLogged: mealCountMap.get(u.id) ?? 0,
      coachMessages: chatCountMap.get(u.id) ?? 0,
      mealScans: scanCountMap.get(u.id) ?? 0,
      currentStreak: p?.currentStreak ?? 0,
      freePro: !!u.freePro,
      isFreePro: !!isFreePro,
      freeProExpiresAt: u.freeProExpiresAt ?? null,
      trialDay,
      accessStatus: isFreePro ? "Free Pro" : trialDay >= 7 ? "Trial Expired" : `Trial Day ${trialDay}`,
    };
  });

  res.json({
    totalUsers,
    newUsersToday,
    activeUsersToday,
    mealsLoggedToday: mealsToday,
    mealScansToday: mealScansToday,
    coachMessagesToday: coachMessagesToday,
    waterLogsToday: waterLogsToday,
    weeklyCheckinsCompleted: weeklyCheckins,
    allUsers: userList,
  });
});

router.get("/admin/users", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const profiles = await db
    .select({
      userId: userProfilesTable.userId,
      name: userProfilesTable.name,
      goals: userProfilesTable.goals,
      currentWeightKg: userProfilesTable.currentWeightKg,
      goalWeightKg: userProfilesTable.goalWeightKg,
    })
    .from(userProfilesTable);

  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  res.json({
    users: users.map(u => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
        name: p?.name ?? null,
        goals: p?.goals ? JSON.parse(p.goals) : [],
        currentWeightKg: p?.currentWeightKg ?? null,
        goalWeightKg: p?.goalWeightKg ?? null,
      };
    }),
  });
});

router.post("/admin/grant-free-pro", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const { userId, expiresAt } = req.body as { userId?: number; expiresAt?: string | null };
  if (!userId || typeof userId !== "number") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  await db
    .update(usersTable)
    .set({ freePro: true, freeProExpiresAt: expiresAtDate })
    .where(eq(usersTable.id, userId));

  logger.info({ userId, expiresAt: expiresAtDate }, "Admin granted Free Pro");
  res.json({ ok: true });
});

router.post("/admin/revoke-free-pro", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const { userId } = req.body as { userId?: number };
  if (!userId || typeof userId !== "number") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({ freePro: false, freeProExpiresAt: null })
    .where(eq(usersTable.id, userId));

  logger.info({ userId }, "Admin revoked Free Pro");
  res.json({ ok: true });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));
  logger.info({ userId, email: user.email }, "Admin deleted user");
  res.json({ ok: true, deleted: userId });
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));
  const userMeals = await db.select().from(mealsTable).where(eq(mealsTable.userId, userId)).orderBy(desc(mealsTable.loggedAt));
  const userWeighIns = await db.select().from(weighInsTable).where(eq(weighInsTable.userId, userId)).orderBy(desc(weighInsTable.loggedAt));
  const userWorkouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId)).orderBy(desc(workoutsTable.completedAt));
  const userReviews = await db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, userId)).orderBy(desc(coachReviewsTable.createdAt));
  const userJournal = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)).orderBy(desc(journalEntriesTable.createdAt));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    profile: profile ? {
      ...profile,
      goals: (profile as any).goals ? JSON.parse((profile as any).goals) : [],
      skinConcerns: (profile as any).skinConcerns ? JSON.parse((profile as any).skinConcerns) : [],
      digestionConcerns: (profile as any).digestionConcerns ? JSON.parse((profile as any).digestionConcerns) : [],
      keyHabits: (profile as any).keyHabits ? JSON.parse((profile as any).keyHabits) : [],
      sportSchedule: (profile as any).sportSchedule ? JSON.parse((profile as any).sportSchedule) : null,
      customWorkoutSchedule: (profile as any).customWorkoutSchedule ? JSON.parse((profile as any).customWorkoutSchedule) : null,
    } : null,
    plan: plan ?? null,
    meals: userMeals.slice(0, 50),
    weighIns: userWeighIns,
    workouts: userWorkouts,
    reviews: userReviews,
    journalEntries: userJournal,
  });
});

export default router;
