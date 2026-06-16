import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, mealsTable, userProfilesTable, plansTable, waterLogsTable } from "@workspace/db";
import { CreateMealBody, GenerateMealsBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId, getUserToday } from "../middlewares/auth";

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
  "steak", "beef", "pork", "shrimp", "lamb", "bison",
  "beans", "lentil", "lentils", "chickpea", "broccoli", "spinach", "kale", "veggie",
  "vegetable", "vegetables", "salad", "greens", "oats", "oatmeal", "quinoa", "brown rice",
  "sweet potato", "fruit", "berries", "berry", "apple", "banana", "yogurt", "greek yogurt",
  "cottage cheese", "cheese", "almond", "almonds", "nuts", "avocado", "water", "protein", "lean",
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
    whatToFixNext = good.length > 0
      ? "Keep the quality up — add variety with different vegetables and whole foods across the day."
      : "Anchor your meals with a protein source and a vegetable to support your wellness goals.";
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

// Keywords in a description that rule out plain water (other drinks)
const NOT_PLAIN_WATER_KEYWORDS = [
  "coconut water", "coconut", "juice", "soda", "coke", "pepsi", "milk",
  "smoothie", "shake", "protein shake", "electrolyte", "gatorade", "coffee",
  "espresso", "beer", "wine", "alcohol", "sports drink", "flavored water",
  "flavored", "kombucha", "lemonade",
];

// Any food present → definitely not plain water. This guard prevents "steak and water"
// or "banana + water bottle" from being intercepted as a water log.
const FOOD_PRESENT_KEYWORDS = [
  // proteins
  "steak", "beef", "chicken", "turkey", "fish", "salmon", "tuna", "shrimp", "lamb",
  "pork", "bacon", "sausage", "egg", "eggs", "tofu", "tempeh",
  // fruit & veg
  "banana", "apple", "orange", "mango", "grape", "berry", "berries", "avocado",
  "broccoli", "spinach", "kale", "salad", "vegetable", "vegetables", "veggie",
  "potato", "sweet potato", "carrot", "cucumber", "tomato", "onion", "pepper",
  // grains & carbs
  "rice", "pasta", "bread", "oat", "oatmeal", "cereal", "tortilla", "wrap",
  "sandwich", "burger", "pizza", "fries", "chips", "cracker",
  // dairy / other food
  "yogurt", "cheese", "cottage cheese", "butter", "cream",
  // general meal terms
  "meal", "food", "snack", "lunch", "dinner", "breakfast", "brunch",
  "plate", "bowl", "dish",
];

// Container-size heuristic for oz estimate
const CONTAINER_OZ: [string, number][] = [
  ["gallon", 128],
  ["nalgene", 32],
  ["large bottle", 32],
  ["32 oz", 32],
  ["24 oz", 24],
  ["20 oz", 20],
  ["16 oz", 16],
  ["water bottle", 20],
  ["shaker", 20],
  ["sports bottle", 24],
  ["tall glass", 16],
  ["large glass", 16],
  ["big glass", 16],
  ["glass", 12],
  ["mug", 12],
  ["cup", 8],
  ["small glass", 8],
];

function descriptionOzEstimate(text: string): number {
  const lower = text.toLowerCase();
  for (const [key, oz] of CONTAINER_OZ) {
    if (lower.includes(key)) return oz;
  }
  return 12;
}

interface WaterDetection {
  isWater: boolean;
  oz: number;
  confidence: "high" | "low";
}

// Returns true if the description text mentions any food item alongside water.
// Used to detect "steak + water" style mixed descriptions.
function descriptionHasFood(lower: string): boolean {
  return FOOD_PRESENT_KEYWORDS.some(k => lower.includes(k));
}

// Returns true if the description text contains ONLY plain water (no food, no other drinks).
function descriptionIsOnlyWater(lower: string): boolean {
  if (descriptionHasFood(lower)) return false;
  if (NOT_PLAIN_WATER_KEYWORDS.some(k => lower.includes(k))) return false;
  return ["water bottle", "glass of water", "cup of water", "water", "h2o"].some(k => lower.includes(k));
}

async function detectPlainWater(description: string, imageUrl: string | null): Promise<WaterDetection> {
  const lower = description.toLowerCase();

  // FOOD GUARD: any food keyword in the description → definitely not plain water.
  // Handles "steak and water", "banana + water bottle", etc.
  if (descriptionHasFood(lower)) {
    return { isWater: false, oz: 0, confidence: "high" };
  }

  // Other drinks (juice, soda, coffee…) also rule out plain water
  if (NOT_PLAIN_WATER_KEYWORDS.some(k => lower.includes(k))) {
    return { isWater: false, oz: 0, confidence: "high" };
  }

  const onlyWaterInText = descriptionIsOnlyWater(lower);

  // No photo — rely purely on text
  if (!imageUrl) {
    return {
      isWater: onlyWaterInText,
      oz: onlyWaterInText ? descriptionOzEstimate(lower) : 0,
      confidence: "high",
    };
  }

  // Photo present — use AI, but with explicit food-exclusion rules
  try {
    const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" } }> = [
      { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
    ];
    if (description.trim()) {
      userContent.unshift({ type: "text", text: `Description: ${description.trim()}` });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are classifying ONE thing: does this image contain ONLY plain water — and nothing else?

RULE 1 — FOOD OVERRIDES EVERYTHING: If you see ANY food item — fruit, meat, vegetables, bread, a plate of food, a bowl with food, a snack, or any edible solid — return {"isWater": false, "oz": 0, "confidence": "high"} IMMEDIATELY, even if a water glass or bottle is also visible in the image.

RULE 2 — MIXED CONTENT = NOT WATER: A glass of water next to a steak is NOT a water-only image. A banana with a water bottle is NOT a water-only image. Only return isWater=true when the ENTIRE image is a water container with plain water and nothing else.

RULE 3 — PLAIN WATER ONLY: isWater=true ONLY when the image shows ONLY a cup, glass, bottle, tumbler, jug, or shaker containing clear/colorless plain water — tap water, filtered water, sparkling water. No food, no other beverages, nothing else.

NOT plain water: coconut water, juice, soda, milk, smoothie, shake, coffee, tea, beer, wine, sports drinks.

Container oz estimates: small cup=8, standard glass=12, large glass/tumbler=16, water bottle=20, large bottle/Nalgene=32. Default=12.

confidence:
- "high": contents are clearly plain water only, OR clearly NOT (food visible, colorful liquid, etc.)
- "low": liquid color ambiguous AND no food visible AND you are genuinely unsure

Respond ONLY with valid JSON: {"isWater": true|false, "oz": <number>, "confidence": "high"|"low"}`,
        },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const isWater = parsed.isWater === true;
    const oz = typeof parsed.oz === "number" && parsed.oz >= 1 && parsed.oz <= 256
      ? Math.round(parsed.oz)
      : 12;
    const confidence: "high" | "low" = parsed.confidence === "low" ? "low" : "high";

    logger.info({ isWater, oz, confidence }, "Plain water detection");
    return { isWater, oz, confidence };
  } catch (err) {
    logger.warn({ err }, "Water detection AI failed, falling back to heuristic");
    return { isWater: onlyWaterInText, oz: onlyWaterInText ? descriptionOzEstimate(lower) : 0, confidence: "high" };
  }
}

// ─── Side-beverage detection (food + water in the same image) ────────────────
// Unlike detectPlainWater(), which intercepts *water-only* submissions, this
// function runs AFTER the meal has been identified and logged.  It looks for a
// water glass / bottle that appears alongside the food in the photo.

interface SideBeverageDetection {
  detected: boolean;
  drinkType: "water" | "other" | "unclear";
  oz: number;
  confidence: "high" | "low";
}

async function detectSideBeverageInPhoto(
  imageUrl: string,
  description: string,
): Promise<SideBeverageDetection> {
  try {
    const userContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" } }
    > = [{ type: "image_url", image_url: { url: imageUrl, detail: "low" } }];
    if (description.trim()) {
      userContent.unshift({ type: "text", text: `User description: ${description.trim()}` });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are analyzing a meal photo that contains food. Your ONLY task is to detect whether a beverage container (glass, cup, bottle, tumbler) is ALSO visible alongside the food.

Do NOT describe the food — only look for a drink container.

drinkType values:
- "water"  : clear/colorless liquid in a glass, bottle, or cup. Sparkling/carbonated water is OK.
- "other"  : any colored liquid — soda, juice, milk, coffee, tea, beer, smoothie, shake, sports drink. Do NOT call these water.
- "unclear": a container is visible but the liquid type cannot be determined (opaque cup, dark thermos, no liquid visible).
- "none"   : no beverage container is visible in the image.

Container oz estimates: small cup/glass = 8, standard glass = 12, large glass/tumbler = 16, water bottle = 20, large Nalgene/bottle = 32. Default to 12 if unsure.

confidence:
- "high": liquid color is unambiguous (clearly water OR clearly not water)
- "low" : container visible but contents ambiguous

If drinkType is "none" or "other", set detected=false and oz=0.

Respond ONLY with valid JSON: {"detected": true|false, "drinkType": "water"|"other"|"unclear"|"none", "oz": <number>, "confidence": "high"|"low"}`,
        },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const rawType = String(parsed.drinkType ?? "none");
    const drinkType = (["water", "other", "unclear", "none"].includes(rawType) ? rawType : "none") as
      | "water"
      | "other"
      | "unclear"
      | "none";

    if (drinkType === "none" || drinkType === "other") {
      return { detected: false, drinkType: "other", oz: 0, confidence: "high" };
    }

    const oz =
      typeof parsed.oz === "number" && parsed.oz >= 1 && parsed.oz <= 256
        ? Math.round(parsed.oz)
        : 12;
    const confidence: "high" | "low" = parsed.confidence === "low" ? "low" : "high";
    logger.info({ drinkType, oz, confidence }, "Side beverage detection");
    return { detected: true, drinkType: drinkType as "water" | "unclear", oz, confidence };
  } catch (err) {
    logger.warn({ err }, "Side beverage detection failed, skipping");
    return { detected: false, drinkType: "other", oz: 0, confidence: "high" };
  }
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

STEP 1 — CLASSIFY what was logged:
Before scoring, decide: is this a SNACK, DRINK, or FULL MEAL?
- FULL MEAL: ANYTHING described as "breakfast", "lunch", "dinner", or "brunch" — even if it's a light plate. Also: 2+ distinct foods logged together, or any description with a protein source + carb/veg.
- SNACK: a single whole food with no meal-time label (banana, apple, nuts, rice cake, energy bar). Yogurt and oats alone may be snacks ONLY if NOT described as breakfast.
- DRINK: liquid only (water, juice, coconut water, tea, coffee, protein shake)

CRITICAL: If the user says "breakfast", "lunch", "dinner", or "it's my [meal]" — classify as FULL MEAL. NEVER say "not a complete meal" for anything the user identified as a meal or breakfast.

STEP 2 — SCORE using the correct standard for the type:

SNACK scoring:
- A snack is NOT judged as a full meal. Never penalize a snack for missing protein unless it was explicitly logged as a meal.
- Healthy whole-food snacks (banana, apple, berries, nuts, Greek yogurt, oats): score 70–90 depending on goal fit.
- Low protein is expected in snacks — note it briefly but do NOT let it drag the score below 65.
- Junk snacks (chips, candy, cookies, donuts): score 30–55.
- NEVER score a banana or single piece of fruit below 65 unless logged as "meal" with a strict muscle-gain goal.

FULL MEAL scoring:
- fat_loss: reward calorie control + high protein + whole foods; penalize excess calories, low protein, fried/sugary food
- muscle_gain: reward calorie density + high protein; penalize undereating, low protein, missing surplus
- maintain: reward protein adequacy + balance; penalize extremes

DRINK scoring: 50–70 (neutral). Never score a standalone drink as "bad" unless pure sugar/alcohol.
${isWellnessGoal ? `
WELLNESS/SKIN/ENERGY GOAL BOOST (user has: ${goalsList}):
- Fruit (banana, berries, mango, citrus) = micronutrients + antioxidants → add 5–10 pts
- Hydration drinks (coconut water, lemon water, green tea) = score 60–70, NEVER "bad"
- Do NOT penalize low protein for drinks or fruit snacks
- Banana for clear skin/energy goals: score 78–88` : ""}

GOAL-SPECIFIC snack rules:
- fat_loss + fruit snack: low-cal, clean carbs — good snack. Score 72–82. Note protein pairing.
- muscle_gain + fruit snack: fine as pre/post-workout fuel. Score 68–75. Note: low protein, not a standalone meal.
- maintain/energy/skin + fruit snack: excellent. Score 80–88.

CHEESE & DAIRY — goal-aware rules (IMPORTANT):
Cheese is a real protein and fat source. ~1 oz / 28g of cheese = ~7g protein, ~9g fat, ~110 cal. Never ignore its protein contribution.
- muscle_gain: extra cheese = more protein + calories → beneficial. Acknowledge it positively: "The cheese adds ~7g protein — good for your surplus."
- fat_loss: cheese adds protein (good for satiety) but also calories — note both: "Cheese adds protein which helps satiety, but watch the portion — ~110 cal/oz adds up."
- better skin / clear skin: dairy affects people differently. Do NOT assume it is bad. Say: "Some people notice dairy affects their skin — if you've seen a pattern, it's worth tracking. Otherwise, the protein from cheese is a positive here."
- maintain / energy / sleep: cheese is neutral-to-positive — protein and fat are fine. No need to flag it.
NEVER mark cheese alone as "bad" or put it in whatWasBad unless the overall meal is already a junk context (e.g. cheeseburger + fries + soda). Extra cheese on a whole-food meal is NEVER a negative.

If the logged item was poor, suggest a better option from:
${swapOptions}

CALORIE & MACRO ANCHORS — use these exact values as reference (USDA FoodData Central):
EGGS & DAIRY
- 1 large egg (no fat added): 70 cal, 6g protein, 0g carbs, 5g fat
- 2 large scrambled eggs (no oil/butter): 140 cal, 12g protein — do NOT add cooking-fat calories unless butter/oil is explicitly mentioned
- 2 large scrambled eggs with 1 tsp butter: 175 cal, 12g protein
- 1 cup plain nonfat Greek yogurt: 130 cal, 22g protein
- 1 cup whole milk: 149 cal, 8g protein
- 1oz cheddar/shredded cheese: 110 cal, 7g protein, 9g fat
- 2 tbsp sour cream: 60 cal, 1g protein

MEAT & FISH
- 1oz grilled chicken breast (no skin): ~46 cal, 8.5g protein
- 6oz grilled chicken breast: 280 cal, 52g protein
- 8oz ribeye steak grilled: 544 cal, 64g protein, 0g carbs, 30g fat  ← high protein, do not undercount
- 4oz ground beef 80/20 cooked: 290 cal, 22g protein
- 3oz canned tuna in water: 100 cal, 22g protein
- 1 strip cooked bacon: 43 cal, 3g protein

GRAINS & STARCHES
- 1 cup cooked white rice: 205 cal, 4g protein, 45g carbs
- 1 cup cooked oatmeal (water): 158 cal, 6g protein, 27g carbs
- 1 medium potato baked: 161 cal, 4g protein
- 1 cup cooked pasta: 220 cal, 8g protein (before sauce)

FRUITS & VEGETABLES
- 1 medium banana: 105 cal, 1g protein
- 1/2 medium avocado (~68g flesh): 115 cal, 1g protein, 10g fat
- 1 cup broccoli: 55 cal, 4g protein
- 1 cup mixed salad greens: 10 cal, 1g protein

FATS & SAUCES — these are calorie-dense, do NOT undercount:
- 1 tbsp olive oil / any cooking oil: 120 cal, 0g protein, 14g fat
- 1 tbsp butter: 102 cal, 0g protein, 12g fat
- 2 tbsp peanut butter: 190 cal, 7g protein, 16g fat
- 2 tbsp Caesar dressing: 160 cal, 1g protein — restaurant salads typically use 3-4 tbsp (~240-320 cal from dressing alone)
- 2 tbsp ranch: 130 cal
- 1 tbsp mayo: 94 cal

COMMON FAST FOOD & RESTAURANT (use chain data, NOT home-cooked estimates):
- McDonald's large fries: 490 cal, 6g protein
- McDonald's Big Mac: 550 cal, 25g protein
- 1 slice pepperoni pizza (standard chain): 285 cal, 12g protein, 36g carbs
- Chipotle chicken burrito bowl (rice + beans + chicken + cheese + sour cream + salsa): 850-950 cal, 48-55g protein — always use upper range for full bowls with cheese + sour cream
- Chipotle chicken burrito (same + tortilla): 1050+ cal
- Subway 6-inch turkey on wheat (no extras): 270-280 cal, 18g protein
- Subway 6-inch turkey with standard veggies: 280-300 cal (do NOT add extra calories for plain lettuce/tomato/cucumber)
- Starbucks Grande Latte (whole milk): 190 cal; oat milk: 170 cal; nonfat: 130 cal

BAKED GOODS & SWEETS — these are often underestimated:
- Glazed donut: 250 cal, 3g protein
- Chocolate glazed donut: 300 cal, 4g protein  ← not 380, not 350
- 1 chocolate chip cookie (large): 220 cal
- 1 croissant: 230 cal

COMPLEX ASSEMBLED MEALS — use realistic restaurant-level estimates, not lean home-cook assumptions:
- Burrito/bowl with cheese + sour cream + rice: add 170 cal minimum for those condiments alone
- Any meal described as "combo" or with "sides": include all components
- Tacos at a restaurant: 180-220 cal each depending on filling + condiments
- When a user mentions "extra" of anything, add it

PORTION DEFAULT RULES (when size is unspecified):
- "a piece of chicken" → 4-5oz, ~190-235 cal
- "a steak" → 8oz, ~500-550 cal depending on cut
- "a bowl of rice" → 1.5 cups cooked, ~300 cal
- "a salad with dressing" → always include dressing (2-3 tbsp = 130-240 cal depending on type)
- "a donut" → standard glazed ~250 cal, chocolate/filled ~290-320 cal
- "a slice of pizza" → 250-300 cal
- "pasta" without size → 1.5 cups cooked + sauce, ~400-500 cal

YOUR TASK:
${imageUrl ? `1. Analyze the image — identify every visible food item, estimate serving sizes and nutrition.
2. Use the description as additional context.
3. Classify as SNACK / DRINK / FULL MEAL before scoring.` : `1. Use the description to assess the item. Classify as SNACK / DRINK / FULL MEAL before scoring.`}
4. Score using the correct standard for what was actually logged.
5. Give direct coaching — no fluff, no shaming.

Respond with ONLY valid JSON in this exact format:
{
  "detectedFoods": [
    {"item": "food name", "serving": "e.g. 1 medium / ~118g", "calories": 105, "protein": 1, "carbs": 27, "fat": 0}
  ],
  "score": 0-100,
  "feedback": "1 sentence. ${imageUrl ? 'Name what you detected. ' : ''}Direct, no fluff.",
  "quality": "good|neutral|bad",
  "whatWasGood": "1 sentence — the single strongest thing about this meal. null if nothing stands out.",
  "whatWasBad": "1 sentence — the one thing to watch. null if nothing is harmful.",
  "whatToFixNext": "1 sentence — one concrete action for the next meal."
}

Tone: direct, personal, honest — no shaming, no false praise, no repeating the same idea across fields.
Examples:
- Steak arepa + extra cheese (fat_loss): score: 74, quality: "good", whatWasGood: "Steak adds solid protein.", whatWasBad: "Cheese adds calories fast, so portion matters for fat loss.", whatToFixNext: "Keep the arepa, add vegetables, and log the next meal clean."
- Steak arepa + extra cheese (muscle_gain): score: 85, quality: "good", whatWasGood: "Steak and cheese are a strong protein combo for your surplus.", whatWasBad: null, whatToFixNext: "Add a carb source like rice or fruit to push total calories higher."
- Banana snack (fat_loss): score: 78, quality: "good", whatWasGood: "Clean carbs, ~105 cal — won't touch your deficit.", whatWasBad: null, whatToFixNext: "Pair with a protein source before your next full meal."
- Coconut water (clear skin): score: 65, quality: "neutral", whatWasGood: "Electrolytes support skin and energy.", whatWasBad: null, whatToFixNext: "Add eggs or Greek yogurt to make this a real meal."
- Large fries + soda (fat_loss): score: 20, quality: "bad", whatWasGood: null, whatWasBad: "~800 cal with almost no protein — wipes out your deficit.", whatToFixNext: "Next meal: chicken, rice, broccoli — no exceptions."
- Too-small muscle meal: score: 35, quality: "bad", whatWasGood: null, whatWasBad: "Too small to move the needle — you need 600–800 cal per meal.", whatToFixNext: "Add rice, peanut butter, or a shake alongside this."`;

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

  // Plain water check — intercept before meal scoring
  const waterDetection = await detectPlainWater(description, imageUrl);
  if (waterDetection.isWater) {
    const userId = getUserId(req);
    // Low confidence — ask the user to confirm before logging
    if (waterDetection.confidence === "low") {
      res.status(200).json({
        waterConfirmNeeded: true,
        amountOz: waterDetection.oz,
      });
      return;
    }
    // High confidence — log immediately
    const date = getUserToday(req);
    await db.insert(waterLogsTable).values({ userId, date, amountOz: waterDetection.oz });
    res.status(201).json({
      waterLogged: true,
      amountOz: waterDetection.oz,
      message: `Detected water — added ${waterDetection.oz} oz to your water tracker.`,
    });
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

  // ── Side-water detection: check description text then photo ─────────────────
  // Priority 1: description explicitly says "water" / "h2o" (not another drink).
  // Priority 2: photo analysis detects a water glass/bottle alongside the food.
  const lower2 = description.toLowerCase();
  const textWaterMentioned =
    ["water", "h2o"].some(k => lower2.includes(k)) &&
    !NOT_PLAIN_WATER_KEYWORDS.some(k => lower2.includes(k));

  let waterAlsoDetected: { oz: number; autoLogged?: boolean; needsConfirm?: boolean } | null = null;
  const userId = getUserId(req);

  if (textWaterMentioned) {
    // High-confidence from text — auto-log and tell frontend it's done.
    const oz = descriptionOzEstimate(lower2);
    try {
      await db.insert(waterLogsTable).values({ userId, date: getUserToday(req), amountOz: oz });
    } catch {
      // Non-fatal: meal is already saved, water log failure shouldn't error.
    }
    waterAlsoDetected = { oz, autoLogged: true };
  } else if (imageUrl) {
    // Photo path — run AI beverage detection (separate from food analysis).
    const bev = await detectSideBeverageInPhoto(imageUrl, description);
    if (bev.detected) {
      if (bev.drinkType === "water" && bev.confidence === "high") {
        // Clear water visible → auto-log silently.
        try {
          await db.insert(waterLogsTable).values({ userId, date: getUserToday(req), amountOz: bev.oz });
        } catch {
          // Non-fatal.
        }
        waterAlsoDetected = { oz: bev.oz, autoLogged: true };
      } else {
        // Unclear drink type or low confidence → ask user to confirm.
        waterAlsoDetected = { oz: bev.oz, needsConfirm: true };
      }
    }
  }

  if (waterAlsoDetected) {
    res.status(201).json({ ...meal, waterAlsoDetected });
    return;
  }

  res.status(201).json(meal);
});

router.get("/meals/today", async (req, res): Promise<void> => {
  const todayStr = getUserToday(req);
  const meals = await db.select().from(mealsTable)
    .where(eq(mealsTable.userId, getUserId(req)))
    .orderBy(desc(mealsTable.loggedAt));
  const tz = req.headers["x-timezone"] as string | undefined;
  const todayMeals = meals.filter(m => {
    try {
      return m.loggedAt.toLocaleDateString("en-CA", tz ? { timeZone: tz } : {}) === todayStr;
    } catch {
      return m.loggedAt.toISOString().startsWith(todayStr);
    }
  });
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
