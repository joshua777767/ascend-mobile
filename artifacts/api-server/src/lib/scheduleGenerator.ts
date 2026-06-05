import type { UserProfile, Plan } from "@workspace/db";
import { parseSportSchedule, estimateSportCaloriesBurned } from "./sportUtils";

export interface ScheduleItem {
  time: string;
  activity: string;
  type: string;
  notes: string | null;
}

export function generateDailySchedule(profile: UserProfile, plan: Plan): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const wakeTime = profile.wakeTime || "06:30";
  const sleepTime = profile.sleepTime || "22:30";
  const workoutTime = profile.preferredWorkoutTime || "evening";
  const keyHabits: string[] = (() => { try { return JSON.parse(plan.keyHabits); } catch { return []; } })();

  // Parse wake time to add offset minutes
  const [wakeHour, wakeMin] = wakeTime.split(":").map(Number);
  const addMinutes = (base: [number, number], mins: number): string => {
    const total = base[0] * 60 + base[1] + mins;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const wake: [number, number] = [wakeHour, wakeMin];

  items.push({ time: wakeTime, activity: "Wake up + weigh in", type: "health", notes: "Weigh yourself before eating. Log it." });
  items.push({ time: addMinutes(wake, 5), activity: "Drink 500ml water", type: "hydration", notes: "Before any food or coffee." });
  items.push({ time: addMinutes(wake, 30), activity: "Meal 1 — High protein breakfast", type: "meal", notes: `Target: ~${Math.round((plan.proteinTargetG || 150) * 0.25)}g protein` });

  if (workoutTime === "morning") {
    const workoutNote = profile.hasOwnSchedule === "yes" && profile.ownSchedule
      ? `Your schedule: ${profile.ownSchedule}`
      : plan.workoutSchedule;
    items.push({ time: addMinutes(wake, 90), activity: "Workout", type: "workout", notes: workoutNote });
    items.push({ time: addMinutes(wake, 150), activity: "Post-workout protein", type: "meal", notes: "Within 45 min of training" });
  }

  if (profile.workSchedule) {
    items.push({ time: addMinutes(wake, 120), activity: "Work / School block", type: "work", notes: profile.workSchedule });
  }

  items.push({ time: addMinutes(wake, 240), activity: "Meal 2 — Lunch", type: "meal", notes: `Target: ~${Math.round((plan.proteinTargetG || 150) * 0.30)}g protein` });
  items.push({ time: addMinutes(wake, 480), activity: "Afternoon water check", type: "hydration", notes: `Should be at ${Math.round(plan.waterTargetL * 0.6 * 10) / 10}L by now` });

  if (workoutTime === "evening" || workoutTime === "afternoon") {
    const workoutNote = profile.hasOwnSchedule === "yes" && profile.ownSchedule
      ? `Your schedule: ${profile.ownSchedule}`
      : plan.workoutSchedule;
    items.push({ time: addMinutes(wake, 540), activity: "Workout / Walk", type: "workout", notes: workoutNote });
    items.push({ time: addMinutes(wake, 600), activity: "Post-workout meal / shake", type: "meal", notes: "Protein + carbs" });
  }

  items.push({ time: addMinutes(wake, 480), activity: "Meal 3 — Dinner", type: "meal", notes: `Target: ~${Math.round((plan.proteinTargetG || 150) * 0.35)}g protein` });

  // Sport practice injection
  const sportSchedule = parseSportSchedule(profile);
  if (sportSchedule) {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const isPracticeDay = sportSchedule.days.some(d => d.toLowerCase() === today.toLowerCase());
    if (isPracticeDay) {
      const calNote = estimateSportCaloriesBurned(sportSchedule.sport, sportSchedule.durationMinutes, sportSchedule.intensity, profile.currentWeightKg);
      const intensityLabel = sportSchedule.intensity === "hard" ? "hard" : sportSchedule.intensity === "light" ? "light" : "moderate";
      items.push({
        time: sportSchedule.startTime,
        activity: `${sportSchedule.sport} practice`,
        type: "sport",
        notes: `${sportSchedule.durationMinutes} min, ${intensityLabel}. ${calNote}. Stay hydrated.`,
      });
      // Post-practice meal
      const endTime = addMinutes(
        sportSchedule.startTime.split(":").map(Number) as [number, number],
        sportSchedule.durationMinutes + 15
      );
      items.push({
        time: endTime,
        activity: "Post-practice meal / shake",
        type: "meal",
        notes: plan.goalType === "muscle_gain"
          ? `Hit ${Math.round((plan.proteinTargetG || 150) * 0.3)}g protein. Add a shake or extra meal.`
          : `Protein + carbs within 1 hour.`,
      });
    }
  }

  if (plan.goalType === "muscle_gain" && profile.mealsPerDay >= 4) {
    items.push({ time: addMinutes(wake, 600), activity: "Optional mass shake / snack", type: "meal", notes: "Oats, peanut butter, banana, milk, protein" });
  }

  // Screen cutoff 60 min before bed
  const [sleepHour, sleepMin] = sleepTime.split(":").map(Number);
  const sleepBase: [number, number] = [sleepHour, sleepMin];
  items.push({ time: addMinutes(sleepBase, -60), activity: "Screen cutoff", type: "habit", notes: "Phone down. No scrolling." });
  items.push({ time: addMinutes(sleepBase, -30), activity: "Nightly journal + review", type: "journal", notes: "5 min. Log the day. Set tomorrow." });
  items.push({ time: addMinutes(sleepBase, -15), activity: "Sleep prep", type: "sleep", notes: "Dark room, cool temp, no screens" });
  items.push({ time: sleepTime, activity: "Sleep", type: "sleep", notes: `Target: ${plan.sleepTargetHours} hours` });

  return items.sort((a, b) => a.time.localeCompare(b.time));
}
