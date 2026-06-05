import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, mealsTable, userProfilesTable, plansTable } from "@workspace/db";
import { CreateMealBody, GenerateMealsBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

interface DetectedFood {
  item: string;
  serving: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

interface MealFeedback {
  feedback: string;
  score: number;
  quality: string;
  whatWasGood: string | null;
  whatWasBad: string | null;
  whatToFixNext: string;
  detectedFoods: DetectedFood[] | null;
}

const GOOD_FOODS = [
  "chicken", "turkey", "fish", "salmon", "tuna", "egg", "eggs", "tofu", "tempeh",
  "beans", "lentil", "lentils", "chickpea", "broccoli", "spinach", "kale", "veggie",
  "vegetable", "vegetables", "salad", "greens", "oats", "oatmeal", "quinoa", "brown rice",
  "sweet potato", "fruit", "berries", "berry", "apple", "banana", "yogurt", "greek yogurt",
  "cottage cheese", "almond", "almonds", "nuts", "avocado", "water", "protein", "lean",
  "grilled", "steamed", "baked",
];

// Hydration/wellness foods — good for skin, energy, recovery goals; not penalised for low protein
const HYDRATION_FOODS = [
  "coconut water", "coconut", "green tea", "herbal tea", "matcha", "electrolyte",
  "watermelon", "cucumber", "celery juice", "lemon water", "aloe", "kombucha",
];

// Goals where hydration/wellness foods should be treated positively, not penalised
const WELLNESS_GOALS = ["better skin", "clear skin", "higher energy", "better sleep", "hydration"];

const BAD_FOODS = [
  "soda", "coke", "pepsi", "candy", "cake", "donut", "doughnut", "fries", "fried",
  "burger", "cheeseburger", "pizza", "chips", "ice cream", "beer", "wine", "alcohol",
  "sugar", "sugary", "cookie", "cookies", "chocolate", "fast food", "milkshake",
  "bacon", "sausage", "processed", "white bread", "pastry", "syrup", "energy drink",
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
function heuristicFeedback(description: string, goalType: string, goals: string[], hasPhoto: boolean): MealFeedback {
  const goalLabel = primaryGoalLabel(goalType, goals);
  const text = description.trim();

  if (!text) {
    return {
      feedback: hasPhoto
        ? `Photo received, but AI vision is temporarily unavailable. Add a quick description — even just "chicken, rice, broccoli, 1 cup each" — and I'll score it against your ${goalLabel} goal.`
        : `No description provided. Tell me what you ate (food + rough amounts) so I can score it against your ${goalLabel} goal.`,
      score: 50,
      quality: "neutral",
      whatWasGood: "You logged the meal — that habit alone puts you ahead of most people.",
      whatWasBad: null,
      whatToFixNext: "Describe what you ate (food items + rough amounts) for an accurate score.",
      detectedFoods: null,
    };
  }

  const isWellnessGoal = goals.some(g => WELLNESS_GOALS.includes(g));
  const hydrationMatches = detect(text, HYDRATION_FOODS);
  const isHydrationItem = hydrationMatches.length > 0;

  // Hydration drinks with wellness goals get special handling — not scored as a full meal,
  // but not rated BAD either
  if (isHydrationItem && isWellnessGoal && detect(text, GOOD_FOODS).length === 0) {
    const drinkName = hydrationMatches[0] ?? "this drink";
    return {
      feedback: `Good for hydration and electrolytes — that supports your ${goalLabel} goal. But this isn't a complete meal. Pair it with real food and protein.`,
      score: 62,
      quality: "neutral",
      whatWasGood: `${drinkName.charAt(0).toUpperCase() + drinkName.slice(1)} supports hydration and recovery. Helpful for ${goalLabel}.`,
      whatWasBad: "Low protein and calories — not enough to count as a meal on its own.",
      whatToFixNext: "Add protein and whole food alongside this. Think eggs, Greek yogurt, or a handful of nuts.",
      detectedFoods: null,
    };
  }

  const good = detect(text, GOOD_FOODS);
  const bad = detect(text, BAD_FOODS);

  // Base score — for wellness/hydration goals, don't penalise low protein as hard
  let score: number;
  if (isWellnessGoal && goalType !== "muscle_gain") {
    // Wellness goals: score on food quality, not protein density
    score = 60 + good.length * 8 - bad.length * 14 + (isHydrationItem ? 6 : 0);
  } else if (goalType === "muscle_gain") {
    // Muscle gain: protein is critical — penalise low-protein items more
    score = 60 + good.length * 9 - bad.length * 14;
  } else {
    // Fat loss / maintain / default
    score = 60 + good.length * 9 - bad.length * 14;
  }
  score = Math.max(5, Math.min(100, score));

  const quality = score >= 70 ? "good" : score >= 45 ? "neutral" : "bad";

  const whatWasGood = good.length > 0
    ? `Solid choices: ${good.slice(0, 3).join(", ")}. That supports ${goalLabel}.`
    : isHydrationItem ? `${hydrationMatches[0]} is good for hydration.` : null;

  const whatWasBad = bad.length > 0
    ? `${bad.slice(0, 3).join(", ")} ${bad.length === 1 ? "is" : "are"} working against ${goalLabel}.`
    : (good.length === 0 && !isHydrationItem ? `Hard to tell how this serves ${goalLabel} — be more specific with portions and protein.` : null);

  let whatToFixNext: string;
  if (goalType === "fat_loss") {
    whatToFixNext = bad.length > 0
      ? "Cut the liquid calories and fried items. Lead with lean protein and vegetables."
      : "Keep protein high, watch portion size, and drink water instead of anything sweet.";
  } else if (goalType === "muscle_gain") {
    whatToFixNext = good.length > 0 && bad.length === 0
      ? "Good base — add more calories and protein (rice, eggs, milk) to actually grow."
      : "Build the plate around protein plus quality carbs. Undereating kills muscle gain.";
  } else if (isWellnessGoal) {
    whatToFixNext = "Pair this with whole foods and a protein source to make it a complete meal.";
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

  return { feedback, score, quality, whatWasGood, whatWasBad, whatToFixNext, detectedFoods: null };
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
    const mealSwaps: Record<string, string[]> = {
      fat_loss: [
        "Eggs + oatmeal + berries (~400 cal, 30g protein)",
        "Greek yogurt + fruit (~350 cal, 25g protein)",
        "Chicken rice bowl with vegetables (~500 cal, 40g protein)",
        "Tuna wrap with lettuce and tomato (~400 cal, 35g protein)",
        "Salmon + brown rice + vegetables (~500 cal, 38g protein)",
      ],
      muscle_gain: [
        "4 eggs + oatmeal + peanut butter + banana (~700 cal, 40g protein)",
        "Chicken rice bowl with olive oil + avocado (~700 cal, 48g protein)",
        "Pasta with ground beef + tomato sauce (~800 cal, 50g protein)",
        "High-calorie shake: milk + oats + banana + peanut butter (~750 cal, 35g protein)",
        "Beef burrito bowl with beans, rice, cheese (~750 cal, 45g protein)",
      ],
      maintain: [
        "Lean protein + rice or potato + vegetables (~520 cal, 38g protein)",
        "Greek yogurt + granola + berries (~380 cal, 22g protein)",
        "Chicken or fish rice bowl with salad (~500 cal, 40g protein)",
      ],
    };
    const swapOptions = (mealSwaps[goalType] ?? mealSwaps.maintain).map(o => `• ${o}`).join("\n");
    const goalCalNote = goalType === "fat_loss"
      ? `${calorieTarget} cal/day creates a moderate deficit for steady fat loss without muscle loss.`
      : goalType === "muscle_gain"
      ? `${calorieTarget} cal/day is a controlled surplus to build lean mass without excessive fat gain.`
      : `${calorieTarget} cal/day supports energy balance for your goal.`;

    const isWellnessGoal = goals.some((g: string) => WELLNESS_GOALS.includes(g));
    const systemPrompt = `You are a strict AI personal coach AND food nutrition analyzer.

USER CONTEXT:
- Plan goal: "${goalType}"
- User's selected goals: ${goalsList}
- Daily targets: ${calorieTarget} cal (${goalCalNote}), ${proteinTarget}g protein

YOUR TASK:
${imageUrl ? `1. ANALYZE THE IMAGE: Identify every visible food item. Estimate serving sizes and nutrition from what you can see.
2. Use the user's description as additional context if provided.
3. If you're uncertain about an item, make your best estimate and note it in the feedback.` : `1. Use the description to assess the meal.`}
4. Score the meal 0–100 against the user's specific goals — not just protein and calories.
5. Give direct coaching — no fluff, no praise padding.

SCORING RULES:
- fat_loss: reward calorie control + high protein + whole foods; penalize excess calories, low protein, fried/sugary food
- muscle_gain: reward calorie density + high protein; penalize undereating, low protein, missing surplus
- maintain: reward protein adequacy + balance; penalize extremes
${isWellnessGoal ? `
WELLNESS/HYDRATION GOAL RULES (user has: ${goalsList}):
- Drinks like coconut water, green tea, kombucha, lemon water are HYDRATION SUPPORT — score 55–70 (neutral), NEVER "bad"
- Do NOT penalize low protein for hydration drinks — that is not their purpose
- If a food item supports skin (antioxidants, hydration, low-glycemic), reward it
- If the logged item is ONLY a drink with no protein/food, say: "Good for hydration/electrolytes, but add protein and real food if this is a meal."
- Score these as snacks/supplements, not full meals` : ""}

CONTEXT AWARENESS — check if this is a drink, snack, or full meal:
- If it's clearly a drink or supplement (coconut water, green tea, smoothie), score it as such — not as a 3-course meal
- Don't penalize a glass of coconut water for having "no protein" if the user's goals include skin or hydration

If the meal was poor, suggest a better option from:
${swapOptions}

Respond with ONLY valid JSON in this exact format:
{
  "detectedFoods": [
    {"item": "food name", "serving": "e.g. 2 slices / ~200g", "calories": 300, "protein": 12, "carbs": 35, "fat": 10}
  ],
  "score": 0-100,
  "feedback": "2-3 sentences. ${imageUrl ? 'Start with what you detected: e.g. \\"I detected coconut water — ~50 cal, electrolytes. \\"' : ''}Give direct coaching.",
  "quality": "good|neutral|bad",
  "whatWasGood": "1 sentence or null",
  "whatWasBad": "1 sentence or null",
  "whatToFixNext": "1-2 actionable sentences. If it's a drink, say what to pair it with."
}

Tone: direct and honest — no shaming, but no false praise either.
Examples:
- Coconut water + clear skin goal: "Good hydration choice — electrolytes support skin and energy. Not a meal though. Pair it with eggs or Greek yogurt to hit protein."  score: 65, quality: "neutral"
- Fat loss bad: "The fries and soda wiped out your deficit. ~800 cal with almost no protein. Next meal: chicken + rice + broccoli." score: 20, quality: "bad"
- Fat loss good: "Solid fat-loss meal. High protein, controlled carbs, no junk." score: 85, quality: "good"
- Muscle gain too small: "Too small to move the needle. You need 600–800 cal per meal. Add rice, peanut butter, or a shake." score: 35, quality: "bad"`;


    const userText = description.trim()
      ? `Meal description: ${description.trim()}`
      : imageUrl
        ? "No description provided — analyze from the photo only."
        : "No description provided.";

    const userContent: any = imageUrl
      ? [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
        ]
      : userText;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, any>;

    let detectedFoods: DetectedFood[] | null = null;
    if (Array.isArray(parsed.detectedFoods) && parsed.detectedFoods.length > 0) {
      detectedFoods = parsed.detectedFoods.map((f: any) => ({
        item: String(f.item ?? "Unknown"),
        serving: String(f.serving ?? ""),
        calories: typeof f.calories === "number" ? Math.round(f.calories) : 0,
        protein: typeof f.protein === "number" ? Math.round(f.protein) : 0,
        ...(typeof f.carbs === "number" ? { carbs: Math.round(f.carbs) } : {}),
        ...(typeof f.fat === "number" ? { fat: Math.round(f.fat) } : {}),
      }));
    }

    return {
      feedback: parsed.feedback ?? "Meal logged. Keep executing the basics.",
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 60,
      quality: parsed.quality ?? "neutral",
      whatWasGood: parsed.whatWasGood ?? null,
      whatWasBad: parsed.whatWasBad ?? null,
      whatToFixNext: parsed.whatToFixNext ?? "Stay consistent with your targets.",
      detectedFoods,
    };
  } catch (err) {
    logger.warn({ err }, "AI meal feedback unavailable, using heuristic fallback");
    return heuristicFeedback(description, goalType, goals, !!imageUrl);
  }
}

router.get("/meals", async (req, res): Promise<void> => {
  const meals = await db.select().from(mealsTable)
    .where(eq(mealsTable.userId, getUserId(req)))
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

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));

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
    userId: getUserId(req),
    description,
    imageUrl,
    coachFeedback: feedback.feedback,
    score: feedback.score,
    quality: feedback.quality,
    whatWasGood: feedback.whatWasGood,
    whatWasBad: feedback.whatWasBad,
    whatToFixNext: feedback.whatToFixNext,
    detectedFoodsJson: feedback.detectedFoods ? JSON.stringify(feedback.detectedFoods) : null,
    calories: feedback.detectedFoods
      ? feedback.detectedFoods.reduce((s, f) => s + f.calories, 0)
      : null,
    protein: feedback.detectedFoods
      ? feedback.detectedFoods.reduce((s, f) => s + f.protein, 0)
      : null,
  }).returning();

  res.status(201).json(meal);
});

router.get("/meals/today", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meals = await db.select().from(mealsTable)
    .where(eq(mealsTable.userId, getUserId(req)))
    .orderBy(desc(mealsTable.loggedAt));
  const todayMeals = meals.filter(m => new Date(m.loggedAt) >= today);
  res.json(todayMeals);
});

interface MealOption {
  name: string;
  ingredients: string[];
  calories: number;
  protein: number;
  instructions: string;
  substitutions: string;
}

interface MealGeneratorResult {
  goal: string;
  mealType: string;
  preference?: string;
  totalCalories?: number;
  totalProtein?: number;
  options: MealOption[];
}

// Deterministic fallback: a small, fast meal generator when OpenAI is unavailable
function heuristicGenerateMeals(
  goal: string,
  mealType: string,
  preference?: string,
  availableFoods?: string,
): MealGeneratorResult {
  const userHas = (food: string): boolean => {
    if (!availableFoods) return true;
    return availableFoods.toLowerCase().includes(food);
  };

  const allRecipes = [
    { name: "Eggs + Oatmeal + Berries", goal: "fat_loss", types: ["breakfast"], cal: 400, pro: 30, ingredients: ["2 eggs", "1 cup oatmeal", "handful of berries", "splash of milk"], inst: "Scramble eggs. Cook oatmeal with milk. Top with berries.", subs: "Use egg whites or tofu instead of eggs. Use any fruit instead of berries." },
    { name: "Greek Yogurt Bowl", goal: "fat_loss", types: ["breakfast", "snack"], cal: 350, pro: 25, ingredients: ["1 cup Greek yogurt", "1 banana", "1 tbsp granola"], inst: "Mix yogurt with sliced banana. Top with granola.", subs: "Use cottage cheese or skyr instead of Greek yogurt." },
    { name: "Protein Smoothie", goal: "fat_loss", types: ["breakfast", "snack"], cal: 350, pro: 30, ingredients: ["1 scoop protein powder", "1 cup almond milk", "1 cup spinach", "1 banana"], inst: "Blend everything together.", subs: "Use any milk or juice. Add oats for thickness." },
    { name: "Chicken Rice Bowl", goal: "fat_loss", types: ["lunch", "dinner"], cal: 500, pro: 40, ingredients: ["150g chicken breast", "1/2 cup rice", "1 cup mixed vegetables", "soy sauce"], inst: "Grill or pan-fry chicken. Cook rice. Steam or stir-fry vegetables.", subs: "Use turkey, tofu, or canned tuna instead of chicken." },
    { name: "Tuna Wrap", goal: "fat_loss", types: ["lunch", "dinner"], cal: 400, pro: 35, ingredients: ["1 can tuna", "1 whole-grain wrap", "lettuce", "tomato", "light mayo"], inst: "Mix tuna with light mayo. Fill wrap with lettuce and tomato.", subs: "Use chicken, turkey, or hummus instead of tuna." },
    { name: "Salmon + Veggies", goal: "fat_loss", types: ["dinner"], cal: 500, pro: 38, ingredients: ["150g salmon", "1 cup broccoli", "1/2 sweet potato"], inst: "Bake salmon. Steam broccoli. Bake or microwave sweet potato.", subs: "Use any fish or chicken instead of salmon." },
    { name: "Lean Beef Stir Fry", goal: "fat_loss", types: ["dinner"], cal: 480, pro: 42, ingredients: ["150g lean beef", "1 cup bell peppers", "1 cup snap peas", "soy sauce", "1/2 cup rice"], inst: "Stir-fry beef and vegetables. Serve over rice.", subs: "Use chicken, turkey, or tofu instead of beef." },
    { name: "Protein Shake + Apple", goal: "fat_loss", types: ["snack"], cal: 250, pro: 28, ingredients: ["1 scoop protein powder", "water", "1 apple"], inst: "Shake protein powder with water. Eat apple.", subs: "Use any fruit instead of apple." },
    { name: "Cottage Cheese + Fruit", goal: "fat_loss", types: ["snack"], cal: 200, pro: 22, ingredients: ["1 cup cottage cheese", "1/2 cup pineapple or berries"], inst: "Top cottage cheese with fruit.", subs: "Use Greek yogurt instead of cottage cheese." },
    { name: "High-Calorie Breakfast Bowl", goal: "muscle_gain", types: ["breakfast"], cal: 700, pro: 40, ingredients: ["4 eggs", "1 cup oatmeal", "2 tbsp peanut butter", "1 banana", "1 cup milk"], inst: "Scramble eggs. Cook oatmeal with milk. Stir in peanut butter. Top with banana.", subs: "Use any nut butter instead of peanut butter. Add protein powder to oats." },
    { name: "Greek Yogurt Power Bowl", goal: "muscle_gain", types: ["breakfast", "snack"], cal: 650, pro: 35, ingredients: ["1.5 cups Greek yogurt", "1/2 cup granola", "1 banana", "1 tbsp honey"], inst: "Mix yogurt with banana, granola, and honey.", subs: "Use cottage cheese or skyr instead of yogurt." },
    { name: "Mass Gainer Shake", goal: "muscle_gain", types: ["breakfast", "snack"], cal: 750, pro: 35, ingredients: ["1.5 cups milk", "1/2 cup oats", "1 banana", "2 tbsp peanut butter", "1 scoop protein powder"], inst: "Blend everything together.", subs: "Use any milk or juice. Add Greek yogurt for extra protein." },
    { name: "Chicken + Rice + Avocado", goal: "muscle_gain", types: ["lunch", "dinner"], cal: 700, pro: 48, ingredients: ["200g chicken breast", "1 cup rice", "1/2 avocado", "olive oil", "vegetables"], inst: "Cook chicken and rice. Add avocado and vegetables. Drizzle with olive oil.", subs: "Use beef, turkey, or tofu instead of chicken." },
    { name: "Pasta with Beef", goal: "muscle_gain", types: ["lunch", "dinner"], cal: 800, pro: 50, ingredients: ["150g ground beef", "1.5 cups pasta", "tomato sauce", "parmesan"], inst: "Cook pasta. Brown beef. Add sauce. Serve with parmesan.", subs: "Use chicken or turkey instead of beef." },
    { name: "Beef Burrito Bowl", goal: "muscle_gain", types: ["lunch", "dinner"], cal: 750, pro: 45, ingredients: ["150g lean beef", "1 cup rice", "1/2 cup beans", "cheese", "salsa", "vegetables"], inst: "Cook beef and rice. Assemble bowl with beans, cheese, salsa, and vegetables.", subs: "Use chicken or turkey instead of beef." },
    { name: "Steak + Potato + Veggies", goal: "muscle_gain", types: ["dinner"], cal: 780, pro: 52, ingredients: ["180g lean steak", "1 large potato", "1 cup vegetables", "olive oil"], inst: "Grill steak. Bake potato. Steam vegetables.", subs: "Use any lean protein instead of steak." },
    { name: "Peanut Butter Toast + Milk", goal: "muscle_gain", types: ["snack"], cal: 400, pro: 18, ingredients: ["2 slices whole grain bread", "2 tbsp peanut butter", "1 cup milk"], inst: "Toast bread. Spread peanut butter. Drink milk.", subs: "Use any nut butter or hummus. Use any milk or protein shake." },
    { name: "Tuna Sandwich + Shake", goal: "muscle_gain", types: ["snack", "lunch"], cal: 500, pro: 35, ingredients: ["1 can tuna", "2 slices whole grain bread", "1 scoop protein powder", "1 cup water"], inst: "Make tuna sandwich. Mix protein shake.", subs: "Use chicken or turkey instead of tuna." },
    { name: "Balanced Breakfast Plate", goal: "maintain", types: ["breakfast"], cal: 450, pro: 28, ingredients: ["3 eggs", "2 slices whole grain toast", "1 piece of fruit"], inst: "Cook eggs to preference. Toast bread. Serve with fruit.", subs: "Use any protein source instead of eggs." },
    { name: "Greek Yogurt + Granola", goal: "maintain", types: ["breakfast", "snack"], cal: 380, pro: 22, ingredients: ["1 cup Greek yogurt", "1/2 cup granola", "1/2 cup berries"], inst: "Mix yogurt with granola and berries.", subs: "Use cottage cheese or skyr instead of yogurt." },
    { name: "Chicken or Fish Bowl", goal: "maintain", types: ["lunch", "dinner"], cal: 520, pro: 40, ingredients: ["150g chicken or fish", "1/2 cup rice", "mixed salad", "olive oil"], inst: "Cook protein and rice. Serve with salad and olive oil.", subs: "Use any lean protein. Use any grain or potato." },
    { name: "Turkey Wrap", goal: "maintain", types: ["lunch", "dinner"], cal: 450, pro: 32, ingredients: ["150g turkey", "1 whole grain wrap", "lettuce", "tomato", "light dressing"], inst: "Fill wrap with turkey, lettuce, and tomato. Add dressing.", subs: "Use chicken or tuna instead of turkey." },
    { name: "Stir Fry with Lean Meat", goal: "maintain", types: ["dinner"], cal: 480, pro: 38, ingredients: ["150g lean meat", "1 cup mixed vegetables", "1/2 cup rice", "soy sauce"], inst: "Stir-fry meat and vegetables. Serve over rice.", subs: "Use any protein instead of lean meat." },
    { name: "Protein Shake + Nuts", goal: "maintain", types: ["snack"], cal: 300, pro: 28, ingredients: ["1 scoop protein powder", "1 cup water", "handful of nuts"], inst: "Mix protein shake. Eat nuts.", subs: "Use any fruit instead of nuts." },
  ];

  let filtered = allRecipes.filter(r => r.types.includes(mealType) && (r.goal === goal || goal === "maintain"));
  if (filtered.length === 0) {
    filtered = allRecipes.filter(r => r.types.includes(mealType) || r.types.includes("lunch"));
  }
  if (filtered.length === 0) {
    filtered = allRecipes.slice(0, 5);
  }

  // If user has available foods, prefer recipes that match
  if (availableFoods) {
    filtered.sort((a, b) => {
      const aMatch = a.ingredients.filter(i => userHas(i.split(" ").pop() || i)).length;
      const bMatch = b.ingredients.filter(i => userHas(i.split(" ").pop() || i)).length;
      return bMatch - aMatch;
    });
  }

  // If preference is set, bias the calorie/protein
  const options: MealOption[] = filtered.slice(0, 5).map(r => {
    let cal = r.cal;
    let pro = r.pro;
    if (preference === "high_protein") {
      pro = Math.round(pro * 1.2);
      cal = Math.round(cal * 1.05);
    } else if (preference === "cheap") {
      cal = Math.round(cal * 0.95);
      pro = Math.round(pro * 0.95);
    } else if (preference === "quick") {
      cal = Math.round(cal * 0.95);
    } else if (preference === "athlete_friendly") {
      cal = Math.round(cal * 1.15);
      pro = Math.round(pro * 1.15);
    }
    return {
      name: r.name,
      ingredients: r.ingredients,
      calories: cal,
      protein: pro,
      instructions: r.inst,
      substitutions: r.subs,
    };
  });

  let totalCalories: number | undefined;
  let totalProtein: number | undefined;
  if (mealType === "full_day") {
    totalCalories = options.reduce((sum, o) => sum + o.calories, 0);
    totalProtein = options.reduce((sum, o) => sum + o.protein, 0);
  }

  return { goal, mealType, preference, options, totalCalories, totalProtein };
}

async function generateMealsWithAI(
  goal: string,
  mealType: string,
  preference?: string,
  availableFoods?: string,
): Promise<MealGeneratorResult> {
  const prefText = preference ? ` The user wants ${preference} meals.` : "";
  const availText = availableFoods ? ` They have these foods available: ${availableFoods}.` : "";
  const calTarget = goal === "fat_loss" ? "1,800-2,200" : goal === "muscle_gain" ? "2,800-3,200" : "2,200-2,600";
  const proTarget = goal === "fat_loss" ? "120-160" : goal === "muscle_gain" ? "160-200" : "120-150";
  const typeNote = mealType === "full_day" ? "a full-day meal plan with breakfast, lunch, dinner, and 1-2 snacks." : `3-5 meal options for ${mealType}.`;

  try {
    const prompt = `You are a strict, practical AI nutrition coach. Generate ${typeNote}

Goal: ${goal}${prefText}${availText}
Daily targets to stay near: ${calTarget} calories, ${proTarget}g protein.

Each meal must include:
- name
- ingredients (simple, short list)
- estimated calories
- estimated protein
- 1-2 sentence instructions
- substitutions if they don't have the exact ingredients

Safety rules:
- No meal under 150 calories.
- No starvation or extreme diets.
- No meals over 1,200 calories unless it's a bulking shake.
- Keep portions realistic for a single person.

Respond ONLY as valid JSON:
{
  "options": [
    {
      "name": "Meal Name",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "calories": 400,
      "protein": 30,
      "instructions": "Short cooking steps.",
      "substitutions": "If you don't have X, use Y or Z."
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { options?: MealOption[] };
    const options = (parsed.options ?? []).map(o => ({
      name: o.name ?? "Meal",
      ingredients: Array.isArray(o.ingredients) ? o.ingredients : ["See instructions"],
      calories: typeof o.calories === "number" ? Math.round(o.calories) : 400,
      protein: typeof o.protein === "number" ? Math.round(o.protein) : 30,
      instructions: o.instructions ?? "Prepare as described.",
      substitutions: o.substitutions ?? "Use any similar protein or vegetable.",
    }));

    let totalCalories: number | undefined;
    let totalProtein: number | undefined;
    if (mealType === "full_day" && options.length > 0) {
      totalCalories = options.reduce((sum, o) => sum + o.calories, 0);
      totalProtein = options.reduce((sum, o) => sum + o.protein, 0);
    }

    return { goal, mealType, preference, options, totalCalories, totalProtein };
  } catch (err) {
    logger.warn({ err }, "AI meal generator unavailable, using heuristic fallback");
    return heuristicGenerateMeals(goal, mealType, preference, availableFoods);
  }
}

router.post("/meals/generate", async (req, res): Promise<void> => {
  const parsed = GenerateMealsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goal, mealType, preference, availableFoods } = parsed.data;
  const result = await generateMealsWithAI(goal, mealType, preference ?? undefined, availableFoods ?? undefined);
  res.json(result);
});

export default router;
