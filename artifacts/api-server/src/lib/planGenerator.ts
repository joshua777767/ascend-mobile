import type { UserProfile } from "@workspace/db";
import { parseSportSchedule, getSportAdjustmentForPlan } from "./sportUtils";

export interface GeneratedPlan {
  goalType: string;
  calorieTarget: number;
  proteinTargetG: number;
  waterTargetL: number;
  stepsTarget: number;
  sleepTargetHours: number;
  weeklyPace: string;
  workoutSchedule: string;
  keyHabits: string[];
  coachNotes: string;
  warnings: string | null;
}

function parseGoals(goalsJson: unknown): string[] {
  // plans.ts already parses goals into an array before calling generatePlan,
  // but generatePlan may also be called with the raw JSON string. Handle both.
  if (Array.isArray(goalsJson)) return goalsJson.filter((g): g is string => typeof g === "string");
  if (typeof goalsJson === "string") {
    try {
      const parsed = JSON.parse(goalsJson);
      return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

const FOCUS_LABELS: Record<string, string> = {
  lose_fat: "fat loss",
  build_muscle: "muscle building",
  strength: "strength & power",
  athletic_performance: "athletic performance",
  conditioning: "conditioning & endurance",
  general_fitness: "general fitness",
};

const SPORT_HABITS: Record<string, string> = {
  football: "Practice explosive drills — lateral cuts, sprints, jumps",
  basketball: "Include vertical jump work and lateral agility drills",
  soccer: "Prioritize lower body strength and cardiovascular endurance",
  track: "Supplement with sprint mechanics and hip flexor work",
  "boxing/mma": "Train grip strength, rotational power, and footwork daily",
  "baseball/softball": "Prioritize rotational strength and arm care",
  volleyball: "Include vertical jump training and shoulder stability work",
  wrestling: "Train grip strength, explosive takedowns, and neck strength",
};

const GLOW_GOALS = ["higher energy", "better sleep", "less bloating", "better digestion"];
const PRIMARY_GOALS = ["lose fat", "lose weight", "gain weight", "build muscle", "maintain fitness"];
const MAINTENANCE_GOALS = ["maintain fitness", "maintain", "stay fit", "maintenance"];

// Order goals so a combined daily mission reads sensibly
const GOAL_ORDER = [
  "lose fat", "lose weight", "gain weight", "build muscle", "maintain fitness",
  "higher energy", "better sleep", "discipline",
];

// How each goal is referenced in coach copy
const GOAL_LABELS: Record<string, string> = {
  "lose fat": "fat loss",
  "lose weight": "weight loss",
  "gain weight": "weight gain",
  "build muscle": "muscle building",
  "maintain fitness": "staying fit",
  "higher energy": "better energy",
  "better sleep": "better sleep",
  discipline: "discipline",
};

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")} ${period}` : `${hr} ${period}`;
}

function subtractHours(t: string, hours: number): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  let total = h * 60 + (m || 0) - hours * 60;
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

interface HabitVals {
  protein: number;
  cal: number;
  water: number;
  steps: number;
  sleep: number;
  workoutDays: number;
  mealsPerDay: number;
  bedtime: string;
  caffeineCutoff: string;
}

// Real, specific daily actions for every goal Ascend offers
function habitsForGoal(goal: string, v: HabitVals): string[] {
  switch (goal) {
    case "lose fat":
    case "lose weight":
      return [
        `Hit your ${v.cal} calorie target`,
        `Eat ${v.protein}g protein`,
        `Drink ${v.water}L water`,
        `Walk ${v.steps.toLocaleString()} steps`,
        `Log every meal`,
        ...(v.workoutDays > 0 ? [`Train ${v.workoutDays}x this week`] : [`Stay active — steps and movement count`]),
      ];
    case "gain weight":
      return [
        `Eat ${v.cal} calories — don't undereat`,
        `Eat ${v.protein}g protein`,
        `Eat ${v.mealsPerDay}+ meals — never skip`,
        `Add a shake or snack between meals`,
        `Strength train ${v.workoutDays}x this week`,
      ];
    case "build muscle":
      return [
        `Eat ${v.protein}g protein`,
        `Strength train ${v.workoutDays}x — progressive overload`,
        `Beat last session: add a rep or weight`,
        `Sleep ${v.sleep}h for recovery`,
        `Take your rest days — muscle grows in recovery`,
      ];
    case "maintain fitness":
      return [
        `Train ${v.workoutDays}x this week`,
        `Eat ${v.protein}g protein`,
        `Walk ${v.steps.toLocaleString()} steps`,
        `Stay near ${v.cal} maintenance calories`,
      ];
    case "better skin":
      return [
        `Drink ${v.water}L water`,
        `Wash your face morning and night`,
        `Change pillowcase 2x this week`,
        `Limit sugary drinks`,
        `Eat protein and whole foods`,
      ];
    case "higher energy":
      return [
        `Protein breakfast within 1h of waking`,
        `Get sunlight or a short walk this morning`,
        `No caffeine after ${v.caffeineCutoff}`,
        `Drink ${v.water}L water`,
        `Avoid sugar-crash meals`,
      ];
    case "better digestion":
    case "less bloating":
      return [
        `Drink ${v.water}L water throughout the day`,
        `Eat slowly — 20+ minutes per meal`,
        `Limit dairy, gluten, and processed food today`,
        `Walk after meals — even 10 minutes`,
        `Eat fiber: vegetables, legumes, or whole grains`,
      ];
    case "athletic performance":
      return [
        `Drink ${v.water}L water — hydration is performance`,
        `Eat ${v.protein}g protein for recovery`,
        `Train ${v.workoutDays}x — prioritize your sport sessions`,
        `Sleep ${v.sleep}h — that's where gains happen`,
        `Warm up and cool down every session`,
      ];
    case "better sleep":
      return [
        `In bed by ${v.bedtime}`,
        `Same wake time every day`,
        `No caffeine after ${v.caffeineCutoff}`,
        `Screens off 60 min before bed`,
        `Wind down in a cool, dark room`,
      ];
    case "discipline":
      return [
        `Pick one main mission today and finish it`,
        `Hit every non-negotiable: protein, training, sleep`,
        `No zero days — do something toward the goal`,
        `Miss a task? Own it and reset tomorrow`,
      ];
    default:
      return [];
  }
}

export function generatePlan(profile: UserProfile): GeneratedPlan {
  const goals = parseGoals(profile.goals);
  const weightDiff = profile.goalWeightKg - profile.currentWeightKg;
  const isLoss = weightDiff < -1;
  const isGain = weightDiff > 1;

  const hasGlowGoals = goals.some(g => GLOW_GOALS.includes(g));
  // If the user explicitly chose a maintenance goal, always honour it —
  // even if their goal weight differs slightly from their current weight.
  const userChoseMaintenance = goals.some(g => MAINTENANCE_GOALS.includes(g.toLowerCase()));

  let goalType = "maintain";
  if (userChoseMaintenance) {
    goalType = "maintain";
  } else if (isLoss) {
    goalType = "fat_loss";
  } else if (isGain) {
    goalType = "muscle_gain";
  } else if (hasGlowGoals) {
    goalType = "glow";
  }

  // Weight diff in lbs (used for timeline calculations)
  const weightDiffLbs = Math.abs(weightDiff) * 2.2046;

  // Parse targetDate → compute weeksToGoal for timeline-driven calorie targets
  let weeksToGoal: number | null = null;
  let targetDateLabel: string | null = null;
  if (profile.targetDate) {
    const parts = profile.targetDate.split("-").map(Number);
    if (parts.length === 3) {
      const [yr, mo, dy] = parts;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDateObj = new Date(yr, mo - 1, dy);
      const diffDays = Math.round((targetDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 7) {
        weeksToGoal = diffDays / 7;
        targetDateLabel = targetDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    }
  }

  const weightKg = profile.currentWeightKg;
  const heightCm = profile.heightCm;
  const age = profile.age;
  const isMale = profile.gender.toLowerCase() === "male";
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const activityMult = profile.workoutDaysPerWeek === 0 ? 1.2
    : profile.workoutDaysPerWeek >= 5 ? 1.725
    : profile.workoutDaysPerWeek >= 3 ? 1.55
    : 1.375;

  const tdee = Math.round(bmr * activityMult);

  // Commitment level affects intensity — but never below safe floors
  const commitment = profile.commitmentLevel ?? "casual";
  const isCasual = commitment === "casual";
  const isSerious = commitment === "serious";
  const isLocked = commitment === "locked_in";
  const isExtreme = commitment === "extreme_discipline";

  let calorieTarget: number;
  let proteinTargetG: number;
  let weeklyPace: string;
  let warnings: string | null = null;

  // Safe calorie floors by sex
  const calorieFloor = isMale ? 1500 : 1200;

  if (goalType === "fat_loss") {
    // Timeline-driven deficit: if user set a target date, derive the needed pace.
    // Deficit capped at 300–500 cal/day for safety.
    let deficit: number;
    let timelineCapHit = false;

    if (weeksToGoal !== null && weightDiffLbs > 0.5) {
      const neededLbsPerWeek = weightDiffLbs / weeksToGoal;
      if (neededLbsPerWeek > 1) timelineCapHit = true;
      const clampedRate = Math.min(neededLbsPerWeek, 1);
      deficit = Math.round(clampedRate * 500);
      deficit = Math.max(300, Math.min(500, deficit));
    } else {
      deficit = isCasual ? 300 : 500;
    }

    calorieTarget = Math.max(calorieFloor, tdee - deficit);
    // Protein from the lower of current or goal weight, capped at 2.2g/kg (1.0g/lb)
    const proteinBaseKg = Math.min(weightKg, profile.goalWeightKg);
    proteinTargetG = Math.round(proteinBaseKg * 2.2);

    const actualLbsPerWeek = deficit / 500;
    const paceStr = actualLbsPerWeek >= 1.85 ? "~2 lb / week"
      : actualLbsPerWeek >= 1.35 ? "~1.5 lb / week"
      : actualLbsPerWeek >= 0.85 ? "~1 lb / week"
      : "~0.5 lb / week";
    weeklyPace = targetDateLabel ? `${paceStr} → goal by ${targetDateLabel}` : paceStr;

    if (timelineCapHit) {
      warnings = `Your goal requires losing more than 1 lb/week given your timeline. Your plan uses the max safe deficit of 500 cal/day. You'll need more time than your target date to reach your goal safely.`;
    } else if (Math.abs(weightDiff) > 20) {
      warnings = "Your goal is ambitious. Stay consistent and patient — safe fat loss takes time. Do not try to cut more than planned.";
    }
  } else if (goalType === "muscle_gain") {
    // Timeline-driven surplus: if user set a date, derive the needed pace.
    // Surplus capped at 250–400 cal/day for a clean lean bulk.
    let surplus: number;
    let timelineCapHit = false;

    if (weeksToGoal !== null && weightDiffLbs > 0.5) {
      const neededLbsPerWeek = weightDiffLbs / weeksToGoal;
      if (neededLbsPerWeek > 0.8) timelineCapHit = true;
      const clampedRate = Math.min(neededLbsPerWeek, 0.8);
      surplus = Math.round(clampedRate * 500);
      surplus = Math.max(250, Math.min(400, surplus));
    } else {
      surplus = isCasual ? 250 : isExtreme ? 400 : 300;
    }

    calorieTarget = tdee + surplus;
    // Protein from goal weight, capped at 2.2g/kg (1.0g/lb)
    proteinTargetG = Math.round(profile.goalWeightKg * 2.2);

    const actualLbsPerWeek = surplus / 500;
    const paceStr = actualLbsPerWeek >= 0.85 ? "~1 lb / week (lean bulk)"
      : actualLbsPerWeek >= 0.45 ? "~0.5 lb / week (lean bulk)"
      : "~0.25 lb / week (easy gain)";
    weeklyPace = targetDateLabel ? `${paceStr} → goal by ${targetDateLabel}` : paceStr;

    if (timelineCapHit) {
      warnings = `Your goal requires gaining faster than 0.8 lb/week — above the safe lean bulk rate. Your plan uses the max safe surplus of 400 cal/day. You'll need more time than your target date to reach your goal without excess fat gain.`;
    }
  } else {
    calorieTarget = tdee;
    proteinTargetG = Math.round(weightKg * 2.0);
    weeklyPace = "Maintain current weight";
  }

  // Personalized water target — weight base + goal/training adjustments
  // Rest-day base. Sport-day on-top boosts happen dynamically in getWaterSummary.
  let waterTargetL = weightKg * 0.033;
  if (goals.includes("better skin"))                                         waterTargetL += 0.30;
  if (goalType === "fat_loss")                                               waterTargetL += 0.25;
  if (goals.includes("higher energy"))                                       waterTargetL += 0.15;
  if (profile.workoutFocus === "athletic_performance"
    || profile.workoutFocus === "conditioning")                              waterTargetL += 0.35;
  if (profile.workoutDaysPerWeek >= 5)                                       waterTargetL += 0.20;
  else if (profile.workoutDaysPerWeek >= 3)                                  waterTargetL += 0.10;
  if (parseSportSchedule(profile))                                           waterTargetL += 0.20;
  waterTargetL = Math.max(2.3, Math.min(3.8, Math.round(waterTargetL * 10) / 10));

  const stepsTarget = goalType === "fat_loss"
    ? (isExtreme ? 15000 : isLocked ? 12000 : isSerious ? 10000 : isCasual ? 7500 : 10000)
    : goalType === "muscle_gain"
      ? (isCasual ? 7000 : isExtreme ? 8000 : 7500)
      : (isCasual ? 7000 : isExtreme ? 9000 : 8000);

  const sleepTargetHours = profile.sleepQuality <= 4 ? 8.5 : 8;

  const workoutDays = profile.workoutDaysPerWeek;
  const sport = profile.sport;
  const workoutFocus = profile.workoutFocus;
  const hasOwnSchedule = profile.hasOwnSchedule;
  const ownSchedule = profile.ownSchedule;

  const sportText = sport && sport !== "no sport" && sport !== "none"
    ? ` | Sport: ${sport === "other" && profile.sportCustom ? profile.sportCustom : sport}`
    : "";

  // Parse sport schedule for plan adjustments
  const sportSchedule = parseSportSchedule(profile);
  const sportAdjustment = sportSchedule ? getSportAdjustmentForPlan(goalType, sportSchedule) : "";

  let workoutSchedule = "";
  if (workoutDays === 0) {
    workoutSchedule = sportText
      ? `No structured workouts — sport${sportText} is your primary activity. Focus on NEAT: steps, walks, and daily movement.`
      : `No structured workouts — fat loss driven by calorie deficit, high protein, and daily steps. Walk as much as possible.`;
  } else if (hasOwnSchedule === "yes" && ownSchedule) {
    workoutSchedule = `Custom schedule: ${ownSchedule}${sportText}`;
  } else if (workoutFocus && FOCUS_LABELS[workoutFocus]) {
    workoutSchedule = `${workoutDays}x/week — focus: ${FOCUS_LABELS[workoutFocus]}${sportText}`;
  } else if (goalType === "fat_loss") {
    workoutSchedule = `${workoutDays}x/week: ${Math.ceil(workoutDays * 0.6)}x strength + ${Math.floor(workoutDays * 0.4)}x cardio/HIIT${sportText}`;
  } else if (goalType === "muscle_gain") {
    workoutSchedule = `${workoutDays}x/week: progressive overload strength training. No missed sessions.${sportText}`;
  } else {
    workoutSchedule = `${workoutDays}x/week: balanced strength + conditioning${sportText}`;
  }

  const bedtime = profile.sleepTime || "22:30";
  const caffeineCutoff = to12h(subtractHours(bedtime, 8));
  const habitVals: HabitVals = {
    protein: proteinTargetG,
    cal: calorieTarget,
    water: waterTargetL,
    steps: stepsTarget,
    sleep: sleepTargetHours,
    workoutDays,
    mealsPerDay: profile.mealsPerDay ?? 3,
    bedtime: to12h(bedtime),
    caffeineCutoff,
  };

  // Build one combined daily mission from every selected goal, deduped.
  const orderedGoals = [
    ...GOAL_ORDER.filter((g) => goals.includes(g)),
    ...goals.filter((g) => !GOAL_ORDER.includes(g)),
  ];

  const keyHabits: string[] = [];
  const seen = new Set<string>();
  const pushHabit = (h: string) => {
    const key = h.toLowerCase().replace(/\s+/g, " ").trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      keyHabits.push(h);
    }
  };

  // If no nutrition/training goal was picked, still seed core actions so the
  // mission is never empty.
  if (!orderedGoals.some((g) => PRIMARY_GOALS.includes(g))) {
    pushHabit(`Eat ${proteinTargetG}g protein`);
    if (workoutDays > 0) pushHabit(`Train ${workoutDays}x this week`);
  }

  for (const g of orderedGoals) {
    for (const h of habitsForGoal(g, habitVals)) pushHabit(h);
  }

  if (workoutFocus === "athletic_performance") {
    pushHabit("Warm up and run through mobility before training");
    pushHabit("Recover: stretch, foam roll, and hydrate after sessions");
  }

  if (sport && sport !== "no sport" && sport !== "none" && sport !== "other") {
    const sportHabit = SPORT_HABITS[sport.toLowerCase()];
    if (sportHabit) pushHabit(sportHabit);
  }

  // Add accountability habits based on commitment level
  if (isLocked || isExtreme) {
    pushHabit("Check in tonight — journal and review the day");
    if (isExtreme && goalType === "fat_loss") pushHabit("No liquid calories today — water, tea, coffee only");
  }

  // Adjust max habits by commitment level
  const maxHabits = isCasual ? 8 : isExtreme ? 14 : 12;
  const finalHabits = keyHabits.slice(0, maxHabits);

  const sportNote = sportText ? ` Training is built around your sport${sportText.replace(" | Sport: ", " (") + ")"}.` : "";
  const goalLabelList = orderedGoals.map((g) => GOAL_LABELS[g] || g);
  const goalText = goalLabelList.length ? joinList(goalLabelList) : "your goals";
  const missionLine = joinList(finalHabits.slice(0, 6).map((h) => h.charAt(0).toLowerCase() + h.slice(1)));
  const commitmentLabel = commitment === "locked_in" ? "Locked In" : commitment === "extreme_discipline" ? "Extreme Discipline" : commitment === "serious" ? "Serious" : "Casual";
  const commitmentNote = commitment === "locked_in"
    ? ` You chose ${commitmentLabel}. No fake tracking. Hit protein, log meals, train, water, sleep, and check in tonight.`
    : commitment === "extreme_discipline"
      ? ` You chose ${commitmentLabel}. Maximum focus. Every behavior matters. I will push you — but I will never let you hurt yourself.`
      : commitment === "serious"
        ? ` You chose ${commitmentLabel}. Follow the plan daily and track consistently.`
        : "";

  const actualDeficit = Math.round(tdee - calorieTarget);
  let nutritionExplanation: string;
  if (goalType === "fat_loss") {
    if (isExtreme) {
      nutritionExplanation = workoutDays === 0
        ? `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}). This is aggressive — ${weeklyPace} if you execute daily. Hit ${proteinTargetG}g protein every single day or you will lose muscle, not just fat. Steps and sleep are non-negotiable.`
        : `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}). This is aggressive — ${weeklyPace} if you execute daily. Hit ${proteinTargetG}g protein every day to protect muscle. Train, sleep, and track every meal — no days off from the basics.`;
    } else if (isLocked) {
      nutritionExplanation = workoutDays === 0
        ? `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) — ${weeklyPace}. This is a real cut. Hit ${proteinTargetG}g protein and ${stepsTarget.toLocaleString()} steps every day. Calories and sleep are what make this work.`
        : `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) — ${weeklyPace}. This is a real cut. Hit ${proteinTargetG}g protein, train consistently, and sleep 8 hours. Execution every day is what separates this from another failed attempt.`;
    } else if (isSerious) {
      nutritionExplanation = workoutDays === 0
        ? `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) — ${weeklyPace}. Protein, steps, and sleep are your three levers. Hit them consistently and the fat comes off on schedule.`
        : `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) — ${weeklyPace}. Hit protein every day and train consistently. Steps and sleep amplify everything.`;
    } else {
      nutritionExplanation = workoutDays === 0
        ? `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) and hit protein every day. You don't need a gym — your three levers are your calorie target, daily steps, and sleep. Hit all three and the fat comes off.`
        : `${actualDeficit}-calorie daily deficit (TDEE ~${tdee}) and hit protein every day. Steps and sleep aren't optional — they're what make the deficit work.`;
    }
  } else if (goalType === "muscle_gain") {
    nutritionExplanation = `You need ${calorieTarget} calories (TDEE ~${tdee}) to grow. Undereating is the #1 reason people don't gain — don't skip meals. Train hard, eat more, sleep more.`;
  } else if (goalType === "glow") {
    nutritionExplanation = `Eat around ${calorieTarget} calories with ${proteinTargetG}g protein. Energy and sleep run on the same engine: water, whole foods, and a steady daily routine.`;
  } else {
    nutritionExplanation = `Stay near ${calorieTarget} maintenance calories and hold your protein. Maintenance is discipline, not relaxation.`;
  }

  const targetDateNote = targetDateLabel
    ? ` Your goal date is ${targetDateLabel}.`
    : "";

  let coachNotes: string;
  if (hasOwnSchedule === "yes" && ownSchedule) {
    coachNotes = `You picked ${goalText}. The plan respects your own training schedule and builds nutrition and recovery around it. Today's mission: ${missionLine}. Hit ${proteinTargetG}g protein every day regardless of the gym.${commitmentNote}${sportNote}${targetDateNote}${sportAdjustment ? " " + sportAdjustment : ""}`;
  } else {
    coachNotes = `You picked ${goalText}. Today's mission: ${missionLine}. ${nutritionExplanation}${commitmentNote}${sportNote}${targetDateNote}${sportAdjustment ? " " + sportAdjustment : ""}`;
  }

  return {
    goalType,
    calorieTarget,
    proteinTargetG,
    waterTargetL,
    stepsTarget,
    sleepTargetHours,
    weeklyPace,
    workoutSchedule,
    keyHabits: finalHabits,
    coachNotes,
    warnings,
  };
}
