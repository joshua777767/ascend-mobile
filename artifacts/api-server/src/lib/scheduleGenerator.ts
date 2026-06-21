import type { UserProfile, Plan } from "@workspace/db";
import { parseSportSchedule, estimateSportCaloriesBurned } from "./sportUtils";

export interface ScheduleItem {
  time: string;
  activity: string;
  type: string;
  notes: string | null;
}

// ─── Time utilities ────────────────────────────────────────────────────────────

function toMin(t: string): number {
  const parts = (t || "").split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function fromMin(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function addMins(base: string, mins: number): string {
  return fromMin(toMin(base) + mins);
}

function laterOf(t1: string, t2: string): string {
  return toMin(t1) >= toMin(t2) ? t1 : t2;
}

function midpointOf(t1: string, t2: string): string {
  let m1 = toMin(t1);
  let m2 = toMin(t2);
  if (m2 < m1) m2 += 1440;
  return fromMin(Math.round((m1 + m2) / 2));
}

function to12h(t: string): string {
  const parts = (t || "").split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")} ${period}` : `${hr} ${period}`;
}

// ─── Range helpers ─────────────────────────────────────────────────────────────

interface TimeRange { start: string; end: string }

function parseRange(rangeJson: string | null | undefined): TimeRange | null {
  if (!rangeJson) return null;
  try {
    const obj = JSON.parse(rangeJson);
    if (typeof obj?.start === "string" && typeof obj?.end === "string") return obj as TimeRange;
  } catch { /* ignore */ }
  return null;
}

function rangeMidpoint(range: TimeRange | null): string | null {
  if (!range) return null;
  return midpointOf(range.start, range.end);
}

// ─── Effective wake/sleep (respects ranges) ────────────────────────────────────

type ProfileWithRange = UserProfile & { wakeTimeRange?: string | null; sleepTimeRange?: string | null };

function effectiveWake(profile: ProfileWithRange): string {
  const r = parseRange(profile.wakeTimeRange ?? null);
  // Use || (not ??) so empty strings also fall through to the default
  return rangeMidpoint(r) || profile.wakeTime || "07:00";
}

function effectiveSleep(profile: ProfileWithRange): string {
  const r = parseRange(profile.sleepTimeRange ?? null);
  return rangeMidpoint(r) || profile.sleepTime || "23:00";
}

// ─── Day-flow sort key ─────────────────────────────────────────────────────────
// When a schedule crosses midnight (sleepMin < wakeMin), items in the pre-wake
// zone (00:xx – wake) belong at the END of the day, not the start.
// Sorting by (tm - wakeMin + 1440) % 1440 achieves the correct day-flow order.
function dayFlowKey(t: string, wakeMin: number): number {
  return (toMin(t) - wakeMin + 1440) % 1440;
}

// ─── Evening pin ───────────────────────────────────────────────────────────────
// The nightly journal should never display as "00:00" — that reads as the start
// of the day. For near-midnight sleepers (sleep=00:00–01:29) whose journal would
// land in the first 60 min past midnight, pin it to 23:30 instead.
// The day-flow sort handles the remaining items (sleep prep, skincare at 00:xx)
// correctly — they'll display at 00:xx but sort at the end of the day.
function eveningPin(t: string, wakeMin: number, crossesMidnight: boolean): string {
  if (!crossesMidnight) return t;
  const tm = toMin(t);
  // 00:00–00:59 lands in first hour past midnight → pull back to 23:30
  if (tm < wakeMin && tm < 60) return "23:30";
  return t;
}

// ─── Main generator ────────────────────────────────────────────────────────────

export function generateDailySchedule(profile: ProfileWithRange, plan: Plan): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  const wake = effectiveWake(profile);
  const sleep = effectiveSleep(profile);
  const wakeMin = toMin(wake);
  const sleepMin = toMin(sleep);
  // Schedule crosses midnight when sleep-time is numerically before wake-time (e.g. sleep=00:30, wake=07:00)
  const crossesMidnight = sleepMin <= wakeMin;
  const wakeRange = parseRange(profile.wakeTimeRange ?? null);
  const sleepRange = parseRange(profile.sleepTimeRange ?? null);

  const workoutPref = profile.preferredWorkoutTime || "evening";
  const goalType = plan.goalType;
  const mealsPerDay = profile.mealsPerDay ?? 3;

  const goals: string[] = (() => { try { return JSON.parse(profile.goals); } catch { return []; } })();

  const isWeightLoss = goalType === "fat_loss";
  const isWeightGain = goalType === "muscle_gain";
  const isSkin = goals.includes("better skin");
  const isSleep = goals.includes("better sleep");
  const isEnergy = goals.includes("higher energy");
  const isDiscipline = goals.includes("discipline");

  const prot = plan.proteinTargetG || 150;
  const cal = plan.calorieTarget || 2000;
  const water = plan.waterTargetL || 2.5;

  // ── Sport schedule for today ──────────────────────────────────────────────
  const sportSchedule = parseSportSchedule(profile);
  const today = new Date().toLocaleDateString("en-US", { timeZone: (profile as any)._timeZone, weekday: "long" });
  const hasSportToday = sportSchedule !== null &&
    sportSchedule.days.some(d => d.toLowerCase() === today.toLowerCase());
  const sportIsHard = hasSportToday && sportSchedule !== null && sportSchedule.intensity === "hard";

  // ── Workout time slot ──────────────────────────────────────────────────────
  // morning: W+90  |  afternoon: max(W+270, 13:00)  |  evening: max(W+480, 17:30)
  let workoutTime: string;
  if (workoutPref === "morning") {
    workoutTime = addMins(wake, 90);
  } else if (workoutPref === "afternoon") {
    workoutTime = laterOf(addMins(wake, 270), "13:00");
  } else {
    workoutTime = laterOf(addMins(wake, 480), "17:30");
  }

  // Conflict: hard sport practice AND workout slot is within 2h before sport start
  const sportStartMin = hasSportToday && sportSchedule ? toMin(sportSchedule.startTime) : -1;
  const workoutConflictsSport =
    sportIsHard &&
    sportStartMin > 0 &&
    toMin(workoutTime) >= sportStartMin - 120 &&
    toMin(workoutTime) <= sportStartMin + 30;

  // ── Meal slots ──────────────────────────────────────────────────────────────
  // Breakfast: W+30
  // Lunch: max(W+210, 11:30) — not before 11:30 AM
  // Dinner: max(W+390, 17:30) — not before 5:30 PM
  const breakfastTime = addMins(wake, 30);
  const lunchTime = laterOf(addMins(wake, 210), "11:30");
  const dinnerTime = laterOf(addMins(wake, 390), "17:30");
  const snackTime = midpointOf(lunchTime, dinnerTime);

  // ─── MORNING SEQUENCE ──────────────────────────────────────────────────────

  const wakeNote = wakeRange
    ? `Wake window: ${to12h(wakeRange.start)}–${to12h(wakeRange.end)}.`
    : "Start your morning strong.";
  items.push({ time: wake, activity: "Wake up", type: "health", notes: wakeNote });
  items.push({ time: addMins(wake, 5), activity: "Drink 16 oz water", type: "hydration", notes: "Before coffee or food — hydrate first." });

  if (isSkin) {
    items.push({ time: addMins(wake, 12), activity: "Morning face wash + skincare", type: "habit", notes: "Cleanse, moisturize, SPF if going outside." });
  }

  if (isDiscipline) {
    items.push({ time: addMins(wake, 10), activity: "Morning mission check", type: "habit", notes: "Pick one non-negotiable for today. Write it down." });
  }

  items.push({
    time: breakfastTime,
    activity: "Meal 1 — Breakfast",
    type: "meal",
    notes: `Target: ~${Math.round(prot * 0.25)}g protein. ${isWeightGain ? "Full meal — do not skip." : isWeightLoss ? "High protein, no liquid calories." : "Whole foods preferred."}`,
  });

  if (isEnergy) {
    items.push({ time: addMins(wake, 45), activity: "Morning sunlight or short walk", type: "habit", notes: "10 min outside — sets circadian rhythm and boosts morning energy." });
  }

  // ─── MORNING WORKOUT ───────────────────────────────────────────────────────
  if (profile.workoutDaysPerWeek > 0 && workoutPref === "morning") {
    if (workoutConflictsSport) {
      items.push({
        time: workoutTime,
        activity: "Active recovery — sport practice today",
        type: "workout",
        notes: `Hard ${sportSchedule!.sport} practice at ${to12h(sportSchedule!.startTime)}. Skip heavy lifting — mobility, foam rolling, or light walk only.`,
      });
    } else {
      items.push({
        time: workoutTime,
        activity: "Workout",
        type: "workout",
        notes: profile.hasOwnSchedule === "yes" && profile.ownSchedule ? `Your schedule: ${profile.ownSchedule}` : plan.workoutSchedule,
      });
      items.push({
        time: addMins(workoutTime, 60),
        activity: "Post-workout protein",
        type: "meal",
        notes: `${Math.round(prot * 0.25)}g protein within 45 min of training.`,
      });
    }
  }

  // Work / school block
  if (profile.workSchedule) {
    const workBlockStart = workoutPref === "morning" ? addMins(workoutTime, 90) : addMins(wake, 120);
    items.push({ time: workBlockStart, activity: "Work / School block", type: "work", notes: profile.workSchedule });
  }

  // ─── LUNCH ─────────────────────────────────────────────────────────────────
  items.push({
    time: lunchTime,
    activity: "Meal 2 — Lunch",
    type: "meal",
    notes: `Target: ~${Math.round(prot * 0.30)}g protein. ${isWeightLoss ? "Log it before eating." : isWeightGain ? "Full meal — don't undereat." : ""}`.trim(),
  });

  if (isWeightLoss) {
    items.push({
      time: addMins(lunchTime, 20),
      activity: "Post-lunch walk",
      type: "habit",
      notes: "Even 10–15 min improves insulin sensitivity and adds to your step goal.",
    });
  }

  // ─── AFTERNOON ─────────────────────────────────────────────────────────────
  items.push({
    time: laterOf(addMins(wake, 300), "14:30"),
    activity: "Afternoon hydration check",
    type: "hydration",
    notes: `Should be at ${Math.round(water * 0.6 * 10) / 10}L by now. Refill and keep drinking.`,
  });

  // Sleep goal: caffeine cutoff 8h before bed
  if (isSleep) {
    items.push({
      time: addMins(sleep, -480),
      activity: "Caffeine cutoff",
      type: "habit",
      notes: `No coffee or caffeine after ${to12h(addMins(sleep, -480))}. Affects sleep quality even if you fall asleep fine.`,
    });
  }

  // ─── AFTERNOON WORKOUT ─────────────────────────────────────────────────────
  if (profile.workoutDaysPerWeek > 0 && workoutPref === "afternoon") {
    if (workoutConflictsSport) {
      items.push({
        time: workoutTime,
        activity: "Active recovery — sport practice today",
        type: "workout",
        notes: `Hard ${sportSchedule!.sport} practice at ${to12h(sportSchedule!.startTime)}. Skip lifting — mobility or light work only.`,
      });
    } else {
      items.push({
        time: workoutTime,
        activity: "Workout",
        type: "workout",
        notes: profile.hasOwnSchedule === "yes" && profile.ownSchedule ? `Your schedule: ${profile.ownSchedule}` : plan.workoutSchedule,
      });
      items.push({
        time: addMins(workoutTime, 60),
        activity: "Post-workout meal / shake",
        type: "meal",
        notes: "Protein + carbs within 45 min.",
      });
    }
  }

  // Snack: weight gain or 4+ meals
  if (isWeightGain || mealsPerDay >= 4) {
    items.push({
      time: snackTime,
      activity: isWeightGain ? "Calorie snack / mass shake" : "Afternoon snack",
      type: "meal",
      notes: isWeightGain
        ? `Oats, peanut butter, banana, milk, protein powder. Target: ~${Math.round(cal * 0.15)} kcal.`
        : `Greek yogurt, fruit, nuts, or a shake. ~${Math.round(prot * 0.15)}g protein.`,
    });
  }

  // Weight loss: afternoon step check
  if (isWeightLoss) {
    items.push({
      time: laterOf(addMins(wake, 330), "15:30"),
      activity: "Step goal check",
      type: "habit",
      notes: `Check your count. If behind, take a 20-min walk now. Target: ${plan.stepsTarget?.toLocaleString() ?? "10,000"} steps.`,
    });
  }

  // ─── DINNER ────────────────────────────────────────────────────────────────
  items.push({
    time: dinnerTime,
    activity: "Meal 3 — Dinner",
    type: "meal",
    notes: `Target: ~${Math.round(prot * 0.35)}g protein. ${isWeightLoss ? "Lean protein + vegetables. Log immediately." : isWeightGain ? "Biggest meal of the day. Hit your calorie target." : "Whole foods, balanced plate."}`,
  });

  // ─── EVENING WORKOUT ───────────────────────────────────────────────────────
  if (profile.workoutDaysPerWeek > 0 && workoutPref === "evening") {
    if (workoutConflictsSport) {
      items.push({
        time: workoutTime,
        activity: "Active recovery — sport practice today",
        type: "workout",
        notes: `Hard ${sportSchedule!.sport} practice at ${to12h(sportSchedule!.startTime)}. Skip heavy lifting — mobility or rest only.`,
      });
    } else {
      items.push({
        time: workoutTime,
        activity: "Workout",
        type: "workout",
        notes: profile.hasOwnSchedule === "yes" && profile.ownSchedule ? `Your schedule: ${profile.ownSchedule}` : plan.workoutSchedule,
      });
      items.push({
        time: addMins(workoutTime, 60),
        activity: "Post-workout meal / shake",
        type: "meal",
        notes: "Protein + carbs. Keep it clean this late in the day.",
      });
    }
  }

  // Late snack for 5+ meals or weight gain
  if (mealsPerDay >= 5 || (isWeightGain && mealsPerDay >= 4)) {
    const lateSnack = laterOf(addMins(wake, 600), "20:00");
    items.push({
      time: lateSnack,
      activity: "Evening snack / shake",
      type: "meal",
      notes: isWeightGain
        ? "Cottage cheese, Greek yogurt, or casein shake — feed muscle overnight."
        : `Light snack: ~${Math.round(prot * 0.10)}g protein.`,
    });
  }

  // ─── SPORT PRACTICE ────────────────────────────────────────────────────────
  if (hasSportToday && sportSchedule) {
    const calNote = estimateSportCaloriesBurned(sportSchedule.sport, sportSchedule.durationMinutes, sportSchedule.intensity, profile.currentWeightKg);
    const intensityLabel = sportSchedule.intensity === "hard" ? "hard" : sportSchedule.intensity === "light" ? "light" : "moderate";
    items.push({
      time: sportSchedule.startTime,
      activity: `${sportSchedule.sport} practice`,
      type: "sport",
      notes: `${sportSchedule.durationMinutes} min · ${intensityLabel} · ${calNote}. Hydrate before and after.`,
    });
    items.push({
      time: addMins(sportSchedule.startTime, sportSchedule.durationMinutes + 15),
      activity: "Post-practice nutrition",
      type: "meal",
      notes: goalType === "muscle_gain"
        ? `${Math.round(prot * 0.30)}g protein + fast carbs within 45 min. Add a shake if needed.`
        : "Protein + carbs within 1 hour. Repair and refuel.",
    });
  }

  // ─── EVENING HYDRATION ─────────────────────────────────────────────────────
  items.push({
    time: addMins(sleep, -90),
    activity: "Evening water goal check",
    type: "hydration",
    notes: `Finish your ${water}L water goal. Sip slowly.`,
  });

  // ─── WIND-DOWN SEQUENCE ────────────────────────────────────────────────────
  items.push({
    time: addMins(sleep, -60),
    activity: "Screen cutoff",
    type: "habit",
    notes: "Phone down, TV off. Blue light kills melatonin for up to 2 hours.",
  });

  if (isSleep) {
    items.push({
      time: addMins(sleep, -45),
      activity: "Sleep wind-down routine",
      type: "sleep",
      notes: "Dim lights, cool room temp, white noise or silence. No stimulating content.",
    });
  }

  items.push({
    // Pin to evening (≤23:59) for near-midnight sleepers so it never sorts to top of day
    time: eveningPin(addMins(sleep, -30), wakeMin, crossesMidnight),
    activity: "Nightly journal + review",
    type: "journal",
    notes: "Score today 1–10. What did you win? What do you fix tomorrow?",
  });

  if (isSkin) {
    items.push({
      time: addMins(sleep, -20),
      activity: "Night skincare routine",
      type: "habit",
      notes: "Cleanse + moisturize. Change pillowcase this week.",
    });
  }

  items.push({
    time: addMins(sleep, -10),
    activity: "Sleep prep",
    type: "sleep",
    notes: "Dark room, cool temp, phone face-down. Set your alarm.",
  });

  const sleepNote = sleepRange
    ? `Sleep window: ${to12h(sleepRange.start)}–${to12h(sleepRange.end)}. Target: ${plan.sleepTargetHours}h.`
    : `Target: ${plan.sleepTargetHours} hours. Protect this time.`;
  items.push({ time: sleep, activity: "Sleep", type: "sleep", notes: sleepNote });

  // ─── Sort and deduplicate ──────────────────────────────────────────────────
  // Use day-flow order anchored to wake time so that post-midnight items
  // (e.g. sleep prep at 00:20 when bed is 00:30) sort at the END of the day,
  // not the beginning — regardless of their 24-hour clock value.
  const sk = (t: string) => dayFlowKey(t, wakeMin);

  items.sort((a, b) => sk(a.time) - sk(b.time));

  // Nudge duplicate timestamps forward (in day-flow direction) by 5 min
  for (let i = 1; i < items.length; i++) {
    if (items[i]!.time === items[i - 1]!.time) {
      items[i]!.time = addMins(items[i]!.time, 5);
    }
  }

  // Re-sort after nudging
  items.sort((a, b) => sk(a.time) - sk(b.time));

  return items;
}
