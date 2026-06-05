import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  chatMessagesTable,
  userProfilesTable,
  plansTable,
  mealsTable,
  workoutsTable,
  journalEntriesTable,
  weighInsTable,
  coachReviewsTable,
} from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId } from "../middlewares/auth";
import { getSportContextForCoach, parseCustomWorkoutSchedule } from "../lib/sportUtils";

const router: IRouter = Router();

const LBS = 2.2046226;

function parseArr(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type Profile = typeof userProfilesTable.$inferSelect;
type Plan = typeof plansTable.$inferSelect;

interface ChatContext {
  profile: Profile | undefined;
  plan: Plan | undefined;
  goalType: string;
  goals: string[];
  calorieTarget: number | null;
  proteinTarget: number | null;
}

// ---------------------------------------------------------------------------
// Goal validation helpers
// ---------------------------------------------------------------------------

function has(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// Detect extreme/unsafe calorie targets mentioned in the message
function detectUnsafeCalories(m: string): boolean {
  const match = m.match(/(\d+)\s*cal/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n < 900) return true;
  }
  return false;
}

// Parse "lose/gain X lbs in Y days/weeks/months" from a message
function parseGoalMath(m: string): { lbs: number; weeks: number } | null {
  const lbsMatch = m.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)/i);
  const weeksMatch =
    m.match(/(\d+(?:\.\d+)?)\s*weeks?/i) ||
    m.match(/(\d+(?:\.\d+)?)\s*months?/i)?.map((v, i) =>
      i === 1 ? String(parseFloat(v) * 4.3) : v,
    );
  const daysMatch = m.match(/(\d+(?:\.\d+)?)\s*days?/i);

  if (!lbsMatch) return null;
  const lbs = parseFloat(lbsMatch[1]);

  if (daysMatch) {
    const days = parseFloat(daysMatch[1]);
    return { lbs, weeks: days / 7 };
  }
  if (weeksMatch) {
    const weeksRaw = m.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
    const monthsRaw = m.match(/(\d+(?:\.\d+)?)\s*months?/i);
    if (weeksRaw) return { lbs, weeks: parseFloat(weeksRaw[1]) };
    if (monthsRaw) return { lbs, weeks: parseFloat(monthsRaw[1]) * 4.3 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Meal suggestion tables used by both heuristic and AI context
// ---------------------------------------------------------------------------

const MEAL_OPTIONS = {
  fat_loss: {
    breakfast: [
      "Eggs + oatmeal + berries (~400 cal, 30g protein)",
      "Greek yogurt + fruit + granola (~350 cal, 25g protein)",
      "Protein smoothie with fruit + spinach (~350 cal, 30g protein)",
      "Egg white omelette + whole grain toast + avocado (~380 cal, 28g protein)",
    ],
    lunch: [
      "Chicken rice bowl with vegetables (~500 cal, 40g protein)",
      "Turkey sandwich on whole grain + side fruit (~450 cal, 35g protein)",
      "Tuna wrap with lettuce, tomato, cucumber (~400 cal, 35g protein)",
      "Grilled salmon salad with olive oil dressing (~420 cal, 38g protein)",
    ],
    dinner: [
      "Lean beef + sweet potato + steamed broccoli (~550 cal, 42g protein)",
      "Chicken breast + pasta + marinara + side salad (~520 cal, 40g protein)",
      "Salmon + brown rice + roasted vegetables (~500 cal, 38g protein)",
      "Turkey stir fry with vegetables over rice (~480 cal, 40g protein)",
    ],
    snacks: [
      "Greek yogurt (~120 cal, 15g protein)",
      "Protein shake (~150 cal, 25g protein)",
      "Cottage cheese + fruit (~180 cal, 18g protein)",
      "Hard boiled eggs x2 (~140 cal, 12g protein)",
      "Tuna on rice cakes (~180 cal, 20g protein)",
    ],
  },
  muscle_gain: {
    breakfast: [
      "4 eggs + oatmeal + peanut butter + banana (~700 cal, 40g protein)",
      "Greek yogurt bowl + granola + banana + honey (~650 cal, 35g protein)",
      "High-calorie shake: milk + oats + banana + peanut butter (~750 cal, 35g protein)",
      "3 eggs + 3 egg whites + whole grain toast + avocado (~600 cal, 38g protein)",
    ],
    lunch: [
      "Chicken rice bowl with olive oil + avocado (~700 cal, 48g protein)",
      "Beef burrito bowl with beans, rice, cheese (~750 cal, 45g protein)",
      "Turkey sandwich + side milk + fruit (~680 cal, 42g protein)",
      "Pasta with ground beef and tomato sauce (~720 cal, 44g protein)",
    ],
    dinner: [
      "Pasta with lean beef + tomato sauce + parmesan (~800 cal, 50g protein)",
      "Chicken + rice + avocado + olive oil (~750 cal, 48g protein)",
      "Salmon + potatoes + Greek yogurt side (~720 cal, 46g protein)",
      "Lean steak + mashed potato + vegetables (~780 cal, 52g protein)",
    ],
    snacks: [
      "Protein shake with whole milk (~280 cal, 35g protein)",
      "Peanut butter toast (~300 cal, 12g protein)",
      "Trail mix with nuts + dried fruit (~350 cal, 10g protein)",
      "Greek yogurt + granola (~300 cal, 20g protein)",
      "Tuna sandwich on whole grain (~350 cal, 28g protein)",
    ],
  },
  maintain: {
    breakfast: [
      "Eggs + whole grain toast + fruit (~400 cal, 28g protein)",
      "Greek yogurt + granola + berries (~380 cal, 22g protein)",
      "Oatmeal + protein powder + banana (~420 cal, 28g protein)",
    ],
    lunch: [
      "Chicken or fish rice bowl (~500 cal, 40g protein)",
      "Turkey wrap with vegetables (~450 cal, 32g protein)",
      "Salad with grilled protein + olive oil (~420 cal, 35g protein)",
    ],
    dinner: [
      "Lean protein + rice or potato + vegetables (~520 cal, 38g protein)",
      "Fish or chicken + pasta or rice (~500 cal, 36g protein)",
      "Stir fry with lean meat + vegetables over rice (~480 cal, 38g protein)",
    ],
    snacks: [
      "Greek yogurt or cottage cheese (~150 cal, 15g protein)",
      "Protein shake (~150 cal, 25g protein)",
      "Handful of nuts + fruit (~200 cal, 6g protein)",
    ],
  },
};

function getMealOptions(goalType: string) {
  if (goalType === "muscle_gain") return MEAL_OPTIONS.muscle_gain;
  if (goalType === "fat_loss") return MEAL_OPTIONS.fat_loss;
  return MEAL_OPTIONS.maintain;
}

function formatMealOptions(goalType: string): string {
  const m = getMealOptions(goalType);
  return [
    "BREAKFAST OPTIONS:",
    m.breakfast.map((o) => `• ${o}`).join("\n"),
    "\nLUNCH OPTIONS:",
    m.lunch.map((o) => `• ${o}`).join("\n"),
    "\nDINNER OPTIONS:",
    m.dinner.map((o) => `• ${o}`).join("\n"),
    "\nSNACKS:",
    m.snacks.map((o) => `• ${o}`).join("\n"),
    "\nYou don't need to follow these exactly. Hit your calorie and protein targets first. If you don't have chicken, use eggs, tuna, beef, turkey, Greek yogurt, or protein powder instead.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Deterministic, goal-aware fallback used when the AI is unavailable
// ---------------------------------------------------------------------------

function heuristicReply(message: string, ctx: ChatContext): string {
  const m = message.toLowerCase();
  const cal = ctx.calorieTarget;
  const pro = ctx.proteinTarget;
  const calStr = cal ? `${cal} calories` : "a sensible calorie level";
  const proStr = pro ? `${pro}g protein` : "enough protein";
  const days = ctx.profile?.workoutDaysPerWeek ?? 3;
  const goalType = ctx.goalType;

  // 0a. Crisis / self-harm
  if (has(m, ["suicid", "kill myself", "killing myself", "want to die", "wanna die", "self harm", "self-harm", "selfharm", "harm myself", "hurt myself", "cut myself", "end it all", "end my life", "ending my life", "no reason to live", "better off dead"])) {
    return "I'm not the right resource for this, and you deserve real support. Please reach out to a doctor, a mental health professional, or a local crisis line right now. You matter — talk to someone who can help today.";
  }

  // 0b. Medical conditions
  if (has(m, [
    "diabetes", "diabetic", "pregnant", "pregnancy", "eating disorder", "anorexia",
    "anorexic", "bulimia", "bulimic", "injured", "injury", "thyroid", "heart condition",
    "blood pressure", "medication", "prescribed", "chronic illness", "medical condition",
    "hurt my", "sprain", "sprained", "pulled a muscle", "knee pain", "back pain",
    "shoulder pain", "joint pain", "sharp pain",
  ])) {
    return "That's outside what I can coach on. For anything medical, talk to a qualified doctor or registered professional first. Once you have their clearance, I'll build your training and nutrition around it.";
  }

  // 0c. Unsafe calorie target
  if (detectUnsafeCalories(m)) {
    return `Eating under 900 calories a day is dangerous. It triggers muscle loss, crashes your metabolism, destroys energy, and is not sustainable. The fix is not eating less — it's eating the right foods. ${calStr} with ${proStr} is your actual target. That's where fat loss happens without wrecking your body.`;
  }

  // 1. Unrealistic goal detection — "lose X in 2 days / overnight / tomorrow"
  const goalMath = parseGoalMath(m);
  const isLosing = has(m, ["lose", "loss", "drop", "slim", "cut"]);
  const isGaining = has(m, ["gain", "build", "bulk", "put on", "grow"]);

  if (goalMath) {
    const { lbs, weeks } = goalMath;
    const weeklyPace = weeks > 0 ? lbs / weeks : Infinity;

    if (weeks < 1 && lbs > 1) {
      const what = isGaining ? "gain that much muscle" : "lose that weight";
      return `Reality Check: You cannot ${what} in a few days. That is not how the body works — fat loss is 1-2 lbs per week maximum, and muscle gain is even slower. Any dramatic short-term drop is water weight, not fat.\n\nA better target: ${isGaining ? "0.25-0.5 lbs per week of lean mass" : "1-2 lbs per week"}. If you have a specific event coming up, we can focus on reducing bloating, staying hydrated, sleeping well, lowering sodium, and staying consistent.`;
    }

    if (isLosing) {
      if (weeklyPace <= 2) {
        const verdict = weeklyPace <= 1 ? "realistic and sustainable" : "aggressive but doable with strict execution";
        const discipline =
          weeklyPace <= 1
            ? "Discipline Required: Moderate. You have margin — an imperfect day here and there won't sink it as long as the week averages out."
            : weeklyPace <= 1.5
              ? "Discipline Required: High. Little room for error — you need roughly 6 of 7 days fully dialed in."
              : "Discipline Required: Very high. This is near-perfect execution — every meal tracked, protein hit daily, no skipped workouts, sleep locked in. Miss the behaviors and you will not hit this number.";
        return `Reality Check: Losing ${lbs} lbs in ${weeks < 4 ? Math.round(weeks) + " weeks" : Math.round(weeks / 4.3) + " months"} is ${verdict} — that's ${weeklyPace.toFixed(1)} lbs per week.\n\n${discipline}\n\nThe Daily Behaviors (this is what actually gets you there — not just calorie math):\n• Calorie adherence: ${calStr}, hit 6-7 days/week. One 1,500-cal blowout erases three days of deficit. This is the #1 driver.\n• Protein: ${proStr} every day. It keeps the weight you lose as fat, not muscle, and keeps you full.\n• Steps: 8,000/day minimum. Burns fat without spiking hunger like hard cardio.\n• Sleep: 7-8 hours. Under 7 spikes cravings and kills willpower — one bad night sabotages a perfect diet day.\n• Meal tracking: log every meal, every day. Untracked bites, sauces, and drinks are where the deficit silently vanishes.\n• Training: ${days}x/week, every week. Lifting tells your body to hold muscle while you lose fat.\n\nCoach Command: The math is the easy part. Win the behaviors daily and the result is automatic.`;
      } else {
        return `Reality Check: Losing ${lbs} lbs in ${weeks < 4 ? Math.round(weeks) + " weeks" : Math.round(weeks / 4.3) + " months"} requires ${weeklyPace.toFixed(1)} lbs per week — that's above the safe limit of 2 lbs/week. Crash diets cause muscle loss, metabolic slowdown, and rebound weight gain.\n\nSafer target: ${Math.round(weeks * 1.5)} lbs in that same timeframe. Focus on ${calStr}, ${proStr}, daily walking, and strength training. Slower and consistent beats fast and broken.`;
      }
    }

    if (isGaining) {
      if (weeklyPace <= 0.5) {
        return `Reality Check: Gaining ${lbs} lbs in ${weeks < 4 ? Math.round(weeks) + " weeks" : Math.round(weeks / 4.3) + " months"} is realistic — that's ${weeklyPace.toFixed(2)} lbs per week of lean mass.\n\nYour Target:\n• Calories: ${calStr} (controlled surplus)\n• Protein: ${proStr}\n• Workouts: ${days}x/week with progressive overload\n• Sleep: 8 hours minimum\n\nHit your meals consistently. Missing even one meal per day kills a bulk.`;
      } else {
        return `Reality Check: Gaining ${lbs} lbs in ${weeks < 4 ? Math.round(weeks) + " weeks" : Math.round(weeks / 4.3) + " months"} would require ${weeklyPace.toFixed(2)} lbs per week. Muscle does not grow that fast — gaining more than 0.5 lbs per week usually means adding fat, not muscle.\n\nRealistic target: ${Math.round(weeks * 0.4)} lbs of lean mass in that timeframe. Eat ${calStr}, ${proStr}, train ${days}x/week, sleep 8 hours. Patience is part of the plan.`;
      }
    }
  }

  // 2. Meal suggestions
  if (has(m, ["what should i eat", "what to eat", "meal ideas", "meal options", "food ideas", "food options", "what food", "give me meals", "meal plan", "meal suggestions", "what can i eat", "what meals"])) {
    return `Here are your meal options for ${goalType === "muscle_gain" ? "gaining weight" : goalType === "fat_loss" ? "fat loss" : "your goal"}:\n\n${formatMealOptions(goalType)}\n\nToday's targets: ${calStr} | ${proStr}`;
  }

  // 3. Breakfast / lunch / dinner specific
  if (has(m, ["breakfast", "morning meal", "what to have for breakfast"])) {
    const opts = getMealOptions(goalType).breakfast;
    return `Breakfast options for ${goalType === "muscle_gain" ? "gaining weight" : goalType === "fat_loss" ? "fat loss" : "your goal"}:\n${opts.map((o) => `• ${o}`).join("\n")}\n\nIf you don't have one ingredient, substitute it. Eggs, Greek yogurt, protein powder, and oats are the core. Hit your protein first.`;
  }

  if (has(m, ["lunch", "midday meal"])) {
    const opts = getMealOptions(goalType).lunch;
    return `Lunch options:\n${opts.map((o) => `• ${o}`).join("\n")}\n\nYou don't need to follow these exactly. Hit ${proStr} across the day and stay near ${calStr} total.`;
  }

  if (has(m, ["dinner", "evening meal", "supper"])) {
    const opts = getMealOptions(goalType).dinner;
    return `Dinner options:\n${opts.map((o) => `• ${o}`).join("\n")}\n\nKeep dinner protein-heavy. If you're close to your calorie target, go lighter on carbs and heavier on vegetables.`;
  }

  if (has(m, ["snack", "snacking", "craving", "cravings", "binge", "eat at night", "late night"])) {
    const opts = getMealOptions(goalType).snacks;
    return `Night snacking is usually too little protein during the day, not real hunger. If you're hungry, choose from these:\n${opts.map((o) => `• ${o}`).join("\n")}\n\nHit ${proStr} across your main meals first. That alone kills most cravings.`;
  }

  // 4. Substitution questions
  if (has(m, ["don't have", "dont have", "no chicken", "no eggs", "substitute", "instead of", "alternative", "swap", "replace"])) {
    return "The food doesn't matter as much as hitting the target. If you don't have chicken, use eggs, tuna, ground beef, turkey, Greek yogurt, or protein powder. If you don't have rice, use oats, pasta, potatoes, or bread. Match the macros — the exact food is secondary.";
  }

  // 5. Calorie questions
  const asksCalorieDirect = has(m, ["how many calories", "calorie target", "calorie goal", "how much should i eat", "my calories", "my target"]);
  const asksWhyCalories = has(m, ["why"]) && has(m, ["calorie", "deficit", "surplus", "macro", "target", "eat"]);
  if (asksCalorieDirect || asksWhyCalories) {
    if (goalType === "fat_loss") {
      return `Your target is ${calStr} because that creates a moderate calorie deficit that drives fat loss without destroying your energy, workouts, or metabolism. Eat less than that and you risk muscle loss and burnout. Eat at this level consistently and the fat comes off steadily. Pair it with ${proStr} to protect muscle.`;
    }
    if (goalType === "muscle_gain") {
      return `Your target is ${calStr} because you need a controlled calorie surplus to build muscle without adding excessive fat. Too little and you won't grow. Too much and you'll gain mostly fat. Hit ${proStr} and train hard — the surplus fuels the muscle you're building.`;
    }
    return `Your target is ${calStr} with ${proStr} to support your goals. Stay consistent with these numbers daily and adjust based on weekly weigh-in results.`;
  }

  // 6. Lose fat
  if (has(m, ["lose fat", "fat loss", "lose weight", "burn fat", "get lean", "leaner", "cut weight", "slim down", "losing weight"])) {
    return `Reality Check: Fat loss isn't about one number — it's about hitting the same behaviors every day. The calorie math is the easy part. Execution is what separates people who get there from people who don't.\n\nDiscipline Required: Daily and non-negotiable. You don't need to be perfect, but you need to be consistent — roughly 6 of 7 days dialed in, every week. Sporadic effort gets sporadic results.\n\nThe Daily Behaviors that decide it:\n• Calorie adherence: ${calStr}, hit 6-7 days/week. One blowout day can erase three days of progress.\n• Protein: ${proStr} every day. Protects muscle so the weight you lose is fat, and keeps you full.\n• Steps: 8,000/day minimum. The easiest fat-loss lever and the one most people skip.\n• Sleep: 7-8 hours. Bad sleep spikes cravings and wrecks willpower the next day.\n• Meal tracking: log everything, every day. If you don't track it, you can't manage it.\n• Training: ${days}x/week, every week. Consistency keeps the muscle while the fat comes off.\n\nCoach Command: No liquid calories today. Hit protein first. Walk after meals. Log every bite.`;
  }

  // 7. Gain weight
  if (has(m, ["gain weight", "gain faster", "put on weight", "too skinny", "skinny", "bulk", "bulking", "eat more", "hard gainer", "gaining weight"])) {
    return `Reality Check: Weight gain requires calories on schedule, not random motivation.\n\nYour Target:\n• Calories: ${calStr}\n• Protein: ${proStr}\n• Meals: 4+ per day, no skipping\n• Workouts: ${days}x/week, progressive overload\n• Sleep: 8 hours\n\nAdd a shake between meals if you're struggling to hit calories. Undereating one day sets you back three.`;
  }

  // 8. Build muscle
  if (has(m, ["build muscle", "gain muscle", "more muscle", "get stronger", "strength", "grow muscle", "muscle mass"])) {
    return `Muscle is progressive lifting plus enough food — both are required.\n\nYour Target:\n• Calories: ${calStr}\n• Protein: ${proStr}\n• Workouts: ${days}x/week with progressive overload\n• Sleep: 8 hours minimum\n\nCoach Command: Track your lifts. If you're not adding weight or reps over time, you're not progressing.`;
  }

  // 9. Missed workout
  if (has(m, ["miss", "skip", "didn't work out", "didnt work out"]) && has(m, ["workout", "gym", "training", "exercise", "session", "lift"])) {
    return "Missing one session isn't failure — quitting is. Don't punish yourself with a brutal double session. Get something short in: 20-30 minutes on the main lifts or a brisk walk. Back to normal schedule tomorrow. Momentum over perfection.";
  }

  // 10. Discouraged / slipped up
  if (has(m, ["messed up", "mess up", "i failed", "failed today", "give up", "giving up", "want to quit", "feel bad", "discouraged", "off track", "ruined", "cheated", "blew it", "screwed up", "fell off", "feel like quitting", "feel terrible", "i'm done", "im done", "hate myself", "disappointed"])) {
    return "Good. Own it, don't spiral. One bad day does not ruin the mission. Tonight: water, no more random snacks, sleep on time. Tomorrow we fix breakfast and get back on schedule. You're still in this — keep going.";
  }

  // 11. Stay fit / maintain
  if (has(m, ["stay fit", "staying fit", "maintain", "keep fit", "stay in shape", "maintenance"])) {
    return `Staying fit is just refusing to drift. Keep training ${days}x/week, hold ${proStr}, walk daily, and sleep on schedule. Maintenance is a skill — protect your habits and you keep everything you built.`;
  }

  // 12. Workouts / training
  if (has(m, ["workout", "work out", "exercise", "train", "training", "gym", "lift", "cardio", "routine"])) {
    return `Keep it simple and consistent: ${days}x/week, compound movements, progressive overload. A focused 40 minutes beats a random 90. Check your Workouts tab and execute today's session.`;
  }

  // 13. Sleep
  if (has(m, ["sleep", "insomnia", "can't sleep", "cant sleep", "rest", "bedtime", "stay up"])) {
    return "Sleep is where progress actually happens. Aim for 7-8 hours, same wake time every day, screens off 30-60 minutes before bed, no caffeine after 2 PM. Fix sleep and your energy, hunger, and willpower all improve automatically.";
  }

  // 14. Energy / fatigue
  if (has(m, ["energy", "tired", "fatigue", "exhausted", "no energy", "low energy", "sluggish", "drained"])) {
    return "Low energy is usually sleep, food, or water — not willpower. Lock in 7-8 hours, eat real meals (don't skip breakfast), drink 3L of water, and get sunlight plus a short walk early in the day. Fix the basics before blaming yourself.";
  }

  // 15. Skin
  if (has(m, ["skin", "acne", "breakout", "complexion", "pimple", "clear skin", "face wash", "skincare", "how to clear skin"])) {
    return `Here's your clear skin routine - keep it simple and do it every day:\n\nAM (2-3 minutes):\n- Cleanse - gentle, non-stripping cleanser\n- Moisturize - lightweight, non-comedogenic\n- SPF 30+ - every morning, even if cloudy\n\nPM (3-4 minutes):\n- Cleanse - remove the day\n- Active - either salicylic acid 2% or benzoyl peroxide 2.5% (not both)\n- Moisturize - lock it in\n\nDiet habits (2-4 week test):\n- Cut whey protein, dairy, and high-sugar foods\n- Eat more whole foods and vegetables\n- Drink 3L water daily\n- Sleep 7-8 hours\n- Change pillowcase 2x/week\n- Don't touch your face\n\nDon't add more products. Most people hurt their skin by overdoing it. If it's cystic, painful, or not improving after 6 weeks, see a dermatologist - that's outside my lane.`;
  }

  // 16. Discipline / consistency
  if (has(m, ["discipline", "disciplined", "consistent", "consistency", "stay on track", "stick to", "habit", "routine help"])) {
    return "Discipline isn't motivation — it's shrinking the decision. Plan tomorrow's meals and training tonight, keep your schedule visible, and don't negotiate with yourself in the moment. Win the small reps daily and discipline becomes automatic.";
  }

  // 17. Motivation
  if (has(m, ["motivat", "inspire", "struggling", "hard to", "can't keep", "cant keep", "lazy", "no drive", "pep talk", "keep going"])) {
    return "Motivation comes and goes — that's normal, don't wait for it. Do the next small action: one meal, one workout, one early night. Action creates momentum, not the other way around. Keep stacking small wins.";
  }

  // 18. Default — reference the user's actual selected goals and combine them
  //     into one mission, mirroring the system-prompt behavior.
  if (ctx.goals.length > 0) {
    const labelMap: Record<string, string> = {
      "lose fat": "fat loss", "lose weight": "weight loss", "gain weight": "weight gain",
      "build muscle": "muscle building", "maintain fitness": "staying fit",
      "better skin": "clear skin", "higher energy": "better energy",
      "better sleep": "better sleep", discipline: "discipline",
    };
    const itemMap: Record<string, string> = {
      "lose fat": `hit ${calStr}, ${proStr}, 8,000 steps, log every meal`,
      "lose weight": `hit ${calStr}, ${proStr}, 8,000 steps, log every meal`,
      "gain weight": `eat ${calStr} across 4+ meals, ${proStr}, don't skip a meal`,
      "build muscle": `${proStr}, train with progressive overload, sleep 8h to recover`,
      "maintain fitness": `train ${days}x/week, ${proStr}, walk daily`,
      "better skin": "drink 3L water, wash your face AM and PM, AM SPF 30+, PM active (salicylic acid 2% or benzoyl peroxide 2.5%), cut dairy/whey/sugar for 2-4 weeks, change pillowcase 2x/week",
      "higher energy": "protein breakfast, morning sunlight, no late caffeine",
      "better sleep": "consistent bedtime, screens off 60 min before bed, cool dark room",
      discipline: "pick one main mission and finish it — no zero days",
    };
    const labels = ctx.goals.map((g) => labelMap[g] || g);
    const joined =
      labels.length === 1 ? labels[0]
      : labels.length === 2 ? `${labels[0]} and ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    const seen = new Set<string>();
    const missionItems = ctx.goals
      .map((g) => itemMap[g])
      .filter((i): i is string => !!i && !seen.has(i) && (seen.add(i), true));
    const mission = missionItems.length
      ? missionItems.map((i) => `• ${i}`).join("\n")
      : `• Calories: ${calStr}\n• Protein: ${proStr}\n• Steps: 8,000\n• Sleep: 7-8 hours`;
    const skinNote = ctx.goals.includes("better skin")
      ? "\n\nFor persistent acne or a skin condition, see a dermatologist — that's outside my lane."
      : "";
    return `You picked ${joined}. Here's today's combined mission:\n\n${mission}\n\nWin these daily and the goals take care of themselves. Tell me what you're stuck on and I'll give you the next step.${skinNote}`;
  }

  return `Execute the basics and you win:\n\nToday's Mission:\n• Calories: ${calStr}\n• Protein: ${proStr}\n• Steps: 8,000\n• Workouts: on schedule (${days}x/week)\n• Water: 3L\n• Sleep: 7-8 hours\n\nTell me exactly what you're stuck on — meals, workouts, sleep, energy, or consistency — and I'll give you the next step.`;
}

// ---------------------------------------------------------------------------

function buildContextSummary(
  profile: Profile | undefined,
  plan: Plan | undefined,
  meals: (typeof mealsTable.$inferSelect)[],
  workouts: (typeof workoutsTable.$inferSelect)[],
  journals: (typeof journalEntriesTable.$inferSelect)[],
  weighIns: (typeof weighInsTable.$inferSelect)[],
  reviews: (typeof coachReviewsTable.$inferSelect)[],
): string {
  const parts: string[] = [];

  if (profile) {
    const goals = parseArr(profile.goals);
    const skin = parseArr(profile.skinConcerns);
    const currentLbs = Math.round(profile.currentWeightKg * LBS);
    const goalLbs = Math.round(profile.goalWeightKg * LBS);
    const diffLbs = goalLbs - currentLbs;
    const direction = diffLbs < 0 ? "lose" : "gain";
    const absDiff = Math.abs(diffLbs);

    const sportDisplay = profile.sport && profile.sport !== "no sport" && profile.sport !== "none"
      ? (profile.sport === "other" && profile.sportCustom ? profile.sportCustom : profile.sport)
      : null;

    const commitmentLabel = profile.commitmentLevel
      ? profile.commitmentLevel.replace(/_/g, " ")
      : null;

    // Parse custom workout schedule for context
    const customSchedule = parseCustomWorkoutSchedule(profile);
    const customScheduleText = customSchedule
      ? `Custom workout split: ${customSchedule.days.map(d => `${d.day}=${d.focus}`).join(", ")}. `
      : "";

    // Get sport context for coach
    const sportContext = getSportContextForCoach(profile);

    parts.push(
      `PROFILE: ${profile.name}, ${profile.age}yo ${profile.gender}. ` +
        `${currentLbs} lbs now → ${goalLbs} lbs goal (${direction} ${absDiff} lbs). ` +
        `Fitness level: ${profile.fitnessLevel}. Gym access: ${profile.gymAccess}. ` +
        `Trains ${profile.workoutDaysPerWeek}x/week. Wake ${profile.wakeTime}, sleep ${profile.sleepTime}. ` +
        `Sleep quality ${profile.sleepQuality}/10, energy ${profile.energyLevel}/10, stress ${profile.stressLevel}/10. ` +
        (sportDisplay ? `Sport: ${sportDisplay}. ` : "") +
        (profile.workoutFocus ? `Workout focus: ${profile.workoutFocus.replace(/_/g, " ")}. ` : "") +
        (profile.hasOwnSchedule === "yes" && profile.ownSchedule
          ? `Custom workout schedule: ${profile.ownSchedule}. Coach must respect this schedule and build nutrition/recovery around it. `
          : "") +
        customScheduleText +
        (sportContext ? `Sport schedule: ${sportContext} Coach must respect practice days and adjust recovery and nutrition. `
          : "") +
        (goals.length ? `Goals: ${goals.join(", ")}. ` : "") +
        (skin.length ? `Skin concerns: ${skin.join(", ")}. ` : "") +
        (profile.biggestStruggle ? `Biggest struggle: ${profile.biggestStruggle}. ` : "") +
        (commitmentLabel ? `Commitment level: ${commitmentLabel}. ` : "") +
        `Always reference weight in pounds (lbs), never kilograms.`,
    );
  } else {
    parts.push("PROFILE: none yet.");
  }

  if (plan) {
    parts.push(
      `PLAN: goal type "${plan.goalType}", ${plan.calorieTarget} cal/day (because this ${plan.goalType === "fat_loss" ? "creates a moderate deficit for steady fat loss without muscle loss" : plan.goalType === "muscle_gain" ? "provides a controlled surplus to build lean mass" : "supports energy balance for maintenance"}), ` +
        `${plan.proteinTargetG}g protein/day, ${plan.waterTargetL}L water, ` +
        `${plan.stepsTarget} steps/day, ${plan.sleepTargetHours}h sleep. Weekly pace: ${plan.weeklyPace}.`,
    );
  }

  if (meals.length) {
    parts.push(
      "RECENT MEALS: " +
        meals
          .map((meal) => `"${meal.description || "(photo)"}" scored ${meal.score}/100 (${meal.quality})`)
          .join("; ") +
        ".",
    );
  }

  if (workouts.length) {
    parts.push(
      "RECENT WORKOUTS: " +
        workouts.map((w) => `${w.name} (${w.type}, ${w.durationMinutes}min)`).join("; ") +
        ".",
    );
  }

  if (journals.length) {
    const j = journals[0];
    parts.push(
      `LATEST JOURNAL (${j.date}): followed schedule ${j.followedSchedule ? "yes" : "no"}, hit protein ${j.hitProtein ? "yes" : "no"}, ` +
        `worked out ${j.workedOut ? "yes" : "no"}, slept on time ${j.sleptOnTime ? "yes" : "no"}, energy ${j.energyRating}/10. ` +
        (j.needHelpWith ? `Needs help with: ${j.needHelpWith}.` : ""),
    );
  }

  if (reviews.length) {
    const r = reviews[0];
    parts.push(
      `LATEST DAILY REVIEW (${r.date}): score ${r.dailyScore}/100, on pace ${r.onPace ? "yes" : "no"}. Fix for tomorrow: ${r.exactFixForTomorrow}`,
    );
  }

  if (weighIns.length) {
    const w = weighIns[0];
    parts.push(`LATEST WEIGH-IN: ${Math.round(w.weightKg * LBS)} lbs (week ${w.weekNumber}). ${w.adjustment ? `Adjustment: ${w.adjustment}.` : ""}`);
  }

  return parts.join("\n");
}

router.get("/chat/history", async (req, res): Promise<void> => {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, getUserId(req)))
    .orderBy(chatMessagesTable.createdAt);
  res.json(messages);
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, getUserId(req)));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, getUserId(req)));

  const [recentMessages, recentMeals, recentWorkouts, recentJournals, recentWeighIns, recentReviews] = await Promise.all([
    db.select().from(chatMessagesTable).where(eq(chatMessagesTable.userId, getUserId(req))).orderBy(desc(chatMessagesTable.createdAt)).limit(20),
    db.select().from(mealsTable).where(eq(mealsTable.userId, getUserId(req))).orderBy(desc(mealsTable.loggedAt)).limit(3),
    db.select().from(workoutsTable).where(eq(workoutsTable.userId, getUserId(req))).orderBy(desc(workoutsTable.completedAt)).limit(3),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, getUserId(req))).orderBy(desc(journalEntriesTable.createdAt)).limit(2),
    db.select().from(weighInsTable).where(eq(weighInsTable.userId, getUserId(req))).orderBy(desc(weighInsTable.loggedAt)).limit(1),
    db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, getUserId(req))).orderBy(desc(coachReviewsTable.createdAt)).limit(1),
  ]);

  const ctx: ChatContext = {
    profile,
    plan,
    goalType: plan?.goalType ?? "general",
    goals: parseArr(profile?.goals ?? null),
    calorieTarget: plan?.calorieTarget ?? null,
    proteinTarget: plan?.proteinTargetG ?? null,
  };

  const contextSummary = buildContextSummary(profile, plan, recentMeals, recentWorkouts, recentJournals, recentWeighIns, recentReviews);

  // Build goal-specific meal options for the system prompt
  const goalType = plan?.goalType ?? "general";
  const mealOptionsText = goalType !== "general" ? formatMealOptions(goalType) : formatMealOptions("maintain");

  const systemPrompt = `You are Ascend — an elite-level AI performance coach with deep expertise in exercise physiology, metabolic science, sports nutrition, sleep architecture, and behavioral psychology. You are NOT a doctor, dietitian, or medical professional. You do not diagnose, treat, cure, or prescribe. You synthesize evidence-based science into actionable daily protocols. Your advice is sophisticated, precise, and grounded in the underlying biology of the human body.

You are powered by the same cognitive engine that reads PubMed abstracts, sports science journals, and exercise physiology textbooks. Your job is to translate that depth into a strict, practical daily protocol the user can execute. Every recommendation you make must have a physiological "why" — the user should understand what is happening inside their body when they follow (or ignore) the protocol.

CRITICAL RULE: You are NOT a doctor. For any medical condition, injury, eating disorder, pregnancy, diabetes, thyroid issues, severe cystic acne, chronic fatigue, or any health issue requiring diagnosis: immediately defer to a qualified medical professional. Do not attempt to diagnose or treat. Use cautious language: "may help," "supports," "builds habits toward," "evidence suggests."

Your calorie targets and step goals are ESTIMATES based on metabolic formulas (Mifflin-St Jeor BMR, activity multipliers) — not exact prescriptions. They are physiological starting points, not clinical directives. Users should monitor weekly progress and adjust with a qualified professional if needed.

NEVER guarantee specific outcomes. Use cautious language: "may help," "supports," "builds habits toward," "evidence suggests." If a user mentions any medical issue, eating disorder, pregnancy, injury, or chronic condition: immediately defer to a qualified medical professional.

USE THE USER'S REAL DATA below. Reference their name, weight, goal, targets, and history naturally in every answer.

${contextSummary}

═══════════════════════════════════════════════════
GOAL VALIDATION — EVIDENCE-BASED METABOLIC MATH (MANDATORY)
═══════════════════════════════════════════════════
When a user states a goal with a timeframe, ALWAYS do the math. Never skip this.

1. Required weekly pace = total lbs / total weeks
2. Classify the pace using metabolic science:
   - ≤1 lb/week fat loss = SUSTAINABLE. Aligns with the ~3,500 kcal/lb rule-of-thumb for adipose tissue. Most people can maintain this without triggering metabolic adaptation.
   - 1–2 lb/week = AGGRESSIVE. Requires a 700–1,000 kcal/day deficit, which suppresses leptin, elevates ghrelin, and reduces NEAT. The body actively fights back.
   - >2 lb/week = UNSAFE. Triggers significant muscle loss, thyroid downregulation, cortisol elevation, and almost guarantees rebound. Push back immediately.
   - ≤0.5 lb/week muscle gain = OPTIMAL. Muscle protein synthesis is capped at ~0.25–0.5 lb/week in trained natural athletes. Surplus above this rate fills adipose tissue.
   - >0.5 lb/week = EXCESS FAT. Most of that is fat mass.

3. EXPLAIN the physiological link between deficit and tissue loss:
   - "A 500 kcal/day deficit creates a ~3,500 kcal/week shortfall. Your body must cover this by mobilizing adipose triglycerides into free fatty acids. At ~3,500 kcal/lb, this translates to roughly 1 lb/week — for most people."
   - "If your goal is 2 lb/week, you need a 1,000 kcal/day deficit. This is not just 'more dieting.' It is a physiological stressor: leptin drops, ghrelin rises, NEAT falls. Your brain will fight you."
   - "10 lbs in 5 weeks is 2 lb/week. Your TDEE is ~[X] kcal, so your target is ~[Y] kcal. At that intake, leptin drops, ghrelin rises, and NEAT falls by 100–300 kcal/day. You'll feel cold, hungry, and tired. This is homeostasis, not willpower failure."

4. METABOLIC ADAPTATION: Always mention this. After 6+ weeks, TDEE drops as mass drops. The deficit shrinks. Rate of loss slows. The body defends its mass.
   - "If you lose 15 lbs, your BMR drops by ~100 kcal. NEAT drops by ~150 kcal. Your deficit shrinks by 250 kcal automatically. The same diet that lost 2 lb/week in week 1 loses 0.5 lb/week in week 8. This is why you track and adjust."

5. WEIGHT GAIN (muscle/hypertrophy):
   - Controlled surplus: +200–400 kcal/day above TDEE. Provides energy for MPS without significant adipogenesis.
   - Protein: 1.6–2.2 g/kg to maximize fractional synthetic rate.
   - If stalls 1–2 weeks: add 200–300 kcal. If gaining >1 lb/week for a month: reduce 100–200 kcal.

6. SKIN (Dermatology-adjacent protocol):
   - Acne is multifactorial: androgen-driven sebum overproduction, follicular hyperkeratinization, Cutibacterium acnes proliferation, and inflammation.
   - Evidence-based routine: AM — gentle cleanser, niacinamide 5% (sebum regulation), moisturizer, SPF 30+. PM — cleanser, salicylic acid 2% (keratolytic) or benzoyl peroxide 2.5% (antibacterial), moisturizer.
   - Diet: high-glycemic loads and certain dairy (especially skim) are associated with increased IGF-1 and sebum. Reducing refined sugar and whey may help. This is epidemiology, not diagnosis.
   - If cystic, nodulocystic, or persistent >3 months: see a dermatologist.

7. ENERGY (Neuroscience-adjacent protocol):
   - ATP production is the foundation. Chronic fatigue is not solved by "more coffee."
   - Sleep: 7+ hours (adults) / 8–10 (teens). Sleep debt accumulates. Cortisol rises, dopamine signaling blunts, prefrontal decision-making degrades.
   - Circadian anchoring: cortisol peaks at wake (30–60 min after), adenosine clears. Morning sunlight (10–30 min) entrains the SCN, setting melatonin onset 14–16 hours later.
   - Protein breakfast: tyrosine + phenylalanine → dopamine + norepinephrine synthesis. Carb-only breakfast creates glucose spike → insulin surge → reactive hypoglycemia → crash.
   - Caffeine: blocks adenosine receptors. Half-life 5–6 hours. Cutoff 8 hours before bed prevents sleep fragmentation.
   - If severe or persistent: see a medical professional.

8. SLEEP (Chronobiology-adjacent protocol):
   - Circadian rhythm: 24-hour oscillation driven by the suprachiasmatic nucleus. Anchored by light (morning) and temperature (evening).
   - Adults: 7+ hours. Teens: 8–10. Sleep restriction <6 hours increases cortisol, impairs glucose tolerance, elevates ghrelin, and suppresses testosterone.
   - Sleep architecture: NREM (slow-wave sleep = physical restoration) and REM (cognitive consolidation). Both needed.
   - Protocol: consistent wake time, consistent bedtime, no caffeine after 2pm (8h before bed), screens off 60 min pre-bed (blue light suppresses melatonin by 50% at 460nm), room 65–68°F (core temp must drop 1°C for onset), complete darkness.
   - Do NOT claim to cure insomnia. Chronic insomnia >3 months: see a sleep specialist.

9. COACH TONE: Strict, direct, evidence-based, uncompromising on the science. Reference the user's actual data. Explain the WHY with real physiology.

10. EXAMPLE ANSWER:
User: "I want to lose 10 lbs in 5 weeks."
Coach: "Reality check: 10 lbs in 5 weeks is 2 lb/week. That's a 1,000 kcal/day deficit. Your TDEE is ~2,400, so your target is ~1,400. At 1,400 kcal, leptin drops, ghrelin rises, and NEAT falls by 100–300 kcal/day. Your brain will make you feel cold, hungry, and tired. This is not a willpower problem — it is homeostasis. The protocol: track every meal, hit [protein]g daily, 10k steps, strength training [X]x/week, 7h sleep, 3L water. Miss 2 days and your effective deficit shrinks to 800 kcal/day. The 5-week timeline becomes 6–7 weeks. Your body doesn't care about intentions."

11. SAFETY: Any medical condition, injury, eating disorder, pregnancy, diabetes, thyroid, severe cystic acne, or chronic fatigue: immediately defer to a qualified medical professional. Do not attempt to diagnose or treat.

═══════════════════════════════════════════════════
CALORIE SCIENCE — ALWAYS EXPLAIN THE PHYSIOLOGY
═══════════════════════════════════════════════════
Whenever you state a calorie target, explain the physiological mechanism:
- Fat loss: "This creates a moderate energy deficit. Your body compensates by mobilizing adipose triglycerides into free fatty acids, which enter the Krebs cycle for ATP. The deficit is large enough to deplete glycogen and adipose stores, but small enough to preserve muscle protein synthesis and thyroid function."
- Muscle gain: "This controlled surplus provides excess ATP beyond basal metabolic needs. The surplus is partitioned toward muscle protein synthesis (via mTOR activation by leucine and mechanical loading) rather than adipose storage. If surplus exceeds MPS capacity, lipogenesis increases."
- Maintenance: "This matches total energy expenditure. Homeostasis is maintained: glycogen stores stay topped, MPS operates at baseline, and adipose mass is neither mobilized nor expanded."

═══════════════════════════════════════════════════
COACH THE PHYSIOLOGY — NOT JUST THE MATH (CRITICAL)
═══════════════════════════════════════════════════
Never stop at "eat 500 calories less." Every answer must explain the biological mechanisms and the daily behaviors that trigger them:

1. DAILY CALORIE ADHERENCE — Energy balance is the first law of thermodynamics. A 1,500-calorie blowout erases a 500-calorie deficit across 3 days. The adipocyte doesn't care about intent. Consistency is the only variable that matters. Track every meal, every day.

2. PROTEIN TARGET — Muscle protein synthesis requires essential amino acids, especially leucine (2.5–3g per meal triggers mTOR). In a deficit, inadequate protein shifts nitrogen balance toward catabolism. The weight lost becomes muscle, not fat. Protein also has the highest thermic effect (20–30%) and increases satiety via GLP-1 and PYY signaling.

3. STEP TARGET — NEAT accounts for 15–50% of TDEE. Walking is low-impact, doesn't elevate hunger, and preserves muscle. 10,000 steps ≈ 300–500 kcal/day. The easiest metabolic lever most people ignore.

4. SLEEP TARGET — 7–8 hours. Under 7 hours: cortisol rises (+15%), ghrelin rises (+18%), leptin falls (+15%), insulin sensitivity drops. The brain increases hedonic preference for high-calorie foods. One bad night raises next-day calorie intake by ~300 kcal. Sleep is a fat-loss hormone protocol.

5. MEAL TRACKING CONSISTENCY — If you don't log it, you can't manage it. Untracked oils, sauces, bites, and drinks are where deficits evaporate. Research shows self-monitoring is the strongest predictor of weight loss success across all dietary patterns.

6. TRAINING CONSISTENCY — Mechanical loading triggers mTOR and IGF-1 signaling, which preserves myofibrillar protein during caloric restriction. Without training, 30–40% of weight loss in a deficit is lean mass. Strength training signals the body to preserve contractile tissue.

═══════════════════════════════════════════════════
DAILY ACTION FORMAT — use this for goal/plan responses
═══════════════════════════════════════════════════
When answering a goal question, include:

Reality Check: [Realistic / Aggressive / Unsafe. State weekly pace. Explain metabolic implications.]

Physiology at Play: [Which hormones, systems, and adaptations are involved?]

Discipline Required: [What this actually means day-to-day.]

The Daily Protocol (what changes your biology):
• Calorie adherence: [X] kcal — [why this level, and what metabolic adaptation to expect]
• Protein: [X]g — [leucine threshold, MPS preservation, satiety signaling]
• Steps: [X]/day — [NEAT contribution, hunger preservation]
• Sleep: [X] hours — [leptin/ghrelin, cortisol, insulin sensitivity]
• Meal tracking: log every meal, every day — [energy intake accuracy is the #1 predictor]
• Training: [frequency/type] — [mTOR, IGF-1, lean mass preservation]

What To Eat: [2-4 specific meal options with calories, protein, and physiological rationale]

Today's Mission:
• [Specific actionable checklist item]
• [Specific actionable checklist item]
• [Specific actionable checklist item]

Coach Command: [One strict, direct, short directive]

═══════════════════════════════════════════════════
GOAL-BASED DAILY PROTOCOLS — every goal gets deep science
═══════════════════════════════════════════════════
The user's selected goals are in their data. ALWAYS reference them by name. Turn every goal into a concrete daily protocol with the physiological rationale.

- Fat loss / lose weight: Deficit targeting adipose lipolysis. Key levers: calorie adherence, protein at 1.6–2.2g/kg, steps to maintain NEAT, sleep for leptin preservation, strength training for muscle retention. Discipline: 6–7 days/week adherence. Metabolic adaptation is real.
- Weight gain / bulk: Controlled surplus +200–400 kcal. Key levers: protein to saturate MPS, meal frequency for leucine pulses, progressive overload, sleep for GH/testosterone. Monitor for excessive fat gain.
- Build muscle: Hypertrophy requires mechanical tension + metabolic stress + muscle damage. Protein 1.6–2.2g/kg, 3–6 sets per muscle per session, 48–72h recovery, sleep for GH pulse. Progressive overload is non-negotiable.
- Maintain fitness: Maintenance calories, protein 1.2–1.6g/kg, consistent training volume, daily steps. Homeostasis requires active maintenance.
- Clear skin: Evidence-based routine: AM cleanse + niacinamide 5% + moisturizer + SPF 30+. PM: cleanse + salicylic acid 2% or BP 2.5% + moisturizer. Diet: reduce high-glycemic loads and whey (IGF-1/sebum link). Habits: pillowcase, no face-touching, stress management. If cystic/nodular: see dermatologist.
- Better energy: ATP optimization. Sleep 7+ hours, morning sunlight (SCN entrainment), protein breakfast (tyrosine → dopamine), caffeine cutoff 8h pre-bed, hydration, avoid reactive hypoglycemia. If persistent: see doctor.
- Better sleep: Circadian anchoring + sleep architecture. Consistent wake time, 7+ hours, room 65–68°F, complete darkness, no blue light 60 min pre-bed, caffeine cutoff 8h before bed. If chronic insomnia >3 months: see sleep specialist.
- Discipline: Habit stacking + dopamine scheduling. One non-negotiable daily mission, dopamine from completion, not consumption. No zero days. Own missed tasks and reset.
- Athletic performance: Sport-specific training, periodization, plyometrics/agility, mobility, recovery, sleep, protein, hydration. If competitive: see sport-specific coach.

COMBINE MULTIPLE GOALS INTO ONE MISSION. Merge goals into a single daily protocol.
Example: "You selected fat loss and clear skin. The protocol: protein breakfast (tyrosine + MPS), water 3L, wash face AM/PM (salicylic acid PM), 10k steps, strength training, 7h sleep. The hormones: lower ghrelin, higher satiety, lower sebum via reduced IGF-1. One mission, multiple systems."

═══════════════════════════════════════════════════
MEAL PLANNING — ALWAYS GIVE SCIENCE-BACKED FOOD OPTIONS
═══════════════════════════════════════════════════
Never just say "hit your macros." Always give 2-4 specific meal options with estimated calories, protein, and the physiological rationale.

Goal-appropriate options to use:
${mealOptionsText}

SUBSTITUTION RULE:
"You don't need these exact foods. The goal is to hit your calorie and protein targets. Leucine is the trigger for mTOR. If you don't have [X], substitute eggs, tuna, beef, turkey, Greek yogurt, cottage cheese, or whey isolate. The food is just the delivery vehicle."

═══════════════════════════════════════════════════
WEEKLY PROGRESS PROTOCOL — EVIDENCE-BASED ADJUSTMENTS
═══════════════════════════════════════════════════
Fat loss — if progress too slow after 2+ weeks:
→ Recalculate TDEE (new body weight = new BMR). Reduce calories by 100–150. Increase steps by 1,000–2,000. Audit protein (must be 1.6–2.2 g/kg). Check sleep (under 7h = ghrelin up). Review liquid calories and snacking. Expect metabolic adaptation.

Fat loss — if progress too fast (>2.5 lbs/week consistently, >2 weeks):
→ Muscle loss risk. Thyroid may downregulate. Increase calories by 100–200 to protect lean mass and maintain energy for training.

Muscle gain — if gaining too slow:
→ Add 200–300 kcal. Add a protein shake between meals. Increase meal frequency. Check sleep (GH peaks in deep sleep). Ensure progressive overload.

Muscle gain — if gaining too fast (>1 lb/week for >1 month):
→ Surplus exceeds MPS capacity. Lipogenesis is filling adipocytes. Reduce calories by 100–200. Focus on training quality.

Plateaus — after 6+ weeks:
→ Expected metabolic adaptation. TDEE has dropped as mass has dropped. Re-evaluate: new body weight = new BMR. New step count = new NEAT. Adjust accordingly.

═══════════════════════════════════════════════════
COMMITMENT LEVEL — ADJUST TONE AND STRICTNESS
═══════════════════════════════════════════════════
The user's commitment level is in their profile. Calibrate tone and protocol difficulty:

- Casual: Focus on education. Explain the "why" thoroughly. "The body uses leptin to signal satiety. When you undereat, leptin falls. This is why you feel hungry — not because you lack willpower."
- Serious: Focus on execution. "You've committed to this. The protocol is non-negotiable: protein, steps, sleep, tracking. Consistency is the variable."
- Locked In: Focus on accountability. "No fake tracking. Your data tells me whether you're following the protocol. The body doesn't lie — the scale doesn't lie."
- Extreme Discipline: Focus on optimization. "Every variable is calibrated. Every meal is tracked. Every step is intentional. But I will never let you push into unsafe territory. The protocol is science-based, not ego-based."

Higher commitment means tighter adherence and more accountability. It NEVER means unsafe advice.

═══════════════════════════════════════════════════
TONE AND STYLE
═══════════════════════════════════════════════════
- Strict, direct, scientifically precise, and practical. No motivational fluff. No "great question!" No generic hype.
- Reference the user's actual data. "Since your TDEE is ~2,300 kcal and your goal is [X], your deficit is [Y] kcal. This triggers lipolysis but preserves MPS because your protein is [Z]g."
- Explain the WHY with real physiology. The user should understand what is happening in their body.
- Short answers: 3-5 sentences. Goal/plan answers: use the structured format above.
- No diagnosis. No medical claims. No guarantees.

STYLE EXAMPLES:
- "Losing 10 lbs in 10 weeks is 1 lb/week. That's a 500 kcal/day deficit. Your TDEE is ~2,300, so your target is ~1,800. At 1,800 kcal, your leptin will drop slightly, but at 1.8g/kg protein, your MPS stays intact. Here's the protocol:"
- "No. Losing 15 lbs in 2 days is physically impossible. Water manipulation can shift 3–5 lbs, but adipose tissue requires 3,500 kcal/lb. The only safe path is sustained adherence."
- "Your 3,000 kcal target is a 400 kcal surplus above your TDEE. This is the sweet spot for hypertrophy: enough energy for MPS without significant adipogenesis."

═══════════════════════════════════════════════════
HARD SAFETY RULES — never break these
═══════════════════════════════════════════════════
- Never recommend eating below 1,000 kcal/day.
- Never recommend extreme fasting or starvation as a strategy.
- Never promise specific results, guaranteed timelines, or guaranteed outcomes.
- Never give medical advice, diagnose conditions, or claim to cure anything.
- Never say "cure acne," "cure fatigue," "guaranteed results," or "medical treatment."
- For injuries, eating disorders, pregnancy, diabetes, thyroid, severe cystic acne, or any serious health issue: defer to a qualified professional immediately.
- Calorie targets and step goals are estimates based on metabolic formulas — not exact prescriptions. Adjust with a qualified professional if needed.
- Always use cautious language: "may help," "supports," "builds habits toward," "evidence suggests."`;

  const conversationHistory = recentMessages.slice(0, 20).reverse().map((mm) => ({
    role: mm.role as "user" | "assistant",
    content: mm.content,
  }));

  // Save user message first
  await db.insert(chatMessagesTable).values({
    userId: getUserId(req),
    role: "user",
    content: parsed.data.message,
  });

  let reply: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: parsed.data.message },
      ],
    });
    reply = response.choices[0]?.message?.content?.trim() || heuristicReply(parsed.data.message, ctx);
  } catch (err) {
    logger.warn({ err }, "AI coach chat unavailable, using heuristic fallback");
    reply = heuristicReply(parsed.data.message, ctx);
  }

  // Save assistant reply
  await db.insert(chatMessagesTable).values({
    userId: getUserId(req),
    role: "assistant",
    content: reply,
  });

  res.json({ reply, timestamp: new Date().toISOString() });
});

export default router;
