import { Router, type IRouter, type Request } from "express";
import { eq, desc, gte, lt, and } from "drizzle-orm";
import { db, coachReviewsTable, journalEntriesTable, plansTable, userProfilesTable } from "@workspace/db";
import { openai } from "../lib/openai";
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
  "strictCoachMessage": "1-2 sentences, strict and direct, personal to what they actually reported — no generic advice"
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
    .where(eq(coachReviewsTable.userId, getUserId(req)))
    .orderBy(desc(coachReviewsTable.createdAt));
  res.json(reviews);
});

router.post("/reviews", async (req, res): Promise<void> => {
  const today = getUserToday(req);

  // Get today's journal entry
  const allEntries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, getUserId(req)))
    .orderBy(desc(journalEntriesTable.createdAt));
  const todayEntry = allEntries.find(e => e.date === today);

  if (!todayEntry) {
    res.status(400).json({ error: "Submit your journal entry first." });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));

  const generated = await generateCoachReview(todayEntry, plan, profile);

  // Upsert today's review
  const existing = (await db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, getUserId(req)))).find(r => r.date === today);

  let review;
  if (existing) {
    [review] = await db.update(coachReviewsTable).set(generated).where(eq(coachReviewsTable.id, existing.id)).returning();
  } else {
    [review] = await db.insert(coachReviewsTable).values({
      userId: getUserId(req),
      date: today,
      ...generated,
    }).returning();
  }

  res.status(201).json(review);
});

router.get("/reviews/today", async (req, res): Promise<void> => {
  const { dayStart, dayEnd } = getTodayUtcRange(req);
  const [todayReview] = await db.select().from(coachReviewsTable)
    .where(
      and(
        eq(coachReviewsTable.userId, getUserId(req)),
        gte(coachReviewsTable.createdAt, dayStart),
        lt(coachReviewsTable.createdAt, dayEnd),
      ),
    )
    .orderBy(desc(coachReviewsTable.createdAt))
    .limit(1);
  if (!todayReview) {
    res.status(404).json({ error: "No review for today" });
    return;
  }
  res.json(todayReview);
});

export default router;
