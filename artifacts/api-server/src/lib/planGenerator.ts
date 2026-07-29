import type { UserProfile } from "@workspace/db";
import {
  parseSportSchedule,
  parseExerciseSchedule,
  getSportAdjustmentForPlan,
  estimateSportCalBurn,
  estimateGameCalBurn,
  estimateGymCalBurn,
  estimateActivityBurn,
} from "./sportUtils";

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
  restDayCalorieTarget: number | null;
  gymDayCalorieTarget: number | null;
  practiceDayCalorieTarget: number | null;
  gameDayCalorieTarget: number | null;
  /**
   * Per-day calorie targets keyed by lowercase weekday name.
   * Each value = goal-adjusted calorieTarget + sum of that day's activity burns.
   * Days absent from the map are rest days — use calorieTarget directly.
   * null when the user has no exercise schedule configured.
   */
  dailyCalorieTargets: Record<string, number> | null;
}

export interface CalorieBreakdown {
  bmr: number | null;
  eer: number;
  energyEquation: "mifflin_st_jeor_adult" | "dri_2023_adolescent";
  activityCategory: "inactive" | "low_active" | "active" | "very_active";
  ageGroup: "under_18" | "adult";
  activityMultiplier: number;
  activityLevelSource: "profile" | "scheduled-exercise-fallback";
  baseTdee: number;
  exerciseCaloriesAdded: number;
  finalMaintenanceCalories: number;
  calorieFloor: number;
  weightLossDeficit: number;
  muscleGainSurplus: number;
  finalCalorieTarget: number;
  proteinTargetG: number;
}

type AdolescentActivityCategory = CalorieBreakdown["activityCategory"];

/**
 * National Academies Dietary Reference Intakes (2023), reproduced by
 * Health Canada (page updated 2025-11-19), ages 9 to <19.
 *
 * These are EER equations (total daily energy requirement), not BMR
 * equations. Height is cm, weight is kg, age is years, and the final
 * constant is the source's thermic-effect-of-food/growth term.
 *
 * The product has five activity labels but the DRI source has four PA
 * categories. This explicit mapping keeps the source category semantics
 * visible instead of silently applying an adult multiplier to adolescents.
 */
function adolescentEer(
  age: number,
  gender: string,
  heightCm: number,
  weightKg: number,
  activityCategory: AdolescentActivityCategory,
): number {
  const male: Record<AdolescentActivityCategory, [number, number, number, number, number]> = {
    inactive: [-447.51, 3.68, 13.01, 13.15, 20],
    low_active: [19.12, 3.68, 8.62, 20.28, 20],
    active: [-388.19, 3.68, 12.66, 20.46, 20],
    very_active: [-671.75, 3.68, 15.38, 23.25, 20],
  };
  const female: Record<AdolescentActivityCategory, [number, number, number, number, number]> = {
    inactive: [55.59, -22.25, 8.43, 17.07, 20],
    low_active: [-297.54, -22.25, 12.77, 14.73, 20],
    active: [-189.55, -22.25, 11.74, 18.34, 20],
    very_active: [-709.59, -22.25, 18.22, 14.25, 20],
  };
  const [constant, ageCoefficient, heightCoefficient, weightCoefficient, adultGrowthTerm] =
    gender.toLowerCase() === "male" ? male[activityCategory] : female[activityCategory];
  // Health Canada's DRI tables use +25 kcal for males and +30 kcal for
  // females ages 9 to <14, then +20 kcal for ages 14 to <19. The coefficient
  // sets are otherwise the same across these two bands.
  const growthTerm = age < 14
    ? (gender.toLowerCase() === "male" ? adultGrowthTerm + 5 : adultGrowthTerm + 10)
    : adultGrowthTerm;
  return constant
    + ageCoefficient * age
    + heightCoefficient * heightCm
    + weightCoefficient * weightKg
    + growthTerm;
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

const PRIMARY_GOALS = ["lose weight", "lose fat", "gain muscle", "gain weight and muscle", "stay fit", "gain weight", "build muscle", "maintain fitness"];
const MAINTENANCE_GOALS = ["stay fit", "maintain fitness", "maintain", "maintenance"];

// Goal adjustments are based on correctly calculated maintenance for every
// user. Absolute caps prevent high-maintenance athletes from receiving
// unnecessarily aggressive cuts or bulks.
const FAT_LOSS_DEFICIT_RATE = 0.20;
const FAT_LOSS_DEFICIT_CAP = 750;
const GAIN_SURPLUS_RATE = 0.15;
const GAIN_SURPLUS_CAP = 600;

// Order goals so a combined daily mission reads sensibly
const GOAL_ORDER = [
  "lose weight", "lose fat", "gain weight and muscle", "gain weight", "gain muscle",
  "build muscle", "stay fit", "maintain fitness", "higher energy", "better sleep", "discipline",
];

// How each goal is referenced in coach copy
const GOAL_LABELS: Record<string, string> = {
  "lose weight": "weight loss",
  "lose fat": "fat loss",
  "gain muscle": "muscle building",
  "gain weight and muscle": "gaining weight and muscle",
  "stay fit": "staying fit",
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
    case "gain muscle":
      return [
        `Eat ${v.protein}g protein — every single day`,
        `Strength train ${v.workoutDays}x — progressive overload`,
        `Beat last session: add a rep or add weight`,
        `Sleep ${v.sleep}h for recovery`,
        `Rest days are mandatory — muscle grows during recovery`,
      ];
    case "gain weight and muscle":
      return [
        `Eat ${v.cal} calories — don't undereat`,
        `Eat ${v.protein}g protein`,
        `Eat ${v.mealsPerDay}+ meals — never skip`,
        `Strength train ${v.workoutDays}x this week`,
        `Add a shake or snack between meals if needed`,
        `Sleep ${v.sleep}h — that's where mass is built`,
      ];
    case "stay fit":
      return [
        `Train ${v.workoutDays}x this week`,
        `Eat ${v.protein}g protein`,
        `Walk ${v.steps.toLocaleString()} steps`,
        `Stay near ${v.cal} maintenance calories`,
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

  // Goal type is driven primarily by the user's chosen goal string.
  // Weight diff is used as a tiebreaker for legacy/ambiguous goal strings only.
  const userChoseLoss = goals.some(g => ["lose weight", "lose fat"].includes(g));
  const userChoseBulk = goals.includes("gain weight and muscle");
  const userChoseRecomp = goals.includes("gain muscle");
  const userChoseMaintenance = goals.some(g => MAINTENANCE_GOALS.includes(g.toLowerCase()));

  let goalType = "maintain";
  if (userChoseLoss) {
    goalType = "fat_loss";
  } else if (userChoseBulk) {
    goalType = "muscle_gain";
  } else if (userChoseRecomp) {
    // "Gain Muscle" with a significant scale-weight goal (> 5 kg / ~11 lb above
    // current weight) is a lean bulk — not a body recomposition. Recomp is
    // appropriate only when body composition change is the goal without meaningful
    // weight gain. Promote to muscle_gain so the correct caloric surplus is applied.
    goalType = weightDiff > 5 ? "muscle_gain" : "recomp";
  } else if (userChoseMaintenance) {
    goalType = "maintain";
  } else if (isLoss) {
    // Legacy/fallback: infer from weight diff when no explicit goal matches
    goalType = "fat_loss";
  } else if (isGain) {
    goalType = "muscle_gain";
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
  const isMinor = age < 18;
  const adultBmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // A standard activity level already includes the user's usual workouts.
  // Therefore, when one is available, do not add workout calories again.
  // Older profiles have no activity level; those use the DRI inactive
  // adolescent category (or the adult sedentary multiplier) and add explicitly
  // scheduled exercise calories only on the relevant day.
  const rawActivityLevel = String(profile.activityLevel ?? "").toLowerCase().trim();
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.20,
    lightly_active: 1.375,
    light: 1.375,
    moderately_active: 1.55,
    moderate: 1.55,
    very_active: 1.725,
    high: 1.725,
    extra_active: 1.90,
    extremely_active: 1.90,
  };
  const normalizedActivityLevel = rawActivityLevel.replace(/[\s-]+/g, "_");
  const profileActivityMultiplier = activityMultipliers[normalizedActivityLevel];
  const activityMult = profileActivityMultiplier ?? 1.20;
  const activityLevelSource = profileActivityMultiplier === undefined
    ? "scheduled-exercise-fallback" as const
    : "profile" as const;

  // The 2023 National Academies DRI adolescent equations are EER equations,
  // so they directly produce total daily energy requirement. They are selected
  // by the DRI activity category rather than multiplying an adult BMR.
  const activityCategory: AdolescentActivityCategory =
    normalizedActivityLevel === "extra_active" || normalizedActivityLevel === "extremely_active"
      ? "very_active"
      : normalizedActivityLevel === "light" || normalizedActivityLevel === "lightly_active"
        ? "low_active"
        : normalizedActivityLevel === "moderate" || normalizedActivityLevel === "moderately_active"
          || normalizedActivityLevel === "high" || normalizedActivityLevel === "very_active"
          ? "active"
          : "inactive";
  const adolescentEerCalories = isMinor
    ? adolescentEer(age, profile.gender, heightCm, weightKg, activityCategory)
    : null;
  const baseTdee = Math.round(adolescentEerCalories ?? adultBmr * activityMult);
  const tdee = baseTdee;

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
  let weightLossDeficit = 0;
  let muscleGainSurplus = 0;

  // Safe calorie floors by sex — raised for under-18 users, who need more
  // energy for growth and development on top of any training.
  const calorieFloor = isMinor
    ? (isMale ? 1800 : 1600)
    : (isMale ? 1500 : 1200);

  if (goalType === "fat_loss") {
    // Every client pursuing fat loss uses the same goal adjustment:
    // 20% of correctly calculated maintenance, capped for safety. Age-specific equations and
    // calorie floors still protect the underlying maintenance and final target.
    const deficit = Math.min(Math.round(tdee * FAT_LOSS_DEFICIT_RATE), FAT_LOSS_DEFICIT_CAP);
    const timelineCapHit = weeksToGoal !== null && weightDiffLbs > 0.5
      ? weightDiffLbs / weeksToGoal > 1
      : false;
    weightLossDeficit = deficit;
    calorieTarget = Math.max(calorieFloor, tdee - deficit);
    // Unified goal-weight protein rule: use the upper end of the requested
    // 0.8–1.0 g/lb range during fat loss to support lean-mass retention.
    proteinTargetG = Math.min(Math.round(profile.goalWeightKg * 2.20462), 250);

    const actualLbsPerWeek = deficit / 500;
    const paceStr = actualLbsPerWeek >= 1.85 ? "~2 lb / week"
      : actualLbsPerWeek >= 1.35 ? "~1.5 lb / week"
      : actualLbsPerWeek >= 0.85 ? "~1 lb / week"
      : actualLbsPerWeek >= 0.55 ? "~0.6 lb / week"
      : "~0.5 lb / week";
    weeklyPace = targetDateLabel ? `${paceStr} → goal by ${targetDateLabel}` : paceStr;

    if (timelineCapHit) {
      warnings = "Your target date requires losing more than about 1 lb/week. Your plan keeps the standard 20% calorie deficit; allow more time rather than cutting calories further.";
    } else if (Math.abs(weightDiff) > 20) {
      warnings = "Your goal is ambitious. Stay consistent and patient — safe fat loss takes time. Do not try to cut more than planned.";
    }
  } else if (goalType === "muscle_gain") {
    // Every client pursuing weight/muscle gain uses the same 15% maintenance
    // surplus, capped to avoid unnecessarily high bulks. Timeline pressure
    // produces a warning but never replaces this consistent goal adjustment.
    const surplus = Math.min(Math.round(tdee * GAIN_SURPLUS_RATE), GAIN_SURPLUS_CAP);
    const timelineCapHit = weeksToGoal !== null && weightDiffLbs > 0.5
      ? weightDiffLbs / weeksToGoal > 1
      : false;

    muscleGainSurplus = surplus;
    calorieTarget = tdee + surplus;
    // Unified goal-weight protein rule: use the upper end of the requested
    // 0.8–1.0 g/lb range while building muscle.
    proteinTargetG = Math.min(Math.round(profile.goalWeightKg * 2.20462), 250);

    const actualLbsPerWeek = surplus / 500;
    const paceStr = actualLbsPerWeek >= 0.85 ? "~1 lb / week (lean bulk)"
      : actualLbsPerWeek >= 0.45 ? "~0.5 lb / week (lean bulk)"
      : "~0.25 lb / week (easy gain)";
    weeklyPace = targetDateLabel ? `${paceStr} → goal by ${targetDateLabel}` : paceStr;

    if (timelineCapHit) {
      warnings = "Your target date requires gaining more than about 1 lb/week. Your plan keeps the standard 15% calorie surplus; allow more time rather than increasing calories further.";
    }
  } else if (goalType === "recomp") {
    // Recomposition: tiny surplus to support muscle growth while minimising fat gain.
    // Under-18: always the flat casual rate — no reason to push a bigger surplus.
    const surplus = isMinor ? 75 : (isCasual ? 75 : 100);
    muscleGainSurplus = surplus;
    calorieTarget = tdee + surplus;
    proteinTargetG = Math.min(Math.round(profile.goalWeightKg * 0.8 * 2.20462), 250);
    weeklyPace = "Recomp: build muscle & reduce body fat simultaneously";
  } else {
    calorieTarget = tdee;
    proteinTargetG = Math.min(Math.round(profile.goalWeightKg * 0.8 * 2.20462), 250);
    weeklyPace = "Maintain current weight";
  }

  // Protein is intentionally age-independent. The goal branches above use
  // the upper end of the requested 0.8–1.0 g/lb range for fat loss/muscle
  // gain and the lower end (0.8 g/lb) for maintenance/recomp.
  proteinTargetG = Math.min(Math.round(proteinTargetG / 5) * 5, 250);

  // ── Sanity guard ─────────────────────────────────────────────────────────────
  // Catches implausible outputs before they reach any user.
  // These conditions should be mathematically impossible given the logic above,
  // but act as a safety net against future edits to the goal/surplus/deficit blocks.
  if (!isMinor && calorieTarget < adultBmr) {
    // Adult target below BMR = below the energy cost of being alive — always a bug.
    calorieTarget = Math.round(adultBmr);
    warnings = (warnings ? warnings + " " : "") +
      "[internal] Calorie target was below BMR and was corrected. Please report this to support.";
  }
  if ((goalType === "muscle_gain") && calorieTarget <= tdee) {
    // Muscle gain requires a surplus — if target is at or below maintenance, something went wrong.
    calorieTarget = tdee + 250;
    warnings = (warnings ? warnings + " " : "") +
      "[internal] Muscle-gain target was not above maintenance and was corrected. Please report this to support.";
  }

  // Personalized water target — weight base + goal/training adjustments
  // Rest-day base. Sport-day on-top boosts happen dynamically in getWaterSummary.
  let waterTargetL = weightKg * 0.033;
  if (goalType === "fat_loss")                                               waterTargetL += 0.25;
  if (goalType === "recomp")                                                 waterTargetL += 0.10;
  if (profile.workoutFocus === "athletic_performance"
    || profile.workoutFocus === "conditioning")                              waterTargetL += 0.35;
  if (profile.workoutDaysPerWeek >= 5)                                       waterTargetL += 0.20;
  else if (profile.workoutDaysPerWeek >= 3)                                  waterTargetL += 0.10;
  if (parseSportSchedule(profile))                                           waterTargetL += 0.20;
  waterTargetL = Math.max(2.3, Math.min(3.8, Math.round(waterTargetL * 10) / 10));

  const stepsTarget = goalType === "fat_loss"
    ? (isExtreme ? 15000 : isLocked ? 12000 : isSerious ? 10000 : 7500)
    : goalType === "muscle_gain"
      ? (isCasual ? 7000 : isExtreme ? 8000 : 7500)
    : goalType === "recomp"
      ? (isCasual ? 7500 : isExtreme ? 9000 : 8000)
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
  } else if (goalType === "recomp") {
    workoutSchedule = `${workoutDays}x/week: strength training with progressive overload. Recomp demands consistency.${sportText}`;
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
  } else if (goalType === "recomp") {
    nutritionExplanation = `You need ${calorieTarget} calories (TDEE ~${tdee}) with a tiny surplus to fuel muscle growth without adding fat. Hit ${proteinTargetG}g protein every day — that's the engine of recomp. Train with progressive overload and sleep 8+ hours. Results come slower than a bulk, but you stay lean.`;
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

  coachNotes += ` Protein is calculated consistently from your goal or target body weight and your selected goal, regardless of age.`;

  // ── Day-specific calorie targets ──────────────────────────────────────────
  //
  // Architecture: calorieTarget is the goal-adjusted base (deficit/surplus
  // already applied, lifestyle TDEE × 1.2 only — no exercise in base).
  // Exercise calories are added on top per day so they are never double-counted:
  //
  //   rest day:     calorieTarget                   (goal-adjusted, lifestyle only)
  //   active day:   calorieTarget + Σ activityBurns  (fallback profiles only)
  //
  // New path  — customWorkoutSchedule (new per-day per-activity format):
  //   dailyCalorieTargets[day] = calorieTarget + Σ estimateActivityBurn(activity, kg)
  //
  // Legacy path — sportSchedule (old single-sport format), kept for backward compat:
  //   practiceDayCalorieTarget = calorieTarget + practiceBurn
  //   gameDayCalorieTarget     = calorieTarget + gameBurn   (hard intensity)
  //
  // The legacy gymDayCalorieTarget (one value for all gym days) is also kept
  // for users who haven't migrated to the new per-day schedule.

  let restDayCalorieTarget: number | null = calorieTarget;
  let gymDayCalorieTarget: number | null = null;
  let practiceDayCalorieTarget: number | null = null;
  let gameDayCalorieTarget: number | null = null;
  let dailyCalorieTargets: Record<string, number> | null = null;
  let exerciseCaloriesAdded = 0;

  // ── New path: per-day per-activity schedule ──────────────────────────────
  const exerciseSchedule = parseExerciseSchedule(profile);
  if (exerciseSchedule && exerciseSchedule.days.length > 0 && activityLevelSource === "scheduled-exercise-fallback") {
    const map: Record<string, number> = {};
    for (const day of exerciseSchedule.days) {
      if (!day.day || day.activities.length === 0) continue;
      const burn = day.activities.reduce(
        (sum, act) => sum + estimateActivityBurn(act, weightKg),
        0,
      );
      exerciseCaloriesAdded = Math.max(exerciseCaloriesAdded, burn);
      map[day.day.toLowerCase()] = Math.max(calorieFloor, calorieTarget + burn);
    }
    if (Object.keys(map).length > 0) {
      dailyCalorieTargets = map;
      restDayCalorieTarget = calorieTarget;
    }
  }

  // ── Legacy path: old per-type single-value targets ───────────────────────
  // Always computed so existing users (before migration) still see correct targets.

  // Gym day — add one session's worth of calories on gym days.
  if (workoutDays > 0 && activityLevelSource === "scheduled-exercise-fallback") {
    const gymBurn = estimateGymCalBurn(profile.workoutFocus, weightKg);
    gymDayCalorieTarget = Math.max(calorieFloor, calorieTarget + gymBurn);
  }

  // Sport days — practice and game burns are additive on top of the lifestyle base.
  const sportEntry = parseSportSchedule(profile);
  if (sportEntry && activityLevelSource === "scheduled-exercise-fallback") {
    const practiceBurn = estimateSportCalBurn(
      sportEntry.sport,
      sportEntry.durationMinutes,
      sportEntry.intensity,
      profile.currentWeightKg,
    );
    practiceDayCalorieTarget = Math.max(calorieFloor, calorieTarget + practiceBurn);

    if (sportEntry.gameDays && sportEntry.gameDays.length > 0) {
      const gameBurn = estimateGameCalBurn(
        sportEntry.sport,
        sportEntry.durationMinutes,
        profile.currentWeightKg,
      );
      gameDayCalorieTarget = Math.max(calorieFloor, calorieTarget + gameBurn);
    }

    // If we didn't already populate dailyCalorieTargets from the new schedule,
    // build it from the legacy sport schedule for backward compat.
    if (!dailyCalorieTargets) {
      const map: Record<string, number> = {};
      const practiceBurnVal = estimateSportCalBurn(
        sportEntry.sport,
        sportEntry.durationMinutes,
        sportEntry.intensity,
        weightKg,
      );
      for (const d of sportEntry.days) {
        map[d.toLowerCase()] = Math.max(calorieFloor, calorieTarget + practiceBurnVal);
      }
      if (sportEntry.gameDays && sportEntry.gameDays.length > 0) {
        const gameBurnVal = estimateGameCalBurn(
          sportEntry.sport,
          sportEntry.durationMinutes,
          weightKg,
        );
        for (const d of sportEntry.gameDays) {
          map[d.toLowerCase()] = Math.max(calorieFloor, calorieTarget + gameBurnVal);
        }
      }
      if (Object.keys(map).length > 0) {
        dailyCalorieTargets = map;
      }
    }
  }

  // Set rest day target whenever any exercise-day target exists.
  if (gymDayCalorieTarget !== null || practiceDayCalorieTarget !== null) {
    restDayCalorieTarget = calorieTarget;
  }

  const finalMaintenanceCalories = baseTdee + exerciseCaloriesAdded;
  const calorieBreakdown: CalorieBreakdown = {
    bmr: isMinor ? null : Math.round(adultBmr),
    eer: baseTdee,
    energyEquation: isMinor ? "dri_2023_adolescent" : "mifflin_st_jeor_adult",
    activityCategory,
    ageGroup: isMinor ? "under_18" : "adult",
    activityMultiplier: activityMult,
    activityLevelSource,
    baseTdee,
    exerciseCaloriesAdded,
    finalMaintenanceCalories,
    calorieFloor,
    weightLossDeficit,
    muscleGainSurplus,
    finalCalorieTarget: calorieTarget,
    proteinTargetG,
  };
  console.info("[calorie-breakdown]", {
    ...calorieBreakdown,
    age,
    gender: profile.gender,
    weightKg,
    heightCm,
    goalType,
  });

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
    restDayCalorieTarget,
    gymDayCalorieTarget,
    practiceDayCalorieTarget,
    gameDayCalorieTarget,
    dailyCalorieTargets,
  };
}
