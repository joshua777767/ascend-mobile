import { Router } from "express";
import { eq, sql, count, desc, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  userProfilesTable,
  mealsTable,
  chatMessagesTable,
  waterLogsTable,
  coachReviewsTable,
  journalEntriesTable,
} from "@workspace/db";
import { getUserId } from "../middlewares/auth";

const OWNER_EMAIL = "joshquag2010@icloud.com";

const router = Router();

const today = sql`date_trunc('day', now())`;
const weekAgo = sql`now() - interval '7 days'`;

router.get("/admin/stats", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

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
    .select({ id: usersTable.id, email: usersTable.email, createdAt: usersTable.createdAt })
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

export default router;
