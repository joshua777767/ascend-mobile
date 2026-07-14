import { test, expect } from "@playwright/test";

/**
 * Exercise Schedule E2E Tests
 * Uses the authed session from global-setup (qa-test@ascend.internal).
 * Each test resets the test user's profile before/after to keep state clean.
 */

const BASE = "http://localhost:80";

// Cookie from global-setup auth state
let authCookie = "";

test.beforeAll(async ({ browser }) => {
  // Read the auth cookie from the shared state file
  const fs = await import("node:fs");
  const state = JSON.parse(fs.readFileSync("./auth-with-profile.json", "utf8"));
  const cookie = state.cookies.find((c: any) => c.name === "connect.sid");
  authCookie = cookie ? `${cookie.name}=${cookie.value}` : "";
});

async function apiFetch(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Forwarded-Proto": "https",
    Cookie: authCookie,
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.beforeEach(async () => {
  // Reset the test user's profile to a clean state before each test
  await apiFetch("DELETE", "/api/users/profile");
});

test.afterEach(async () => {
  // Clean up after each test
  await apiFetch("DELETE", "/api/users/profile");
});

// ── 1. Dashboard shows schedule prompt for user without schedule ────────────

test("dashboard shows 'Set your exercise schedule' prompt when no schedule exists", async ({ page }) => {
  // Create a basic profile without any exercise schedule
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25,
    gender: "male",
    heightCm: 175,
    currentWeightKg: 80,
    goalWeightKg: 75,
    bodyType: "average",
    goals: ["fat loss"],
    fitnessLevel: "intermediate",
    gymAccess: "no",
    workoutDaysPerWeek: 0,
    wakeTime: "07:00",
    sleepTime: "23:00",
    sleepQuality: 6,
    energyLevel: 6,
    stressLevel: 4,
    mealsPerDay: 3,
    waterIntakeLiters: 2.5,
    skinConcerns: [],
    commitmentLevel: "serious",
    digestionConcerns: [],
  });
  await apiFetch("POST", "/api/plans/current", {});

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // The prompt should be visible
  const prompt = page.locator("text=Set your exercise schedule").first();
  await expect(prompt).toBeVisible({ timeout: 10_000 });
});

// ── 2. Dashboard prompt disappears after saving schedule ────────────────

test("dashboard prompt disappears after saving exercise schedule in settings", async ({ page }) => {
  // Create profile without schedule
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "no", workoutDaysPerWeek: 0,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
  });
  await apiFetch("POST", "/api/plans/current", {});

  // Go to settings and add an exercise schedule
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // Toggle Monday on
  const monBtn = page.getByTestId("day-toggle-monday");
  await monBtn.click();

  // Wait for activity config card to appear
  await page.waitForSelector("text=Monday", { timeout: 5_000 });

  // Save
  const saveBtn = page.locator("text=Save exercise schedule").first();
  await saveBtn.click();

  // Wait for save confirmation (button text changes briefly)
  await page.waitForTimeout(2_000);

  // Go to dashboard
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Prompt should NOT be visible anymore
  const prompt = page.locator("text=Set your exercise schedule").first();
  await expect(prompt).not.toBeVisible({ timeout: 5_000 });
});

// ── 3. Settings Exercise Schedule section loads ──────────────────────────

test("settings page shows Exercise Schedule section", async ({ page }) => {
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "no", workoutDaysPerWeek: 0,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
  });

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("text=Exercise Schedule").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Exercise days").first()).toBeVisible();
  await expect(page.locator('button:has-text("M")').first()).toBeVisible();
});

// ── 4. Settings day toggles work ────────────────────────────────────

test("settings: toggling exercise days shows/hides per-day config", async ({ page }) => {
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "no", workoutDaysPerWeek: 0,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
  });

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // Toggle Monday on → per-day card should appear
  const monBtn = page.getByTestId("day-toggle-monday");
  await monBtn.click();
  await expect(page.locator("text=Monday").first()).toBeVisible({ timeout: 5_000 });

  // Toggle Monday off → per-day card should disappear
  await monBtn.click();
  await expect(page.locator("text=Monday").first()).not.toBeVisible({ timeout: 5_000 });
});

// ── 5. Dashboard shows 'Calories (Active Day)' on exercise day ────────────

test("dashboard shows 'Calories (Active Day)' label when today is an exercise day", async ({ page }) => {
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  // Create profile with today as a gym day
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "yes", workoutDaysPerWeek: 1,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
    customWorkoutSchedule: JSON.stringify({
      days: [{ day: todayName, activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
    }),
  });
  await apiFetch("POST", "/api/plans/current", {});

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Should show "Calories (Active Day)" label
  await expect(page.locator("text=Calories (Active Day)").first()).toBeVisible({ timeout: 10_000 });
});

// ── 6. Dashboard shows plain 'Calories' on rest day ─────────────────────

test("dashboard shows plain 'Calories' label when today is a rest day", async ({ page }) => {
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const otherDay = todayName === "monday" ? "tuesday" : "monday";

  // Create profile with a different day as exercise (today = rest)
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "yes", workoutDaysPerWeek: 1,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
    customWorkoutSchedule: JSON.stringify({
      days: [{ day: otherDay, activities: [{ type: "gym", durationMinutes: 60, intensity: "moderate" }] }],
    }),
  });
  await apiFetch("POST", "/api/plans/current", {});

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Should NOT show "Active Day" label
  await expect(page.locator("text=Calories (Active Day)").first()).not.toBeVisible({ timeout: 5_000 });
  // But should still show "Calories" label
  await expect(page.locator("text=Calories").first()).toBeVisible({ timeout: 10_000 });
});

// ── 7. Settings multi-activity per day ────────────────────────────────

test("settings: can add multiple activities to the same day", async ({ page }) => {
  await apiFetch("POST", "/api/users/profile", {
    name: "Schedule QA",
    age: 25, gender: "male", heightCm: 175, currentWeightKg: 80, goalWeightKg: 75,
    bodyType: "average", goals: ["fat loss"], fitnessLevel: "intermediate",
    gymAccess: "yes", workoutDaysPerWeek: 0,
    wakeTime: "07:00", sleepTime: "23:00", sleepQuality: 6,
    energyLevel: 6, stressLevel: 4, mealsPerDay: 3, waterIntakeLiters: 2.5,
    skinConcerns: [], commitmentLevel: "serious", digestionConcerns: [],
  });

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // Toggle Monday on
  const monBtn = page.getByTestId("day-toggle-monday");
  await monBtn.click();

  // Wait for per-day card
  await page.waitForSelector("text=Monday", { timeout: 5_000 });

  // Add another activity
  const addBtn = page.locator("text=+ Add another activity").first();
  await addBtn.click();

  // Should now have 2 activity cards for Monday
  const activityCards = page.locator("text=Activity 1, Activity 2, text=Activity 2").first();
  // Just check the add button leads to more content — look for the "Remove" button that appears with 2+ activities
  await expect(page.locator("text=Remove").first()).toBeVisible({ timeout: 5_000 });
});
