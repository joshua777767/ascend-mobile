import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, weighInsTable, plansTable } from "@workspace/db";
import { CreateWeighInBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { USER_ID } from "./users";

const router: IRouter = Router();

async function getAdjustment(weightKg: number, previousWeightKg: number | null, goalType: string, goalWeightKg: number): Promise<{
  adjustment: string; coachMessage: string;
}> {
  try {
    const diff = previousWeightKg !== null ? weightKg - previousWeightKg : 0;
    const distToGoal = Math.abs(weightKg - goalWeightKg);

    const prompt = `Strict transformation coach. Goal type: ${goalType}. Goal weight: ${goalWeightKg}kg. Current weight: ${weightKg}kg. Last week's weight: ${previousWeightKg ?? "unknown"}. Change: ${diff > 0 ? "+" : ""}${diff.toFixed(1)}kg. Distance to goal: ${distToGoal.toFixed(1)}kg.

Respond as JSON ONLY:
{
  "adjustment": "1-2 sentence specific plan adjustment based on the pace",
  "coachMessage": "2-3 sentence strict, direct coach response to this weigh-in result"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    });

    return JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch {
    return {
      adjustment: "Stay the course. Consistency over the next 7 days.",
      coachMessage: "Weigh-in logged. Keep executing the basics: protein, sleep, training. The scale follows the habits.",
    };
  }
}

router.get("/weigh-ins", async (req, res): Promise<void> => {
  const weighins = await db.select().from(weighInsTable)
    .where(eq(weighInsTable.userId, USER_ID))
    .orderBy(desc(weighInsTable.loggedAt));
  res.json(weighins);
});

router.post("/weigh-ins", async (req, res): Promise<void> => {
  const parsed = CreateWeighInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));
  const previous = await db.select().from(weighInsTable)
    .where(eq(weighInsTable.userId, USER_ID))
    .orderBy(desc(weighInsTable.loggedAt));

  const prevWeight = previous.length > 0 ? previous[0].weightKg : null;
  const weekNumber = previous.length + 1;
  const goalType = plan?.goalType ?? "maintain";
  const goalWeightKg = 70; // fallback

  const { adjustment, coachMessage } = await getAdjustment(parsed.data.weightKg, prevWeight, goalType, goalWeightKg);

  const [weighIn] = await db.insert(weighInsTable).values({
    userId: USER_ID,
    weightKg: parsed.data.weightKg,
    weekNumber,
    adjustment,
    coachMessage,
  }).returning();

  res.status(201).json(weighIn);
});

export default router;
