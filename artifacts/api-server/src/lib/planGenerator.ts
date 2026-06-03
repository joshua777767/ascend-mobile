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

function parseGoals(goalsJson: string): string[] {
  try { return JSON.parse(goalsJson); } catch { return []; }
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

export function generatePlan(profile: UserProfile): GeneratedPlan {
  const goals = parseGoals(profile.goals);
  const weightDiff = profile.goalWeightKg - profile.currentWeightKg;
  const isLoss = weightDiff < -1;
  const isGain = weightDiff > 1;

  const hasGlowGoals = goals.some(g => ["better skin", "higher energy", "better sleep", "less bloating", "better digestion"].includes(g));

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

  const keyHabits: string[] = [];
  if (goalType === "fat_loss") {
    keyHabits.push(
      `Eat ${proteinTargetG}g protein daily — non-negotiable`,
      `Walk at least ${stepsTarget} steps`,
      `No liquid calories except water and black coffee`,
      `Stop eating 3 hours before bed`,
      `Drink ${waterTargetL}L water by 6pm`,
    );
  } else if (goalType === "muscle_gain") {
    keyHabits.push(
      `Never skip meals — eat every 3-4 hours`,
      `Hit ${proteinTargetG}g protein daily`,
      `Eat ${calorieTarget} calories minimum`,
      `Sleep ${sleepTargetHours} hours — muscle grows during recovery`,
      `Have a protein shake or whole food meal within 45 min of training`,
    );
  } else {
    keyHabits.push(
      `Consistent ${workoutDays}x/week training`,
      `${proteinTargetG}g protein daily`,
      `${waterTargetL}L water daily`,
      `${sleepTargetHours} hours of quality sleep`,
      `Limit processed food to 2x/week`,
    );
  }

  if (sport && sport !== "no sport" && sport !== "none" && sport !== "other") {
    const sportKey = sport.toLowerCase();
    const sportHabit = SPORT_HABITS[sportKey];
    if (sportHabit) keyHabits.push(sportHabit);
  }

  if (hasGlowGoals) {
    keyHabits.push("Screen off 60 min before bed", "Sunlight or outdoor walk within 2 hours of waking");
  }

  let coachNotes = "";
  const sportNote = sportText ? ` Training is built around your sport${sportText.replace(" | Sport: ", " (") + ")"}.` : "";

  if (hasOwnSchedule === "yes" && ownSchedule) {
    coachNotes = `You have your own schedule — the plan respects it. Nutrition and recovery are built around your training days. Your TDEE is ~${tdee} calories. Hit your protein target of ${proteinTargetG}g every day regardless of what you do in the gym.${sportNote}`;
  } else if (goalType === "fat_loss") {
    coachNotes = `You need a ${Math.round(tdee - calorieTarget)} calorie deficit to hit your pace. Your TDEE is ~${tdee} calories. Protein is the priority — hit it every day without exception. Steps add up. Every missed workout is a setback you have to earn back.${sportNote}`;
  } else if (goalType === "muscle_gain") {
    coachNotes = `Your TDEE is ~${tdee}. You need ${calorieTarget} calories daily to grow. Undereating is the #1 reason people don't gain. If you're not gaining weight, you're not eating enough — period. Train hard, eat more, sleep more.${sportNote}`;
  } else {
    coachNotes = `Maintenance means staying disciplined, not relaxing. You're keeping what you've built. Stay consistent with training, hit your protein, and don't let small habits slide.${sportNote}`;
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
    keyHabits,
    coachNotes,
    warnings,
  };
}
