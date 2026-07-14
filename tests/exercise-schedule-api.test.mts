/**
 * Exercise Schedule — Integration API Tests
 * Covers: onboarding save, plan generation, dailyCalorieTargets,
 *   backward compat, multi-activity, rest days, gym/sport/game days,
 *   profile patch triggers plan regen.
 *
 * Run: pnpm --filter @workspace/tests run test:api-integration
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:80";

// Shared helpers
async function api(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Forwarded-Proto": "https", // required: secure cookies only sent on HTTPS
  };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const parsed = ct.includes("application/json") && text ? JSON.parse(text) : text;
  const setCookie = res.headers.get("set-cookie") ?? "";
  return { status: res.status, body: parsed, setCookie };
}

function post(path: string, body: unknown, cookie?: string) { return api("POST", path, body, cookie); }
function get(path: string, cookie?: string) { return api("GET", path, undefined, cookie); }
function patch(path: string, body: unknown, cookie?: string) { return api("PATCH", path, body, cookie); }
function del(path: string, cookie?: string) { return api("DELETE", path, undefined, cookie); }

// Factory: create a fresh test user, return { cookie, email }
async function createTestUser(label: string) {
  const email = `qa-schedule-${label}-${Date.now()}@ascend.internal`;
  const password = "qa-schedule-pass-9912";
  const r = await post("/api/auth/signup", { email, password });
  assert.equal(r.status, 201, `signup failed: ${JSON.stringify(r.body)}`);
  const cookie = r.setCookie.split(";")[0];
  return { email, password, cookie, userId: (r.body as any).id };
}

// Minimal base profile
const BASE_PROFILE = {
  name: "Schedule QA",
  age: 25,
  gender: "male",
  heightCm: 175,
  currentWeightKg: 80,
  goalWeightKg: 75,
  bodyType: "average",
  goals: ["fat loss"],
  fitnessLevel: "intermediate",
  gymAccess: "home",
  workoutDaysPerWeek: 0,
  commitmentLevel: "serious",
  wakeTime: "07:00",
  sleepTime: "23:00",
  sleepQuality: 6,
  energyLevel: 6,
  stressLevel: 4,
  mealsPerDay: 3,
  waterIntakeLiters: 2.5,
  skinConcerns: [],
  digestionConcerns: [],
};

// ── Suite 1: Rest day — no schedule ────────────────────────────────────────

describe("1. Rest day — no exercise schedule", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("rest");
    cookie = u.cookie;
    await post("/api/users/profile", { ...BASE_PROFILE, workoutDaysPerWeek: 0 }, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets is null", async () => {
    const r = await get("/api/plans/current", cookie);
    assert.equal(r.status, 200);
    const plan = r.body as any;
    assert.equal(plan.dailyCalorieTargets, null);
  });

  it("calorieTarget equals restDayCalorieTarget", async () => {
    const r = await get("/api/plans/current", cookie);
    const plan = r.body as any;
    assert.equal(plan.calorieTarget, plan.restDayCalorieTarget);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 2: Gym-only day ──────────────────────────────────────────────

describe("2. Gym-only day — single activity", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("gym");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets[monday] > calorieTarget", async () => {
    const r = await get("/api/plans/current", cookie);
    const plan = r.body as any;
    assert.ok(plan.dailyCalorieTargets);
    assert.ok(plan.dailyCalorieTargets.monday > plan.calorieTarget,
      `Expected ${plan.dailyCalorieTargets.monday} > ${plan.calorieTarget}`);
  });

  it("calorieTarget (base) did NOT change from rest-day base", async () => {
    // Compare against a rest-day user with same stats
    const u2 = await createTestUser("gym-rest-ref");
    await post("/api/users/profile", BASE_PROFILE, u2.cookie);
    await post("/api/plans/current", {}, u2.cookie);
    const restPlan = (await get("/api/plans/current", u2.cookie)).body as any;
    const gymPlan = (await get("/api/plans/current", cookie)).body as any;
    assert.equal(gymPlan.calorieTarget, restPlan.calorieTarget,
      "Base calorieTarget must be identical regardless of gym schedule");
    await del("/api/users/profile", u2.cookie);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 3: Sport practice day ──────────────────────────────────────────

describe("3. Sport practice day", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("sport");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "thursday", activities: [{ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "football" }] },
        ],
      }),
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets[thursday] > calorieTarget", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.thursday > plan.calorieTarget);
  });

  it("other days are absent from dailyCalorieTargets (rest)", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.equal(plan.dailyCalorieTargets.monday, undefined);
    assert.equal(plan.dailyCalorieTargets.sunday, undefined);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 4: Game day ────────────────────────────────────────────────────

describe("4. Game day", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("game");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "saturday", activities: [{ type: "game", durationMinutes: 90, intensity: "hard", sport: "football" }] },
        ],
      }),
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets[saturday] > calorieTarget", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.saturday > plan.calorieTarget);
  });

  it("game day target > practice day target for same sport/duration (hard > moderate)", async () => {
    // Create a practice-day user for comparison
    const u2 = await createTestUser("practice-ref");
    const p2 = {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "saturday", activities: [{ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "football" }] },
        ],
      }),
    };
    await post("/api/users/profile", p2, u2.cookie);
    await post("/api/plans/current", {}, u2.cookie);
    const gamePlan = (await get("/api/plans/current", cookie)).body as any;
    const practicePlan = (await get("/api/plans/current", u2.cookie)).body as any;
    assert.ok(gamePlan.dailyCalorieTargets.saturday > practicePlan.dailyCalorieTargets.saturday,
      `Game ${gamePlan.dailyCalorieTargets.saturday} should exceed practice ${practicePlan.dailyCalorieTargets.saturday}`);
    await del("/api/users/profile", u2.cookie);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 5: Multiple activities on same day ────────────────────────

describe("5. Multiple activities on the same day", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("multi");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
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
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets[tuesday] = calorieTarget + gymBurn + cardioBurn", async () => {
    const multiPlan = (await get("/api/plans/current", cookie)).body as any;

    // Create single-activity reference users
    const uGym = await createTestUser("multi-gym-ref");
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "tuesday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
      }),
    }, uGym.cookie);
    await post("/api/plans/current", {}, uGym.cookie);
    const gymPlan = (await get("/api/plans/current", uGym.cookie)).body as any;

    const uCardio = await createTestUser("multi-cardio-ref");
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "tuesday", activities: [{ type: "cardio", durationMinutes: 30, intensity: "hard" }] }],
      }),
    }, uCardio.cookie);
    await post("/api/plans/current", {}, uCardio.cookie);
    const cardioPlan = (await get("/api/plans/current", uCardio.cookie)).body as any;

    const base = multiPlan.calorieTarget;
    const gymBurn = gymPlan.dailyCalorieTargets.tuesday - base;
    const cardioBurn = cardioPlan.dailyCalorieTargets.tuesday - base;
    const multiTotal = multiPlan.dailyCalorieTargets.tuesday;

    assert.equal(multiTotal, base + gymBurn + cardioBurn,
      `Expected ${base} + ${gymBurn} + ${cardioBurn} = ${base + gymBurn + cardioBurn}, got ${multiTotal}`);

    await del("/api/users/profile", uGym.cookie);
    await del("/api/users/profile", uCardio.cookie);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 6: Gym + sport on same day ──────────────────────────────────────

describe("6. Gym + sport practice on the same day", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("gym-sport");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [
          {
            day: "friday",
            activities: [
              { type: "gym", durationMinutes: 60, intensity: "moderate" },
              { type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "basketball" },
            ],
          },
        ],
      }),
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets[friday] = base + gymBurn + sportBurn", async () => {
    const multiPlan = (await get("/api/plans/current", cookie)).body as any;
    const base = multiPlan.calorieTarget;

    // Reference users
    const uGym = await createTestUser("gs-gym-ref");
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "friday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
      }),
    }, uGym.cookie);
    await post("/api/plans/current", {}, uGym.cookie);
    const gymPlan = (await get("/api/plans/current", uGym.cookie)).body as any;

    const uSport = await createTestUser("gs-sport-ref");
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "friday", activities: [{ type: "sport_practice", durationMinutes: 90, intensity: "moderate", sport: "basketball" }] }],
      }),
    }, uSport.cookie);
    await post("/api/plans/current", {}, uSport.cookie);
    const sportPlan = (await get("/api/plans/current", uSport.cookie)).body as any;

    const gymBurn = gymPlan.dailyCalorieTargets.friday - base;
    const sportBurn = sportPlan.dailyCalorieTargets.friday - base;
    const multiTotal = multiPlan.dailyCalorieTargets.friday;

    assert.equal(multiTotal, base + gymBurn + sportBurn,
      `Expected ${base} + ${gymBurn} + ${sportBurn} = ${base + gymBurn + sportBurn}, got ${multiTotal}`);

    await del("/api/users/profile", uGym.cookie);
    await del("/api/users/profile", uSport.cookie);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 7: Backward compat — legacy sportSchedule only ────────────────

describe("7. Backward compat — old sportSchedule populates dailyCalorieTargets", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("legacy");
    cookie = u.cookie;
    const profile = {
      ...BASE_PROFILE,
      sport: "football",
      sportSchedule: JSON.stringify({
        sport: "football",
        days: ["tuesday", "thursday"],
        startTime: "18:00",
        durationMinutes: 90,
        intensity: "moderate",
        gameDays: ["saturday"],
      }),
    };
    await post("/api/users/profile", profile, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("dailyCalorieTargets is populated from sportSchedule", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets, "dailyCalorieTargets should be auto-populated from legacy sportSchedule");
  });

  it("practice day > rest day", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.tuesday > plan.calorieTarget);
  });

  it("game day > practice day", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.saturday > plan.dailyCalorieTargets.tuesday,
      `Game ${plan.dailyCalorieTargets.saturday} should exceed practice ${plan.dailyCalorieTargets.tuesday}`);
  });

  it("non-scheduled days are absent", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.equal(plan.dailyCalorieTargets.monday, undefined);
    assert.equal(plan.dailyCalorieTargets.wednesday, undefined);
    assert.equal(plan.dailyCalorieTargets.friday, undefined);
    assert.equal(plan.dailyCalorieTargets.sunday, undefined);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 8: PATCH triggers plan regen with new schedule ────────────────

describe("8. PATCH /users/profile with customWorkoutSchedule triggers plan regen", () => {
  let cookie = "";

  before(async () => {
    const u = await createTestUser("patch");
    cookie = u.cookie;
    await post("/api/users/profile", BASE_PROFILE, cookie);
    await post("/api/plans/current", {}, cookie);
  });

  it("initial plan has no dailyCalorieTargets", async () => {
    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.equal(plan.dailyCalorieTargets, null);
  });

  it("after PATCH with customWorkoutSchedule, plan regens with dailyCalorieTargets", async () => {
    const patchBody = {
      customWorkoutSchedule: JSON.stringify({
        days: [
          { day: "wednesday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] },
        ],
      }),
    };
    const patchRes = await patch("/api/users/profile", patchBody, cookie);
    assert.equal(patchRes.status, 200, `PATCH failed: ${JSON.stringify(patchRes.body)}`);

    const plan = (await get("/api/plans/current", cookie)).body as any;
    assert.ok(plan.dailyCalorieTargets, "Plan should have been regenerated with dailyCalorieTargets");
    assert.ok(plan.dailyCalorieTargets.wednesday > plan.calorieTarget);
  });

  after(async () => {
    await del("/api/users/profile", cookie);
  });
});

// ── Suite 9: Goal-adjusted base preserved in dailyCalorieTargets ────────────────

describe("9. Goal-adjusted base — deficit/surplus preserved", () => {
  let lossCookie = "";
  let gainCookie = "";

  before(async () => {
    const uLoss = await createTestUser("loss");
    lossCookie = uLoss.cookie;
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      goals: ["lose weight"],
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
      }),
    }, lossCookie);
    await post("/api/plans/current", {}, lossCookie);

    const uGain = await createTestUser("gain");
    gainCookie = uGain.cookie;
    await post("/api/users/profile", {
      ...BASE_PROFILE,
      goals: ["gain muscle"],
      goalWeightKg: 90,
      customWorkoutSchedule: JSON.stringify({
        days: [{ day: "monday", activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
      }),
    }, gainCookie);
    await post("/api/plans/current", {}, gainCookie);
  });

  it("fat_loss: gym day target > calorieTarget (deficit base + burn)", async () => {
    const plan = (await get("/api/plans/current", lossCookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.monday > plan.calorieTarget);
  });

  it("muscle_gain: gym day target > calorieTarget (surplus base + burn)", async () => {
    const plan = (await get("/api/plans/current", gainCookie)).body as any;
    assert.ok(plan.dailyCalorieTargets.monday > plan.calorieTarget);
  });

  it("fat_loss calorieTarget < muscle_gain calorieTarget for same stats", async () => {
    const lossPlan = (await get("/api/plans/current", lossCookie)).body as any;
    const gainPlan = (await get("/api/plans/current", gainCookie)).body as any;
    assert.ok(lossPlan.calorieTarget < gainPlan.calorieTarget,
      `Loss base ${lossPlan.calorieTarget} should be < gain base ${gainPlan.calorieTarget}`);
  });

  after(async () => {
    await del("/api/users/profile", lossCookie);
    await del("/api/users/profile", gainCookie);
  });
});
