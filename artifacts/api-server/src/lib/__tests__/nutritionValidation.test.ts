import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePlan } from "../planGenerator";
import { estimateActivityBurn, estimateGameCalBurn } from "../sportUtils";
import type { ScheduledActivity } from "../sportUtils";

type Goal = "fat_loss" | "maintain" | "muscle_gain";
type DayKind = "rest" | "gym" | "practice" | "game";

const DAYS = {
  rest: JSON.stringify({ days: [] }),
  gym: JSON.stringify({
    days: [{ day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
  }),
  practice: JSON.stringify({
    days: [{
      day: "monday",
      activities: [{ type: "sport_practice", sport: "soccer", durationMinutes: 90, intensity: "moderate" }],
    }],
  }),
  game: JSON.stringify({
    days: [{ day: "monday", activities: [{ type: "game", sport: "soccer", durationMinutes: 90, intensity: "hard" }] }],
  }),
} as const;

const base = {
  age: 30,
  gender: "male",
  heightCm: 178,
  currentWeightKg: 80,
  goalWeightKg: 75,
  fitnessLevel: "intermediate",
  primaryGoal: "lose_fat",
  workoutFocus: "lose_fat",
  commitmentLevel: "committed",
  workoutDaysPerWeek: 0,
  goals: ["lose weight"],
  skinConcerns: [],
  digestionConcerns: [],
  sportSchedule: null,
  customWorkoutSchedule: null as string | null,
  sleepHoursPerNight: 8,
  sleepQuality: "good",
};

type Profile = typeof base & {
  id: string;
  activityLevel?: "sedentary" | "light" | "moderate" | "high" | "extra_active";
  goal: Goal;
  day: DayKind;
  expectedExercise: number;
  targetDate?: string;
};

function makeProfile(
  id: string,
  overrides: Partial<Omit<Profile, "id" | "goal" | "day" | "expectedExercise">> & {
    goal: Goal;
    day: DayKind;
    expectedExercise?: number;
  },
): Profile {
  const { goal, day, expectedExercise, ...rest } = overrides;
  const goals = goal === "fat_loss"
    ? ["lose weight"]
    : goal === "muscle_gain"
      ? ["gain weight and muscle"]
      : ["maintain fitness"];
  return {
    ...base,
    ...rest,
    id,
    goal,
    day,
    goals,
    primaryGoal: goal === "fat_loss" ? "lose_fat" : goal === "muscle_gain" ? "build_muscle" : "maintain",
    workoutFocus: goal === "muscle_gain" ? "build_muscle" : goal === "fat_loss" ? "lose_fat" : "general_fitness",
    customWorkoutSchedule: day === "rest" ? DAYS.rest : DAYS[day],
    workoutDaysPerWeek: day === "rest" ? 0 : 1,
    expectedExercise: expectedExercise ?? 0,
  } as Profile;
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const profiles: Profile[] = [
  // Profile-based activity: exercise is included in EER/TDEE and must not be added again.
  makeProfile("A01", { age: 16, gender: "male", heightCm: 167.64, currentWeightKg: 72.6, goalWeightKg: 63.5, activityLevel: "high", goal: "fat_loss", day: "gym" }),
  makeProfile("A02", { age: 15, gender: "female", activityLevel: "light", goal: "fat_loss", day: "rest" }),
  makeProfile("A03", { age: 17, gender: "male", activityLevel: "moderate", goal: "maintain", day: "practice" }),
  makeProfile("A04", { age: 14, gender: "female", activityLevel: "high", goal: "muscle_gain", day: "game" }),
  makeProfile("A05", { age: 16, gender: "female", activityLevel: "sedentary", goal: "maintain", day: "rest" }),
  makeProfile("A06", { age: 17, gender: "male", activityLevel: "extra_active", goal: "muscle_gain", day: "gym" }),
  makeProfile("A07", { age: 13, gender: "female", activityLevel: "moderate", goal: "fat_loss", day: "practice" }),
  makeProfile("A08", { age: 13, gender: "male", activityLevel: "light", goal: "maintain", day: "game" }),
  makeProfile("A09", { age: 16, gender: "male", activityLevel: "moderate", goal: "fat_loss", day: "rest", targetDate: daysFromNow(35) }),
  // Adult profile-based activity across low/moderate/high and all goals/days.
  makeProfile("B01", { age: 25, gender: "male", activityLevel: "light", goal: "fat_loss", day: "rest" }),
  makeProfile("B02", { age: 35, gender: "female", activityLevel: "moderate", goal: "maintain", day: "gym" }),
  makeProfile("B03", { age: 42, gender: "male", activityLevel: "high", goal: "muscle_gain", day: "practice" }),
  makeProfile("B04", { age: 29, gender: "female", activityLevel: "moderate", goal: "fat_loss", day: "game" }),
  makeProfile("B05", { age: 55, gender: "male", activityLevel: "sedentary", goal: "maintain", day: "rest" }),
  makeProfile("B06", { age: 22, gender: "female", activityLevel: "high", goal: "muscle_gain", day: "gym" }),
  makeProfile("B07", { age: 48, gender: "female", activityLevel: "light", goal: "fat_loss", day: "practice" }),
  makeProfile("B08", { age: 31, gender: "male", activityLevel: "high", goal: "maintain", day: "game" }),
  makeProfile("B09", { age: 31, gender: "female", activityLevel: "moderate", currentWeightKg: 70, goalWeightKg: 80, goal: "muscle_gain", day: "rest", targetDate: daysFromNow(35) }),
  makeProfile("B10", { age: 70, gender: "male", heightCm: 175, currentWeightKg: 78, goalWeightKg: 78, activityLevel: "high", goal: "maintain", day: "gym" }),
  // Legacy profiles: no activityLevel, so scheduled exercise is additive only on active days.
  makeProfile("L01", { age: 27, gender: "male", activityLevel: undefined, goal: "fat_loss", day: "rest" }),
  makeProfile("L02", { age: 19, gender: "female", activityLevel: undefined, goal: "maintain", day: "gym", expectedExercise: 0 }),
  makeProfile("L03", { age: 64, gender: "male", activityLevel: undefined, goal: "muscle_gain", day: "practice", expectedExercise: 0 }),
  makeProfile("L04", { age: 38, gender: "female", activityLevel: undefined, goal: "fat_loss", day: "game", expectedExercise: 0 }),
  makeProfile("L05", { age: 18, gender: "male", activityLevel: undefined, goal: "maintain", day: "rest" }),
  makeProfile("L06", { age: 44, gender: "female", activityLevel: undefined, goal: "muscle_gain", day: "gym" }),
].map((p) => {
  const day = p.day;
  const weight = p.currentWeightKg;
  const activity = day === "gym"
      ? { type: "gym" as const, durationMinutes: 60, intensity: "moderate" as const }
    : day === "practice"
      ? { type: "sport_practice" as const, sport: "soccer", durationMinutes: 90, intensity: "moderate" as const }
      : day === "game"
        ? { type: "game" as const, sport: "soccer", durationMinutes: 90, intensity: "hard" as const }
        : null;
  const expectedExercise = activity
    ? activity.type === "gym"
      ? estimateActivityBurn(activity as ScheduledActivity, weight)
      : activity.type === "sport_practice"
        ? estimateActivityBurn(activity, weight)
        : estimateGameCalBurn("soccer", 90, weight)
    : 0;
  return { ...p, expectedExercise };
});

function runProfile(p: Profile) {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  const plan = generatePlan(p as any);
  const call = spy.mock.calls.find((entry) => entry[0] === "[calorie-breakdown]");
  spy.mockRestore();
  return { plan, breakdown: call?.[1] as Record<string, unknown> };
}

function validateProfile(p: Profile) {
  const { plan, breakdown } = runProfile(p);
  const failures: string[] = [];
  const maintenance = Number(breakdown.finalMaintenanceCalories);
  const baseline = Number(breakdown.baseTdee);
  const exercise = Number(breakdown.exerciseCaloriesAdded);
  const scheduledTarget = plan.dailyCalorieTargets?.monday;
  const dayTarget = scheduledTarget ?? (p.day === "gym"
    ? plan.gymDayCalorieTarget
    : p.day === "practice"
      ? plan.practiceDayCalorieTarget
      : p.day === "game"
        ? plan.gameDayCalorieTarget
        : plan.restDayCalorieTarget);
  const finalCalories = dayTarget ?? plan.calorieTarget;
  const deficit = Number(breakdown.weightLossDeficit);
  const surplus = Number(breakdown.muscleGainSurplus);
  const floor = Number(breakdown.calorieFloor);
  const hasActivityLevel = typeof p.activityLevel === "string";
  const isMinor = p.age < 18;
  const expectedEquation = isMinor ? "dri_2023_adolescent" : "mifflin_st_jeor_adult";

  if (breakdown.energyEquation !== expectedEquation) failures.push(`wrong equation: ${String(breakdown.energyEquation)}`);
  if (!Number.isFinite(baseline) || baseline <= 0) failures.push("missing/invalid baseline expenditure");
  if (!Number.isFinite(maintenance) || maintenance !== baseline + exercise) failures.push("maintenance does not equal baseline + exercise");
  if (!Number.isFinite(exercise) || exercise < 0) failures.push("invalid exercise calories");
  if (hasActivityLevel && exercise !== 0) failures.push("exercise double-counting: profile activity plus exercise addition");
  if (!hasActivityLevel && p.day === "rest" && exercise !== 0) failures.push("rest day has exercise calories");
  // The engine's finalMaintenanceCalories already includes the scheduled
  // exercise burn for legacy profiles; never add expectedExercise again here.
  const scenarioMaintenance = maintenance;
  if (p.goal === "fat_loss" && finalCalories >= scenarioMaintenance) failures.push("fat-loss calories are at or above maintenance");
  // Profile activity is already part of maintenance. Legacy profiles apply
  // the goal adjustment to their sedentary base, then add scheduled exercise
  // to active-day targets; validate each path against its own base.
  const deficitMaintenance = hasActivityLevel ? maintenance : baseline;
  if (p.goal === "fat_loss" && deficit !== Math.round(deficitMaintenance * 0.15)) failures.push(`deficit is not 15% of maintenance: ${deficit}`);
  if (p.goal === "muscle_gain" && (surplus <= 0 || surplus > (isMinor ? 300 : 400))) failures.push(`extreme surplus: ${surplus}`);
  if (finalCalories < (isMinor ? (p.gender === "male" ? 1800 : 1600) : 1500)) failures.push("dietitian-unacceptable low calorie target");
  if (p.goal === "fat_loss" && scenarioMaintenance - finalCalories > scenarioMaintenance * 0.15 + 1) failures.push("dietitian-unacceptable deficit");
  if (p.goal === "muscle_gain" && finalCalories - scenarioMaintenance > (isMinor ? 300 : 400)) failures.push("dietitian-unacceptable surplus");
  if (plan.proteinTargetG <= 0 || plan.proteinTargetG > 250) failures.push("dietitian-unacceptable protein target");
  if (p.goal === "maintain" && (deficit !== 0 || surplus !== 0)) failures.push("maintenance plan has deficit/surplus");
  if (finalCalories < floor) failures.push(`unsafe calorie floor: ${finalCalories} < ${floor}`);
  if (isMinor && breakdown.bmr !== null) failures.push("minor incorrectly reports adult BMR");
  if (!isMinor && typeof breakdown.bmr !== "number") failures.push("adult missing BMR");
  if (p.targetDate) {
    const paceMatch = plan.weeklyPace.match(/~([0-9.]+) lb/);
    const displayedPace = paceMatch ? Number(paceMatch[1]) : 0;
    if (!plan.warnings) failures.push("timeline rate exceeded a safety limit without a warning");
  }
  if (p.day !== "rest" && !hasActivityLevel && exercise <= 0) failures.push(`${p.day} day missing exercise calories`);
  if (p.day === "rest" && plan.dailyCalorieTargets && Object.keys(plan.dailyCalorieTargets).length > 0) {
    failures.push("rest profile unexpectedly has active-day targets");
  }
  return { p, plan, breakdown, failures };
}

function recommendationRationale(p: Profile, breakdown: Record<string, unknown>, plan: ReturnType<typeof generatePlan>) {
  const maintenance = Number(breakdown.finalMaintenanceCalories);
  const target = plan.dailyCalorieTargets?.monday ?? (p.day === "gym"
    ? plan.gymDayCalorieTarget
    : p.day === "practice"
      ? plan.practiceDayCalorieTarget
      : p.day === "game"
        ? plan.gameDayCalorieTarget
        : plan.restDayCalorieTarget);
  const adjustment = p.goal === "fat_loss"
    ? `a controlled ${Number(breakdown.weightLossDeficit)} kcal deficit for gradual fat loss`
    : p.goal === "muscle_gain"
      ? `a controlled ${Number(breakdown.muscleGainSurplus)} kcal surplus for lean-mass gain`
      : "no calorie adjustment so intake supports weight stability";
  const activity = p.activityLevel
    ? `${p.activityLevel} normal activity (the ${p.day} session is not added again)`
    : "a conservative inactive baseline with scheduled exercise added only on active days";
  const ageSafety = p.age < 18
    ? "the adolescent DRI EER equation and higher youth calorie floor"
    : "adult Mifflin–St Jeor plus the selected activity multiplier";
  return `Maintenance reflects ${ageSafety} and ${activity}; ${p.day} target ${target ?? plan.calorieTarget} applies ${adjustment} without double-counting exercise; protein is ${plan.proteinTargetG}g based on body weight and goal.`;
}

function onboardingFieldFailures() {
  // These are the fields persisted by Step 5, checked against the same
  // source used by the onboarding flow so a renamed/omitted field fails this
  // validation report instead of silently degrading nutrition calculations.
  const source = readFileSync(
    resolve(process.cwd(), "../project-upgrade/src/pages/onboarding.tsx"),
    "utf8",
  );
  const required = [
    "activityLevel",
    "workoutDaysPerWeek",
    "customWorkoutSchedule",
    "sportSchedule",
    "durationMinutes",
    "intensity",
  ];
  return required.filter((field) => !source.includes(field));
}

describe("automated nutrition validation report", () => {
  it("runs 25 realistic profiles and produces a PASS report with no dietitian safety flags", () => {
    const results = profiles.map(validateProfile);
    const report = results.map(({ p, breakdown, plan, failures }) => ({
      id: p.id,
      age: p.age,
      sex: p.gender,
      goal: p.goal,
      day: p.day,
      equation: p.age < 18 ? breakdown.energyEquation : `BMR=${breakdown.bmr}`,
      activityCategory: breakdown.activityCategory,
      baseline: breakdown.baseTdee,
      exerciseCalories: breakdown.exerciseCaloriesAdded,
      maintenance: breakdown.finalMaintenanceCalories,
      deficitOrSurplus: p.goal === "fat_loss" ? -Number(breakdown.weightLossDeficit) : Number(breakdown.muscleGainSurplus),
      finalCalories: plan.dailyCalorieTargets?.monday ??
        (p.day === "gym"
          ? plan.gymDayCalorieTarget ?? plan.calorieTarget
          : p.day === "practice"
            ? plan.practiceDayCalorieTarget ?? plan.calorieTarget
            : p.day === "game"
              ? plan.gameDayCalorieTarget ?? plan.calorieTarget
              : plan.restDayCalorieTarget ?? plan.calorieTarget),
      proteinTargetG: plan.proteinTargetG,
      why: recommendationRationale(p, breakdown, plan),
      safetyRulesTriggered: [
        p.age < 18 ? "under-18 EER + safety limits" : "adult limits",
        Number(breakdown.exerciseCaloriesAdded) === 0 ? "no additive exercise calories" : "legacy exercise addition",
        Number(breakdown.calorieFloor) === plan.calorieTarget ? "calorie floor binds" : null,
      ].filter(Boolean),
      flags: failures,
    }));
    const onboardingFlags = onboardingFieldFailures();
    const allFailures = [
      ...report.flatMap((row) => row.flags.map((flag) => `${row.id}: ${flag}`)),
      ...onboardingFlags.map((field) => `onboarding field missing: ${field}`),
    ];

    console.info("[nutrition-validation-report]", JSON.stringify({
      result: allFailures.length === 0 ? "PASS" : "FAIL",
      profileCount: report.length,
      onboardingFlags,
      profiles: report,
    }, null, 2));
    console.info("[dietitian-review-table]", JSON.stringify(report.map((row) => ({
      id: row.id,
      age: row.age,
      sex: row.sex,
      goal: row.goal,
      day: row.day,
      maintenance: row.maintenance,
      target: row.finalCalories,
      proteinG: row.proteinTargetG,
      why: row.why,
    }))));

    expect(report).toHaveLength(25);
    expect(onboardingFlags).toEqual([]);
    expect(allFailures).toEqual([]);
  });

  it("specifically verifies the requested 16-year-old gym profile", () => {
    const result = validateProfile(profiles.find((p) => p.id === "A01")!);
    expect(result.failures).toEqual([]);
    expect(result.breakdown).toMatchObject({
      energyEquation: "dri_2023_adolescent",
      baseTdee: 3298,
      exerciseCaloriesAdded: 0,
      finalMaintenanceCalories: 3298,
      weightLossDeficit: 495,
      calorieFloor: 1800,
      finalCalorieTarget: 2803,
    });
    expect(result.plan.calorieTarget).toBe(2803);
  });
});