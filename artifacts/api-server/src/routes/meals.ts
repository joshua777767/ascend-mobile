import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, mealsTable, userProfilesTable, plansTable } from "@workspace/db";
import { CreateMealBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { USER_ID } from "./users";

const router: IRouter = Router();

async function getMealFeedback(description: string, goalType: string, proteinTarget: number, calorieTarget: number): Promise<{
  feedback: string; quality: string; whatWasGood: string; whatWasBad: string; whatToFixNext: string;
}> {
  try {
    const systemPrompt = `You are a strict, direct AI transformation coach. Goal type: ${goalType}. Daily targets: ${calorieTarget} calories, ${proteinTarget}g protein.

Analyze the meal and respond with ONLY valid JSON in this exact format:
{
  "feedback": "2-3 sentence coach response (strict, direct, safe, no fluff)",
  "quality": "good|neutral|bad",
  "whatWasGood": "1 sentence or null",
  "whatWasBad": "1 sentence or null",
  "whatToFixNext": "1 actionable sentence"
}

Tone examples:
- Fat loss: "This meal is not terrible, but the soda is wasting calories. Next meal needs lean protein, water, and no extra snacks."
- Muscle gain: "Too small. You want to gain weight but this meal won't get you there. Add rice, eggs, milk, or peanut butter."
- Maintain: "Solid meal. Keep protein high and don't let random snacks push you off plan."`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Meal: ${description}` }
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return {
      feedback: "Log your meals consistently. Every meal is data.",
      quality: "neutral",
      whatWasGood: null as any,
      whatWasBad: null as any,
      whatToFixNext: "Stay consistent with your targets.",
    };
  }
}

router.get("/meals", async (req, res): Promise<void> => {
  const meals = await db.select().from(mealsTable)
    .where(eq(mealsTable.userId, USER_ID))
    .orderBy(desc(mealsTable.loggedAt));
  res.json(meals);
});

router.post("/meals", async (req, res): Promise<void> => {
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));

  const goalType = plan?.goalType ?? "maintain";
  const proteinTarget = plan?.proteinTargetG ?? 150;
  const calorieTarget = plan?.calorieTarget ?? 2000;

  const feedback = await getMealFeedback(parsed.data.description, goalType, proteinTarget, calorieTarget);

  const [meal] = await db.insert(mealsTable).values({
    userId: USER_ID,
    description: parsed.data.description,
    coachFeedback: feedback.feedback,
    quality: feedback.quality,
    whatWasGood: feedback.whatWasGood,
    whatWasBad: feedback.whatWasBad,
    whatToFixNext: feedback.whatToFixNext,
  }).returning();

  res.status(201).json(meal);
});

router.get("/meals/today", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meals = await db.select().from(mealsTable)
    .where(eq(mealsTable.userId, USER_ID))
    .orderBy(desc(mealsTable.loggedAt));
  const todayMeals = meals.filter(m => new Date(m.loggedAt) >= today);
  res.json(todayMeals);
});

export default router;
