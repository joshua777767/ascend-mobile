import { generatePlan } from "../../artifacts/api-server/src/lib/planGenerator.js";
import type { UserProfile } from "../../lib/db/src/schema/userProfiles.js";

interface TestProfile {
  label: string;
  profile: Omit<UserProfile, "id" | "userId" | "createdAt" | "updatedAt" | "goalReachedAt" | "currentStreak" | "lastStreakDate">;
}

function baseProfile(): TestProfile["profile"] {
  return {
    name: "Test User",
    age: 20,
    gender: "male",
    heightCm: 175,
    currentWeightKg: 70,
    goalWeightKg: 70,
    bodyType: "average",
    goals: "[]",
    targetDate: null,
    fitnessLevel: "beginner",
    gymAccess: "yes",
    equipment: "dumbbells",
    workoutDaysPerWeek: 3,
    preferredWorkoutTime: "morning",
    wakeTime: "07:00",
    sleepTime: "23:00",
    sleepQuality: 5,
    energyLevel: 5,
    stressLevel: 5,
    workSchedule: null,
    averageDailySteps: 5000,
    allergies: null,
    dislikedFoods: null,
    dietStyle: null,
    foodBudget: null,
    mealsPerDay: 3,
    waterIntakeLiters: 2,
    caffeineUse: null,
    screenTimeBeforeBed: null,
    skinConcerns: "[]",
    digestionConcerns: "[]",
    biggestStruggle: null,
    sport: null,
    sportCustom: null,
    sportSchedule: null,
    hasOwnSchedule: null,
    ownSchedule: null,
    customWorkoutSchedule: null,
    workoutFocus: null,
    commitmentLevel: "serious",
    wakeTimeRange: null,
    sleepTimeRange: null,
  };
}

function lbsToKg(lbs: number) {
  return lbs * 0.453592;
}

function ftInToCm(feet: number, inches: number) {
  return (feet * 12 + inches) * 2.54;
}

const tests: TestProfile[] = [
  {
    label: "Overweight user → lose weight",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 25,
      heightCm: ftInToCm(5, 10),
      currentWeightKg: lbsToKg(220),
      goalWeightKg: lbsToKg(180),
      bodyType: "endomorph",
      goals: JSON.stringify(["lose fat", "better energy"]),
      commitmentLevel: "serious",
    },
  },
  {
    label: "Underweight user → gain weight",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 20,
      heightCm: ftInToCm(5, 9),
      currentWeightKg: lbsToKg(120),
      goalWeightKg: lbsToKg(160),
      bodyType: "ectomorph",
      goals: JSON.stringify(["gain weight", "build muscle"]),
      commitmentLevel: "serious",
    },
  },
  {
    label: "Skinny user → gain muscle",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 22,
      heightCm: ftInToCm(5, 11),
      currentWeightKg: lbsToKg(140),
      goalWeightKg: lbsToKg(170),
      bodyType: "ectomorph",
      goals: JSON.stringify(["build muscle"]),
      commitmentLevel: "locked_in",
      workoutDaysPerWeek: 5,
    },
  },
  {
    label: "Average user → stay fit",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 28,
      heightCm: ftInToCm(5, 10),
      currentWeightKg: lbsToKg(170),
      goalWeightKg: lbsToKg(170),
      bodyType: "mesomorph",
      goals: JSON.stringify(["maintain fitness"]),
      commitmentLevel: "casual",
    },
  },
  {
    label: "Better skin focus",
    profile: {
      ...baseProfile(),
      gender: "female",
      age: 24,
      heightCm: ftInToCm(5, 4),
      currentWeightKg: lbsToKg(130),
      goalWeightKg: lbsToKg(130),
      bodyType: "average",
      goals: JSON.stringify(["better skin", "higher energy"]),
      skinConcerns: JSON.stringify(["acne", "dryness"]),
      commitmentLevel: "casual",
    },
  },
  {
    label: "More energy focus",
    profile: {
      ...baseProfile(),
      gender: "female",
      age: 30,
      heightCm: ftInToCm(5, 6),
      currentWeightKg: lbsToKg(145),
      goalWeightKg: lbsToKg(145),
      bodyType: "average",
      goals: JSON.stringify(["higher energy", "better sleep"]),
      energyLevel: 3,
      sleepQuality: 3,
      commitmentLevel: "casual",
    },
  },
  {
    label: "Short user",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 35,
      heightCm: ftInToCm(5, 3),
      currentWeightKg: lbsToKg(160),
      goalWeightKg: lbsToKg(140),
      bodyType: "endomorph",
      goals: JSON.stringify(["lose fat"]),
      commitmentLevel: "serious",
    },
  },
  {
    label: "Tall user",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 24,
      heightCm: ftInToCm(6, 5),
      currentWeightKg: lbsToKg(240),
      goalWeightKg: lbsToKg(210),
      bodyType: "endomorph",
      goals: JSON.stringify(["lose fat"]),
      commitmentLevel: "serious",
    },
  },
  {
    label: "Male profile",
    profile: {
      ...baseProfile(),
      gender: "male",
      age: 25,
      heightCm: ftInToCm(5, 10),
      currentWeightKg: lbsToKg(185),
      goalWeightKg: lbsToKg(175),
      bodyType: "mesomorph",
      goals: JSON.stringify(["lose fat", "build muscle"]),
      commitmentLevel: "serious",
    },
  },
  {
    label: "Female profile",
    profile: {
      ...baseProfile(),
      gender: "female",
      age: 27,
      heightCm: ftInToCm(5, 5),
      currentWeightKg: lbsToKg(155),
      goalWeightKg: lbsToKg(140),
      bodyType: "endomorph",
      goals: JSON.stringify(["lose fat", "better skin"]),
      commitmentLevel: "serious",
    },
  },
];

function safeCalorieCheck(cal: number, gender: string): string | null {
  const floor = gender === "male" ? 1500 : 1200;
  if (cal < floor) return `Calorie target ${cal} is BELOW safe floor of ${floor} for ${gender}`;
  if (cal > 4500) return `Calorie target ${cal} is unexpectedly high for ${gender}`;
  return null;
}

function safeProteinCheck(protein: number, currentWeightKg: number, goalWeightKg: number, gender: string, goalType: string): string | null {
  const lbsCurrent = currentWeightKg * 2.2046;
  const lbsGoal = goalWeightKg * 2.2046;
  // For muscle gain, use goal weight; for fat loss, use min of current/goal; for maintain, use current
  const proteinBase = goalType === "muscle_gain" ? lbsGoal : Math.min(lbsCurrent, lbsGoal);
  const proteinMax = proteinBase * 1.0;
  if (protein > proteinMax + 3) return `Protein ${protein}g exceeds max 1.0g/lb of ${proteinBase.toFixed(1)} lb = ${Math.round(proteinMax)}g`;
  return null;
}

function bmrCheck(weightKg: number, heightCm: number, age: number, gender: string, cal: number, workoutDays: number): string | null {
  const bmr = gender === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const mult = workoutDays === 0 ? 1.2 : workoutDays >= 5 ? 1.725 : workoutDays >= 3 ? 1.55 : 1.375;
  const tdee = Math.round(bmr * mult);
  // For fat loss, should be at least tdee - 500
  if (cal < tdee - 700) return `Calorie target ${cal} is unexpectedly low relative to estimated TDEE ${tdee}`;
  return null;
}

const edgeTests: TestProfile[] = [
  {
    label: "Very short female lose weight",
    profile: {
      ...baseProfile(),
      gender: "female", age: 25, heightCm: 152.4, currentWeightKg: 58, goalWeightKg: 50,
      bodyType: "average", goals: JSON.stringify(["lose fat"]),
      fitnessLevel: "beginner", gymAccess: "no", workoutDaysPerWeek: 2,
      commitmentLevel: "serious",
    },
  },
  {
    label: "Very tall heavy male lose weight",
    profile: {
      ...baseProfile(),
      gender: "male", age: 28, heightCm: 203.2, currentWeightKg: 136, goalWeightKg: 110,
      bodyType: "endomorph", goals: JSON.stringify(["lose fat"]),
      fitnessLevel: "intermediate", gymAccess: "yes", workoutDaysPerWeek: 5,
      commitmentLevel: "extreme",
    },
  },
  {
    label: "Female with aggressive timeline",
    profile: {
      ...baseProfile(),
      gender: "female", age: 22, heightCm: 165.1, currentWeightKg: 68, goalWeightKg: 55,
      bodyType: "average", goals: JSON.stringify(["lose fat"]), targetDate: "2026-07-06",
      fitnessLevel: "beginner", gymAccess: "no", workoutDaysPerWeek: 3,
      commitmentLevel: "extreme",
    },
  },
];

const report: string[] = [];

function runTest(test: TestProfile) {
  const p = test.profile;
  const plan = generatePlan(p as any);

  const calorieBug = safeCalorieCheck(plan.calorieTarget, p.gender);
  const proteinBug = safeProteinCheck(plan.proteinTargetG, p.currentWeightKg, p.goalWeightKg, p.gender, plan.goalType);
  const bmrBug = bmrCheck(p.currentWeightKg, p.heightCm, p.age, p.gender, plan.calorieTarget, p.workoutDaysPerWeek);

  const bugs = [calorieBug, proteinBug, bmrBug].filter(Boolean);

  const bmr = p.gender === "male"
    ? 10 * p.currentWeightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.currentWeightKg + 6.25 * p.heightCm - 5 * p.age - 161;
  const tdee = Math.round(bmr * (p.workoutDaysPerWeek === 0 ? 1.2 : p.workoutDaysPerWeek >= 5 ? 1.725 : p.workoutDaysPerWeek >= 3 ? 1.55 : 1.375));

  return {
    label: test.label,
    gender: p.gender,
    age: p.age,
    currentLbs: p.currentWeightKg * 2.2046,
    goalLbs: p.goalWeightKg * 2.2046,
    heightIn: p.heightCm / 2.54,
    goals: p.goals,
    plan,
    bugs,
    tdee,
  };
}

for (const test of tests) {
  const r = runTest(test);
  report.push(`
────────────────────────────────────────────────────────────────────────────
  ${r.label}
  ${r.gender === "male" ? "Male" : "Female"}, ${r.age}y, ${r.currentLbs.toFixed(1)} lb → ${r.goalLbs.toFixed(1)} lb, ${r.heightIn.toFixed(0)} in
  Goals: ${(() => { try { const g = JSON.parse(r.goals as any); return Array.isArray(g) ? g.join(", ") : "(empty)"; } catch { return "(empty)"; } })()}
────────────────────────────────────────────────────────────────────────────
  Goal type        : ${r.plan.goalType}
  Calorie target   : ${r.plan.calorieTarget} kcal
  Protein target   : ${r.plan.proteinTargetG} g
  Water target     : ${r.plan.waterTargetL} L
  Weekly pace      : ${r.plan.weeklyPace}
  Steps target     : ${r.plan.stepsTarget.toLocaleString()}
  Sleep target     : ${r.plan.sleepTargetHours} h
  ${r.bugs.length > 0 ? `  ❌ BUGS:\n${r.bugs.map(b => `    • ${b}`).join("\n")}` : `  ✅ SAFE — no bugs detected`}
  ${r.plan.warnings ? `  ⚠️ Warning: ${r.plan.warnings}` : ""}
`);
}

// Edge cases
report.push("\n\n========== EDGE CASES ==========\n");
for (const test of edgeTests) {
  const r = runTest(test);
  const deficit = r.tdee - r.plan.calorieTarget;
  report.push(`
────────────────────────────────────────────────────────────────────────────
  ${r.label}
  TDEE: ${r.tdee} | Cal: ${r.plan.calorieTarget} | Deficit: ${deficit}
  Protein: ${r.plan.proteinTargetG}g | Water: ${r.plan.waterTargetL}L
  ${r.bugs.length > 0 ? `❌ BUGS: ${r.bugs.join("; ")}` : `✅ SAFE`}
  ${r.plan.warnings ? `  ⚠️ Warning: ${r.plan.warnings}` : ""}
`);
}

console.log(report.join("\n"));
