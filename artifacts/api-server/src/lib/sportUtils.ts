import type { UserProfile } from "@workspace/db";

export interface SportScheduleEntry {
  sport: string;
  days: string[];
  startTime: string;
  durationMinutes: number;
  intensity: "light" | "moderate" | "hard";
  gameDays?: string[];
}

export interface CustomWorkoutDay {
  day: string;
  focus: string;
  exercises?: string[];
}

export interface CustomWorkoutSchedule {
  days: CustomWorkoutDay[];
}

export function parseSportSchedule(profile: UserProfile): SportScheduleEntry | null {
  if (!profile.sportSchedule) return null;
  try {
    const parsed = JSON.parse(profile.sportSchedule);
    if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
      return {
        sport: parsed.sport || profile.sport || "sport",
        days: parsed.days.map((d: string) => d.trim()),
        startTime: parsed.startTime || "16:00",
        durationMinutes: parsed.durationMinutes || 90,
        intensity: parsed.intensity || "moderate",
        gameDays: parsed.gameDays?.map((d: string) => d.trim()) ?? undefined,
      };
    }
  } catch {
    // Try to parse from free-text ownSchedule
    if (profile.hasOwnSchedule === "yes" && profile.ownSchedule) {
      return tryParseSportFromText(profile.sport || "sport", profile.ownSchedule);
    }
  }
  return null;
}

export function parseCustomWorkoutSchedule(profile: UserProfile): CustomWorkoutSchedule | null {
  if (profile.customWorkoutSchedule) {
    try {
      const parsed = JSON.parse(profile.customWorkoutSchedule);
      if (parsed && Array.isArray(parsed.days)) {
        return parsed as CustomWorkoutSchedule;
      }
    } catch {
      // Fall through to try text parsing
    }
  }
  // Try to parse from free-text ownSchedule
  if (profile.hasOwnSchedule === "yes" && profile.ownSchedule) {
    return tryParseCustomWorkoutFromText(profile.ownSchedule);
  }
  return null;
}

function tryParseSportFromText(sport: string, text: string): SportScheduleEntry | null {
  const days: string[] = [];
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const d of dayNames) {
    if (text.toLowerCase().includes(d)) days.push(capitalize(d));
  }
  if (days.length === 0) return null;

  // Try to extract time
  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
  const startTime = timeMatch ? timeMatch[1] : "16:00";

  // Try to extract duration
  const durationMatch = text.match(/(\d+)\s*(?:hour|hr|hours|hrs)/i);
  const durationMinutes = durationMatch ? parseInt(durationMatch[1]) * 60 : 90;

  // Try to extract intensity
  const intensity = text.match(/\bhard\b|\bintense\b|\bvigorous\b/i)
    ? "hard"
    : text.match(/\blight\b|\beasy\b|\blow\b/i)
      ? "light"
      : "moderate";

  return { sport, days, startTime, durationMinutes, intensity };
}

function tryParseCustomWorkoutFromText(text: string): CustomWorkoutSchedule | null {
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const days: CustomWorkoutDay[] = [];
  const lines = text.split(/\n|,|\|/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const d of dayNames) {
      if (lower.includes(d)) {
        const focus = line.split(/:|—|-/)[1]?.trim() || extractBodyParts(lower);
        if (focus) {
          days.push({ day: capitalize(d), focus });
        }
      }
    }
  }
  return days.length > 0 ? { days } : null;
}

function extractBodyParts(text: string): string {
  const parts = [];
  const keywords: Record<string, string[]> = {
    chest: ["chest", "pec", "push", "bench"],
    back: ["back", "pull", "lat", "row"],
    biceps: ["bicep", "biceps", "arm", "curl"],
    triceps: ["tricep", "triceps", "pushdown"],
    shoulders: ["shoulder", "delts", "overhead press"],
    legs: ["leg", "squat", "lunge", "deadlift", "quads", "hamstring"],
    glutes: ["glute", "hip", "thrust"],
    core: ["core", "ab", "plank", "abs"],
    conditioning: ["cardio", "hiit", "condition", "run", "sprint"],
    rest: ["rest", "off", "recovery"],
  };
  for (const [part, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) parts.push(part);
  }
  return parts.length > 0 ? parts.join(" / ") : "full body";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Calorie burn estimation
// ---------------------------------------------------------------------------

const METS: Record<string, number> = {
  football: 8.0,
  basketball: 6.5,
  soccer: 7.0,
  track: 8.5,
  "boxing/mma": 9.0,
  "baseball/softball": 4.5,
  volleyball: 4.0,
  wrestling: 7.5,
};

export function estimateSportCaloriesBurned(
  sport: string,
  durationMinutes: number,
  intensity: "light" | "moderate" | "hard",
  weightKg: number
): string {
  const baseMet = METS[sport.toLowerCase()] || 5.0;
  const intensityMult = intensity === "hard" ? 1.3 : intensity === "light" ? 0.7 : 1.0;
  const met = baseMet * intensityMult;
  const durationHours = durationMinutes / 60;
  const cal = Math.round(met * weightKg * durationHours);
  const min = Math.round(cal * 0.8);
  const max = Math.round(cal * 1.2);
  return `roughly ${min}–${max} calories burned`;
}

export function getSportContextForCoach(profile: UserProfile): string {
  const sport = parseSportSchedule(profile);
  if (!sport) return "";

  const calNote = estimateSportCaloriesBurned(sport.sport, sport.durationMinutes, sport.intensity, profile.currentWeightKg);
  const days = sport.days.join(", ");
  const intensityLabel = sport.intensity === "hard" ? "hard" : sport.intensity === "light" ? "light" : "moderate";

  let ctx = `Sport: ${sport.sport}. Practice: ${days} at ${sport.startTime}, ${sport.durationMinutes} min, ${intensityLabel} intensity. Estimated burn: ${calNote}.`;

  if (sport.gameDays && sport.gameDays.length > 0) {
    ctx += ` Game days: ${sport.gameDays.join(", ")}.`;
  }

  return ctx;
}

export function getSportScheduleItems(profile: UserProfile): { time: string; activity: string; notes: string }[] {
  const sport = parseSportSchedule(profile);
  if (!sport) return [];

  const calNote = estimateSportCaloriesBurned(sport.sport, sport.durationMinutes, sport.intensity, profile.currentWeightKg);
  const intensityLabel = sport.intensity === "hard" ? "hard" : sport.intensity === "light" ? "light" : "moderate";

  return sport.days.map(day => ({
    time: sport.startTime,
    activity: `${sport.sport} practice`,
    notes: `${sport.durationMinutes} min, ${intensityLabel}. ${calNote}.`,
  }));
}

export function getSportAdjustmentForPlan(goalType: string, sport: SportScheduleEntry): string {
  const intensityLabel = sport.intensity === "hard" ? "hard" : sport.intensity === "light" ? "light" : "moderate";
  const sportName = sport.sport;
  const days = sport.days.join(", ");

  if (goalType === "muscle_gain") {
    return `You have ${sportName} practice ${days} (${sport.durationMinutes} min, ${intensityLabel}). Add a post-practice meal or shake so you still hit your calorie surplus. Prioritize recovery, sleep, and hydration on practice days.`;
  }
  if (goalType === "fat_loss") {
    return `You have ${sportName} practice ${days} (${sport.durationMinutes} min, ${intensityLabel}). Activity helps, but do not undereat. Keep protein, water, and recovery non-negotiable.`;
  }
  return `You have ${sportName} practice ${days} (${sport.durationMinutes} min, ${intensityLabel}). Warm up before practice. Eat within 2 hours after. Sleep 8+ hours on practice days.`;
}
