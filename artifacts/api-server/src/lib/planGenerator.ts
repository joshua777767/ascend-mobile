import type { UserProfile } from "@workspace/db";

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

const GLOW_GOALS = ["better skin", "higher energy", "better sleep", "less bloating", "better digestion"];
const PRIMARY_GOALS = ["lose fat", "lose weight", "gain weight", "build muscle", "maintain fitness"];

// Order goals so a combined daily mission reads sensibly
const GOAL_ORDER = [
  "lose fat", "lose weight", "gain weight", "build muscle", "maintain fitness",
  "better skin", "higher energy", "better sleep", "discipline",
];

// How each goal is referenced in coach copy
const GOAL_LABELS: Record<string, string> = {
  "lose fat": "fat loss",
  "lose weight": "weight loss",
  "gain weight": "weight gain",
  "build muscle": "muscle building",
  "maintain fitness": "staying fit",
  "better skin": "clear skin",
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
        `Walk ${v.steps.toLocaleString()} steps`,
        `Log every meal`,
        `Train ${v.workoutDays}x this week`,
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

  let goalType = "maintain";
  if (isLoss) goalType = "fat_loss";
  else if (isGain) goalType = "muscle_gain";
  else if (hasGlowGoals) goalType = "glow";

  const weightKg = profile.currentWeightKg;
  const heightCm = profile.heightCm;
  const age = profile.age;
  const isMale = profile.gender.toLowerCase() === "male";
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const activityMult = profile.workoutDaysPerWeek >= 5 ? 1.725
    : profile.workoutDaysPerWeek >= 3 ? 1.55
    : 1.375;

  const tdee = Math.round(bmr * activityMult);

  let calorieTarget: number;
  let proteinTargetG: number;
  let weeklyPace: string;
  let warnings: string | null = null;

  if (goalType === "fat_loss") {
    const deficit = Math.min(500, Math.abs(weightDiff) > 20 ? 750 : 500);
    calorieTarget = Math.max(1200, tdee - deficit);
    proteinTargetG = Math.round(weightKg * 2.2);
    weeklyPace = deficit >= 500 ? "~1 lb / week" : "~0.5 lb / week";
    if (Math.abs(weightDiff) > 20) {
      warnings = "Your goal is ambitious. Stay consistent — do not cut more than planned. Extreme deficits cause muscle loss and burnout.";
    }
  } else if (goalType === "muscle_gain") {
    calorieTarget = tdee + 300;
    proteinTargetG = Math.round(weightKg * 2.4);
    weeklyPace = "~0.5 lb / week (lean bulk)";
  } else {
    calorieTarget = tdee;
    proteinTargetG = Math.round(weightKg * 2.0);
    weeklyPace = "Maintain current weight";
  }

  const waterTargetL = Math.max(2.5, Math.round((weightKg * 0.033) * 10) / 10);

  const stepsTarget = goalType === "fat_loss" ? 10000
    : goalType === "muscle_gain" ? 7500
    : 8000;

  const sleepTargetHours = profile.sleepQuality <= 4 ? 8.5 : 8;

  const workoutDays = profile.workoutDaysPerWeek;
  const sport = profile.sport;
  const workoutFocus = profile.workoutFocus;
  const hasOwnSchedule = profile.hasOwnSchedule;
  const ownSchedule = profile.ownSchedule;

  const sportText = sport && sport !== "no sport" && sport !== "none"
    ? ` | Sport: ${sport === "other" && profile.sportCustom ? profile.sportCustom : sport}`
    : "";

  let workoutSchedule = "";
  if (hasOwnSchedule === "yes" && ownSchedule) {
    workoutSchedule = `Custom schedule: ${ownSchedule}`;
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
    pushHabit(`Train ${workoutDays}x this week`);
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

  // Keep the mission focused even when many goals are combined.
  const finalHabits = keyHabits.slice(0, 12);

  const sportNote = sportText ? ` Training is built around your sport${sportText.replace(" | Sport: ", " (") + ")"}.` : "";
  const goalLabelList = orderedGoals.map((g) => GOAL_LABELS[g] || g);
  const goalText = goalLabelList.length ? joinList(goalLabelList) : "your goals";
  const missionLine = joinList(finalHabits.slice(0, 6).map((h) => h.charAt(0).toLowerCase() + h.slice(1)));
  const skinNote = goals.includes("better skin")
    ? " For skin, habits help — but for persistent acne or a medical skin condition, see a dermatologist."
    : "";

  let nutritionExplanation: string;
  if (goalType === "fat_loss") {
    nutritionExplanation = `This takes real discipline: hold a ${Math.round(tdee - calorieTarget)}-calorie deficit (TDEE ~${tdee}) and hit protein every day. Steps and sleep aren't optional — they're what make the deficit work.`;
  } else if (goalType === "muscle_gain") {
    nutritionExplanation = `You need ${calorieTarget} calories (TDEE ~${tdee}) to grow. Undereating is the #1 reason people don't gain — don't skip meals. Train hard, eat more, sleep more.`;
  } else if (goalType === "glow") {
    nutritionExplanation = `Eat around ${calorieTarget} calories with ${proteinTargetG}g protein. Skin, energy, and sleep all run on the same engine: water, whole foods, and a steady daily routine.`;
  } else {
    nutritionExplanation = `Stay near ${calorieTarget} maintenance calories and hold your protein. Maintenance is discipline, not relaxation.`;
  }

  let coachNotes: string;
  if (hasOwnSchedule === "yes" && ownSchedule) {
    coachNotes = `You picked ${goalText}. The plan respects your own training schedule and builds nutrition and recovery around it. Today's mission: ${missionLine}. Hit ${proteinTargetG}g protein every day regardless of the gym.${sportNote}${skinNote}`;
  } else {
    coachNotes = `You picked ${goalText}. Today's mission: ${missionLine}. ${nutritionExplanation}${sportNote}${skinNote}`;
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
