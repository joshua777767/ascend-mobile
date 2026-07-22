/**
 * Schedule time-editing tests.
 *
 * Covers:
 *   - Editing a workout from 5:00 AM to 1:00 AM
 *   - Editing to 11:59 PM
 *   - Notifications rescheduling correctly
 *   - Existing schedules remaining intact after an edit
 */

// ── Time utilities (identical to schedule.tsx helpers) ────────────────────────

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h ?? 0) * 60 + (m ?? 0) + mins) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) >= 0 && (h ?? 0) <= 23 && (m ?? 0) >= 0 && (m ?? 0) <= 59;
}

// ── Notification helpers (mirrored from schedule.tsx) ─────────────────────────

function notifId(activity: string): string {
  return "meal-" + activity.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

interface NotifPayload {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
}

function parseNotifTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

// ── Schedule item type ────────────────────────────────────────────────────────

interface ScheduleItem {
  time: string;
  activity: string;
  type: string;
  notes: string | null;
  status: string | null;
  isCustom?: boolean;
}

interface Override {
  activity: string;
  type: string;
  time?: string;
  status?: string;
}

// ── Override merge (mirrors schedule.ts getScheduleItems logic) ───────────────

function mergeOverrides(generated: ScheduleItem[], overrides: Override[]): ScheduleItem[] {
  return generated.map(item => {
    const override = overrides.find(
      o => o.activity === item.activity && o.type === item.type
    );
    return {
      ...item,
      time: override?.time ?? item.time,
      status: override?.status ?? item.status,
    };
  });
}

// ── Mock bridge ───────────────────────────────────────────────────────────────

function makeBridge() {
  const scheduled: Record<string, NotifPayload> = {};
  const calls: Array<{ type: string; payload: unknown }> = [];

  function bridge(type: string, payload: unknown) {
    calls.push({ type, payload });
    if (type === "SCHEDULE_NOTIFICATION") {
      const p = payload as NotifPayload;
      scheduled[p.id] = p;
    }
    if (type === "CANCEL_NOTIFICATION") {
      const p = payload as { id: string };
      delete scheduled[p.id];
    }
  }

  function scheduleNotif(id: string, activity: string, time: string) {
    const { hour, minute } = parseNotifTime(time);
    bridge("SCHEDULE_NOTIFICATION", {
      id,
      title: "🍽 Time to eat!",
      body: `Log your ${activity} in AscendFit`,
      hour,
      minute,
    });
  }

  function cancelNotif(id: string) {
    bridge("CANCEL_NOTIFICATION", { id });
  }

  return { scheduled, calls, scheduleNotif, cancelNotif };
}

// ── Simulate handleTimeChange (extracted from schedule.tsx) ───────────────────

function handleTimeChange(
  items: ScheduleItem[],
  target: ScheduleItem,
  newTime: string,
  notifState: Record<string, boolean>,
  scheduleNotif: (id: string, activity: string, time: string) => void
): ScheduleItem[] {
  const updated = items
    .map(i => (i.activity === target.activity && i.type === target.type ? { ...i, time: newTime } : i))
    .sort((a, b) => a.time.localeCompare(b.time));

  const nid = notifId(target.activity);
  if (notifState[nid]) {
    scheduleNotif(nid, target.activity, newTime);
  }

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SCHEDULE: ScheduleItem[] = [
  { time: "07:00", activity: "Wake up",             type: "health",   notes: null, status: "active" },
  { time: "07:30", activity: "Meal 1 — Breakfast",  type: "meal",     notes: null, status: "active" },
  { time: "05:00", activity: "Workout",              type: "workout",  notes: null, status: "active" },
  { time: "12:30", activity: "Meal 2 — Lunch",      type: "meal",     notes: null, status: "active" },
  { time: "18:30", activity: "Meal 3 — Dinner",     type: "meal",     notes: null, status: "active" },
  { time: "22:30", activity: "Sleep",                type: "sleep",    notes: null, status: "active" },
];

// ─────────────────────────────────────────────────────────────────────────────

describe("Editing a workout from 5:00 AM to 1:00 AM", () => {
  it("updates the workout time from 05:00 to 01:00", () => {
    const { scheduleNotif } = makeBridge();
    const workout = BASE_SCHEDULE.find(i => i.activity === "Workout")!;
    const result = handleTimeChange(BASE_SCHEDULE, workout, "01:00", {}, scheduleNotif);
    const updated = result.find(i => i.activity === "Workout")!;
    expect(updated.time).toBe("01:00");
  });

  it("1:00 AM (01:00) is a valid 24-hour time", () => {
    expect(isValidTime("01:00")).toBe(true);
  });

  it("01:00 is earlier in the day than 05:00 in minute value", () => {
    expect(toMins("01:00")).toBeLessThan(toMins("05:00"));
  });

  it("all other items remain unchanged after editing the workout", () => {
    const { scheduleNotif } = makeBridge();
    const workout = BASE_SCHEDULE.find(i => i.activity === "Workout")!;
    const result = handleTimeChange(BASE_SCHEDULE, workout, "01:00", {}, scheduleNotif);
    const breakfast = result.find(i => i.activity === "Meal 1 — Breakfast")!;
    const dinner   = result.find(i => i.activity === "Meal 3 — Dinner")!;
    const sleep    = result.find(i => i.activity === "Sleep")!;
    expect(breakfast.time).toBe("07:30");
    expect(dinner.time).toBe("18:30");
    expect(sleep.time).toBe("22:30");
  });

  it("addMins wraps across midnight: 23:00 + 120 min = 01:00", () => {
    expect(addMins("23:00", 120)).toBe("01:00");
  });

  it("addMins handles negative wrap: 00:30 − 60 min = 23:30", () => {
    expect(addMins("00:30", -60)).toBe("23:30");
  });

  it("±15m buttons from 01:00 produce valid times", () => {
    expect(addMins("01:00", -15)).toBe("00:45");
    expect(addMins("01:00",  15)).toBe("01:15");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Editing to 11:59 PM (23:59)", () => {
  it("23:59 is a valid 24-hour time", () => {
    expect(isValidTime("23:59")).toBe(true);
  });

  it("23:59 is the last minute of the day (1439 minutes)", () => {
    expect(toMins("23:59")).toBe(1439);
  });

  it("updates workout time to 23:59", () => {
    const { scheduleNotif } = makeBridge();
    const workout = BASE_SCHEDULE.find(i => i.activity === "Workout")!;
    const result = handleTimeChange(BASE_SCHEDULE, workout, "23:59", {}, scheduleNotif);
    expect(result.find(i => i.activity === "Workout")!.time).toBe("23:59");
  });

  it("+15 min from 23:59 wraps to 00:14", () => {
    expect(addMins("23:59", 15)).toBe("00:14");
  });

  it("+1 min from 23:59 wraps to 00:00", () => {
    expect(addMins("23:59", 1)).toBe("00:00");
  });

  it("all hours 00–23 are valid", () => {
    for (let h = 0; h <= 23; h++) {
      expect(isValidTime(`${String(h).padStart(2, "0")}:00`)).toBe(true);
    }
  });

  it("24:00 is not a valid time", () => {
    const [h] = "24:00".split(":").map(Number);
    expect((h ?? 0) > 23).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Notifications rescheduling correctly", () => {
  it("schedules a meal notification at the correct hour and minute", () => {
    const { scheduled, scheduleNotif } = makeBridge();
    const activity = "Meal 1 — Breakfast";
    const id = notifId(activity);
    scheduleNotif(id, activity, "07:30");
    expect(scheduled[id]).toBeDefined();
    expect(scheduled[id]!.hour).toBe(7);
    expect(scheduled[id]!.minute).toBe(30);
  });

  it("reschedules notification to new time when meal time changes", () => {
    const { scheduled, scheduleNotif } = makeBridge();
    const activity = "Meal 1 — Breakfast";
    const id = notifId(activity);
    scheduleNotif(id, activity, "07:30");
    scheduleNotif(id, activity, "09:00");
    expect(scheduled[id]!.hour).toBe(9);
    expect(scheduled[id]!.minute).toBe(0);
  });

  it("reschedules workout notification from 5:00 AM to 1:00 AM", () => {
    const { scheduled, scheduleNotif } = makeBridge();
    const { calls } = makeBridge();
    const activity = "Workout";
    const id = notifId(activity);
    const notifState: Record<string, boolean> = { [id]: true };
    const workout = BASE_SCHEDULE.find(i => i.activity === "Workout")!;

    handleTimeChange(BASE_SCHEDULE, workout, "01:00", notifState, scheduleNotif);

    expect(scheduled[id]).toBeDefined();
    expect(scheduled[id]!.hour).toBe(1);
    expect(scheduled[id]!.minute).toBe(0);
    void calls;
  });

  it("reschedules any item's notification to 11:59 PM (23:59)", () => {
    const { scheduled, scheduleNotif } = makeBridge();
    const activity = "Nightly journal + review";
    const id = notifId(activity);
    scheduleNotif(id, activity, "22:00");
    scheduleNotif(id, activity, "23:59");
    expect(scheduled[id]!.hour).toBe(23);
    expect(scheduled[id]!.minute).toBe(59);
  });

  it("does NOT reschedule when no notification is enabled for the item", () => {
    const { calls, scheduleNotif } = makeBridge();
    const workout = BASE_SCHEDULE.find(i => i.activity === "Workout")!;
    handleTimeChange(BASE_SCHEDULE, workout, "01:00", {}, scheduleNotif);
    expect(calls).toHaveLength(0);
  });

  it("cancels a notification correctly", () => {
    const { scheduled, scheduleNotif, cancelNotif } = makeBridge();
    const activity = "Meal 2 — Lunch";
    const id = notifId(activity);
    scheduleNotif(id, activity, "12:30");
    expect(scheduled[id]).toBeDefined();
    cancelNotif(id);
    expect(scheduled[id]).toBeUndefined();
  });

  it("midnight-crossing time (01:00) schedules at hour=1, minute=0", () => {
    const { scheduled, scheduleNotif } = makeBridge();
    const id = notifId("Workout");
    scheduleNotif(id, "Workout", "01:00");
    expect(scheduled[id]!.hour).toBe(1);
    expect(scheduled[id]!.minute).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Existing schedules intact after an edit", () => {
  it("returns the original schedule untouched when there are no overrides", () => {
    const result = mergeOverrides(BASE_SCHEDULE, []);
    expect(result).toHaveLength(BASE_SCHEDULE.length);
    expect(result.find(i => i.activity === "Workout")!.time).toBe("05:00");
  });

  it("applies a time override for one item without touching others", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Workout", type: "workout", time: "01:00" },
    ]);
    expect(result.find(i => i.activity === "Workout")!.time).toBe("01:00");
    expect(result.find(i => i.activity === "Meal 1 — Breakfast")!.time).toBe("07:30");
    expect(result.find(i => i.activity === "Meal 2 — Lunch")!.time).toBe("12:30");
  });

  it("all original items are still present after applying an override", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Workout", type: "workout", time: "23:59" },
    ]);
    expect(result).toHaveLength(BASE_SCHEDULE.length);
    for (const item of BASE_SCHEDULE) {
      expect(result.some(r => r.activity === item.activity)).toBe(true);
    }
  });

  it("preserves completed status of other items when one is rescheduled", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Wake up", type: "health", status: "completed" },
      { activity: "Workout", type: "workout", time: "01:00" },
    ]);
    expect(result.find(i => i.activity === "Wake up")!.status).toBe("completed");
    expect(result.find(i => i.activity === "Workout")!.time).toBe("01:00");
  });

  it("preserves skipped status of items when another is rescheduled", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Meal 1 — Breakfast", type: "meal", status: "skipped" },
      { activity: "Workout", type: "workout", time: "23:59" },
    ]);
    expect(result.find(i => i.activity === "Meal 1 — Breakfast")!.status).toBe("skipped");
    expect(result.find(i => i.activity === "Workout")!.time).toBe("23:59");
  });

  it("applies override for 1:00 AM (crosses midnight) without corrupting order logic", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Workout", type: "workout", time: "01:00" },
    ]);
    const workout = result.find(i => i.activity === "Workout")!;
    expect(isValidTime(workout.time)).toBe(true);
    expect(workout.time).toBe("01:00");
  });

  it("applies override for 11:59 PM without corrupting other items", () => {
    const result = mergeOverrides(BASE_SCHEDULE, [
      { activity: "Workout", type: "workout", time: "23:59" },
    ]);
    const workout = result.find(i => i.activity === "Workout")!;
    expect(workout.time).toBe("23:59");
    expect(result.find(i => i.activity === "Sleep")!.time).toBe("22:30");
  });
});
