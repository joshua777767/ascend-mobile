/**
 * Full QA Test Suite — Ascend App
 * Uses Playwright's request API with full URLs.
 */

import { chromium, request } from "playwright";

const BASE_URL = "http://localhost:80";
const API_BASE = "http://localhost:80/api";
const CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const TEST_EMAIL = `qa-test-${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPassword123!";

const results: { name: string; status: "PASS" | "FAIL" | "SKIP"; error?: string; detail?: string }[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, status: "PASS", detail });
  console.log(`✅ PASS: ${name}${detail ? ` | ${detail}` : ""}`);
}
function fail(name: string, error: string) {
  results.push({ name, status: "FAIL", error });
  console.log(`❌ FAIL: ${name} | ${error}`);
}
function skip(name: string, reason: string) {
  results.push({ name, status: "SKIP", detail: reason });
  console.log(`⏭️ SKIP: ${name} | ${reason}`);
}

async function bodyJson(res: any) {
  try { return await res.json(); } catch { return null; }
}

async function main() {
  console.log("\n🚀 Ascend QA Test Suite\n");
  console.log(`Test user: ${TEST_EMAIL}\n`);

  const apiContext = await request.newContext();

  // ── Test 1: Sign up ──
  {
    const name = "1. Sign up new user";
    try {
      const res = await apiContext.post(`${API_BASE}/auth/signup`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 201 && body?.id) {
        pass(name, `User ${TEST_EMAIL} created, id=${body.id}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 2: Login ──
  {
    const name = "2. Login with test user";
    try {
      const res = await apiContext.post(`${API_BASE}/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.id) {
        pass(name, `id=${body.id}, hasAccess=${body.hasAccess}, trialExpired=${body.trialExpired}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 3: /auth/me fields ──
  {
    const name = "3. /auth/me returns trial & access fields";
    try {
      const res = await apiContext.get(`${API_BASE}/auth/me`);
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.id) {
        const hasFields =
          "trialUsed" in body && "trialStartDate" in body && "trialEndDate" in body &&
          "trialExpired" in body && "trialActive" in body && "hasAccess" in body && "isPaidSubscriber" in body;
        if (hasFields) {
          pass(name, `trialActive=${body.trialActive}, hasAccess=${body.hasAccess}, isPaidSubscriber=${body.isPaidSubscriber}`);
        } else {
          fail(name, `Missing fields: ${JSON.stringify(body)}`);
        }
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 4: Complete onboarding ──
  {
    const name = "4. Complete onboarding (create profile + plan)";
    try {
      const res = await apiContext.post(`${API_BASE}/users/profile`, {
        data: {
          name: "QA Tester",
          age: 28,
          gender: "male",
          heightCm: 180,
          currentWeightKg: 80,
          goalWeightKg: 75,
          bodyType: "ectomorph",
          goals: ["lose fat", "build muscle"],
          fitnessLevel: "beginner",
          gymAccess: "gym",
          workoutDaysPerWeek: 4,
          commitmentLevel: "serious",
          wakeTime: "06:00",
          sleepTime: "22:00",
          sleepQuality: 3,
          energyLevel: 3,
          stressLevel: 3,
        },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 201 && body?.id) {
        pass(name, `Profile created, id=${body.id}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 5: Plan exists ──
  {
    const name = "5. Plan generated (dashboard data)";
    try {
      // First trigger plan generation via POST
      const genRes = await apiContext.post(`${API_BASE}/plans/current`, {
        data: {}, headers: { "Content-Type": "application/json" },
      });
      const genBody = await bodyJson(genRes);
      if (genRes.status() !== 201 && genRes.status() !== 200) {
        // Try GET anyway — plan may already exist
      }
      const res = await apiContext.get(`${API_BASE}/plans/current`);
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.id) {
        pass(name, `plan id=${body.id}, goals=${JSON.stringify(body.goals)}, calories=${body.dailyCalories}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 6: Chat ──
  {
    const name = "6. Coach chat responds";
    try {
      const res = await apiContext.post(`${API_BASE}/chat`, {
        data: { message: "Give me a quick fitness tip" },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.reply) {
        pass(name, `Response: ${String(body.reply).slice(0, 60)}...`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 7: Meals ──
  {
    const name = "7. Meals log and list";
    try {
      const post = await apiContext.post(`${API_BASE}/meals`, {
        data: { mealType: "breakfast", description: "3 eggs, toast", calories: 400, protein: 25, carbs: 30, fats: 18, image: null },
        headers: { "Content-Type": "application/json" },
      });
      const postBody = await bodyJson(post);
      if (post.status() !== 201 && post.status() !== 200) {
        fail(name, `POST failed: ${JSON.stringify(postBody)}`);
      } else {
        const get = await apiContext.get(`${API_BASE}/meals`);
        const body = await bodyJson(get);
        if (Array.isArray(body) && body.some((m: any) => m.description === "3 eggs, toast")) {
          pass(name, `Meal logged and returned (count=${body.length})`);
        } else {
          fail(name, `Meal not found in list: ${JSON.stringify(body)}`);
        }
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 8: Journal ──
  {
    const name = "8. Journal save and retrieve";
    try {
      const today = new Date().toISOString().split("T")[0];
      const post = await apiContext.post(`${API_BASE}/journal`, {
        data: {
          date: today,
          followedSchedule: true,
          hitProtein: true,
          stayedNearCalories: true,
          workedOut: true,
          drankWater: true,
          sleptOnTime: true,
          energyRating: 7,
          skinBloatingRating: 3,
          biggestWin: "Completed QA test entry",
          notes: "QA test entry",
        },
        headers: { "Content-Type": "application/json" },
      });
      const postBody = await bodyJson(post);
      if (post.status() !== 201 && post.status() !== 200) {
        fail(name, `POST failed: ${JSON.stringify(postBody)}`);
      } else {
        const get = await apiContext.get(`${API_BASE}/journal?date=${today}`);
        const body = await bodyJson(get);
        const entries = Array.isArray(body) ? body : [body];
        const entry = entries.find((e: any) => e?.biggestWin?.includes("Completed QA test entry"));
        if (entry) {
          pass(name, `Entry saved and retrieved: ${entry.biggestWin.slice(0, 40)}...`);
        } else {
          fail(name, `GET status ${get.status()}: ${JSON.stringify(body)}`);
        }
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 9: Progress ──
  {
    const name = "9. Progress page (summary endpoint)";
    try {
      const res = await apiContext.get(`${API_BASE}/progress/summary`);
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.startWeightKg !== undefined) {
        pass(name, `startWeightKg=${body?.startWeightKg}, currentWeightKg=${body?.currentWeightKg}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 10: Logout ──
  {
    const name = "10. Logout";
    try {
      const res = await apiContext.post(`${API_BASE}/auth/logout`);
      if (res.status() === 204) {
        pass(name, "Session destroyed successfully");
      } else {
        fail(name, `Status ${res.status()}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 11: Re-login ──
  {
    const name = "11. Login again with same user";
    try {
      const res = await apiContext.post(`${API_BASE}/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.id) {
        pass(name, `id=${body.id}, hasAccess=${body.hasAccess}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 12: Forgot password ──
  {
    const name = "12. Forgot password flow";
    try {
      const res = await apiContext.post(`${API_BASE}/auth/forgot-password`, {
        data: { email: TEST_EMAIL },
        headers: { "Content-Type": "application/json" },
      });
      const body = await bodyJson(res);
      if (res.status() === 200 && body?.message) {
        pass(name, `Response: ${body.message}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 13: Trial lockout ──
  {
    const name = "13. Trial lockout (hasAccess check)";
    try {
      const res = await apiContext.get(`${API_BASE}/auth/me`);
      const body = await bodyJson(res);
      if (res.status() === 200) {
        if (body.hasAccess === true && body.trialActive === true && body.trialExpired === false) {
          pass(name, `hasAccess=true, trialActive=true, trialExpired=false`);
        } else {
          fail(name, `Unexpected state: ${JSON.stringify({ hasAccess: body.hasAccess, trialActive: body.trialActive, trialExpired: body.trialExpired })}`);
        }
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 14: Stripe products ──
  {
    const name = "14. Stripe products available";
    try {
      const res = await apiContext.get(`${API_BASE}/stripe/products`);
      const body = await bodyJson(res);
      if (res.status() === 200 && Array.isArray(body?.data) && body.data.length > 0) {
        pass(name, `Products: ${body.data.map((p: any) => p.name).join(", ")}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // ── Test 15: Stripe subscription ──
  {
    const name = "15. Stripe subscription status";
    try {
      const res = await apiContext.get(`${API_BASE}/subscription`);
      const body = await bodyJson(res);
      if (res.status() === 200) {
        const status = body?.subscription?.status || body?.status || "none";
        pass(name, `Status: ${status}`);
      } else {
        fail(name, `Status ${res.status()}: ${JSON.stringify(body)}`);
      }
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  await apiContext.dispose();

  // ── UI Tests ──
  console.log("\n── UI Tests ──\n");
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, headless: true });
  const context = await browser.newContext();

  // Login page branding
  {
    const name = "UI: Login page branding";
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 15000 });
      const header = await page.locator('text=ASCEND').first().isVisible().catch(() => false);
      const fit = await page.locator('text=FIT').first().isVisible().catch(() => false);
      const html = await page.content();
      const hasAmber = html.includes("F59E0B") || html.includes("#F59E0B");
      if (header && fit) {
        pass(name, `ASCENDFIT visible, amber color=${hasAmber}`);
      } else {
        fail(name, `ASCEND=${header}, FIT=${fit}`);
      }
      await page.close();
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // Signup page
  {
    const name = "UI: Signup page renders";
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle", timeout: 15000 });
      const email = await page.locator('input[type="email"]').first().isVisible().catch(() => false);
      const pwd = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
      if (email && pwd) {
        pass(name, "Email and password inputs visible");
      } else {
        fail(name, `Email=${email}, Password=${pwd}`);
      }
      await page.close();
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // Pricing page
  {
    const name = "UI: Pricing page renders";
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: "networkidle", timeout: 15000 });
      const trial = await page.locator('text=/trial/i').first().isVisible().catch(() => false);
      const pro = await page.locator('text=/Pro/i').first().isVisible().catch(() => false);
      if (trial && pro) {
        pass(name, "Trial and Pro pricing visible");
      } else {
        fail(name, `Trial=${trial}, Pro=${pro}`);
      }
      await page.close();
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  // Full login flow
  {
    const name = "UI: Login flow → Dashboard redirect";
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 15000 });
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 }).catch(() => {});
      const url = page.url();
      if (url.includes("/dashboard")) {
        pass(name, `Navigated to ${url}`);
      } else if (url.includes("/onboarding")) {
        pass(name, `Navigated to onboarding: ${url}`);
      } else {
        const body = await page.evaluate(() => document.body.innerText.slice(0, 200));
        fail(name, `Stuck at ${url}, body: ${body}`);
      }
      await page.close();
    } catch (e: any) {
      fail(name, e.message);
    }
  }

  await context.close();
  await browser.close();

  // ── Report ──
  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📊 QA RESULTS\n");
  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status === "FAIL");
  const skipped = results.filter((r) => r.status === "SKIP");

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    console.log(`${icon} ${r.name}`);
    if (r.error) console.log(`   └─ ${r.error}`);
    if (r.detail) console.log(`   └─ ${r.detail}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\nTOTAL: ${results.length} | PASS: ${passed.length} | FAIL: ${failed.length} | SKIP: ${skipped.length}`);
  if (failed.length > 0) {
    console.log("\n⚠️ Failures detected — review logs above.");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main();
