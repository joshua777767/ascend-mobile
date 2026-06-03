import { test, expect } from "@playwright/test";

// ── Landing page ─────────────────────────────────────────────────────────────

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your ai coach/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /start 7-day free trial/i })).toBeVisible();
});

test("landing page CTA links to /signup", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: /start 7-day free trial/i });
  await expect(cta).toHaveAttribute("href", /signup/);
});

test("landing page has login link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
});

// ── Login page ────────────────────────────────────────────────────────────────

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByTestId("input-email")).toBeVisible();
  await expect(page.getByTestId("input-password")).toBeVisible();
  await expect(page.getByTestId("button-login")).toBeVisible();
  await expect(page.getByTestId("link-signup")).toBeVisible();
});

test("login shows error for wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("input-email").fill("nobody@example.com");
  await page.getByTestId("input-password").fill("wrongpassword");
  await page.getByTestId("button-login").click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  expect(page.url()).toContain("/login");
});

// ── Signup page ───────────────────────────────────────────────────────────────

test("signup page loads", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  await expect(page.getByTestId("input-email")).toBeVisible();
  await expect(page.getByTestId("input-password")).toBeVisible();
  await expect(page.getByTestId("button-signup")).toBeVisible();
  await expect(page.getByTestId("link-login")).toBeVisible();
});

test("signup rejects short passwords", async ({ page }) => {
  await page.goto("/signup");
  await page.getByTestId("input-email").fill("newuser@example.com");
  await page.getByTestId("input-password").fill("short");
  await page.getByTestId("button-signup").click();
  await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  expect(page.url()).toContain("/signup");
});

// ── Auth guards ───────────────────────────────────────────────────────────────

test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("unauthenticated /meals redirects to /login", async ({ page }) => {
  await page.goto("/meals");
  await expect(page).toHaveURL(/login/);
});

test("unauthenticated /coach redirects to /login", async ({ page }) => {
  await page.goto("/coach");
  await expect(page).toHaveURL(/login/);
});
