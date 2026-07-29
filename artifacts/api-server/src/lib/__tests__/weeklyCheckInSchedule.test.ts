import { describe, expect, it } from "vitest";
import {
  getWeeklyCheckInSchedule,
  WEEKLY_CHECK_IN_INTERVAL_MS,
} from "../../../../../lib/api-client-react/src/weekly-check-in-schedule";

const ACCOUNT_CREATED = "2026-01-01T12:00:00.000Z";
const atDay = (day: number) => new Date(
  new Date(ACCOUNT_CREATED).getTime() + day * WEEKLY_CHECK_IN_INTERVAL_MS / 7,
).toISOString();

describe("weekly check-in schedule", () => {
  it("does not show a check-in immediately after account creation", () => {
    const schedule = getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      now: atDay(0),
    });

    expect(schedule.firstDueAt.toISOString()).toBe("2026-01-08T12:00:00.000Z");
    expect(schedule.isDue).toBe(false);
  });

  it("shows the first check-in exactly 7 days after account creation", () => {
    expect(getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      now: atDay(7),
    }).isDue).toBe(true);
  });

  it("schedules each next check-in 7 days after completion", () => {
    const schedule = getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(7)],
      now: atDay(13),
    });
    expect(schedule.nextDueAt.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(schedule.isDue).toBe(false);
    expect(getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(7)],
      now: atDay(14),
    }).isDue).toBe(true);
  });

  it("keeps a missed check-in due until completion, then resumes from completion", () => {
    expect(getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      now: atDay(10),
    }).isDue).toBe(true);
    expect(getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(10)],
      now: atDay(16),
    }).isDue).toBe(false);
    expect(getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(10)],
      now: atDay(17),
    }).isDue).toBe(true);
  });

  it("uses the latest completion once and never creates duplicate due prompts", () => {
    const schedule = getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(7), atDay(7), atDay(14), atDay(14)],
      now: atDay(20),
    });
    expect(schedule.nextDueAt.toISOString()).toBe("2026-01-22T12:00:00.000Z");
    expect(schedule.isDue).toBe(false);
  });

  it("does not let pre-account records change the schedule", () => {
    const schedule = getWeeklyCheckInSchedule({
      accountCreatedAt: ACCOUNT_CREATED,
      checkInCreatedAt: [atDay(-7)],
      now: atDay(6),
    });
    expect(schedule.nextDueAt.toISOString()).toBe("2026-01-08T12:00:00.000Z");
    expect(schedule.isDue).toBe(false);
  });
});