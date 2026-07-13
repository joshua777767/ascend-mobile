import { describe, it, expect } from "vitest";
import { generatePlan } from "../planGenerator";
import {
  estimateGymCalBurn,
  estimateSportCalBurn,
  estimateGameCalBurn,
} from "../sportUtils";

// ─── Shared base profile ──────────────────────────────────────────────────────

const BASE_PROFILE: Record<string, unknown> = {
  age: 25,
  gender: "male",
  heightCm: 175,
  currentWeightKg: 80,
  goalWeightKg: 75,
  fitnessLevel: "intermediate",
  primaryGoal: "lose_fat",
  workoutFocus: "lose_fat",
  commitmentLevel: "committed",
  workoutDaysPerWeek: 0,
  goals: [],
  skinConcerns: [],
  digestionConcerns: [],
  sportSchedule: null,
  sleepHoursPerNight: 7,
  sleepQuality: "good",
};

// Helper: build a profile with given overrides.
// Casts to `any` because test fixtures only supply the fields planGenerator
// actually reads — the DB type includes many more columns we don't need here.
const profile = (overrides: Record<string, unknown> = {}) =>
  ({ ...BASE_PROFILE, ...overrides }) as any;

// ─── 1. Lifestyle TDEE invariant ──────────────────────────────────────────────

describe("lifestyle TDEE invariant — no exercise in base", () => {
  it("calorieTarget is identical regardless of workoutDaysPerWeek (0 vs 5)", () => {
    const plan0 = generatePlan(profile({ workoutDaysPerWeek: 0 }));
    const plan5 = generatePlan(profile({ workoutDaysPerWeek: 5 }));

    // The base calorie target must not change when workoutDaysPerWeek changes —
    // exercise calories are added per-day, not baked into the base TDEE.
    expect(plan0.calorieTarget).toBe(plan5.calorieTarget);
  });

  it("calorieTarget is the same for 1, 3, and 7 workout days", () => {
    const targets = [1, 3, 7].map(
      (d) => generatePlan(profile({ workoutDaysPerWeek: d })).calorieTarget
    );
    expect(new Set(targets).size).toBe(1);
  });
});

// ─── 2. Gym day is strictly additive ─────────────────────────────────────────

describe("gymDayCalorieTarget — additive on top of lifestyle base", () => {
  it("gymDayCalorieTarget = calorieTarget + estimateGymCalBurn(focus, weight)", () => {
    const p = profile({ workoutDaysPerWeek: 3, workoutFocus: "strength" });
    const plan = generatePlan(p);

    expect(plan.gymDayCalorieTarget).not.toBeNull();
    const expectedBurn = estimateGymCalBurn("strength", 80);
    expect(plan.gymDayCalorieTarget).toBe(plan.calorieTarget + expectedBurn);
  });

  it("gymDayCalorieTarget is null when workoutDaysPerWeek is 0", () => {
    const plan = generatePlan(profile({ workoutDaysPerWeek: 0 }));
    expect(plan.gymDayCalorieTarget).toBeNull();
  });

  it("gymBurn is always positive — gym day always exceeds rest day", () => {
    const plan = generatePlan(profile({ workoutDaysPerWeek: 4, workoutFocus: "conditioning" }));
    expect(plan.gymDayCalorieTarget!).toBeGreaterThan(plan.calorieTarget);
  });

  it("restDayCalorieTarget equals calorieTarget when gym days exist", () => {
    const plan = generatePlan(profile({ workoutDaysPerWeek: 3 }));
    expect(plan.restDayCalorieTarget).toBe(plan.calorieTarget);
  });
});

// ─── 3. Sport practice day is strictly additive ───────────────────────────────

describe("practiceDayCalorieTarget — additive on top of lifestyle base", () => {
  const footballProfile = profile({
    workoutDaysPerWeek: 0,
    sportSchedule: JSON.stringify({
      sport: "football",
      days: ["tuesday", "thursday"],
      startTime: "18:00",
      durationMinutes: 90,
      intensity: "moderate",
      gameDays: [],
    }),
  });

  it("practiceDayCalorieTarget = calorieTarget + sport practice burn", () => {
    const plan = generatePlan(footballProfile);

    expect(plan.practiceDayCalorieTarget).not.toBeNull();
    const expectedBurn = estimateSportCalBurn("football", 90, "moderate", 80);
    expect(plan.practiceDayCalorieTarget).toBe(plan.calorieTarget + expectedBurn);
  });

  it("practiceDayCalorieTarget > calorieTarget (practice always burns calories)", () => {
    const plan = generatePlan(footballProfile);
    expect(plan.practiceDayCalorieTarget!).toBeGreaterThan(plan.calorieTarget);
  });

  it("restDayCalorieTarget equals calorieTarget when sport schedule exists", () => {
    const plan = generatePlan(footballProfile);
    expect(plan.restDayCalorieTarget).toBe(plan.calorieTarget);
  });
});

// ─── 4. Game day uses MET formula, not ×1.175 ────────────────────────────────

describe("gameDayCalorieTarget — MET formula, not arbitrary multiplier", () => {
  const gameDayProfile = profile({
    workoutDaysPerWeek: 0,
    sportSchedule: JSON.stringify({
      sport: "football",
      days: ["tuesday", "thursday"],
      startTime: "18:00",
      durationMinutes: 90,
      intensity: "moderate",
      gameDays: ["saturday"],
    }),
  });

  it("gameDayCalorieTarget = calorieTarget + estimateGameCalBurn (hard intensity)", () => {
    const plan = generatePlan(gameDayProfile);

    expect(plan.gameDayCalorieTarget).not.toBeNull();
    const expectedGameBurn = estimateGameCalBurn("football", 90, 80);
    expect(plan.gameDayCalorieTarget).toBe(plan.calorieTarget + expectedGameBurn);
  });

  it("game burn (hard) is greater than practice burn (moderate) for same sport + duration", () => {
    const practiceBurn = estimateSportCalBurn("football", 90, "moderate", 80);
    const gameBurn = estimateGameCalBurn("football", 90, 80);
    expect(gameBurn).toBeGreaterThan(practiceBurn);
  });

  it("game day is NOT calculated as practiceDayCalorieTarget × 1.175", () => {
    const plan = generatePlan(gameDayProfile);
    const oldFormula = Math.round(plan.practiceDayCalorieTarget! * 1.175);
    expect(plan.gameDayCalorieTarget).not.toBe(oldFormula);
  });
});

// ─── 5. No double-counting across any combination ─────────────────────────────

describe("no double-counting — exercise never baked into base TDEE", () => {
  it("gym burn is exactly the delta between gymDay and restDay targets", () => {
    const p = profile({ workoutDaysPerWeek: 4, workoutFocus: "athletic_performance" });
    const plan = generatePlan(p);

    const gymBurn = estimateGymCalBurn("athletic_performance", 80);
    const delta = plan.gymDayCalorieTarget! - plan.restDayCalorieTarget!;
    expect(delta).toBe(gymBurn);
  });

  it("sport practice burn is exactly the delta between practiceDay and restDay targets", () => {
    const sp = profile({
      workoutDaysPerWeek: 0,
      sportSchedule: JSON.stringify({
        sport: "basketball",
        days: ["monday", "wednesday", "friday"],
        startTime: "17:00",
        durationMinutes: 60,
        intensity: "hard",
        gameDays: [],
      }),
    });
    const plan = generatePlan(sp);

    const practiceBurn = estimateSportCalBurn("basketball", 60, "hard", 80);
    const delta = plan.practiceDayCalorieTarget! - plan.restDayCalorieTarget!;
    expect(delta).toBe(practiceBurn);
  });

  it("game burn is exactly the delta between gameDay and restDay targets", () => {
    const gp = profile({
      workoutDaysPerWeek: 0,
      sportSchedule: JSON.stringify({
        sport: "soccer",
        days: ["tuesday", "thursday"],
        startTime: "16:00",
        durationMinutes: 75,
        intensity: "moderate",
        gameDays: ["saturday"],
      }),
    });
    const plan = generatePlan(gp);

    const gameBurn = estimateGameCalBurn("soccer", 75, 80);
    const delta = plan.gameDayCalorieTarget! - plan.restDayCalorieTarget!;
    expect(delta).toBe(gameBurn);
  });

  it("with both gym and sport, all four targets are independent additive slots", () => {
    const p = profile({
      workoutDaysPerWeek: 3,
      workoutFocus: "general_fitness",
      sportSchedule: JSON.stringify({
        sport: "basketball",
        days: ["tuesday", "thursday"],
        startTime: "18:00",
        durationMinutes: 90,
        intensity: "moderate",
        gameDays: ["saturday"],
      }),
    });
    const plan = generatePlan(p);
    const base = plan.calorieTarget;

    const gymBurn      = estimateGymCalBurn("general_fitness", 80);
    const practiceBurn = estimateSportCalBurn("basketball", 90, "moderate", 80);
    const gameBurn     = estimateGameCalBurn("basketball", 90, 80);

    expect(plan.restDayCalorieTarget).toBe(base);
    expect(plan.gymDayCalorieTarget).toBe(base + gymBurn);
    expect(plan.practiceDayCalorieTarget).toBe(base + practiceBurn);
    expect(plan.gameDayCalorieTarget).toBe(base + gameBurn);

    // All targets are strictly ordered: rest < gym ≤ practice < game
    // (gym and practice order depends on session MET/duration, so only assert distinct from rest/game)
    expect(plan.gymDayCalorieTarget!).toBeGreaterThan(base);
    expect(plan.practiceDayCalorieTarget!).toBeGreaterThan(base);
    expect(plan.gameDayCalorieTarget!).toBeGreaterThan(plan.practiceDayCalorieTarget!);
  });
});
