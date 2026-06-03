import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, mealsTable, userProfilesTable, plansTable } from "@workspace/db";
import { CreateMealBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { USER_ID } from "./users";

const router: IRouter = Router();

interface MealFeedback {
  feedback: string;
  score: number;
  quality: string;
  whatWasGood: string | null;
  whatWasBad: string | null;
  whatToFixNext: string;
}

const GOOD_FOODS = [
  "chicken", "turkey", "fish", "salmon", "tuna", "egg", "eggs", "tofu", "tempeh",
  "beans", "lentil", "lentils", "chickpea", "broccoli", "spinach", "kale", "veggie",
  "vegetable", "vegetables", "salad", "greens", "oats", "oatmeal", "quinoa", "brown rice",
  "sweet potato", "fruit", "berries", "berry", "apple", "banana", "yogurt", "greek yogurt",
  "cottage cheese", "almond", "almonds", "nuts", "avocado", "water", "protein", "lean",
  "grilled", "steamed", "baked",
];

const BAD_FOODS = [
  "soda", "coke", "pepsi", "candy", "cake", "donut", "doughnut", "fries", "fried",
  "burger", "cheeseburger", "pizza", "chips", "ice cream", "beer", "wine", "alcohol",
  "sugar", "sugary", "cookie", "cookies", "chocolate", "fast food", "milkshake", "shake",
  "bacon", "sausage", "processed", "white bread", "pastry", "syrup", "juice", "energy drink",
];

function detect(text: string, list: string[]): string[] {
  const lower = text.toLowerCase();
  return list.filter(k => lower.includes(k));
}

function primaryGoalLabel(goalType: string, goals: string[]): string {
  if (goals.length > 0) return goals[0];
  if (goalType === "fat_loss") return "fat loss";
  if (goalType === "muscle_gain") return "building muscle";
  return "your goal";
}

// Deterministic, goal-aware feedback from the typed description.
// Used when AI is unavailable (e.g. quota exceeded) so the feature still works.
function heuristicFeedback(description: string, goalType: string, goals: string[]): MealFeedback {
  const goalLabel = primaryGoalLabel(goalType, goals);
  const text = description.trim();

  if (!text) {
    return {
      feedback: `Photo logged. I can't break down the plate in detail right now — add a short description (e.g. "chicken, rice, broccoli") so I can score it against ${goalLabel}.`,
      score: 50,
      quality: "neutral",
      whatWasGood: "You logged the meal — tracking is the habit that wins.",
      whatWasBad: null,
      whatToFixNext: "Add a quick text description next time so the meal can be scored properly.",
    };
  }

  const good = detect(text, GOOD_FOODS);
  const bad = detect(text, BAD_FOODS);

  let score = 60 + good.length * 9 - bad.length * 14;
  score = Math.max(5, Math.min(100, score));

  const quality = score >= 70 ? "good" : score >= 45 ? "neutral" : "bad";

  const whatWasGood = good.length > 0
    ? `Solid choices: ${good.slice(0, 3).join(", ")}. That supports ${goalLabel}.`
    : null;

  const whatWasBad = bad.length > 0
    ? `${bad.slice(0, 3).join(", ")} ${bad.length === 1 ? "is" : "are"} working against ${goalLabel}.`
    : (good.length === 0 ? `Hard to tell how this serves ${goalLabel} — be more specific with portions and protein.` : null);

  let whatToFixNext: string;
  if (goalType === "fat_loss") {
    whatToFixNext = bad.length > 0
      ? "Cut the liquid calories and fried items. Lead with lean protein and vegetables."
      : "Keep protein high, watch portion size, and drink water instead of anything sweet.";
  } else if (goalType === "muscle_gain") {
    whatToFixNext = good.length > 0 && bad.length === 0
      ? "Good base — add more calories and protein (rice, eggs, milk) to actually grow."
      : "Build the plate around protein plus quality carbs. Undereating kills muscle gain.";
  } else {
    whatToFixNext = "Anchor every meal with a protein source and a vegetable, and keep snacks intentional.";
  }

  let feedback: string;
  if (quality === "bad") {
    feedback = `This one hurt your progress. ${bad.length > 0 ? `The ${bad[0]} is the problem.` : ""} You said ${goalLabel} matters — eat like it. Next meal, no excuses.`;
  } else if (quality === "good") {
    feedback = `Respectable meal for ${goalLabel}. Don't get comfortable — consistency over the whole day is what moves the needle.`;
  } else {
    feedback = `Not terrible, not great. This is a "fine" meal, and "fine" won't get you to ${goalLabel} fast. Tighten it up.`;
  }

  return { feedback, score, quality, whatWasGood, whatWasBad, whatToFixNext };
}

async function getMealFeedback(
  description: string,
  imageUrl: string | null,
  goalType: string,
  goals: string[],
  proteinTarget: number,
  calorieTarget: number,
): Promise<MealFeedback> {
  const goalsList = goals.length > 0 ? goals.join(", ") : goalType;
  try {
    const systemPrompt = `You are a strict, direct AI transformation coach. The user's primary goal type is "${goalType}" and their stated goals are: ${goalsList}. Daily targets: ${calorieTarget} calories, ${proteinTarget}g protein.

Judge the meal specifically against these goals (e.g. fat loss, gain weight, build muscle, maintain, better skin, higher energy, better sleep, discipline). If a meal photo is provided, analyze what you see in it; otherwise rely on the description.

Respond with ONLY valid JSON in this exact format:
{
  "score": 0-100 integer rating how well this meal serves the user's goals,
  "feedback": "2-3 sentence short, strict, direct coach message (no fluff)",
  "quality": "good|neutral|bad",
  "whatWasGood": "1 sentence on what was good, or null",
  "whatWasBad": "1 sentence on what hurt the goal, or null",
  "whatToFixNext": "1 actionable sentence on what to fix next meal"
}

Tone examples:
- Fat loss: "This meal is not terrible, but the soda is wasting calories. Next meal needs lean protein, water, and no extra snacks."
- Muscle gain: "Too small. You want to gain weight but this meal won't get you there. Add rice, eggs, milk, or peanut butter."
- Maintain: "Solid meal. Keep protein high and don't let random snacks push you off plan."`;

    const userText = description.trim()
      ? `Meal: ${description.trim()}`
      : "Meal: (no description provided — judge from the photo)";

    const userContent: any = imageUrl
      ? [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
        ]
      : userText;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<MealFeedback>;
    return {
      feedback: parsed.feedback ?? "Meal logged. Keep executing the basics.",
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 60,
      quality: parsed.quality ?? "neutral",
      whatWasGood: parsed.whatWasGood ?? null,
      whatWasBad: parsed.whatWasBad ?? null,
      whatToFixNext: parsed.whatToFixNext ?? "Stay consistent with your targets.",
    };
  } catch (err) {
    logger.warn({ err }, "AI meal feedback unavailable, using heuristic fallback");
    return heuristicFeedback(description, goalType, goals);
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

  const description = parsed.data.description?.trim() ?? "";
  const imageUrl = parsed.data.imageUrl ?? null;

  if (!description && !imageUrl) {
    res.status(400).json({ error: "Provide a meal description, a photo, or both." });
    return;
  }

  if (imageUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageUrl)) {
    res.status(400).json({ error: "Invalid image format." });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));

  const goalType = plan?.goalType ?? "maintain";
  const proteinTarget = plan?.proteinTargetG ?? 150;
  const calorieTarget = plan?.calorieTarget ?? 2000;
  let goals: string[] = [];
  try {
    goals = profile?.goals ? JSON.parse(profile.goals) : [];
  } catch {
    goals = [];
  }

  const feedback = await getMealFeedback(description, imageUrl, goalType, goals, proteinTarget, calorieTarget);

  const [meal] = await db.insert(mealsTable).values({
    userId: USER_ID,
    description,
    imageUrl,
    coachFeedback: feedback.feedback,
    score: feedback.score,
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
