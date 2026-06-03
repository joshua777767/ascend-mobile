import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, weighInsTable, plansTable, userProfilesTable } from "@workspace/db";
import { CreateWeighInBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

async function getAdjustment(weightKg: number, previousWeightKg: number | null, goalType: string, goalWeightKg: number): Promise<{
  adjustment: string; coachMessage: string;
}> {
  try {
    const toLbs = (kg: number) => Math.round(kg * 2.2046226 * 10) / 10;
    const diffLbs = previousWeightKg !== null ? toLbs(weightKg - previousWeightKg) : 0;
    const distToGoalLbs = toLbs(Math.abs(weightKg - goalWeightKg));

    const prompt = `Strict transformation coach. Goal type: ${goalType}. Goal weight: ${toLbs(goalWeightKg)} lbs. Current weight: ${toLbs(weightKg)} lbs. Last week's weight: ${previousWeightKg !== null ? toLbs(previousWeightKg) + " lbs" : "unknown"}. Change: ${diffLbs > 0 ? "+" : ""}${diffLbs.toFixed(1)} lbs. Distance to goal: ${distToGoalLbs.toFixed(1)} lbs. Always reference weight in pounds (lbs), never kilograms.

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
    .where(eq(weighInsTable.userId, getUserId(req)))
    .orderBy(desc(weighInsTable.loggedAt));
  res.json(weighins);
});

router.post("/weigh-ins", async (req, res): Promise<void> => {
  const parsed = CreateWeighInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  const previous = await db.select().from(weighInsTable)
    .where(eq(weighInsTable.userId, getUserId(req)))
    .orderBy(desc(weighInsTable.loggedAt));

  const prevWeight = previous.length > 0 ? previous[0].weightKg : null;
  const weekNumber = previous.length + 1;
  const goalType = plan?.goalType ?? "maintain";
  const goalWeightKg = profile?.goalWeightKg ?? plan?.calorieTarget ?? 70;

  const { adjustment, coachMessage } = await getAdjustment(parsed.data.weightKg, prevWeight, goalType, goalWeightKg);

  const [weighIn] = await db.insert(weighInsTable).values({
    userId: getUserId(req),
    weightKg: parsed.data.weightKg,
    weekNumber,
    adjustment,
    coachMessage,
  }).returning();

  res.status(201).json(weighIn);
});

export default router;
