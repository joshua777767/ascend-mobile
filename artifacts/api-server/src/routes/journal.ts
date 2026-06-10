import { Router, type IRouter, type Request } from "express";
import { eq, desc, gte, lt, and } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import { CreateJournalEntryBody } from "@workspace/api-zod";
import { getUserId, getUserToday, getLocalMidnightUtc } from "../middlewares/auth";

const router: IRouter = Router();

function getTodayUtcRange(req: Request): { dayStart: Date; dayEnd: Date } {
  const tz = (req.headers["x-timezone"] as string | undefined) || "UTC";
  const dateStr = getUserToday(req);
  const dayStart = getLocalMidnightUtc(dateStr, tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}

router.get("/journal", async (req, res): Promise<void> => {
  const entries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, getUserId(req)))
    .orderBy(desc(journalEntriesTable.createdAt));
  res.json(entries);
});

router.post("/journal", async (req, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db.insert(journalEntriesTable).values({
    userId: getUserId(req),
    date: getUserToday(req),
    ...parsed.data,
  }).returning();

  res.status(201).json(entry);
});

router.get("/journal/today", async (req, res): Promise<void> => {
  const { dayStart, dayEnd } = getTodayUtcRange(req);
  const [todayEntry] = await db.select().from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, getUserId(req)),
        gte(journalEntriesTable.createdAt, dayStart),
        lt(journalEntriesTable.createdAt, dayEnd),
      ),
    )
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(1);

  if (!todayEntry) {
    res.status(404).json({ error: "No journal entry for today" });
    return;
  }
  res.json(todayEntry);
});

export default router;
