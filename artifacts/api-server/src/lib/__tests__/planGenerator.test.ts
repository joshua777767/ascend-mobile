import { describe, it, expect } from "vitest";
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
  it("uses high-activity TDEE once and does not add gym calories again", () => {
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

    const plan = generatePlan(p);
    // Mifflin–St Jeor: 10(72.6) + 6.25(167.64) - 5(16) + 5 = 1,699 kcal.
    // High activity: 1,699 × 1.725 = 2,930 kcal; weight-loss deficit = 500.
    expect(plan.calorieTarget).toBe(2430);
    expect(plan.dailyCalorieTargets).toBeNull();
    expect(plan.gymDayCalorieTarget).toBeNull();
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
