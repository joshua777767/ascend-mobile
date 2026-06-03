/**
 * Ascend QA — lightweight API + route tests
 * Uses Node.js built-in `node:test` + `fetch` (Node 24).
 * No browser, no AI, no external dependencies.
 *
 * Run:  pnpm --filter @workspace/tests run test:api
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:80";
const TEST_EMAIL = `qa-api-${Date.now()}@ascend.internal`;
const TEST_PASS = "qa-api-pass-9912";

// Minimal profile that satisfies all required fields
const PROFILE = {
  name: "QA Tester",
  age: 30,
  gender: "male",
  heightCm: 178,
  currentWeightKg: 80,
  goalWeightKg: 75,
  bodyType: "average",
  goals: ["fat loss"],
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

// Shared cookie jar for the authenticated session
let authCookie = "";
let userId = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<{ status: number; body: unknown; setCookie: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const parsed = ct.includes("application/json") && text ? JSON.parse(text) : text;
  const setCookie = res.headers.get("set-cookie") ?? "";

  return { status: res.status, body: parsed, setCookie };
}

function get(path: string, cookie?: string) { return api("GET", path, undefined, cookie); }
function post(path: string, body: unknown, cookie?: string) { return api("POST", path, body, cookie); }
function del(path: string, cookie?: string) { return api("DELETE", path, undefined, cookie); }

// ── Public pages (SPA — all return 200 + HTML) ────────────────────────────────

describe("Public pages load (server returns 200)", () => {
  const publicRoutes = ["/", "/login", "/signup", "/pricing"];

  for (const route of publicRoutes) {
    it(`GET ${route} → 200`, async () => {
      const r = await get(route);
      assert.equal(r.status, 200, `Expected 200 for ${route}, got ${r.status}`);
      assert.ok(
        typeof r.body === "string" && r.body.includes("<!DOCTYPE html"),
        `Expected HTML response for ${route}`,
      );
    });
  }

  // App routes also served by the SPA (same HTML shell)
  const appRoutes = ["/dashboard", "/onboarding", "/meals", "/coach", "/journal", "/progress", "/settings"];
  for (const route of appRoutes) {
    it(`GET ${route} → 200 HTML (SPA shell)`, async () => {
      const r = await get(route);
      assert.equal(r.status, 200);
      assert.ok(typeof r.body === "string" && r.body.includes("<!DOCTYPE html"));
    });
  }
});

// ── API: auth flow ─────────────────────────────────────────────────────────────

describe("Auth: /api/auth/me → 401 when unauthenticated", () => {
  it("GET /api/auth/me without session → 401", async () => {
    const r = await get("/api/auth/me");
    assert.equal(r.status, 401);
  });
});

describe("Auth: signup", () => {
  it("POST /api/auth/signup → 201 with user object", async () => {
    const r = await post("/api/auth/signup", { email: TEST_EMAIL, password: TEST_PASS });
    assert.equal(r.status, 201, `Signup failed: ${JSON.stringify(r.body)}`);
    const user = r.body as { id: number; email: string };
    assert.ok(typeof user.id === "number" && user.id > 0);
    assert.equal(user.email, TEST_EMAIL);
    userId = user.id;

    // Capture session cookie
    assert.ok(r.setCookie.includes("connect.sid"), "Session cookie not set after signup");
    authCookie = r.setCookie.split(";")[0];
  });

  it("Duplicate email → 409", async () => {
    const r = await post("/api/auth/signup", { email: TEST_EMAIL, password: TEST_PASS });
    assert.equal(r.status, 409);
  });

  it("Short password → 400", async () => {
    const r = await post("/api/auth/signup", { email: "other@test.com", password: "short" });
    assert.equal(r.status, 400);
  });
});

describe("Auth: me (after signup)", () => {
  it("GET /api/auth/me with session → 200 and correct user", async () => {
    const r = await get("/api/auth/me", authCookie);
    assert.equal(r.status, 200);
    const user = r.body as { id: number; email: string };
    assert.equal(user.email, TEST_EMAIL);
  });
});

// ── API: auth guards on data routes ──────────────────────────────────────────

describe("Auth guards: data routes reject unauthenticated requests", () => {
  const protectedRoutes = [
    ["GET", "/api/users/profile"],
    ["GET", "/api/plans/current"],
    ["GET", "/api/workouts"],
    ["GET", "/api/meals"],
    ["GET", "/api/journal"],
    ["GET", "/api/reviews"],
    ["GET", "/api/weigh-ins"],
    ["GET", "/api/chat/history"],
    ["GET", "/api/progress/summary"],
    ["GET", "/api/schedule/today"],
  ] as const;

  for (const [method, path] of protectedRoutes) {
    it(`${method} ${path} without session → 401`, async () => {
      const r = await get(path);
      assert.equal(r.status, 401, `Expected 401 for ${path}, got ${r.status}`);
    });
  }
});

// ── API: profile (onboarding) ─────────────────────────────────────────────────

describe("Profile: create and read", () => {
  it("GET /api/users/profile → 404 before onboarding", async () => {
    const r = await get("/api/users/profile", authCookie);
    assert.equal(r.status, 404);
  });

  it("POST /api/users/profile → 201 (creates profile)", async () => {
    const r = await api("POST", "/api/users/profile", PROFILE, authCookie);
    assert.equal(r.status, 201, `Profile creation failed: ${JSON.stringify(r.body)}`);
    const profile = r.body as { name: string; userId: number };
    assert.equal(profile.name, PROFILE.name);
  });

  it("GET /api/users/profile → 200 after creation", async () => {
    const r = await get("/api/users/profile", authCookie);
    assert.equal(r.status, 200);
    const profile = r.body as { name: string };
    assert.equal(profile.name, PROFILE.name);
  });
});

// ── API: data isolation ───────────────────────────────────────────────────────

describe("Data isolation: second user cannot see first user's data", () => {
  let user2Cookie = "";

  before(async () => {
    const r = await post("/api/auth/signup", {
      email: `qa-isolation-${Date.now()}@ascend.internal`,
      password: "isolation-pass-1234",
    });
    assert.equal(r.status, 201);
    user2Cookie = r.setCookie.split(";")[0];
  });

  it("Second user sees their own empty profile (404)", async () => {
    const r = await get("/api/users/profile", user2Cookie);
    assert.equal(r.status, 404, "Second user should not see first user's profile");
  });

  it("/api/auth/me returns different users for different sessions", async () => {
    const r1 = await get("/api/auth/me", authCookie);
    const r2 = await get("/api/auth/me", user2Cookie);
    const u1 = r1.body as { id: number };
    const u2 = r2.body as { id: number };
    assert.notEqual(u1.id, u2.id, "Sessions should belong to different users");
  });

  after(async () => {
    // Clean up second test user's data
    await del("/api/users/profile", user2Cookie);
  });
});

// ── API: login ────────────────────────────────────────────────────────────────

describe("Auth: login", () => {
  it("Login with correct credentials → 200", async () => {
    const r = await post("/api/auth/login", { email: TEST_EMAIL, password: TEST_PASS });
    assert.equal(r.status, 200);
    const user = r.body as { email: string };
    assert.equal(user.email, TEST_EMAIL);
  });

  it("Login with wrong password → 401", async () => {
    const r = await post("/api/auth/login", { email: TEST_EMAIL, password: "wrong" });
    assert.equal(r.status, 401);
  });

  it("Login with unknown email → 401", async () => {
    const r = await post("/api/auth/login", { email: "nobody@ascend.internal", password: "whatever" });
    assert.equal(r.status, 401);
  });
});

// ── API: logout ───────────────────────────────────────────────────────────────

describe("Auth: logout", () => {
  it("POST /api/auth/logout → 204", async () => {
    const r = await post("/api/auth/logout", {}, authCookie);
    assert.equal(r.status, 204);
  });

  it("Session is invalid after logout — /api/auth/me → 401", async () => {
    const r = await get("/api/auth/me", authCookie);
    assert.equal(r.status, 401, "Session should be destroyed after logout");
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

after(async () => {
  // Re-login to clean up test user data
  try {
    const login = await post("/api/auth/login", { email: TEST_EMAIL, password: TEST_PASS });
    if (login.status === 200) {
      const cookie = login.setCookie.split(";")[0];
      await del("/api/users/profile", cookie);
    }
    // Remove user row directly if possible
    if (userId > 0) {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: login?.setCookie?.split(";")[0] ?? "" },
      });
    }
  } catch {
    // Best-effort cleanup, not fatal
  }
});
