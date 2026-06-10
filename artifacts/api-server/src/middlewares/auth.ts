import type { Request, Response, NextFunction } from "express";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function getUserId(req: Request): number {
  const id = req.session?.userId;
  if (!id) {
    throw new Error("Missing authenticated user on request");
  }
  return id;
}

/**
 * Compute "today" (YYYY-MM-DD) in the user's local timezone.
 * Reads the `X-Timezone` header from the client. Falls back to UTC if unavailable.
 */
export function getUserToday(req: Request): string {
  const tz = req.headers["x-timezone"] as string | undefined;
  if (tz) {
    try {
      // en-CA produces ISO-like "YYYY-MM-DD" regardless of local system locale
      return new Date().toLocaleDateString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      // Invalid timezone string — fall back to ISO
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return the UTC timestamp of local midnight for the given date string + timezone.
 * Example: "2026-06-09" in "America/New_York" (EDT, UTC-4) → 2026-06-09T04:00:00Z
 */
export function getLocalMidnightUtc(dateStr: string, tz: string): Date {
  // Start with candidate midnight UTC. Calculate the local time offset from midnight UTC,
  // then adjust. After adjustment, verify the result against the target date and correct
  // if DST shifted the date across the target.
  const candidate = new Date(`${dateStr}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(candidate);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const offsetMs = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
  const midnight = new Date(candidate.getTime() - offsetMs);

  // Verify: the resulting date in the target timezone must match dateStr
  const verify = midnight.toLocaleDateString("en-CA", { timeZone: tz });
  if (verify === dateStr) return midnight;
  const prevDay = new Date(midnight.getTime() - 24 * 60 * 60 * 1000);
  if (prevDay.toLocaleDateString("en-CA", { timeZone: tz }) === dateStr) return prevDay;
  const nextDay = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
  if (nextDay.toLocaleDateString("en-CA", { timeZone: tz }) === dateStr) return nextDay;
  return midnight;
}

/**
 * Add/subtract days to a date string in the user's local timezone.
 * Returns YYYY-MM-DD. Always interprets the input as the user's local date.
 */
export function addDaysInUserTz(req: Request, date: string, days: number): string {
  const tz = (req.headers["x-timezone"] as string | undefined) || "UTC";
  try {
    const dayStart = getLocalMidnightUtc(date, tz);
    dayStart.setUTCDate(dayStart.getUTCDate() + days);
    return dayStart.toLocaleDateString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
