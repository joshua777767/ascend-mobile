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
 * Add/subtract days to a date string in the user's local timezone.
 * Returns YYYY-MM-DD. Always interprets the input as the user's local date.
 */
export function addDaysInUserTz(req: Request, date: string, days: number): string {
  const tz = req.headers["x-timezone"] as string | undefined;
  // Anchor to noon UTC of the given date — avoids midnight UTC crossing into the
  // previous local day for users in UTC-offset timezones (e.g. T00:00:00Z = 8 pm
  // the night before in EDT, which toLocaleDateString would format as yesterday).
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  if (tz) {
    try {
      return d.toLocaleDateString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      // fall through
    }
  }
  return d.toISOString().slice(0, 10);
}
