import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import { CreateJournalEntryBody } from "@workspace/api-zod";
import { getUserId, getUserToday } from "../middlewares/auth";

const router: IRouter = Router();

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
  const today = getUserToday(req);
  const entries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, getUserId(req)))
    .orderBy(desc(journalEntriesTable.createdAt));

  const todayEntry = entries.find(e => e.date === today);

  if (!todayEntry) {
    res.status(404).json({ error: "No journal entry for today" });
    return;
  }
  res.json(todayEntry);
});

export default router;
