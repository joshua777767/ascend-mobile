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
  const api = await request.newContext({ baseURL: BASE });

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

  // Upsert profile so protected pages load without onboarding redirect
  const profileRes = await api.post("/api/users/profile", { data: PROFILE });
  if (!profileRes.ok()) {
    const body = await profileRes.text();
    throw new Error(`QA setup: profile creation failed (${profileRes.status()}): ${body}`);
  }

  // Persist cookie state for authed tests
  await api.storageState({ path: AUTH_STATE });
  await api.dispose();

  console.log("  QA test user ready:", EMAIL);
}
