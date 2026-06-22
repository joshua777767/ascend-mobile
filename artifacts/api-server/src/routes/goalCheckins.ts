import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, goalCheckInsTable, userProfilesTable, plansTable } from "@workspace/db";
import { CreateGoalCheckInBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

function parseArr(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function getGoalContext(goal: string, score: number, profile: any): string {
  const name = profile?.name ?? "User";
  const concerns: Record<string, string> = {
    "better skin": `Skin concerns: ${profile?.skinConcerns?.join(", ") || "none reported"}. Sleep: ${profile?.sleepTime ?? "unknown"}. Water: ${profile?.waterIntakeLiters ?? 2}L.`,
    "higher energy": `Energy level: ${profile?.energyLevel ?? 5}/10. Sleep: ${profile?.sleepTime ?? "unknown"}. Wake: ${profile?.wakeTime ?? "unknown"}. Caffeine: ${profile?.caffeineUse || "not reported"}.`,
    "better sleep": `Sleep quality: ${profile?.sleepQuality ?? 5}/10. Sleep time: ${profile?.sleepTime ?? "unknown"}. Wake time: ${profile?.wakeTime ?? "unknown"}. Screen time: ${profile?.screenTimeBeforeBed || "unknown"}.`,
    "discipline": `Commitment level: ${profile?.commitmentLevel || "unknown"}. Workout days: ${profile?.workoutDaysPerWeek ?? 3}/week. Biggest struggle: ${profile?.biggestStruggle || "unknown"}.`,
    "lose fat": `Body type: ${profile?.bodyType ?? "unknown"}. Current weight: ${profile?.currentWeightKg ?? "unknown"}kg. Goal: ${profile?.goalWeightKg ?? "unknown"}kg.`,
    "lose weight": `Body type: ${profile?.bodyType ?? "unknown"}. Current weight: ${profile?.currentWeightKg ?? "unknown"}kg. Goal: ${profile?.goalWeightKg ?? "unknown"}kg.`,
    "build muscle": `Body type: ${profile?.bodyType ?? "unknown"}. Fitness level: ${profile?.fitnessLevel ?? "unknown"}. Goal: ${profile?.goalWeightKg ?? "unknown"}kg.`,
    "gain weight": `Body type: ${profile?.bodyType ?? "unknown"}. Current weight: ${profile?.currentWeightKg ?? "unknown"}kg. Goal: ${profile?.goalWeightKg ?? "unknown"}kg.`,
    "maintain fitness": `Fitness level: ${profile?.fitnessLevel ?? "unknown"}. Workout days: ${profile?.workoutDaysPerWeek ?? 3}/week.`,
  };
  return concerns[goal] || `Goal: ${goal}. Score: ${score}/10.`;
}

// Goals that represent an ongoing state, not a one-time milestone.
// Users with these goals should never see "goal complete" prompts.
const ONGOING_GOALS = new Set([
  "maintain fitness",
  "maintain",
  "stay fit",
  "maintenance",
]);

function determineStatus(score: number, previousScores: number[], goal: string): string {
  // Maintenance/stay-fit goals are permanent ongoing states — never mark them
  // as achieved or ask for "goal complete" confirmation.
  if (ONGOING_GOALS.has(goal.toLowerCase().trim())) {
    if (score <= 5 && previousScores.length >= 2) {
      const recent = previousScores.slice(0, 2);
      if (recent.every(s => Math.abs(s - score) <= 1)) return "plateau";
    }
    return "on_track";
  }

  // previousScores is newest-first (desc order).
  // Two consecutive 9–10 scores → prompt user to confirm goal complete
  if (score >= 9 && previousScores.length > 0 && previousScores[0] >= 9) {
    return "needs_confirmation";
  }
  // Plateau: score stuck at ≤5 with minimal movement for 2+ consecutive check-ins
  if (previousScores.length >= 2) {
    const recent = previousScores.slice(0, 2);
    if (recent.every(s => Math.abs(s - score) <= 1) && score <= 5) {
      return "plateau";
    }
  }
  if (score >= 7) return "achieved";
  return "on_track";
}

async function getGoalFeedback(
  goal: string,
  score: number,
  notes: string | null,
  trend: string | null,
  whatHelped: string | null,
  whatHardened: string | null,
  weekNumber: number,
  profile: any,
  previousScores: number[],
): Promise<{ coachFeedback: string; status: string }> {
  const status = determineStatus(score, previousScores, goal);
  const context = getGoalContext(goal, score, profile);

  const prompt = `You are an elite-level AI performance coach with deep knowledge in physiology, nutrition, dermatology, sleep science, and behavioral psychology.

USER CONTEXT:
${context}

WEEKLY GOAL CHECK-IN:
- Goal: ${goal}
- Week: ${weekNumber}
- Score: ${score}/10
- Trend vs last week: ${trend ?? "not reported"}
- Previous scores: ${previousScores.length > 0 ? previousScores.join(", ") : "first check-in"}
- Status: ${status}
${whatHelped ? `- What helped this week: ${whatHelped}` : ""}
${whatHardened ? `- What made it harder: ${whatHardened}` : ""}
${notes ? `- Notes: ${notes}` : ""}

SCORING INTERPRETATION:
1-3: Significant issues. Need major intervention.
4-6: Struggling. Need specific adjustments and accountability.
7-8: Good progress. Minor tweaks to optimize.
9-10: Excellent. Reinforce what's working.

FEEDBACK RULES BY GOAL:
- "better skin": Focus on hydration, omega-3s, zinc, sleep consistency, and avoiding inflammatory foods. Reference sebum regulation, glycation, and collagen synthesis.
- "higher energy": Focus on glycemic stability, B vitamins, iron, magnesium, circadian rhythm, and cortisol management. Reference ATP synthesis, mitochondrial health.
- "better sleep": Focus on melatonin, GABA, magnesium, screen time, caffeine cutoff, and sleep pressure. Reference sleep architecture, adenosine clearance.
- "discipline": Focus on habit stacking, environment design, dopamine regulation, and identity-based habits. Reference behavioral psychology, prefrontal cortex engagement.
- "lose fat" / "lose weight": Focus on calorie deficit, protein, NEAT, and adherence. Reference metabolic adaptation.
- "build muscle" / "gain weight": Focus on progressive overload, protein, surplus, and recovery. Reference mTOR signaling.
- "maintain fitness": Focus on consistency, stress management, and recovery.
${status === "needs_confirmation" ? `\nThe user has rated this goal 9-10 two weeks in a row. Acknowledge their excellent progress. The app will ask them to confirm the goal is complete.` : ""}

Respond as JSON ONLY:
{
  "coachFeedback": "2-3 sentences. Directly reference what the user said helped or made it harder (quote their words if possible). Give ONE specific, small adjustment for next week that addresses their reported struggle. Use 'may help' language — no absolute claims, no medical diagnoses.",
  "status": "${status}"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { coachFeedback?: string; status?: string };
    return {
      coachFeedback: parsed.coachFeedback ?? `Week ${weekNumber}: Score ${score}/10. Keep executing the fundamentals.`,
      status: parsed.status ?? status,
    };
  } catch (err) {
    logger.warn({ err }, "AI goal check-in feedback unavailable, using fallback");
    return {
      coachFeedback: `Week ${weekNumber}: Score ${score}/10. ${score >= 8 ? "Strong progress. Maintain your current protocol." : score >= 5 ? "Steady progress. Focus on consistency this week." : "Needs improvement. Review your habits and make one specific change."}`,
      status,
    };
  }
}

router.get("/goal-checkins", async (req, res): Promise<void> => {
  const checkins = await db.select().from(goalCheckInsTable)
    .where(eq(goalCheckInsTable.userId, getUserId(req)))
    .orderBy(desc(goalCheckInsTable.createdAt));
  res.json(checkins);
});

router.post("/goal-checkins", async (req, res): Promise<void> => {
  const parsed = CreateGoalCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(400).json({ error: `Invalid input: ${issues}` });
    return;
  }

  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));

  const previous = await db.select().from(goalCheckInsTable)
    .where(eq(goalCheckInsTable.userId, userId))
    .orderBy(desc(goalCheckInsTable.createdAt));

  const goalPrev = previous.filter(p => p.goal === parsed.data.goal);
  const weekNumber = goalPrev.length > 0
    ? Math.max(...goalPrev.map(p => p.weekNumber)) + 1
    : 1;
  const previousScores = goalPrev.map(p => p.score);

  const profileData = profile ? {
    ...profile,
    goals: parseArr(profile.goals),
    skinConcerns: parseArr(profile.skinConcerns),
    digestionConcerns: parseArr(profile.digestionConcerns),
  } : undefined;

  const { coachFeedback, status } = await getGoalFeedback(
    parsed.data.goal,
    parsed.data.score,
    parsed.data.notes ?? null,
    parsed.data.trend ?? null,
    parsed.data.whatHelped ?? null,
    parsed.data.whatHardened ?? null,
    weekNumber,
    profileData,
    previousScores,
  );

  const [checkIn] = await db.insert(goalCheckInsTable).values({
    userId,
    goal: parsed.data.goal,
    weekNumber,
    score: parsed.data.score,
    notes: parsed.data.notes ?? null,
    trend: parsed.data.trend ?? null,
    whatHelped: parsed.data.whatHelped ?? null,
    whatHardened: parsed.data.whatHardened ?? null,
    coachFeedback,
    status,
  }).returning();

  res.status(201).json(checkIn);
});

export default router;
