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
import { USER_ID } from "./users";

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
// Deterministic, goal-aware fallback used when the AI is unavailable
// (e.g. quota exceeded) so the coach still gives real, useful answers.
// ---------------------------------------------------------------------------

function has(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function heuristicReply(message: string, ctx: ChatContext): string {
  const m = message.toLowerCase();
  const cal = ctx.calorieTarget;
  const pro = ctx.proteinTarget;
  const calStr = cal ? `~${cal} calories` : "a sensible calorie level";
  const proStr = pro ? `~${pro}g protein` : "enough protein";
  const days = ctx.profile?.workoutDaysPerWeek ?? 3;

  // 0a. Crisis / self-harm -> compassionate redirect to real help (highest priority)
  if (has(m, ["suicid", "kill myself", "killing myself", "want to die", "wanna die", "self harm", "self-harm", "selfharm", "harm myself", "hurt myself", "cut myself", "end it all", "end my life", "ending my life", "no reason to live", "better off dead"])) {
    return "I'm not the right resource for this, and you deserve real support. Please reach out to a doctor, a mental health professional, or a local crisis line right now. You matter — talk to someone who can help today.";
  }

  // 0b. Medical conditions / injuries -> defer to a professional, no medical advice
  if (has(m, [
    "diabetes", "diabetic", "pregnant", "pregnancy", "eating disorder", "anorexia",
    "anorexic", "bulimia", "bulimic", "injured", "injury", "thyroid", "heart condition",
    "blood pressure", "medication", "prescribed", "chronic illness", "medical condition",
    "hurt my", "sprain", "sprained", "pulled a muscle", "knee pain", "back pain",
    "shoulder pain", "joint pain", "sharp pain",
  ])) {
    return "That's outside what I can coach on. For anything medical, talk to a qualified doctor or registered professional first. Once you have their clearance, I'll build your training and nutrition around it — your health comes first.";
  }

  // 1. Discouraged / slipped up / wants to quit -> ownership + reset (most specific)
  if (
    has(m, [
      "messed up", "mess up", "i failed", "failed today", "give up", "giving up",
      "want to quit", "feel bad", "discouraged", "depressed", "off track",
      "ruined", "cheated", "blew it", "screwed up", "fell off", "feel like quitting",
      "feel terrible", "i'm done", "im done", "hate myself", "disappointed",
      "feeling down", "feel down", "feeling low", "so sad", "feel hopeless",
    ])
  ) {
    return "Good. Own it, don't spiral. One bad day does not ruin the mission. Tonight: water, no more random snacks, sleep on time. Tomorrow we fix breakfast and get back on schedule. You're still in this — keep going.";
  }

  // 2. Missed / skipped workout
  if (has(m, ["miss", "skip", "didn't work out", "didnt work out"]) && has(m, ["workout", "gym", "training", "exercise", "session", "lift"])) {
    return "Missing one session isn't failure — quitting is. Don't punish yourself with a brutal double. Get a short one in today: 20-30 minutes on the main lifts or a brisk walk, then back to your normal schedule tomorrow. Momentum over perfection.";
  }

  // 3. Night snacking / cravings
  if (has(m, ["snack", "snacking", "craving", "cravings", "binge", "eat at night", "late night"])) {
    return `Night snacking is usually too little protein during the day, not real hunger. Hit ${proStr} across your real meals, drink water first, and close the kitchen early — brush your teeth to signal you're done. If you must snack, make it protein, not sugar.`;
  }

  // 4. Lose fat
  if (has(m, ["lose fat", "fat loss", "lose weight", "burn fat", "get lean", "leaner", "cut weight", "slim down", "losing weight"])) {
    return `Hit ${proStr} a day, stay in a reasonable calorie deficit (${calStr}), walk daily, lift weights, sleep on time, and stop drinking your calories. No starvation and no crash diets — steady and consistent is what actually works.`;
  }

  // 5. Gain weight
  if (has(m, ["gain weight", "gain faster", "put on weight", "too skinny", "skinny", "bulk", "bulking", "eat more", "hard gainer", "gaining weight"])) {
    return `You need calories on schedule, not random motivation. Eat 3-4 meals, add a shake, push toward ${calStr} and ${proStr} a day, lift consistently, and stop skipping breakfast. Be patient — healthy weight goes on gradually.`;
  }

  // 6. Build muscle
  if (has(m, ["build muscle", "gain muscle", "more muscle", "get stronger", "strength", "grow muscle", "muscle mass"])) {
    return `Muscle is progressive lifting plus enough food. Train ${days}x/week, push for a little more weight or reps over time, eat ${proStr} daily, and sleep 7-8 hours. It's earned week by week, not overnight — stay consistent.`;
  }

  // 7. Stay fit / maintain
  if (has(m, ["stay fit", "staying fit", "maintain", "keep fit", "stay in shape", "maintenance"])) {
    return `Staying fit is just refusing to drift. Keep training ${days}x/week, hold your protein, walk daily, and sleep on schedule. Maintenance is a skill — protect your habits and you keep everything you built.`;
  }

  // 8. Workouts / training (general)
  if (has(m, ["workout", "work out", "exercise", "train", "training", "gym", "lift", "cardio", "routine"])) {
    return `Keep it simple and consistent: ${days}x/week, build sessions around compound movements, and add a little weight or reps over time. A focused 40 minutes beats a random 90. Check your Workouts tab and just execute today's session.`;
  }

  // 9. Meals / what to eat
  if (has(m, ["what should i eat", "what to eat", "eat next", "meal", "food", "diet", "nutrition", "calories", "macros", "breakfast", "lunch", "dinner"])) {
    return `Build every plate around a protein source and vegetables, then add a smart carb. Aim for ${proStr} and ${calStr} across the day, and don't skip meals. Snap a photo on the Meals tab and I'll score it for you.`;
  }

  // 10. Sleep
  if (has(m, ["sleep", "insomnia", "can't sleep", "cant sleep", "rest", "bedtime", "stay up"])) {
    return "Sleep is where progress actually happens. Aim for 7-8 hours, same wake time every day, screens off 30-60 minutes before bed, and no caffeine late. Fix sleep and your energy, hunger, and willpower all improve.";
  }

  // 11. Energy / fatigue
  if (has(m, ["energy", "tired", "fatigue", "exhausted", "no energy", "low energy", "sluggish", "drained"])) {
    return "Low energy is usually sleep, food, or water — not willpower. Lock in 7-8 hours, eat real meals (don't skip breakfast), hydrate, and get sunlight plus a short walk early. Fix the basics before blaming yourself.";
  }

  // 12. Skin
  if (has(m, ["skin", "acne", "breakout", "complexion", "pimple", "clear skin"])) {
    return "Skin responds to habits: drink water, sleep enough, cut excess sugar and greasy fast food, and keep a simple, consistent routine. Give it a few weeks before judging results. If something looks serious, see a professional — that's outside my lane.";
  }

  // 13. Discipline / consistency
  if (has(m, ["discipline", "disciplined", "consistent", "consistency", "stay on track", "stick to", "habit", "routine help"])) {
    return "Discipline isn't motivation — it's shrinking the decision. Plan tomorrow's meals and training tonight, keep your schedule visible, and don't negotiate with yourself in the moment. Win the small reps daily and discipline becomes automatic.";
  }

  // 14. Motivation / feeling stuck
  if (has(m, ["motivat", "inspire", "feel like", "struggling", "hard to", "can't keep", "cant keep", "lazy", "no drive", "positive", "positivity", "stay positive", "encourage", "pep talk", "keep going"])) {
    return "Motivation comes and goes — that's normal, don't wait for it. Do the next small action: one meal, one workout, one early night. Action creates momentum, not the other way around. Keep stacking small wins.";
  }

  // 15. Default
  return `Execute the basics and you win: hit ${proStr}, stay near ${calStr}, train on schedule, drink water, and sleep on time. Tell me exactly what you're stuck on — meals, workouts, sleep, energy, or staying consistent — and I'll give you the next step.`;
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
    parts.push(
      `PROFILE: ${profile.name}, ${profile.age}yo ${profile.gender}. ` +
        `${Math.round(profile.currentWeightKg * LBS)}lbs now -> ${Math.round(profile.goalWeightKg * LBS)}lbs goal. ` +
        `Fitness level: ${profile.fitnessLevel}. Gym access: ${profile.gymAccess}. ` +
        `Trains ${profile.workoutDaysPerWeek}x/week. Wake ${profile.wakeTime}, sleep ${profile.sleepTime}. ` +
        `Sleep quality ${profile.sleepQuality}/10, energy ${profile.energyLevel}/10, stress ${profile.stressLevel}/10. ` +
        (goals.length ? `Goals: ${goals.join(", ")}. ` : "") +
        (skin.length ? `Skin concerns: ${skin.join(", ")}. ` : "") +
        (profile.biggestStruggle ? `Biggest struggle: ${profile.biggestStruggle}. ` : "") +
        `Always reference weight in pounds (lbs), never kilograms.`,
    );
  } else {
    parts.push("PROFILE: none yet.");
  }

  if (plan) {
    parts.push(
      `PLAN: goal ${plan.goalType}, ${plan.calorieTarget} cal/day, ${plan.proteinTargetG}g protein/day, ` +
        `${plan.waterTargetL}L water, ${plan.stepsTarget} steps, ${plan.sleepTargetHours}h sleep. Weekly pace: ${plan.weeklyPace}.`,
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
    parts.push(`LATEST WEIGH-IN: ${Math.round(w.weightKg * LBS)}lbs (week ${w.weekNumber}). ${w.adjustment ? `Adjustment: ${w.adjustment}.` : ""}`);
  }

  return parts.join("\n");
}

router.get("/chat/history", async (req, res): Promise<void> => {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, USER_ID))
    .orderBy(chatMessagesTable.createdAt);
  res.json(messages);
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));

  const [recentMessages, recentMeals, recentWorkouts, recentJournals, recentWeighIns, recentReviews] = await Promise.all([
    db.select().from(chatMessagesTable).where(eq(chatMessagesTable.userId, USER_ID)).orderBy(desc(chatMessagesTable.createdAt)).limit(20),
    db.select().from(mealsTable).where(eq(mealsTable.userId, USER_ID)).orderBy(desc(mealsTable.loggedAt)).limit(3),
    db.select().from(workoutsTable).where(eq(workoutsTable.userId, USER_ID)).orderBy(desc(workoutsTable.completedAt)).limit(3),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, USER_ID)).orderBy(desc(journalEntriesTable.createdAt)).limit(2),
    db.select().from(weighInsTable).where(eq(weighInsTable.userId, USER_ID)).orderBy(desc(weighInsTable.loggedAt)).limit(1),
    db.select().from(coachReviewsTable).where(eq(coachReviewsTable.userId, USER_ID)).orderBy(desc(coachReviewsTable.createdAt)).limit(1),
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

  const systemPrompt = `You are Project Upgrade — a strict, encouraging, and safe AI transformation coach. You answer the user's questions about losing fat, gaining weight, building muscle, staying fit, workouts, meal choices, sleep, energy, skin habits, discipline, motivation, and staying positive when they feel discouraged.

USE THE USER'S REAL DATA below to personalize every answer. Reference their goals, targets, schedule, meals, workouts, journal, and progress when relevant.

${contextSummary}

TONE:
- Strict but encouraging. Direct but never mean. Positive but never corny. Always safe and professional.
- Short answers: 2-4 sentences. No fluff, no "great question!", no generic hype.
- When the user is discouraged, acknowledge it briefly, then redirect to the next concrete action.

STYLE EXAMPLES (match this voice, do not copy verbatim):
- User: "I messed up today" -> "Good. Own it, don't spiral. One bad meal does not ruin the mission. Tonight: water, no more random snacks, sleep on time. Tomorrow we fix breakfast and get back on schedule."
- User: "How do I gain weight?" -> "You need calories on schedule, not random motivation. Eat 3-4 meals, add a shake, lift consistently, and stop skipping breakfast."
- User: "How do I lose fat?" -> "Hit protein, stay in a reasonable calorie deficit, walk daily, lift weights, sleep on time, and stop drinking calories."

HARD RULES:
- No medical advice and no diagnosing conditions. For minors, eating disorders, diabetes, pregnancy, injuries, or serious health issues, tell them to speak with a qualified professional.
- Never recommend starvation, extreme fasting, crash diets, or dangerous practices. Always promote reasonable, sustainable habits.
- Never promise guaranteed or specific results or timelines. Talk in terms of consistent effort and progress.
- Always tie answers back to the user's actual goals and data.`;

  const conversationHistory = recentMessages.slice(0, 20).reverse().map((mm) => ({
    role: mm.role as "user" | "assistant",
    content: mm.content,
  }));

  // Save user message first
  await db.insert(chatMessagesTable).values({
    userId: USER_ID,
    role: "user",
    content: parsed.data.message,
  });

  let reply: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
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
    userId: USER_ID,
    role: "assistant",
    content: reply,
  });

  res.json({ reply, timestamp: new Date().toISOString() });
});

export default router;
