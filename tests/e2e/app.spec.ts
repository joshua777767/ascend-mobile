import { test, expect, type Page } from "@playwright/test";

// All tests in this file use the `authed` project which loads the
// session cookie saved by global-setup (logged in + profile complete).
// That means every page should load without hitting the onboarding redirect.

// ── Helper: spinner must not linger ─────────────────────────────────────────

async function assertNoInfiniteSpinner(page: Page) {
  // If a full-screen spinner is present it must disappear within 8 seconds
  // (that's the timeout baked into useFirstLoadSpinner).
  const spinner = page.locator(".animate-spin").first();
  const isPresent = await spinner.isVisible().catch(() => false);
  if (isPresent) {
    await expect(spinner).toBeHidden({ timeout: 9_000 });
  }
}

// ── Protected app pages ───────────────────────────────────────────────────────

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await assertNoInfiniteSpinner(page);
  // Dashboard has "Good morning / afternoon / evening" or the user name
  // We just verify there is NO redirect to /login or /onboarding
  await expect(page).not.toHaveURL(/login/);
  await expect(page).not.toHaveURL(/onboarding/);
  // Wait for main content — something in the page body
  await expect(page.locator("body")).not.toBeEmpty();
});

test("meals page loads", async ({ page }) => {
  await page.goto("/meals");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.getByText(/meal/i).first()).toBeVisible();
});

test("coach page loads", async ({ page }) => {
  await page.goto("/coach");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  // Coach chat should show a message input or heading
  await expect(page.locator("body")).not.toBeEmpty();
});

test("journal page loads", async ({ page }) => {
  await page.goto("/journal");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("progress page loads", async ({ page }) => {
  await page.goto("/progress");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("schedule page loads", async ({ page }) => {
  await page.goto("/schedule");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("workouts page loads", async ({ page }) => {
  await page.goto("/workouts");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("settings page loads and shows account email", async ({ page }) => {
  await page.goto("/settings");
  await assertNoInfiniteSpinner(page);
  await expect(page).not.toHaveURL(/login/);
  await expect(page.getByTestId("text-email")).toBeVisible();
  const email = await page.getByTestId("text-email").innerText();
  expect(email).toContain("@");
});

// ── Spinner timeout guarantee ─────────────────────────────────────────────────

test("no page holds an infinite loading spinner beyond 8 s", async ({ page }) => {
  const routes = ["/dashboard", "/meals", "/coach", "/journal", "/progress"];
  for (const route of routes) {
    await page.goto(route);
    await assertNoInfiniteSpinner(page);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
// This test intentionally runs LAST because it destroys the session.
// Playwright runs tests in file order within a project (fullyParallel: false).

test("logout redirects to /login and session is invalidated", async ({ page, context }) => {
  await page.goto("/settings");
  await assertNoInfiniteSpinner(page);

  // Click logout
  await page.getByTestId("button-logout").click();

  // Should redirect to /login
  await expect(page).toHaveURL(/login/, { timeout: 8_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

  // Open a fresh page in the same context — session cookie is gone server-side
  const page2 = await context.newPage();
  await page2.goto("/dashboard");
  await expect(page2).toHaveURL(/login/);
  await page2.close();
});
