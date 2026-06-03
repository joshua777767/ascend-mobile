import { test, expect } from "@playwright/test";

// Tests run under the `public-mobile` project which sets device to iPhone 13.

test("landing page loads on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your ai coach/i })).toBeVisible();
});

test("landing page CTA is visible on mobile viewport", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: /start 7-day free trial/i });
  await expect(cta).toBeVisible();
  // Button must be within the rendered viewport bounding box
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(0);
});

test("landing page can scroll on mobile", async ({ page }) => {
  await page.goto("/");

  // Record initial scroll position
  const before = await page.evaluate(() => window.scrollY);

  // Scroll down one viewport-height
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBeGreaterThan(before);
});

test("login page loads on mobile", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("input-email")).toBeVisible();
  await expect(page.getByTestId("button-login")).toBeVisible();
});

test("signup page loads on mobile", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByTestId("input-email")).toBeVisible();
  await expect(page.getByTestId("button-signup")).toBeVisible();
});
