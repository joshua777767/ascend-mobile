import { request } from "@playwright/test";

const BASE = "http://localhost:80";
const EMAIL = "qa-test@ascend.internal";
const PASSWORD = "qa-testpass-9912";
export const AUTH_STATE = "./auth-with-profile.json";

const PROFILE = {
  name: "QA Tester",
  age: 30,
  gender: "male",
  heightCm: 178,
  currentWeightKg: 80,
  goalWeightKg: 75,
  bodyType: "average",
  goals: ["fat loss", "more energy"],
  fitnessLevel: "beginner",
  gymAccess: "home",
  workoutDaysPerWeek: 3,
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

export default async function globalSetup() {
  const api = await request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
  });

  // Try login first (user may already exist from a previous run)
  let res = await api.post("/api/auth/login", {
    data: { email: EMAIL, password: PASSWORD },
  });

  if (!res.ok()) {
    // Account doesn't exist yet — create it
    res = await api.post("/api/auth/signup", {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`QA setup: signup failed (${res.status()}): ${body}`);
    }
  }

  // Grant free Pro access so the test user skips the subscription paywall
  const userBody = await res.json();
  const userId = userBody?.id;
  if (userId) {
    const rcRes = await api.post("/api/revenuecat/webhook", {
      data: {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: String(userId),
          entitlements: { pro: { expires_date: "2099-01-01T00:00:00Z" } },
        },
      },
    });
    if (!rcRes.ok()) {
      const rcBody = await rcRes.text();
      console.warn(`  QA setup: RC webhook returned ${rcRes.status()}: ${rcBody}`);
    }
  }

  // Upsert profile so protected pages load without onboarding redirect
  const profileRes = await api.post("/api/users/profile", { data: PROFILE });
  if (!profileRes.ok()) {
    const body = await profileRes.text();
    throw new Error(`QA setup: profile creation failed (${profileRes.status()}): ${body}`);
  }

  // Persist cookie state for authed tests
  await api.storageState({ path: AUTH_STATE });
  await api.dispose();

  // Patch cookie for HTTP E2E: sameSite=None requires secure=true per spec,
  // so Chromium silently drops the cookie over HTTP. Switch to Lax+insecure.
  const fs = await import("node:fs");
  const state = JSON.parse(fs.readFileSync(AUTH_STATE, "utf8"));
  for (const c of state.cookies ?? []) {
    c.secure = false;
    c.sameSite = "Lax";
  }
  fs.writeFileSync(AUTH_STATE, JSON.stringify(state, null, 2));

  console.log("  QA test user ready:", EMAIL);
}
