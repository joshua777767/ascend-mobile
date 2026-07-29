const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyCheckInScheduleInput {
  accountCreatedAt: string | Date;
  checkInCreatedAt?: Array<string | Date> | null;
  now?: string | Date;
}

export interface WeeklyCheckInSchedule {
  firstDueAt: Date;
  nextDueAt: Date;
  isDue: boolean;
}

function asTime(value: string | Date): number {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error(`Invalid check-in schedule date: ${String(value)}`);
  }
  return time;
}

/**
 * Check-ins are completion-driven, not dismissal-driven:
 * - first check-in: account creation + 7 days
 * - later check-ins: latest completed check-in + 7 days
 * A missed due date remains due until the user completes it.
 */
export function getWeeklyCheckInSchedule({
  accountCreatedAt,
  checkInCreatedAt = [],
  now = new Date(),
}: WeeklyCheckInScheduleInput): WeeklyCheckInSchedule {
  const accountTime = asTime(accountCreatedAt);
  const completedTimes = (checkInCreatedAt ?? [])
    .map(asTime)
    .filter((time) => time >= accountTime)
    .sort((a, b) => b - a);
  const firstDueAt = new Date(accountTime + WEEK_MS);
  const nextDueAt = new Date((completedTimes[0] ?? accountTime) + WEEK_MS);

  return {
    firstDueAt,
    nextDueAt,
    isDue: asTime(now) >= nextDueAt.getTime(),
  };
}

export const WEEKLY_CHECK_IN_INTERVAL_MS = WEEK_MS;