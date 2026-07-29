import { describe, it, expect, vi } from "vitest";
import { generatePlan } from "../planGenerator";
import {
  estimateGymCalBurn,
  estimateSportCalBurn,
  estimateGameCalBurn,
  estimateActivityBurn,
} from "../sportUtils";
import type { ScheduledActivity } from "../sportUtils";

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
  customWorkoutSchedule: null,
  sleepHoursPerNight: 7,
  sleepQuality: "good",
};

const profile = (overrides: Record<string, unknown> = {}) =>
  ({ ...BASE_PROFILE, ...overrides }) as any;

// Computes a "YYYY-MM-DD" target date N days from whenever the test actually
// runs, so timeline-driven tests stay valid regardless of the current date.
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Captures the "[calorie-breakdown]" console.info log emitted by generatePlan
// so tests can assert on internal BMR/TDEE/deficit/surplus/floor/protein
// values that aren't part of the public GeneratedPlan return shape.
function captureBreakdown(p: ReturnType<typeof profile>) {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  const plan = generatePlan(p);
  const call = spy.mock.calls.find((c) => c[0] === "[calorie-breakdown]");
  spy.mockRestore();
  return { plan, breakdown: call?.[1] as Record<string, unknown> | undefined };
}

// ─── 1. Lifestyle TDEE invariant ──────────────────────────────────────────────

describe("lifestyle TDEE invariant — no exercise in base", () => {
  it("calorieTarget is identical regardless of workoutDaysPerWeek (0 vs 5)", () => {
    const plan0 = generatePlan(profile({ workoutDaysPerWeek: 0 }));
    const plan5 = generatePlan(profile({ workoutDaysPerWeek: 5 }));
    expect(plan0.calorieTarget).toBe(plan5.calorieTarget);
  });

  it("calorieTarget is the same for 1, 3, and 7 workout days", () => {
    const targets = [1, 3, 7].map(
      (d) => generatePlan(profile({ workoutDaysPerWeek: d })).calorieTarget
    );
    expect(new Set(targets).size).toBe(1);
  });

  it("calorieTarget never changes when customWorkoutSchedule days change", () => {
    const noSchedule = generatePlan(profile({}));
    const withGym = generatePlan(profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
          { day: "wednesday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
          { day: "friday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    }));
    expect(noSchedule.calorieTarget).toBe(withGym.calorieTarget);
  });
});

describe("calorie audit — 16-year-old high-activity weight loss profile", () => {
  // This is the exact profile from the calorie-system audit: male, 16, 5'6",
  // 160 lb, goal "lose weight", gym scheduled today, high activity level.
  //
  // BEFORE any audit fixes, this profile produced ~2,800 calories/day because
  // the plan derived an activity multiplier from workoutDaysPerWeek AND THEN
  // added the scheduled gym session's calories again on top — double-counting
  // the same workout.
  //
  // AFTER fix #1 (activity-level-aware TDEE, done first): the explicit
  // activityLevel="high" is used as the sole TDEE multiplier and gym calories
  // are no longer added on top. But the deficit was still a flat adult rate
  // (500 cal/day for a non-"casual" commitment).
  //
  // AFTER fix #2 (this audit — evidence-based adolescent EER):
  // the National Academies DRI 2023 adolescent EER equation is used. The
  // product's "high" activity maps to the DRI "active" category.
  //
  //   DRI adolescent EER (male, 16, active):
  //     -388.19 + 3.68(16) + 12.66(167.64) + 20.46(72.6) + 20 = 3,298 kcal
  //   Exercise calories:      +0 (already included in the EER category)
  //   Deficit (15% of maintenance): round(3,298 × 0.15) = 495 cal/day
  //   Final calorie target:   3,298 - 495 = 2,803 kcal/day
  //   Protein (under-18):     current weight (72.6kg) × 1.5 g/kg ≈ 110g
  it("uses high-activity TDEE once, does not add gym calories again, and applies the universal 15% deficit", () => {
    const p = profile({
      age: 16,
      gender: "male",
      heightCm: 167.64, // 5'6"
      currentWeightKg: 72.6, // 160 lb
      goalWeightKg: 63.5,
      goals: ["lose weight"],
      workoutFocus: "lose_fat",
      workoutDaysPerWeek: 1, // Gym Today is represented by the schedule below
      activityLevel: "high",
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    });

    const { plan, breakdown } = captureBreakdown(p);

    expect(plan.calorieTarget).toBe(2803);
    expect(plan.proteinTargetG).toBe(110);
    expect(plan.dailyCalorieTargets).toBeNull();
    expect(plan.gymDayCalorieTarget).toBeNull();

    // Full breakdown — pins every number in the audit trail above.
    expect(breakdown).toMatchObject({
      bmr: null,
      eer: 3298,
      energyEquation: "dri_2023_adolescent",
      activityCategory: "active",
      ageGroup: "under_18",
      activityMultiplier: 1.725,
      activityLevelSource: "profile",
      baseTdee: 3298,
      exerciseCaloriesAdded: 0,
      finalMaintenanceCalories: 3298,
      calorieFloor: 1800,
      weightLossDeficit: 495,
      finalCalorieTarget: 2803,
      proteinTargetG: 110,
    });
  });
});

// ─── 1b. Age-aware calorie safety — minors vs adults ──────────────────────────
//
// Requirement: fat loss uses a safe deficit off maintenance; muscle gain uses a
// small controlled surplus; under-18 and adult logic must be handled separately.
// All numbers below were independently verified with a standalone calculator
// before being hard-coded here (see audit notes) — every fixture uses
// activityLevel so exercise is never separately added on top (Mode A), keeping
// the arithmetic isolated to the deficit/surplus/floor logic under test.

describe("universal 15% maintenance deficit — fat loss (weight loss)", () => {
  it("adult, non-casual commitment: deficit is 15% of maintenance", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ ageGroup: "adult", weightLossDeficit: 407, calorieFloor: 1500 });
    expect(plan.calorieTarget).toBe(2304);
  });

  it("adult, casual commitment: commitment does not change the 15% deficit", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "casual", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ weightLossDeficit: 407 });
    expect(plan.calorieTarget).toBe(2304);
  });

  it("under-18, non-casual commitment: deficit is 15% of maintenance", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ ageGroup: "under_18", weightLossDeficit: 531, calorieFloor: 1800 });
    expect(plan.calorieTarget).toBe(3012);
  });

  it("under-18, casual commitment: commitment does not change the 15% deficit", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "casual", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ weightLossDeficit: 531 });
    expect(plan.calorieTarget).toBe(3012);
  });

  it("adult calorie floor (1,200 female) binds for a very small deficit target", () => {
    const p = profile({
      age: 22, gender: "female", heightCm: 150, currentWeightKg: 42, goalWeightKg: 38,
      activityLevel: "sedentary", commitmentLevel: "casual", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    // Unclamped math would be 1,304 - 300 = 1,004 — below the adult female floor.
    expect(breakdown).toMatchObject({ calorieFloor: 1200 });
    expect(plan.calorieTarget).toBe(1200);
  });

  it("under-18 calorie floor is raised to 1,600 (female) — binds where the adult floor would not", () => {
    const p = profile({
      age: 15, gender: "female", heightCm: 150, currentWeightKg: 40, goalWeightKg: 35,
      activityLevel: "sedentary", commitmentLevel: "committed", goals: ["lose weight"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    // The 15% deficit would place this target below the raised teen floor.
    expect(breakdown).toMatchObject({ ageGroup: "under_18", calorieFloor: 1600 });
    expect(plan.calorieTarget).toBe(1600);
    expect(plan.calorieTarget).toBeGreaterThan(1389);
  });

  it("under-18 timeline pressure does not override the universal 15% deficit", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
      targetDate: daysFromNow(35), // 5 weeks — needs ~4.4 lb/week, far above any safe cap
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ weightLossDeficit: 531 });
    expect(plan.calorieTarget).toBe(3012);
    expect(plan.warnings).toBeTruthy();
    expect(plan.warnings).toMatch(/15% calorie deficit/i);
  });

  it("adult timeline pressure does not override the universal 15% deficit", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 70,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
      targetDate: daysFromNow(35),
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ weightLossDeficit: 407 });
    expect(plan.calorieTarget).toBe(2304);
    expect(plan.warnings).toMatch(/1 lb\/week/i);
  });
});

describe("age-aware calorie safety — muscle gain surplus caps", () => {
  it("adult, committed (non-casual, non-extreme): surplus is 300 (unchanged)", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ ageGroup: "adult", muscleGainSurplus: 300 });
    expect(plan.calorieTarget).toBe(3011);
  });

  it("adult, extreme_discipline: surplus reaches 400 (unchanged) — the 'extreme' path", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "extreme_discipline", goals: ["gain weight and muscle"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ muscleGainSurplus: 400 });
    expect(plan.calorieTarget).toBe(3111);
  });

  it("under-18, committed: surplus is capped at 300 max (never 400)", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ ageGroup: "under_18", muscleGainSurplus: 300 });
    expect(plan.calorieTarget).toBe(3843);
  });

  it("under-18, extreme_discipline: has NO extreme path — surplus is still 300, same as 'committed'", () => {
    const committed = captureBreakdown(profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
    }));
    const extreme = captureBreakdown(profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "extreme_discipline", goals: ["gain weight and muscle"],
    }));
    expect(extreme.breakdown).toMatchObject({ muscleGainSurplus: 300 });
    expect(extreme.plan.calorieTarget).toBe(committed.plan.calorieTarget);
    expect(extreme.plan.calorieTarget).toBe(3843);
  });

  it("under-18, casual: surplus is 200", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "casual", goals: ["gain weight and muscle"],
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ muscleGainSurplus: 200 });
    expect(plan.calorieTarget).toBe(3743);
  });

  it("under-18 timeline-driven pace is capped at 0.5 lb/week (not the adult 0.8 lb/week)", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 70, goalWeightKg: 80,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
      targetDate: daysFromNow(35),
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ muscleGainSurplus: 250 });
    expect(plan.calorieTarget).toBe(3588);
    expect(plan.warnings).toMatch(/0\.5 lb\/week/i);
  });

  it("adult timeline-driven pace is still capped at 0.8 lb/week (unchanged)", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 70, goalWeightKg: 80,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
      targetDate: daysFromNow(35),
    });
    const { plan, breakdown } = captureBreakdown(p);
    expect(breakdown).toMatchObject({ muscleGainSurplus: 400 });
    expect(plan.calorieTarget).toBe(2956);
    expect(plan.warnings).toMatch(/0\.8 lb\/week/i);
  });
});

describe("age-aware calorie safety — recomp surplus", () => {
  it("adult, non-casual: surplus is 100 (unchanged)", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 82,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain muscle"],
    });
    const { plan } = captureBreakdown(p);
    expect(plan.calorieTarget).toBe(2811);
  });

  it("adult, casual: surplus is 75 (unchanged)", () => {
    const p = profile({
      age: 30, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 82,
      activityLevel: "moderate", commitmentLevel: "casual", goals: ["gain muscle"],
    });
    const { plan } = captureBreakdown(p);
    expect(plan.calorieTarget).toBe(2786);
  });

  it("under-18: surplus is always flat 75, regardless of commitment level", () => {
    const committed = captureBreakdown(profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 82,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain muscle"],
    }));
    const extreme = captureBreakdown(profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 82,
      activityLevel: "moderate", commitmentLevel: "extreme_discipline", goals: ["gain muscle"],
    }));
    expect(committed.plan.calorieTarget).toBe(3618);
    expect(extreme.plan.calorieTarget).toBe(3618);
  });
});

describe("age-aware calorie safety — protein uses current weight for minors", () => {
  it("under-18 fat_loss: protein = current weight × 1.5 g/kg, ignoring goal weight", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 60, // large goal-weight gap
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
    });
    const plan = generatePlan(p);
    expect(plan.proteinTargetG).toBe(120); // round((80*1.5)/5)*5 — not based on the 60kg goal weight
  });

  it("under-18 muscle_gain: protein = current weight × 1.7 g/kg, ignoring goal weight", () => {
    const p = profile({
      age: 16, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 90,
      activityLevel: "moderate", commitmentLevel: "committed", goals: ["gain weight and muscle"],
    });
    const plan = generatePlan(p);
    expect(plan.proteinTargetG).toBe(135); // round((80*1.7)/5)*5
  });
});

describe("age-aware calorie safety — breakdown log completeness", () => {
  it("logs ageGroup, calorieFloor, muscleGainSurplus, and proteinTargetG for an adult plan", () => {
    const { breakdown } = captureBreakdown(profile({
      age: 30, activityLevel: "moderate", commitmentLevel: "committed", goals: ["lose weight"],
    }));
    expect(breakdown).toBeDefined();
    expect(breakdown).toEqual(expect.objectContaining({
      bmr: expect.any(Number),
      ageGroup: "adult",
      activityMultiplier: expect.any(Number),
      activityLevelSource: expect.any(String),
      baseTdee: expect.any(Number),
      exerciseCaloriesAdded: expect.any(Number),
      finalMaintenanceCalories: expect.any(Number),
      calorieFloor: expect.any(Number),
      weightLossDeficit: expect.any(Number),
      muscleGainSurplus: 0,
      finalCalorieTarget: expect.any(Number),
      proteinTargetG: expect.any(Number),
    }));
  });

  it("logs ageGroup: 'under_18' and muscleGainSurplus for a minor muscle-gain plan", () => {
    const { breakdown } = captureBreakdown(profile({
      age: 15, activityLevel: "moderate", commitmentLevel: "committed",
      goals: ["gain weight and muscle"], goalWeightKg: 90,
    }));
    expect(breakdown).toMatchObject({ ageGroup: "under_18", weightLossDeficit: 0 });
    expect((breakdown as any).muscleGainSurplus).toBeGreaterThan(0);
  });
});

// ─── 2. Goal adjustment preserved in base ─────────────────────────────────────

describe("goal-adjusted base (deficit/surplus) — preserved in all day targets", () => {
  it("fat_loss: restDayCalorieTarget equals calorieTarget (deficit applied)", () => {
    const p = profile({
      goals: ["lose weight"],
      workoutDaysPerWeek: 3,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.restDayCalorieTarget).toBe(plan.calorieTarget);
  });

  it("fat_loss: dailyCalorieTargets[day] > calorieTarget because exercise adds burn", () => {
    const p = profile({
      goals: ["lose weight"],
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets?.monday).toBeGreaterThan(plan.calorieTarget);
  });

  it("muscle_gain: restDayCalorieTarget equals calorieTarget (surplus applied)", () => {
    const p = profile({
      goals: ["gain muscle"],
      goalWeightKg: 90,
      workoutDaysPerWeek: 4,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "tuesday", activities: [{ type: "gym", durationMinutes: 60, intensity: "hard" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.restDayCalorieTarget).toBe(plan.calorieTarget);
  });

  it("muscle_gain: dailyCalorieTargets[day] > calorieTarget (surplus + burn)", () => {
    const p = profile({
      goals: ["gain muscle"],
      goalWeightKg: 90,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "tuesday", activities: [{ type: "gym", durationMinutes: 60, intensity: "hard" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets?.tuesday).toBeGreaterThan(plan.calorieTarget);
  });
});

// ─── 3. Legacy gymDayCalorieTarget — additive on top of goal-adjusted base ────

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

// ─── 4. Legacy sport practice day ─────────────────────────────────────────────

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

// ─── 5. Legacy game day ───────────────────────────────────────────────────────

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

// ─── 6. No double-counting across any combination ────────────────────────────

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

    expect(plan.gymDayCalorieTarget!).toBeGreaterThan(base);
    expect(plan.practiceDayCalorieTarget!).toBeGreaterThan(base);
    expect(plan.gameDayCalorieTarget!).toBeGreaterThan(plan.practiceDayCalorieTarget!);
  });
});

// ─── 7. New dailyCalorieTargets — per-day per-activity map ────────────────────

describe("dailyCalorieTargets — new per-day exercise schedule", () => {
  it("rest day (no schedule): dailyCalorieTargets is null", () => {
    const plan = generatePlan(profile({ workoutDaysPerWeek: 0 }));
    expect(plan.dailyCalorieTargets).toBeNull();
  });

  it("gym-only day: dailyCalorieTargets[day] = calorieTarget + gymBurn", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();

    const act: ScheduledActivity = { type: "gym", durationMinutes: 60, intensity: "moderate" };
    const expectedBurn = estimateActivityBurn(act, 80);
    expect(plan.dailyCalorieTargets!.monday).toBe(plan.calorieTarget + expectedBurn);
  });

  it("sport_practice day: dailyCalorieTargets[day] = calorieTarget + sportPracticeBurn", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "thursday", activities: [{ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "football" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();

    const act: ScheduledActivity = { type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "football" };
    const expectedBurn = estimateActivityBurn(act, 80);
    expect(plan.dailyCalorieTargets!.thursday).toBe(plan.calorieTarget + expectedBurn);
  });

  it("game day: dailyCalorieTargets[day] = calorieTarget + gameBurn", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "saturday", activities: [{ type: "game", durationMinutes: 90, intensity: "hard", sport: "football" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();

    const act: ScheduledActivity = { type: "game", durationMinutes: 90, intensity: "hard", sport: "football" };
    const expectedBurn = estimateActivityBurn(act, 80);
    expect(plan.dailyCalorieTargets!.saturday).toBe(plan.calorieTarget + expectedBurn);
  });

  it("two activities same day: both burns are summed (never double-counted)", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          {
            day: "tuesday",
            activities: [
              { type: "gym", durationMinutes: 60, intensity: "moderate" },
              { type: "cardio", durationMinutes: 30, intensity: "hard" },
            ],
          },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();

    const gymBurn    = estimateActivityBurn({ type: "gym",    durationMinutes: 60, intensity: "moderate" }, 80);
    const cardioBurn = estimateActivityBurn({ type: "cardio", durationMinutes: 30, intensity: "hard"     }, 80);
    expect(plan.dailyCalorieTargets!.tuesday).toBe(plan.calorieTarget + gymBurn + cardioBurn);
  });

  it("gym + sport_practice same day: both burns summed independently", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          {
            day: "friday",
            activities: [
              { type: "gym",            durationMinutes: 60, intensity: "moderate" },
              { type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "basketball" },
            ],
          },
        ],
      }),
    });
    const plan = generatePlan(p);

    const gymBurn     = estimateActivityBurn({ type: "gym",            durationMinutes: 60, intensity: "moderate"                }, 80);
    const sportBurn   = estimateActivityBurn({ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "basketball" }, 80);
    expect(plan.dailyCalorieTargets!.friday).toBe(plan.calorieTarget + gymBurn + sportBurn);
  });

  it("multiple days each have correct independent target", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday",   activities: [{ type: "gym",     durationMinutes: 60, intensity: "moderate" }] },
          { day: "thursday", activities: [{ type: "cardio",  durationMinutes: 45, intensity: "hard"     }] },
          { day: "saturday", activities: [{ type: "game",    durationMinutes: 90, intensity: "hard",    sport: "soccer" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();

    const monBurn = estimateActivityBurn({ type: "gym",    durationMinutes: 60, intensity: "moderate" }, 80);
    const thuBurn = estimateActivityBurn({ type: "cardio", durationMinutes: 45, intensity: "hard"     }, 80);
    const satBurn = estimateActivityBurn({ type: "game",   durationMinutes: 90, intensity: "hard", sport: "soccer" }, 80);

    expect(plan.dailyCalorieTargets!.monday).toBe(plan.calorieTarget + monBurn);
    expect(plan.dailyCalorieTargets!.thursday).toBe(plan.calorieTarget + thuBurn);
    expect(plan.dailyCalorieTargets!.saturday).toBe(plan.calorieTarget + satBurn);
  });

  it("days not in schedule are absent from dailyCalorieTargets (rest days use calorieTarget)", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets!.tuesday).toBeUndefined();
    expect(plan.dailyCalorieTargets!.wednesday).toBeUndefined();
    expect(plan.dailyCalorieTargets!.sunday).toBeUndefined();
  });

  it("base calorieTarget never changes regardless of how many active days are in schedule", () => {
    const fewDays = generatePlan(profile({
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
      }),
    }));
    const manyDays = generatePlan(profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday",    activities: [{ type: "gym",    durationMinutes: 60, intensity: "moderate" }] },
          { day: "tuesday",   activities: [{ type: "cardio", durationMinutes: 45, intensity: "hard"     }] },
          { day: "wednesday", activities: [{ type: "gym",    durationMinutes: 60, intensity: "hard"     }] },
          { day: "thursday",  activities: [{ type: "cardio", durationMinutes: 30, intensity: "moderate" }] },
          { day: "friday",    activities: [{ type: "gym",    durationMinutes: 60, intensity: "moderate" }] },
          { day: "saturday",  activities: [{ type: "game",   durationMinutes: 90, intensity: "hard", sport: "basketball" }] },
        ],
      }),
    }));
    expect(fewDays.calorieTarget).toBe(manyDays.calorieTarget);
  });
});

// ─── 8. Backward compat: old sportSchedule populates dailyCalorieTargets ──────

describe("backward compat — sportSchedule populates dailyCalorieTargets", () => {
  it("old sportSchedule without customWorkoutSchedule still generates dailyCalorieTargets", () => {
    const p = profile({
      customWorkoutSchedule: null,
      sportSchedule: JSON.stringify({
        sport: "football",
        days: ["tuesday", "thursday"],
        startTime: "18:00",
        durationMinutes: 90,
        intensity: "moderate",
        gameDays: ["saturday"],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets).not.toBeNull();
    expect(plan.dailyCalorieTargets!.tuesday).toBeGreaterThan(plan.calorieTarget);
    expect(plan.dailyCalorieTargets!.thursday).toBeGreaterThan(plan.calorieTarget);
    expect(plan.dailyCalorieTargets!.saturday).toBeGreaterThan(plan.calorieTarget);
  });

  it("legacy game day target > legacy practice day target (same sport, game = hard)", () => {
    const p = profile({
      customWorkoutSchedule: null,
      sportSchedule: JSON.stringify({
        sport: "basketball",
        days: ["monday", "wednesday"],
        startTime: "17:00",
        durationMinutes: 75,
        intensity: "moderate",
        gameDays: ["friday"],
      }),
    });
    const plan = generatePlan(p);
    expect(plan.dailyCalorieTargets!.friday).toBeGreaterThan(plan.dailyCalorieTargets!.monday);
  });

  it("new customWorkoutSchedule takes priority over old sportSchedule", () => {
    const p = profile({
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
      sportSchedule: JSON.stringify({
        sport: "football",
        days: ["tuesday", "thursday"],
        durationMinutes: 90,
        intensity: "moderate",
        gameDays: [],
      }),
    });
    const plan = generatePlan(p);
    // new schedule has monday only — tuesday from old sportSchedule should NOT appear
    expect(plan.dailyCalorieTargets!.monday).toBeGreaterThan(plan.calorieTarget);
    expect(plan.dailyCalorieTargets!.tuesday).toBeUndefined();
  });
});

// ─── 9. estimateActivityBurn unit tests ───────────────────────────────────────

describe("estimateActivityBurn — per-activity calorie burn", () => {
  it("gym: burn > 0 for any intensity", () => {
    for (const intensity of ["light", "moderate", "hard"] as const) {
      const burn = estimateActivityBurn({ type: "gym", durationMinutes: 60, intensity }, 80);
      expect(burn).toBeGreaterThan(0);
    }
  });

  it("home_workout: burn > 0", () => {
    const burn = estimateActivityBurn({ type: "home_workout", durationMinutes: 45, intensity: "moderate" }, 80);
    expect(burn).toBeGreaterThan(0);
  });

  it("cardio: harder intensity burns more", () => {
    const light    = estimateActivityBurn({ type: "cardio", durationMinutes: 30, intensity: "light"    }, 80);
    const moderate = estimateActivityBurn({ type: "cardio", durationMinutes: 30, intensity: "moderate" }, 80);
    const hard     = estimateActivityBurn({ type: "cardio", durationMinutes: 30, intensity: "hard"     }, 80);
    expect(moderate).toBeGreaterThan(light);
    expect(hard).toBeGreaterThan(moderate);
  });

  it("sport_practice: burn > 0 for football", () => {
    const burn = estimateActivityBurn({ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "football" }, 80);
    expect(burn).toBeGreaterThan(0);
  });

  it("game: burn > sport_practice burn for same duration (game = hard)", () => {
    const practice = estimateActivityBurn({ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "basketball" }, 80);
    const game     = estimateActivityBurn({ type: "game",           durationMinutes: 90, intensity: "hard",     sport: "basketball" }, 80);
    expect(game).toBeGreaterThan(practice);
  });

  it("longer duration burns more for same activity type and intensity", () => {
    const short = estimateActivityBurn({ type: "cardio", durationMinutes: 30, intensity: "moderate" }, 80);
    const long  = estimateActivityBurn({ type: "cardio", durationMinutes: 60, intensity: "moderate" }, 80);
    expect(long).toBeGreaterThan(short);
  });

  it("heavier user burns more for same activity", () => {
    const lighter = estimateActivityBurn({ type: "gym", durationMinutes: 60, intensity: "moderate" }, 60);
    const heavier = estimateActivityBurn({ type: "gym", durationMinutes: 60, intensity: "moderate" }, 100);
    expect(heavier).toBeGreaterThan(lighter);
  });
});
