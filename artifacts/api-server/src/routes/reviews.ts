import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, coachReviewsTable, journalEntriesTable, plansTable, userProfilesTable } from "@workspace/db";
import { openai } from "../lib/openai";
import { USER_ID } from "./users";

const router: IRouter = Router();

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

async function generateCoachReview(entry: any, plan: any, profile: any): Promise<{
  dailyScore: number; biggestWin: string; biggestMistake: string;
  whatSlowedProgress: string; exactFixForTomorrow: string; onPace: boolean; strictCoachMessage: string;
}> {
  try {
    const checks = [
      entry.followedSchedule ? 15 : 0,
      entry.hitProtein ? 20 : 0,
      entry.stayedNearCalories ? 15 : 0,
      entry.workedOut ? 20 : 0,
      entry.drankWater ? 10 : 0,
      entry.sleptOnTime ? 10 : 0,
      Math.round((entry.energyRating / 10) * 5),
      Math.round((entry.skinBloatingRating / 10) * 5),
    ];
    const score = checks.reduce((a, b) => a + b, 0);
    const onPace = score >= 60;

    const prompt = `You are a strict transformation coach. Review this user's day.

Goal: ${plan?.goalType ?? "general improvement"}
Journal: followed schedule=${entry.followedSchedule}, hit protein=${entry.hitProtein}, stayed near calories=${entry.stayedNearCalories}, worked out=${entry.workedOut}, drank water=${entry.drankWater}, slept on time=${entry.sleptOnTime}
Energy: ${entry.energyRating}/10, Skin/Bloating: ${entry.skinBloatingRating}/10
Biggest win: ${entry.biggestWin || "none"}
What went wrong: ${entry.whatWentWrong || "nothing reported"}
Score: ${score}/100

Respond ONLY as valid JSON:
{
  "biggestWin": "1 sentence",
  "biggestMistake": "1 sentence",
  "whatSlowedProgress": "1 sentence",
  "exactFixForTomorrow": "1 concrete, specific action",
  "strictCoachMessage": "2-3 sentences, strict coach tone, personal, based on what they actually reported"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return { dailyScore: score, onPace, ...parsed };
  } catch {
    const score = 50;
    return {
      dailyScore: score,
      biggestWin: entry.biggestWin || "Showed up today.",
      biggestMistake: entry.whatWentWrong || "Some targets were missed.",
      whatSlowedProgress: "Inconsistency is the enemy of progress.",
      exactFixForTomorrow: "Hit protein first. Everything else follows.",
      onPace: false,
      strictCoachMessage: "You logged your day. That counts. Tomorrow, execute on the basics: protein, water, sleep. No excuses.",
    };
  }
}

router.get("/reviews", async (req, res): Promise<void> => {
  const reviews = await db.select().from(coachReviewsTable)
    .where(eq(coachReviewsTable.userId, USER_ID))
    .orderBy(desc(coachReviewsTable.createdAt));
  res.json(reviews);
});

router.post("/reviews", async (req, res): Promise<void> => {
  const today = getTodayStr();

  // Get today's journal entry
  const allEntries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, USER_ID))
    .orderBy(desc(journalEntriesTable.createdAt));
  const todayEntry = allEntries.find(e => e.date === today);

  if (!todayEntry) {
    res.status(400).json({ error: "Submit your journal entry first." });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));

  const generated = await generateCoachReview(todayEntry, plan, profile);

  // Upsert today's review
  const existing = (await db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, USER_ID))).find(r => r.date === today);

  let review;
  if (existing) {
    [review] = await db.update(coachReviewsTable).set(generated).where(eq(coachReviewsTable.id, existing.id)).returning();
  } else {
    [review] = await db.insert(coachReviewsTable).values({
      userId: USER_ID,
      date: today,
      ...generated,
    }).returning();
  }

  res.status(201).json(review);
});

router.get("/reviews/today", async (req, res): Promise<void> => {
  const today = getTodayStr();
  const all = await db.select().from(coachReviewsTable)
    .where(eq(coachReviewsTable.userId, USER_ID))
    .orderBy(desc(coachReviewsTable.createdAt));
  const todayReview = all.find(r => r.date === today);
  if (!todayReview) {
    res.status(404).json({ error: "No review for today" });
    return;
  }
  res.json(todayReview);
});

export default router;
