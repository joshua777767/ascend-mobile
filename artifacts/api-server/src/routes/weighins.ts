import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, weighInsTable, plansTable, userProfilesTable } from "@workspace/db";
import { CreateWeighInBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { getUserId } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const toLbs = (kg: number) => Math.round(kg * 2.2046226 * 10) / 10;

function fallbackAdjustment(
  diffLbs: number,
  goalType: string,
  distToGoalLbs: number,
  weekNumber: number,
): { adjustment: string; coachMessage: string } {
  if (goalType === "fat_loss") {
    if (diffLbs === 0) {
      return {
        adjustment: "Scale didn't move. Audit your snacks and liquid calories — those are usually the hidden culprit. Cut 100-150 calories and add 1,000 steps daily this week.",
        coachMessage: "No change on the scale. That's a signal, not a failure. Tighten up: log every meal, cut liquid calories completely, and hit your protein target every single day. The scale follows the habits.",
      };
    }
    if (diffLbs < -2.5) {
      return {
        adjustment: "Progress is too fast — more than 2.5 lbs in a week is likely muscle and water, not just fat. Increase calories by 150-200 to protect muscle and sustain the deficit long-term.",
        coachMessage: `Dropping ${Math.abs(diffLbs).toFixed(1)} lbs in a week is too aggressive. That pace causes muscle loss and energy crashes that derail progress. Add 150-200 calories — still a deficit, but sustainable. Protecting muscle is protecting your metabolism.`,
      };
    }
    if (diffLbs < -0.5) {
      return {
        adjustment: `Solid pace at ${Math.abs(diffLbs).toFixed(1)} lbs down. Keep calories and protein steady. Add 500-1,000 more steps if you want to accelerate slightly.`,
        coachMessage: `Down ${Math.abs(diffLbs).toFixed(1)} lbs this week — exactly on track. ${distToGoalLbs.toFixed(1)} lbs to go. Stay consistent: same calories, same protein, same training schedule. Do not change what is working.`,
      };
    }
    // Gained or barely moved on fat loss
    return {
      adjustment: "Progress stalled. Reduce calories by 100-150, increase daily steps by 1,000-2,000, hit protein every meal, and audit any snacks or drinks outside your plan.",
      coachMessage: `The scale went the wrong direction. That means something isn't matching the plan — likely snacks, liquid calories, or skipped protein. This week: log every meal, no liquid calories, and walk more. Execution fixes this.`,
    };
  }

  if (goalType === "muscle_gain") {
    if (diffLbs <= 0) {
      return {
        adjustment: "Not gaining. Add 200-300 calories from quality sources: oats, rice, peanut butter, whole milk, or a protein shake. Hit 4+ meals daily and stop skipping breakfast.",
        coachMessage: `No gain this week. You are probably under-eating or skipping meals. Add a shake between meals, push to ${weekNumber > 4 ? "4+" : "3+"} meals per day, and hit your calorie target every day — not just some days. Consistency is what builds mass.`,
      };
    }
    if (diffLbs > 1.0) {
      return {
        adjustment: "Gaining faster than 1 lb/week for a bulk means some is fat. Reduce calories by 100-200 — keep the surplus, but controlled. Keep lifting heavy.",
        coachMessage: `Up ${diffLbs.toFixed(1)} lbs this week — gaining a bit fast. Some fat gain in a bulk is normal, but over 1 lb/week consistently starts adding more fat than muscle. Trim 100-200 calories and keep training hard.`,
      };
    }
    return {
      adjustment: `Gaining ${diffLbs.toFixed(1)} lbs this week — solid lean bulk pace. Keep calories and protein steady. Progressive overload in training is the other half of this equation.`,
      coachMessage: `Up ${diffLbs.toFixed(1)} lbs. That's the target range for lean mass gain. ${distToGoalLbs.toFixed(1)} lbs to go. Keep training with progressive overload and hitting your calorie and protein targets every day.`,
    };
  }

  // maintain / general
  if (Math.abs(diffLbs) <= 1.0) {
    return {
      adjustment: "Weight stable — maintenance is working. Keep executing the basics and adjust only if you want a new direction.",
      coachMessage: `Scale is holding steady at ${distToGoalLbs.toFixed(1)} lbs from your goal. That's maintenance working. Keep protein, training, and sleep consistent — this is what sustainable looks like.`,
    };
  }
  return {
    adjustment: "Weight shifted more than expected. Review your calorie intake and training schedule this week.",
    coachMessage: "Weigh-in logged. Keep executing the basics: protein, sleep, training. The scale follows the habits.",
  };
}

async function getAdjustment(
  weightKg: number,
  previousWeightKg: number | null,
  goalType: string,
  goalWeightKg: number,
  weekNumber: number,
  profile: { name?: string | null; workoutDaysPerWeek?: number | null } | undefined,
): Promise<{ adjustment: string; coachMessage: string }> {
  const currentLbs = toLbs(weightKg);
  const goalLbs = toLbs(goalWeightKg);
  const diffLbs = previousWeightKg !== null ? Math.round((toLbs(weightKg) - toLbs(previousWeightKg)) * 10) / 10 : 0;
  const distToGoalLbs = Math.round(Math.abs(currentLbs - goalLbs) * 10) / 10;
  const days = profile?.workoutDaysPerWeek ?? 3;

  let progressContext: string;
  if (goalType === "fat_loss") {
    if (previousWeightKg === null) {
      progressContext = "First weigh-in — baseline established.";
    } else if (diffLbs < -2.5) {
      progressContext = `LOSING TOO FAST: down ${Math.abs(diffLbs).toFixed(1)} lbs this week — above safe limit of 2 lbs/week. Risk of muscle loss.`;
    } else if (diffLbs <= -0.5) {
      progressContext = `ON TRACK: down ${Math.abs(diffLbs).toFixed(1)} lbs this week — solid fat-loss pace.`;
    } else if (diffLbs > 0) {
      progressContext = `STALLED/GAINING: up ${diffLbs.toFixed(1)} lbs on a fat-loss plan — something is off.`;
    } else {
      progressContext = `NO CHANGE: scale didn't move — need to tighten the plan.`;
    }
  } else if (goalType === "muscle_gain") {
    if (previousWeightKg === null) {
      progressContext = "First weigh-in — baseline established for lean bulk.";
    } else if (diffLbs > 1.0) {
      progressContext = `GAINING TOO FAST: up ${diffLbs.toFixed(1)} lbs — likely adding excess fat. Slow the surplus.`;
    } else if (diffLbs > 0) {
      progressContext = `ON TRACK: up ${diffLbs.toFixed(1)} lbs this week — solid lean bulk pace.`;
    } else {
      progressContext = `NOT GAINING: scale didn't move or dropped — under-eating.`;
    }
  } else {
    progressContext = `Weight change: ${diffLbs > 0 ? "+" : ""}${diffLbs.toFixed(1)} lbs this week.`;
  }

  try {
    const prompt = `You are a strict, direct AI transformation coach at the level of a $50/month premium personal trainer.

USER DATA:
- Name: ${profile?.name ?? "User"}
- Goal type: ${goalType}
- Goal weight: ${goalLbs} lbs
- Current weight: ${currentLbs} lbs
- Previous weight: ${previousWeightKg !== null ? `${toLbs(previousWeightKg)} lbs` : "unknown (first weigh-in)"}
- Week: ${weekNumber}
- Distance to goal: ${distToGoalLbs} lbs
- Weekly change: ${diffLbs > 0 ? "+" : ""}${diffLbs.toFixed(1)} lbs
- Trains: ${days}x/week
- Progress assessment: ${progressContext}

ADJUSTMENT LOGIC — follow these rules:
Fat loss — too slow or no change: reduce calories by 100-150, add 1,000-2,000 steps, fix protein, audit snacks and liquid calories, improve sleep.
Fat loss — too fast (>2.5 lbs/week): warn about muscle loss, increase calories by 150-200 to protect muscle while keeping deficit.
Fat loss — on track (0.5-2.5 lbs/week): reinforce what's working, keep targets steady.
Muscle gain — not gaining: add 200-300 calories, add a protein shake, increase meal frequency, stop skipping meals.
Muscle gain — gaining too fast (>1 lb/week): reduce calories slightly by 100-200 to minimize fat gain.
Muscle gain — on track: reinforce, keep lifting heavy with progressive overload.

Respond as JSON ONLY:
{
  "adjustment": "1-2 specific, concrete sentences: exactly what to change this week (calories, steps, meals, protein, sleep). Reference the actual numbers.",
  "coachMessage": "2-3 sentences: strict, direct, personal. Reference their actual progress numbers. Not generic. Acknowledge the result, give the next action."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { adjustment?: string; coachMessage?: string };
    return {
      adjustment: parsed.adjustment ?? fallbackAdjustment(diffLbs, goalType, distToGoalLbs, weekNumber).adjustment,
      coachMessage: parsed.coachMessage ?? fallbackAdjustment(diffLbs, goalType, distToGoalLbs, weekNumber).coachMessage,
    };
  } catch (err) {
    logger.warn({ err }, "AI weigh-in adjustment unavailable, using heuristic fallback");
    return fallbackAdjustment(diffLbs, goalType, distToGoalLbs, weekNumber);
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
  const goalWeightKg = profile?.goalWeightKg ?? 70;

  const { adjustment, coachMessage } = await getAdjustment(
    parsed.data.weightKg,
    prevWeight,
    goalType,
    goalWeightKg,
    weekNumber,
    profile ? { name: profile.name, workoutDaysPerWeek: profile.workoutDaysPerWeek } : undefined,
  );

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
