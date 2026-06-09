import { Router, type IRouter, type Request } from "express";
import { eq, desc, gte, lt, and } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import { CreateJournalEntryBody } from "@workspace/api-zod";
import { getUserId, getUserToday } from "../middlewares/auth";

const router: IRouter = Router();

// Return the UTC timestamp of local midnight for the given date string + timezone.
function getLocalMidnightUtc(dateStr: string, tz: string): Date {
  const ref = new Date(`${dateStr}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const localSecsFromMidnight = (get("hour") % 24) * 3600 + get("minute") * 60 + get("second");
  return new Date(ref.getTime() - localSecsFromMidnight * 1000);
}

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
