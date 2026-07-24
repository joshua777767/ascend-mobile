import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTrialDay } from "@/hooks/use-trial";
import {
  useGetUserProfile,
  useGetCurrentPlan,
  useGetTodayWorkout,
  useGetTodayReview,
  useGetTodayMeals,
  useGetTodaySchedule,
  useGetWaterToday,
  useLogWater,
  useGetStreak,
  useGetProgressSummary,
  useListGoalCheckIns,
  useGetDailyScore,
  useListWeighIns,
  getGetWaterTodayQueryKey,
  getGetTodayMealsQueryKey,
  getGetTodayScheduleQueryKey,
  getGetTodayWorkoutQueryKey,
  getGetTodayReviewQueryKey,
  getGetStreakQueryKey,
  getGetProgressSummaryQueryKey,
  getListGoalCheckInsQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dumbbell,
  Utensils,
  MessageSquare,
  BookOpen,
  ChevronRight,
  Flame,
  Beef,
  Droplets,
  Footprints,
  Moon,
  Target,
  CheckCircle2,
  Circle,
  Plus,
  Camera,
  Trophy,
  Sparkles,
  Star,
  Zap,
  Medal,
  AlertTriangle,
  Cookie,
  Dumbbell as DumbbellIcon,
  Frown,
  UtensilsCrossed,
  Bell,
} from "lucide-react";
import { isNative } from "@/lib/native-bridge";
import {
  loadNotifPermissionAsked,
  saveNotifPermissionAsked,
  loadNotifPermission,
  saveNotifPermission,
  enableMealNotifsForSchedule,
  requestNotificationPermission,
} from "@/lib/notifications";

// ─── image util ───────────────────────────────────────────────────────────────

function compressImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-caps text-muted-foreground mb-3">{children}</p>
  );
}

function MetricCard({
  icon: Icon,
  value,
  unit,
  label,
  tint,
}: {
  icon: React.ElementType;
  value: string | number;
  unit?: string;
  label: string;
  tint: "blue" | "green";
}) {
  const iconBg = tint === "blue"
    ? "rgba(107,139,174,0.12)"
    : "rgba(74,155,120,0.12)";
  const iconColor = tint === "blue" ? "#6B8BAE" : "#4A9B78";

  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        background: "hsl(220 12% 9%)",
        borderColor: "hsl(220 10% 18%)",
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2.2} />
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight leading-none">
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
      </p>
      <p className="text-muted-foreground mt-1.5" style={{ fontSize: "10px", fontWeight: "500" }}>{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 active:scale-[0.97] transition-all"
      style={{
        background: "hsl(220 12% 9%)",
        border: "1px solid hsl(217 32% 15%)",
      }}
    >
      <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </Link>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#4A9B78" : pct >= 50 ? "#6B8BAE" : "#C89A3E";
  return (
    <div
      className="relative w-20 h-20 rounded-full shrink-0"
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, hsl(218 46% 12%) 0deg)`,
      }}
    >
      <div
        className="absolute inset-1.5 rounded-full flex flex-col items-center justify-center"
        style={{ background: "hsl(220 52% 8%)" }}
      >
        <span className="text-xl font-black tracking-tight leading-none">{pct}</span>
        <span className="text-[7px] font-medium text-muted-foreground mt-0.5">Score</span>
      </div>
    </div>
  );
}

function IntakeBar({
  icon: Icon,
  label,
  eaten,
  target,
  unit,
  tint,
}: {
  icon: React.ElementType;
  label: string;
  eaten: number;
  target: number;
  unit?: string;
  tint: "blue" | "green";
}) {
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  const barColor = tint === "blue"
    ? "#6B8BAE"
    : "#4A9B78";
  const iconBg = tint === "blue" ? "rgba(107,139,174,0.12)" : "rgba(74,155,120,0.12)";
  const iconColor = tint === "blue" ? "#6B8BAE" : "#4A9B78";
  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        background: "hsl(220 12% 9%)",
        borderColor: "hsl(220 10% 18%)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: iconBg }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} strokeWidth={2.2} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{pct}%</span>
      </div>
      <p className="text-lg font-bold tracking-tight leading-none mb-2">
        {eaten.toLocaleString()}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
        <span className="text-xs font-normal text-muted-foreground ml-1">/ {target.toLocaleString()}{unit}</span>
      </p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(218 46% 12%)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// Priority families — ordered by importance. Each habit is assigned to the
// first family whose keywords match, so duplicates like "Train 3x" and
// "Strength train 3x" collapse into one entry.
const HABIT_FAMILIES: Array<{ family: string; keywords: string[] }> = [
  { family: "calorie",  keywords: ["calorie", "caloric", "deficit", "surplus", "kcal"] },
  { family: "protein",  keywords: ["protein", "macro"] },
  { family: "water",    keywords: ["water", "hydrat", "drink"] },
  { family: "log",      keywords: ["log", "track", "scan", "meal"] },
  { family: "train",    keywords: ["train", "workout", "gym", "exercise", "lift", "strength", "cardio", "run", "recover", "recovery", "rest day", "sport", "practice"] },
  { family: "sleep",    keywords: ["sleep", "bed", "night", "wake"] },
  { family: "skin",     keywords: ["skin", "face", "moistur", "spf", "sunscreen"] },
  { family: "mindset",  keywords: ["stress", "meditat", "breath", "journal", "gratitude", "focus"] },
  { family: "steps",    keywords: ["step", "walk", "10k", "active"] },
];

function habitFamily(habit: string): string {
  const lower = habit.toLowerCase();
  for (const { family, keywords } of HABIT_FAMILIES) {
    if (keywords.some((k) => lower.includes(k))) return family;
  }
  return `other:${habit}`;
}

function habitPriorityScore(habit: string): number {
  const lower = habit.toLowerCase();
  for (let i = 0; i < HABIT_FAMILIES.length; i++) {
    if (HABIT_FAMILIES[i].keywords.some((k) => lower.includes(k))) return i;
  }
  return HABIT_FAMILIES.length;
}

// Deduplicates by family (keeping the shorter label), sorts by priority, caps at 5.
function prioritizeHabits(rawHabits: string[]): string[] {
  const byFamily = new Map<string, string>();
  for (const h of rawHabits) {
    const fam = habitFamily(h);
    const existing = byFamily.get(fam);
    if (!existing || h.length < existing.length) {
      byFamily.set(fam, h);
    }
  }
  return Array.from(byFamily.values())
    .sort((a, b) => habitPriorityScore(a) - habitPriorityScore(b))
    .slice(0, 5);
}

function DailyChecklist({
  habits,
  done,
  setDone,
}: {
  habits: string[];
  done: Record<string, boolean>;
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  if (habits.length === 0) return null;
  const completed = habits.filter((h) => done[h]).length;
  const allDone = completed === habits.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="label-caps text-muted-foreground">Daily Mission</p>
          {allDone && (
            <span
              className="text-[8px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(74,155,120,0.15)", color: "#4A9B78" }}
            >
              Complete
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {completed}/{habits.length}
        </span>
      </div>
      <div
        className="rounded-2xl overflow-hidden divide-y"
        style={{
          background: "hsl(220 12% 9%)",
          border: "1px solid hsl(217 32% 15%)",
        }}
      >
        {habits.map((habit) => {
          const isDone = !!done[habit];
          return (
            <button
              key={habit}
              type="button"
              onClick={() => setDone((d) => ({ ...d, [habit]: !d[habit] }))}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-elevated transition-colors"
              style={{ borderColor: "hsl(220 10% 18%)" }}
            >
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all"
                style={isDone
                  ? { background: "#4A9B78", borderColor: "#4A9B78" }
                  : { borderColor: "hsl(220 10% 22%)" }}
              >
                {isDone && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-sm leading-snug flex-1 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {habit}
              </span>
              {isDone && (
                <span className="text-[8px] font-medium" style={{ color: "#4A9B78" }}>
                  Done
                </span>
              )}
            </button>
          );
        })}
      </div>
      {allDone && (
        <p className="text-[10px] font-medium text-muted-foreground mt-2 text-center">
          All done. You're building the habit. Keep the streak going.
        </p>
      )}
    </div>
  );
}

function WaterTracker({
  totalOz,
  targetOz,
  onLog,
  onLogPhoto,
  isLogging,
  isAnalyzing,
  photoFeedback,
  confirmOz,
  onConfirmOz,
  onCancelConfirm,
}: {
  totalOz: number;
  targetOz: number;
  onLog: (oz: number) => void;
  onLogPhoto: (imageUrl: string) => void;
  isLogging: boolean;
  isAnalyzing: boolean;
  photoFeedback: string | null;
  confirmOz: number | null;
  onConfirmOz: (oz: number) => void;
  onCancelConfirm: () => void;
}) {
  const [customOz, setCustomOz] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pct = targetOz > 0 ? Math.min(100, Math.round((totalOz / targetOz) * 100)) : 0;
  const met = totalOz >= targetOz && targetOz > 0;
  const busy = isLogging || isAnalyzing;

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(customOz, 10);
    if (!isNaN(val) && val > 0 && val <= 500) {
      onLog(val);
      setCustomOz("");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      onLogPhoto(dataUrl);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "hsl(220 12% 9%)",
        borderColor: "hsl(220 10% 18%)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(107,139,174,0.12)" }}
          >
            <Droplets className="w-3.5 h-3.5" style={{ color: "#6B8BAE" }} strokeWidth={2.2} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Hydration</span>
        </div>
        {met && !isAnalyzing && (
          <span
            className="text-[8px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(74,155,120,0.15)", color: "#4A9B78" }}
          >
            Target Met ✓
          </span>
        )}
        {isAnalyzing && (
          <span className="text-[10px] font-bold text-primary animate-pulse tracking-wide">
            Analyzing…
          </span>
        )}
      </div>

      <p className="text-2xl font-black tracking-tight leading-none mb-1">
        {totalOz}
        <span className="text-xs font-medium text-muted-foreground ml-0.5">oz</span>
        <span className="text-sm font-normal text-muted-foreground ml-1.5">/ {targetOz} oz</span>
      </p>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "hsl(218 46% 12%)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: met
              ? "#4A9B78"
              : "#6B8BAE",
          }}
        />
      </div>

      {photoFeedback && (
        <p className="text-xs font-semibold mb-3" style={{ color: "#4A9B78" }}>{photoFeedback}</p>
      )}

      {confirmOz !== null && (
        <div
          className="mb-3 rounded-xl p-3 space-y-2"
          style={{ background: "rgba(107,139,174,0.08)", border: "1px solid rgba(107,139,174,0.22)" }}
        >
          <p className="text-xs font-medium leading-snug" style={{ color: "hsl(210 30% 70%)" }}>
            Couldn't clearly detect water. How much to add?
          </p>
          <div className="flex gap-2">
            {[8, 12, 16].map((oz) => (
              <button
                key={oz}
                type="button"
                onClick={() => onConfirmOz(oz)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(107,139,174,0.15)",
                  border: "1px solid rgba(107,139,174,0.3)",
                  color: "#6B8BAE",
                }}
              >
                Add {oz} oz
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCancelConfirm}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {[8, 16, 24].map((oz) => (
          <button
            key={oz}
            type="button"
            disabled={busy}
            onClick={() => onLog(oz)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "rgba(107,139,174,0.1)",
              border: "1px solid rgba(107,139,174,0.2)",
              color: "#6B8BAE",
            }}
          >
            +{oz} oz
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="py-2 px-3 rounded-xl text-xs font-medium text-muted-foreground active:bg-card transition-colors disabled:opacity-50 flex items-center gap-1.5"
          style={{
            background: "hsl(218 46% 12%)",
            border: "1px solid hsl(217 32% 15%)",
          }}
          title="Snap a photo to auto-detect volume"
        >
          <Camera className="w-3.5 h-3.5" strokeWidth={2.2} />
        </button>
      </div>

      <form onSubmit={handleCustomSubmit} className="flex gap-2">
        <input
          type="number"
          min={1}
          max={500}
          value={customOz}
          onChange={(e) => setCustomOz(e.target.value)}
          placeholder="Custom oz"
          className="flex-1 h-9 rounded-xl px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          style={{ background: "hsl(218 46% 12%)", border: "1px solid hsl(217 32% 15%)" }}
        />
        <button
          type="submit"
          disabled={busy || !customOz}
          className="h-9 px-3 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:opacity-80 transition-opacity"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
        </button>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Scope all "today" queries to the user's local date so React Query
  // treats each calendar day as a separate cache entry and never serves
  // yesterday's data on a new local day.
  const localDate = new Date().toLocaleDateString("en-CA");

  const { data: profile, isLoading: loadingProfile, error } = useGetUserProfile();
  const { data: plan } = useGetCurrentPlan();
  const { data: workout } = useGetTodayWorkout({
    query: { queryKey: [...getGetTodayWorkoutQueryKey(), localDate] },
  });
  const { data: review } = useGetTodayReview({
    query: { queryKey: [...getGetTodayReviewQueryKey(), localDate] },
  });
  const { data: todayMeals, refetch: refetchMeals } = useGetTodayMeals({
    query: { queryKey: [...getGetTodayMealsQueryKey(), localDate] },
  });
  const { data: todaySchedule } = useGetTodaySchedule({
    query: { queryKey: [...getGetTodayScheduleQueryKey(), localDate] },
  });
  const { data: waterData, refetch: refetchWater } = useGetWaterToday({
    query: { queryKey: [...getGetWaterTodayQueryKey(), localDate] },
  });
  const { mutateAsync: logWaterFn, isPending: waterLogging } = useLogWater();
  const { data: streakData } = useGetStreak({
    query: { queryKey: [...getGetStreakQueryKey(), localDate] },
  });

  const { data: progress } = useGetProgressSummary({
    query: { queryKey: [...getGetProgressSummaryQueryKey(), localDate] },
  });
  const { data: goalCheckIns } = useListGoalCheckIns({
    query: { queryKey: [...getListGoalCheckInsQueryKey(), localDate] },
  });
  const { data: dailyScore } = useGetDailyScore({
    query: { queryKey: ["dailyScore", localDate] },
  });
  const [navigatingToCoach, setNavigatingToCoach] = useState(false);

  useEffect(() => { refetchMeals(); }, [refetchMeals]);
  useEffect(() => { refetchWater(); }, [refetchWater]);

  // After Stripe checkout success: force a fresh auth/me fetch so the app
  // immediately reflects the new subscription status without requiring a reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      // Clean the URL so a refresh doesn't re-trigger
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, [queryClient]);

  const habits = React.useMemo(
    () => prioritizeHabits(plan && Array.isArray(plan.keyHabits) ? plan.keyHabits : []),
    [plan]
  );

  // Split habits into daily (completable today) and weekly (tracked across the week)
  const weeklyKeywords = ["this week", "weekly"];
  const isWeeklyHabit = (h: string) => weeklyKeywords.some(kw => h.toLowerCase().includes(kw));
  const dailyHabits = React.useMemo(() => habits.filter(h => !isWeeklyHabit(h)), [habits]);
  const weeklyHabits = React.useMemo(() => habits.filter(h => isWeeklyHabit(h)), [habits]);

  // Weekly counter state — stored at top level with a key per habit
  const [weeklyCounts, setWeeklyCounts] = useState<Record<string, number>>({});

  // Re-initialize weeklyCounts from localStorage whenever the plan (and thus
  // weeklyHabits) changes. We merge in so existing counts for matching habits
  // are preserved, and new habits start from localStorage or 0.
  useEffect(() => {
    const weekPrefix = `ascend.weekly.${localDate.slice(0, 7)}`;
    const next: Record<string, number> = {};
    for (const h of weeklyHabits) {
      const key = `${weekPrefix}.${h}`;
      try {
        const raw = localStorage.getItem(key);
        next[h] = raw ? parseInt(raw, 10) || 0 : 0;
      } catch {
        next[h] = 0;
      }
    }
    setWeeklyCounts(prev => {
      const merged = { ...prev };
      for (const h of weeklyHabits) {
        merged[h] = next[h];
      }
      // Remove stale habits that no longer exist in weeklyHabits
      for (const k of Object.keys(merged)) {
        if (!weeklyHabits.includes(k)) delete merged[k];
      }
      return merged;
    });
  }, [weeklyHabits, localDate]);

  const storageKey = `ascend.checklist.v2.${localDate}`;

  // Track which storageKey was used to initialize `done` so we can detect
  // a date change without writing yesterday's state to today's key.
  const activeKeyRef = useRef(storageKey);
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  // When the local date changes while the app is open, reset checklist state
  // for the new day BEFORE the save effect can write yesterday's state to it.
  useEffect(() => {
    if (activeKeyRef.current === storageKey) return;
    activeKeyRef.current = storageKey;
    try {
      const raw = localStorage.getItem(storageKey);
      setDone(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setDone({});
    }
  }, [storageKey]);

  // Persist done state — only dep is `done` so this never fires on a date
  // change before the reset above has run.
  useEffect(() => {
    try {
      localStorage.setItem(activeKeyRef.current, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done]);

  // Only count water that was logged on today's local date.
  // waterData.date comes from the server's getUserToday(); comparing it with
  // the client's localDate guards against stale logs stored with the UTC date
  // (from before the timezone fix) appearing as today's hydration.
  const waterIsToday = waterData?.date === localDate;
  const waterOz = waterIsToday ? (waterData?.totalOz ?? 0) : 0;
  const waterTargetOz = waterData?.targetOz ?? (plan ? Math.round(plan.waterTargetL * 33.814) : 64);

  // Auto-check the water habit when daily target is met
  useEffect(() => {
    if (waterOz > 0 && waterTargetOz > 0 && waterOz >= waterTargetOz) {
      const waterHabit = dailyHabits.find((h) => h.toLowerCase().includes("water"));
      if (waterHabit && !done[waterHabit]) {
        setDone((prev) => ({ ...prev, [waterHabit]: true }));
      }
    }
  }, [waterOz, waterTargetOz, dailyHabits]); // eslint-disable-line react-hooks/exhaustive-deps

  const checklistCompleted = dailyHabits.filter((h) => done[h]).length;
  const checklistScore = dailyHabits.length ? Math.round((checklistCompleted / dailyHabits.length) * 100) : 0;


  useEffect(() => {
    if (error) setLocation("/onboarding");
  }, [error, setLocation]);

  const [waterAnalyzing, setWaterAnalyzing] = useState(false);
  const [waterPhotoFeedback, setWaterPhotoFeedback] = useState<string | null>(null);
  const [waterConfirmOz, setWaterConfirmOz] = useState<number | null>(null);

  async function handleLogWater(oz: number) {
    try {
      await logWaterFn({ data: { amountOz: oz } });
      // invalidateQueries marks the query stale and immediately refetches
      // since the dashboard is mounted — this is the most reliable update path
      await queryClient.invalidateQueries({ queryKey: getGetWaterTodayQueryKey() });
    } catch {
      // fail silently
    }
  }

  async function handleConfirmWaterOz(oz: number) {
    setWaterConfirmOz(null);
    await handleLogWater(oz);
    setWaterPhotoFeedback(`Water logged — added ${oz} oz.`);
    setTimeout(() => setWaterPhotoFeedback(null), 4000);
  }

  function handleCancelWaterConfirm() {
    setWaterConfirmOz(null);
  }

  async function handleLogWaterPhoto(imageUrl: string) {
    if (waterAnalyzing) return; // prevent double submit
    setWaterAnalyzing(true);
    setWaterPhotoFeedback(null);
    setWaterConfirmOz(null);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setWaterAnalyzing(false);
      // On timeout, show the manual-confirm UI instead of a dead end
      setWaterConfirmOz(12);
    }, 20_000);

    try {
      const result = await logWaterFn({ data: { imageUrl } });
      clearTimeout(timeoutId);
      if (timedOut) return;

      // Low confidence (dark cup, unclear photo) — show multi-button confirm
      if ((result as any)?.lowConfidence) {
        setWaterConfirmOz((result as any).suggestedOz ?? 12);
        return;
      }

      // High confidence — logged by server, refetch to update counter
      await queryClient.invalidateQueries({ queryKey: getGetWaterTodayQueryKey() });
      const oz = (result as any)?.detectedOz ?? 12;
      setWaterPhotoFeedback(`Water logged — added ${oz} oz.`);
      setTimeout(() => setWaterPhotoFeedback(null), 4000);
    } catch {
      clearTimeout(timeoutId);
      if (!timedOut) {
        // On error, show confirm options so user isn't stuck
        setWaterConfirmOz(12);
      }
    } finally {
      if (!timedOut) setWaterAnalyzing(false);
    }
  }

  const { trialDay, daysLeft, trialComplete, isPro } = useTrialDay();
  const showTrialNudge = !isPro && trialDay >= 5;

  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const todayCalories = (todayMeals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0);
  const todayProtein = (todayMeals ?? []).reduce((s, m) => s + (m.protein ?? 0), 0);

  // Today's calorie target — uses new dailyCalorieTargets map first, then legacy fallback
  const effectiveCalorieTarget = (() => {
    const p = plan as any;
    const todayFull = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    // New path: per-day targets map (keyed by lowercase weekday)
    if (p?.dailyCalorieTargets) {
      const targets: Record<string, number> =
        typeof p.dailyCalorieTargets === "string"
          ? (() => { try { return JSON.parse(p.dailyCalorieTargets); } catch { return {}; } })()
          : p.dailyCalorieTargets;
      if (targets[todayFull]) return targets[todayFull] as number;
      return (p.calorieTarget as number) ?? 0; // rest day — use goal-adjusted base
    }

    // Legacy path: old sport-based single-value targets
    if (p?.restDayCalorieTarget && p?.practiceDayCalorieTarget) {
      const raw = (profile as any)?.sportSchedule;
      if (raw) {
        try {
          const schedule = JSON.parse(raw);
          const todayShort = todayFull.slice(0, 3);
          const matchDay = (arr: string[]) =>
            arr.map(d => d.toLowerCase().trim()).some(d => d.startsWith(todayShort) || todayFull.startsWith(d.slice(0, 3)));
          const gameDays: string[] = schedule.gameDays ?? [];
          const practiceDays: string[] = schedule.days ?? [];
          if (gameDays.length > 0 && p.gameDayCalorieTarget && matchDay(gameDays)) return p.gameDayCalorieTarget as number;
          if (matchDay(practiceDays)) return p.practiceDayCalorieTarget as number;
          return p.restDayCalorieTarget as number;
        } catch { /* ignore */ }
      }
    }

    return plan?.calorieTarget ?? 0;
  })();

  const isExerciseDay = (() => {
    const p = plan as any;
    if (!p?.dailyCalorieTargets) return false;
    const todayFull = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const targets: Record<string, number> =
      typeof p.dailyCalorieTargets === "string"
        ? (() => { try { return JSON.parse(p.dailyCalorieTargets); } catch { return {}; } })()
        : p.dailyCalorieTargets;
    return !!targets[todayFull];
  })();

  // Auto-check the calorie habit when daily calorie target is met
  useEffect(() => {
    if (plan && todayCalories > 0 && todayCalories >= effectiveCalorieTarget) {
      const calorieHabit = dailyHabits.find((h) =>
        ["calorie", "caloric", "deficit", "surplus", "kcal"].some((k) => h.toLowerCase().includes(k))
      );
      if (calorieHabit && !done[calorieHabit]) {
        setDone((prev) => ({ ...prev, [calorieHabit]: true }));
      }
    }
  }, [todayCalories, plan?.calorieTarget, dailyHabits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-check the protein habit when daily protein target is met
  useEffect(() => {
    if (plan && todayProtein > 0 && todayProtein >= plan.proteinTargetG) {
      const proteinHabit = dailyHabits.find((h) =>
        ["protein", "macro"].some((k) => h.toLowerCase().includes(k))
      );
      if (proteinHabit && !done[proteinHabit]) {
        setDone((prev) => ({ ...prev, [proteinHabit]: true }));
      }
    }
  }, [todayProtein, plan?.proteinTargetG, dailyHabits]); // eslint-disable-line react-hooks/exhaustive-deps

  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("ascend.dashboardWelcome") === "1"
  );
  const showWelcome = !welcomeDismissed;

  const [profilePromptDismissed, setProfilePromptDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("ascend.profilePromptDismissed") === "1"
  );
  const showProfilePrompt = !profilePromptDismissed &&
    !!profile && !(profile as any).dietStyle && !(profile as any).allergies && (profile as any).gymAccess === "no";

  // Schedule completion prompt — shown to existing users who have no exercise schedule set
  const [schedulePromptDismissed, setSchedulePromptDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("ascend.schedulePromptDismissed") === "1"
  );
  const hasExerciseSchedule = (() => {
    const p = plan as any;
    if (p?.dailyCalorieTargets) {
      const targets: Record<string, number> =
        typeof p.dailyCalorieTargets === "string"
          ? (() => { try { return JSON.parse(p.dailyCalorieTargets); } catch { return {}; } })()
          : p.dailyCalorieTargets;
      return Object.keys(targets).length > 0;
    }
    // Legacy: had sport schedule
    if ((profile as any)?.sportSchedule) return true;
    return false;
  })();
  const showSchedulePrompt = !schedulePromptDismissed && !!plan && !hasExerciseSchedule;

  // Meal notification prompt — one-time ask for native app users
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("ascend.notifPromptDismissed") === "true"
  );
  const [notifPermission, setNotifPermission] = useState<"unknown" | "granted" | "denied">(loadNotifPermission);
  const [notifAsking, setNotifAsking] = useState(false);
  const notifAutoEnabled = useRef(false);
  const showNotifPrompt = !notifPromptDismissed && isNative && notifPermission === "unknown" && !loadNotifPermissionAsked();

  // If the user grants permission before the schedule has loaded, enable
  // meal notifications as soon as the schedule arrives.
  useEffect(() => {
    if (notifPermission !== "granted" || notifAutoEnabled.current) return;
    if (!todaySchedule?.items) return;
    notifAutoEnabled.current = true;
    enableMealNotifsForSchedule(todaySchedule.items as any);
  }, [notifPermission, todaySchedule?.items]);

  const handleEnableNotifs = async () => {
    setNotifAsking(true);
    saveNotifPermissionAsked();
    const granted = await requestNotificationPermission();
    const perm = granted ? "granted" : "denied";
    setNotifPermission(perm);
    saveNotifPermission(perm);
    if (granted && todaySchedule?.items) {
      notifAutoEnabled.current = true;
      enableMealNotifsForSchedule(todaySchedule.items as any);
    }
    setNotifAsking(false);
  };

  const handleDismissNotifPrompt = () => {
    setNotifPromptDismissed(true);
    saveNotifPermissionAsked();
    localStorage.setItem("ascend.notifPromptDismissed", "true");
  };

  const { data: weighIns } = useListWeighIns();
  const [weighInPromptDismissed, setWeighInPromptDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("ascend.weighInDismissedDate") === new Date().toDateString()
  );
  const daysSinceOnboarding = profile
    ? (Date.now() - new Date((profile as any).createdAt ?? Date.now()).getTime()) / 86400000
    : 0;
  const lastWeighIn = weighIns && weighIns.length > 0
    ? weighIns.slice().sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())[0]
    : null;
  const daysSinceLastWeighIn = lastWeighIn
    ? (Date.now() - new Date(lastWeighIn.loggedAt).getTime()) / 86400000
    : Infinity;
  const showWeighInPrompt = !weighInPromptDismissed && daysSinceOnboarding >= 7 && daysSinceLastWeighIn >= 6;

  if (loadingProfile || !profile) {
    return (
      <div className="h-full overflow-y-auto scroll-area">
        <div className="p-4 max-w-lg mx-auto space-y-4 pt-5">
          <Skeleton className="h-7 w-40 rounded-lg bg-elevated" />
          <Skeleton className="h-24 w-full rounded-2xl bg-elevated" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24 rounded-2xl bg-elevated" />
            <Skeleton className="h-24 rounded-2xl bg-elevated" />
            <Skeleton className="h-24 rounded-2xl bg-elevated" />
          </div>
          <Skeleton className="h-20 w-full rounded-2xl bg-elevated" />
        </div>
      </div>
    );
  }

  const goals: string[] = Array.isArray(profile.goals) ? profile.goals : [];
  const reviewScore = review && typeof review.dailyScore === "number" ? review.dailyScore : null;
  const firstName = profile.name?.split(" ")[0] ?? profile.name;

  // New daily score from API: calories 25 | protein 25 | water 20 | workout 20 | sleep 10 = 100
  const apiScore = dailyScore && typeof dailyScore.totalScore === "number" ? dailyScore.totalScore : null;

  // Fallback blended score (old logic) for users before API score exists
  const calorieProgress = effectiveCalorieTarget > 0
    ? Math.min(todayCalories / effectiveCalorieTarget, 1) : 0;
  const proteinProgress = plan && plan.proteinTargetG > 0
    ? Math.min(todayProtein / plan.proteinTargetG, 1) : 0;
  const waterProgress = waterTargetOz > 0
    ? Math.min(waterOz / waterTargetOz, 1) : 0;
  const missionProgress = dailyHabits.length > 0 ? checklistCompleted / dailyHabits.length : 0;
  const ascendScore = Math.round(
    calorieProgress * 30 +
    proteinProgress * 25 +
    waterProgress * 20 +
    missionProgress * 25,
  );

  const displayScore = apiScore !== null ? apiScore : (reviewScore !== null ? reviewScore : ascendScore);
  const hasAnyData = todayCalories > 0 || todayProtein > 0 || waterOz > 0 || checklistCompleted > 0;

  // Streak sync: on every dashboard load, check if the stored streak is stale.
  // If lastStreakDate is before yesterday, reset the streak to 0.  This ensures
  // a user who missed yesterday sees a 0 streak immediately, not a stale value.
  // Runs once per mount and whenever the localDate changes.
  useEffect(() => {
    const syncKey = `streak_synced_${localDate}`;
    if (localStorage.getItem(syncKey)) return;
    localStorage.setItem(syncKey, "1");

    // Clean up old localStorage entries (older than 30 days) to prevent
    // unbounded growth from daily streak sync/evaluate keys.
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("streak_synced_") || key?.startsWith("streak_evaluated_")) {
        const dateStr = key.split("_").pop();
        if (dateStr && !Number.isNaN(Date.parse(dateStr)) && (now - new Date(dateStr).getTime()) > 30 * 86400000) {
          localStorage.removeItem(key);
        }
      }
    }

    fetch("/api/streak/sync", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    })
      .then((r) => r.json())
      .then((updated) => {
        queryClient.setQueryData([...getGetStreakQueryKey(), localDate], updated);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDate, queryClient]);

  // Streak evaluation: once per day, score >= 70 extends streak; score < 70 breaks it.
  // The /streak/qualify endpoint is idempotent — if already evaluated today, it returns
  // the existing state unchanged, so we can fire whenever the user has any data.
  useEffect(() => {
    if (!hasAnyData) return;
    const alreadyKey = `streak_evaluated_${localDate}`;
    if (localStorage.getItem(alreadyKey)) return;
    localStorage.setItem(alreadyKey, "1");

    fetch("/api/streak/qualify", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      body: JSON.stringify({ score: displayScore }),
    })
      .then((r) => r.json())
      .then((updated) => {
        queryClient.setQueryData([...getGetStreakQueryKey(), localDate], updated);
      })
      .catch(() => {});
  }, [displayScore, hasAnyData, streakData?.lastStreakDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Personalized mission copy ---
  const calorieDeficit = plan ? effectiveCalorieTarget - todayCalories : 0;
  const proteinDeficit = plan ? plan.proteinTargetG - todayProtein : 0;
  const isMaintenance = plan?.goalType === "maintain";
  const isBulking = !isMaintenance && plan ? (profile.goalWeightKg ?? 0) > (profile.currentWeightKg ?? 0) : false;
  const isCutting = !isMaintenance && plan ? (profile.goalWeightKg ?? 0) < (profile.currentWeightKg ?? 0) : false;
  const missionComplete = checklistScore >= 100 && dailyHabits.length > 0;

  function buildMission(): string {
    if (missionComplete) {
      return "Day stacked. Every choice you made today built something real.";
    }
    if (isMaintenance && plan) {
      if (proteinDeficit > 30) return `${proteinDeficit}g protein still to go. Hit your target — protein is what keeps you strong.`;
      return `${firstName}, consistency is the goal. Train, eat well, drink water, protect your sleep.`;
    }
    if (plan && calorieDeficit > 500) {
      return `You're ${calorieDeficit} calories behind. Fuel up before bed. Every meal counts.`;
    }
    if (plan && proteinDeficit > 30) {
      return `${proteinDeficit}g protein short. Make the next meal count. You're building.`;
    }
    if (isBulking && plan) {
      return `${firstName}, you're building. Hit ${effectiveCalorieTarget.toLocaleString()} calories today. Every meal is a choice.`;
    }
    if (isCutting && plan) {
      return `${firstName}, stay focused: protein, steps, water, clean tracking. Your next move matters.`;
    }
    if (goals.includes("gain muscle")) {
      return "Recomp is built on consistency: hit protein every day, train with progressive overload, and sleep 8 hours.";
    }
    if (goals.includes("gain weight and muscle")) {
      return `${firstName}, you're building. Hit ${effectiveCalorieTarget > 0 ? effectiveCalorieTarget.toLocaleString() : "your"} calories today. Every meal is a choice.`;
    }
    if (goals.includes("discipline")) {
      return "Discipline is built daily. Show up. Small wins compound. Progress is proof.";
    }
    return plan?.coachNotes?.trim() || "Start with protein, move your body, drink water early, and protect your sleep. Small choices, big change.";
  }

  const coachMessage = buildMission();

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">

        {/* ── Welcome card (first visit only) ── */}
        {showWelcome && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(38 70% 45% / 0.35)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-snug">Welcome to Ascend</p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 leading-relaxed">
                  <li>• Ascend builds a personalized plan based on your goals.</li>
                  <li>• Follow your daily meals, workouts, habits, and schedule.</li>
                  <li>• Track your progress and stay consistent.</li>
                  <li>• Chat with your AI coach anytime for guidance and adjustments.</li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setWelcomeDismissed(true);
                  localStorage.setItem("ascend.dashboardWelcome", "1");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 -mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── Meal notification prompt (one-time) ── */}
        {showNotifPrompt && (
          <div
            className="rounded-2xl p-4"
            style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(38 70% 45% / 0.35)" }}
          >
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#C89A3E" }} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug">Get meal reminders</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Ascend can notify you when it's time to eat, so you never miss a meal or forget to log it.
                </p>
                <button
                  onClick={handleEnableNotifs}
                  disabled={notifAsking}
                  className="mt-3 w-full h-11 rounded-xl text-sm font-semibold text-background transition-all active:scale-[0.99] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #C89A3E 0%, #A87E2E 100%)" }}
                >
                  {notifAsking ? "Requesting permission…" : "Enable reminders"}
                </button>
              </div>
              <button
                onClick={handleDismissNotifPrompt}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 -mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── Profile completion prompt ── */}
        {showProfilePrompt && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(38 70% 45% / 0.35)" }}
          >
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#C89A3E" }} strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">Want a more personalized plan?</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Add your gym access, diet preferences, and workout experience to unlock a better-tailored plan.
              </p>
              <Link
                href="/settings"
                className="inline-block mt-2 text-xs font-bold"
                style={{ color: "#C89A3E" }}
              >
                Complete your profile →
              </Link>
            </div>
            <button
              onClick={() => {
                setProfilePromptDismissed(true);
                localStorage.setItem("ascend.profilePromptDismissed", "1");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Exercise schedule completion prompt ── */}
        {showSchedulePrompt && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(38 70% 45% / 0.35)" }}
          >
            <span className="text-lg leading-none shrink-0 mt-0.5">🏋️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">Set your exercise schedule</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Tell your coach which days you train and what you do — your calorie target will automatically adjust on active days.
              </p>
              <Link
                href="/settings"
                className="inline-block mt-2 text-xs font-bold"
                style={{ color: "#C89A3E" }}
              >
                Set up schedule →
              </Link>
            </div>
            <button
              onClick={() => {
                setSchedulePromptDismissed(true);
                localStorage.setItem("ascend.schedulePromptDismissed", "1");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Weekly weigh-in prompt ── */}
        {showWeighInPrompt && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(220 80% 55% / 0.3)" }}
          >
            <span className="text-lg leading-none shrink-0 mt-0.5">⚖️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">Time for your weekly weigh-in</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Update your current weight to track progress and let your coach adjust your plan.
              </p>
              <Link
                href="/progress"
                className="inline-block mt-2 text-xs font-bold"
                style={{ color: "#C89A3E" }}
              >
                Log weigh-in →
              </Link>
            </div>
            <button
              onClick={() => {
                setWeighInPromptDismissed(true);
                localStorage.setItem("ascend.weighInDismissedDate", new Date().toDateString());
              }}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Hero / Command Center ── */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "hsl(220 12% 9%)",
            border: "1px solid hsl(220 10% 18%)",
          }}
        >

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold tracking-[0.02em] text-muted-foreground">
                {dayName} · {dateStr}
              </p>
              <h1 className="text-[2.3rem] font-black tracking-tight leading-tight mt-0.5">
                {firstName}
              </h1>
              {/* Phase label — for Pro users show program day; for free-trial users show trial day */}
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                {isPro ? (
                  <>
                    Day {Math.max(1, Math.floor((Date.now() - new Date(profile?.createdAt ?? Date.now()).getTime()) / (86400000)) + 1)}
                    {plan && isCutting ? " — Cut Phase" : plan && isBulking ? " — Build Phase" : " — Maintenance"}
                  </>
                ) : (
                  <>
                    Day {trialDay > 0 ? trialDay : 1}
                    {plan && isCutting ? " — Cut Phase" : plan && isBulking ? " — Build Phase" : " — Maintenance"}
                  </>
                )}
              </p>
              {/* Status badge */}
              {(() => {
                const statusLabel = displayScore >= 90
                  ? { text: "Perfect Day", color: "#4A9B78", bg: "rgba(74,155,120,0.12)", border: "rgba(74,155,120,0.3)" }
                  : displayScore >= 65
                  ? { text: "Locked In", color: "#6B8BAE", bg: "rgba(107,139,174,0.12)", border: "rgba(107,139,174,0.3)" }
                  : displayScore >= 30
                  ? { text: "Building Momentum", color: "#C89A3E", bg: "rgba(200,154,62,0.12)", border: "rgba(200,154,62,0.3)" }
                  : { text: "Comeback Day", color: "#C89A3E", bg: "rgba(200,154,62,0.10)", border: "rgba(200,154,62,0.25)" };
                if (!hasAnyData) return null;
                return (
                  <span
                    className="inline-block mt-2 text-[9px] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: statusLabel.color, background: statusLabel.bg, border: `1px solid ${statusLabel.border}` }}
                  >
                    {statusLabel.text}
                  </span>
                );
              })()}
              {streakData && (streakData.currentStreak ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <Flame className="w-3.5 h-3.5" style={{ color: "#C89A3E" }} strokeWidth={2.4} />
                <p className="text-[11px] font-bold" style={{ color: "#C89A3E" }}>
                  {streakData.currentStreak}-day streak
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
            <ScoreRing score={displayScore} />
            <span className="label-caps-strong text-muted-foreground mt-0.5" style={{ fontSize: "8px" }}>Ascend Score</span>
          </div>
        </div>
        </div>

        {/* ── Today's Mission ── */}
        <Link href="/schedule" className="block active:scale-[0.99] transition-transform">
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{
              background: "rgba(107,139,174,0.08)",
              border: "1px solid rgba(107,139,174,0.22)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(107,139,174,0.12)" }}
              >
                <Target className="w-5 h-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-medium text-primary mb-0.5">Today's Mission</p>
                <p className="text-sm font-bold leading-tight">Hit the plan. Keep the streak alive.</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
          </div>
        </Link>

        {/* ── Proof of Change / Consistency (maintenance) ── */}
        {(() => {
          // Maintenance users don't have a "weight to lose/gain" goal.
          // Show a consistency card instead of a weight-progress bar.
          if (isMaintenance) {
            const streak = streakData?.currentStreak ?? 0;
            const pct = Math.min(100, checklistScore);
            const barColor = pct >= 80 ? "#4A9B78" : pct >= 50 ? "#6B8BAE" : "#C89A3E";
            return (
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(220 10% 18%)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold tracking-[0.02em] text-muted-foreground mb-1">Consistency</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black" style={{ color: barColor }}>{pct}%</span>
                      <span className="text-[11px] text-muted-foreground">daily mission today</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {streak > 0 ? `${streak}-day streak · ` : ""}Stay fit by showing up daily.
                    </p>
                  </div>
                  <Link href="/progress" className="text-xs font-bold text-primary shrink-0 pt-1">Track</Link>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(218 46% 12%)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground">{checklistCompleted}/{dailyHabits.length} habits done today</p>
                </div>
              </div>
            );
          }

          // Weight-change card for loss / gain users
          const startKg = progress?.startWeightKg ?? profile.currentWeightKg ?? 0;
          const currentKg = progress?.currentWeightKg ?? profile.currentWeightKg ?? 0;
          const goalKg = progress?.goalWeightKg ?? profile.goalWeightKg ?? 0;
          const startLbs = Math.round(startKg * 2.2046226);
          const currentLbs = Math.round(currentKg * 2.2046226);
          const goalLbs = goalKg > 0 ? Math.round(goalKg * 2.2046226) : 0;
          const totalChange = Math.round((currentKg - startKg) * 2.2046226 * 10) / 10;
          const hasChange = Math.abs(totalChange) > 0;
          const isLoss = totalChange < 0;
          const changeColor = isLoss ? "#4A9B78" : totalChange > 0 ? "#C89A3E" : "#6B8BAE";
          const progressPct = goalLbs > 0 && startLbs !== goalLbs
            ? Math.max(0, Math.min(100, Math.round(Math.abs(startLbs - currentLbs) / Math.abs(startLbs - goalLbs) * 100)))
            : 0;
          return (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "hsl(220 12% 9%)", border: "1px solid hsl(220 10% 18%)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold tracking-[0.02em] text-muted-foreground mb-1">Proof of Change</p>
                  {hasChange ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black" style={{ color: changeColor }}>
                        {isLoss ? "" : "+"}{totalChange}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground">lbs</span>
                      <span className="text-[11px] text-muted-foreground">since starting</span>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground">Log a weigh-in to see your change.</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {startLbs} lbs
                    {hasChange ? ` → ${currentLbs} lbs` : ""}
                    {goalLbs > 0 ? ` → ${goalLbs} goal` : ""}
                  </p>
                </div>
                <Link href="/progress" className="text-xs font-bold text-primary shrink-0 pt-1">
                  {hasChange ? "Track" : "Weigh In"}
                </Link>
              </div>
              {goalLbs > 0 && startLbs !== goalLbs && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(218 46% 12%)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${changeColor}, ${changeColor}aa)` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">{progressPct}% of the way to goal</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Goal Reached — not shown for maintenance users ── */}
        {progress?.goalReached && !isMaintenance && (
          <div
            className="rounded-2xl p-4 text-center space-y-2"
            style={{
              background: "rgba(107,139,174,0.08)",
              border: "1px solid rgba(107,139,174,0.25)",
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-primary" strokeWidth={2} />
              <p className="text-base font-black text-primary tracking-tight">Objective Reached</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You hit {Math.round((progress.goalWeightKg ?? 0) * 2.2046226)} lbs.
            </p>
            <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              View Progress <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ── Weekly Goal Check-In ── */}
        {goals.length > 0 && (
          <div>
            {(() => {
              const latestByGoal = (goalCheckIns ?? []).reduce((acc, c) => {
                if (!acc[c.goal] || new Date(c.createdAt) > new Date(acc[c.goal].createdAt)) {
                  acc[c.goal] = c;
                }
                return acc;
              }, {} as Record<string, any>);
              const goalsNeedingCheckIn = goals.filter((g: string) => {
                const latest = latestByGoal[g];
                if (!latest) return true;
                const daysSince = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                return daysSince >= 7;
              });
              if (goalsNeedingCheckIn.length === 0) return null;
              return (
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: "rgba(107,139,174,0.07)",
                    border: "1px solid rgba(107,139,174,0.2)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="label-caps text-primary">Weekly Check-In</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {goalsNeedingCheckIn.length === 1
                      ? `Rate your progress on ${goalsNeedingCheckIn[0]} this week.`
                      : `Rate your progress on ${goalsNeedingCheckIn.length} objectives this week.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {goalsNeedingCheckIn.map((g: string) => {
                      const latest = latestByGoal[g];
                      return (
                        <Link
                          key={g}
                          href="/progress"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium capitalize"
                          style={{
                            background: "hsl(220 12% 9%)",
                            border: "1px solid hsl(217 32% 15%)",
                          }}
                        >
                          <Star className="w-3 h-3 text-primary" />
                          {g}
                          {latest && <span className="text-muted-foreground">(last: {latest.score}/10)</span>}
                        </Link>
                      );
                    })}
                  </div>
                  <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    Go to Progress <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Next Mission ── */}
        {(() => {
          type CheckIn = { goal: string; whatHelped: string | null; whatHardened: string | null; createdAt: string; score: number };
          const sorted = [...(goalCheckIns ?? [] as CheckIn[])].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          const items: Array<{ type: "fix" | "keep"; text: string; goal: string }> = [];
          const seen = new Set<string>();
          for (const c of sorted) {
            if (c.whatHardened && !seen.has(c.whatHardened)) {
              seen.add(c.whatHardened);
              items.push({ type: "fix", text: c.whatHardened, goal: c.goal });
            }
            if (c.whatHelped && !seen.has(c.whatHelped)) {
              seen.add(c.whatHelped);
              items.push({ type: "keep", text: c.whatHelped, goal: c.goal });
            }
            if (items.length >= 3) break;
          }

          // Sleep-specific mission when no check-in data but sleep is a goal
          const hasSleepGoal = goals.some((g: string) => g.toLowerCase().includes("sleep"));
          const hour = new Date().getHours();
          const isEvening = hour >= 20;

          if (items.length === 0) {
            // Show a sleep/tonight nudge in the evening if relevant
            if (hasSleepGoal || isEvening) {
              return (
                <div
                  className="rounded-2xl p-4 space-y-2"
                  style={{ background: "rgba(107,139,174,0.05)", border: "1px solid rgba(107,139,174,0.15)" }}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-primary" />
                    <p className="label-caps text-primary">Tonight's Mission</p>
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {hasSleepGoal
                      ? plan && plan.sleepTargetHours
                        ? `Phone down by ${22 - Math.max(0, plan.sleepTargetHours - 7)}:00. Protect your ${plan.sleepTargetHours}h target.`
                        : "Phone down by 10:30. Get 8+ hours. Recovery drives results."
                      : "Wind down early. Recovery drives every result tomorrow."}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Sleep is when the gains happen.</p>
                </div>
              );
            }
            return null;
          }

          return (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(107,139,174,0.05)", border: "1px solid rgba(107,139,174,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="label-caps text-primary">Next Mission</p>
              </div>
              <div className="space-y-2.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
                      style={
                        item.type === "fix"
                          ? { background: "rgba(200,154,62,0.15)", color: "#C89A3E" }
                          : { background: "rgba(74,155,120,0.15)", color: "#4A9B78" }
                      }
                    >
                      {item.type === "fix" ? "Reduce" : "Keep"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs leading-snug text-foreground capitalize">{item.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.goal}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Based on your last check-in — track the pattern.
              </p>
            </div>
          );
        })()}

        {/* ── Mission Card ── */}
        {missionComplete ? (
          /* ── Reward / Mission Complete state ── */
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: "rgba(74,155,120,0.10)",
              border: "1px solid rgba(74,155,120,0.25)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(74,155,120,0.12)" }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: "#4A9B78" }} strokeWidth={2.2} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[9px] font-medium" style={{ color: "#4A9B78" }}>Mission Complete</p>
                <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(200,154,62,0.15)", color: "#C89A3E", border: "1px solid rgba(200,154,62,0.3)" }}>Day stacked</span>
              </div>
            </div>
            <p className="text-sm font-bold leading-snug text-foreground">You kept the promise today.</p>
            <p className="text-[11px] leading-relaxed" style={{ color: "#4A9B78" }}>
              Proof logged. Stack another win tomorrow. Don't break the chain.
            </p>
          </div>
        ) : (
          /* ── Mission Active state ── */
          <div className="rounded-2xl p-4 ascend-mission-card">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#6B8BAE", animation: "pulse 2s infinite" }}
                  />
                  <p className="label-caps" style={{ color: "#6B8BAE", fontSize: "9px" }}>Mission Active</p>
                </div>
                <p className="text-[13px] leading-relaxed text-foreground font-medium">{coachMessage}</p>
                <div className="mt-2.5">
                  {(() => {
                    const nextAction = (() => {
                      if (!todayMeals || todayMeals.length === 0) return "Next: log your first meal";
                      if (effectiveCalorieTarget > 0 && todayCalories < effectiveCalorieTarget * 0.5) return "Next: hit your calorie target";
                      if (waterOz < waterTargetOz * 0.5) return "Next: drink water";
                      if (!review) return "Next: journal tonight";
                      return "Next: hit tomorrow's plan";
                    })();
                    return <span className="ascend-next-action">{nextAction}</span>;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Daily Score Breakdown ── */}
        {dailyScore && typeof dailyScore.totalScore === "number" && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background: "hsl(220 12% 9%)",
              border: "1px solid hsl(220 10% 18%)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="label-caps text-muted-foreground">Score Breakdown</p>
              <span className="text-[10px] font-bold text-muted-foreground">{dailyScore.totalScore}/100</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Calories", score: dailyScore.caloriesScore, max: 35, color: "#6B8BAE" },
                { label: "Protein", score: dailyScore.proteinScore, max: 35, color: "#4A9B78" },
                { label: "Water", score: dailyScore.waterScore, max: 30, color: "#6B8BAE" },
              ].map((item) => (
                <div key={item.label} className="text-center space-y-1">
                  <div className="relative h-16 rounded-lg overflow-hidden" style={{ background: "hsl(218 46% 12%)" }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-500"
                      style={{
                        height: `${item.max > 0 ? Math.round((item.score / item.max) * 100) : 0}%`,
                        background: item.color,
                        opacity: 0.8,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                      {item.score}
                    </span>
                  </div>
                  <p className="text-[8px] font-medium text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Emergency Coach Buttons ── */}
        <div>
          <p className="label-caps text-muted-foreground mb-3">Emergency Coach</p>
          <div className="grid grid-cols-3 gap-2.5">
            {([
              { icon: Cookie, label: "Craving junk", msg: "I'm craving junk food right now. Help me stay on track." },
              { icon: DumbbellIcon, label: "Missed workout", msg: "I missed my workout today. What should I do now?" },
              { icon: UtensilsCrossed, label: "Overate today", msg: "I overate today. How do I recover without spiraling?" },
              { icon: Frown, label: "Unmotivated", msg: "I feel unmotivated right now. Give me a reason to keep going." },
              { icon: AlertTriangle, label: "What to eat?", msg: "What should I eat right now that fits my plan?" },
            ] as const).map(({ icon: Icon, label, msg }) => (
              <button
                key={label}
                type="button"
                disabled={navigatingToCoach}
                onClick={() => {
                  if (navigatingToCoach) return;
                  setNavigatingToCoach(true);
                  setLocation(`/coach?emergency=${encodeURIComponent(msg)}`);
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[11px] font-medium active:scale-[0.97] transition-all disabled:opacity-50"
                style={{
                  background: "hsl(220 12% 9%)",
                  border: "1px solid hsl(220 10% 18%)",
                  color: "hsl(215 22% 70%)",
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(200,154,62,0.12)" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: "#C89A3E" }} strokeWidth={2.2} />
                </div>
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Daily Mission Checklist ── */}
        {dailyHabits.length > 0 && (
          <DailyChecklist habits={dailyHabits} done={done} setDone={setDone} />
        )}

        {/* ── Weekly Goals ── */}
        {weeklyHabits.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="label-caps text-muted-foreground">Weekly Goals</p>
            </div>
            <div
              className="rounded-2xl overflow-hidden divide-y"
              style={{
                background: "hsl(220 12% 9%)",
                border: "1px solid hsl(217 32% 15%)",
              }}
            >
              {weeklyHabits.map((habit) => {
                const lower = habit.toLowerCase();
                const isWorkoutFreq = /\b(train|workout|strength|gym|exercise|lift|cardio|run|sport|practice)\b/.test(lower) && /\b(this week|weekly|x\/week)\b/.test(lower);
                const liveDays = profile.workoutDaysPerWeek ?? 3;
                const targetCount = isWorkoutFreq && liveDays > 0 ? liveDays : 1;
                const weekKey = `ascend.weekly.${localDate.slice(0, 7)}.${habit}`;
                const weeklyCount = weeklyCounts[habit] ?? 0;
                const weeklyDone = weeklyCount >= targetCount;

                function updateWeeklyCount(delta: number) {
                  setWeeklyCounts(prev => {
                    const next = Math.max(0, (prev[habit] ?? 0) + delta);
                    const updated = { ...prev, [habit]: next };
                    try { localStorage.setItem(weekKey, String(next)); } catch {}
                    return updated;
                  });
                }

                return (
                  <div key={habit} className="w-full flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => updateWeeklyCount(weeklyDone ? -1 : 1)}
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all active:scale-90"
                        style={weeklyDone
                          ? { background: "#4A9B78", borderColor: "#4A9B78" }
                          : { borderColor: "hsl(220 10% 22%)" }}
                      >
                        {weeklyDone ? (
                          <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
                        ) : (
                          <Circle className="w-3 h-3 text-muted-foreground" strokeWidth={2} />
                        )}
                      </button>
                      <span className={`text-sm leading-snug flex-1 ${weeklyDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {isWorkoutFreq && liveDays > 0 ? `Train ${liveDays}x this week` : habit}
                      </span>
                    </div>
                    {/* Counter — tap + to add, tap − to undo */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateWeeklyCount(-1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground active:bg-elevated"
                        style={{ border: "1px solid hsl(217 32% 22%)" }}
                      >
                        −
                      </button>
                      <span className="text-sm font-bold tabular-nums w-8 text-center">
                        {weeklyCount}/{targetCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateWeeklyCount(1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold active:bg-elevated"
                        style={{ border: "1px solid hsl(217 32% 22%)" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Fuel ── */}
        {plan && (
          <div>
            <SectionLabel>Fuel</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <IntakeBar icon={Flame} label={isExerciseDay ? "Calories (Active Day)" : "Calories"} eaten={todayCalories} target={effectiveCalorieTarget} tint="blue" />
              <IntakeBar icon={Beef} label="Protein" eaten={todayProtein} target={plan.proteinTargetG} unit="g" tint="green" />
            </div>
          </div>
        )}

        {/* ── Water ── */}
        {plan && (
          <WaterTracker
            totalOz={waterOz}
            targetOz={waterTargetOz}
            onLog={handleLogWater}
            onLogPhoto={handleLogWaterPhoto}
            isLogging={waterLogging}
            isAnalyzing={waterAnalyzing}
            photoFeedback={waterPhotoFeedback}
            confirmOz={waterConfirmOz}
            onConfirmOz={handleConfirmWaterOz}
            onCancelConfirm={handleCancelWaterConfirm}
          />
        )}

        {/* ── Targets ── */}
        {plan && (
          <div>
            <SectionLabel>Targets</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard icon={Footprints} value={plan.stepsTarget.toLocaleString()} label="Steps" tint="green" />
              <MetricCard icon={Moon} value={plan.sleepTargetHours} unit="h" label="Sleep" tint="blue" />
              <MetricCard
                icon={Zap}
                value={profile.workoutDaysPerWeek}
                unit="x"
                label="Workouts/wk"
                tint="green"
              />
            </div>
          </div>
        )}

        {/* ── Today's Training ── */}
        <Link href="/workouts" className="block active:scale-[0.99] transition-transform">
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{
              background: "hsl(220 12% 9%)",
              border: "1px solid hsl(217 32% 15%)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(107,139,174,0.12)" }}
              >
                <Dumbbell className="w-5 h-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground" style={{ fontSize: "9px" }}>Training</p>
                <p className="text-sm font-bold truncate mt-0.5">
                  {workout?.name ?? "View Training Plan"}
                </p>
                {workout && (
                  <p className="text-xs text-muted-foreground">
                    {workout.type} · {workout.exercises?.length ?? 0} exercises
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
          </div>
        </Link>

        {/* ── Trial Nudge (days 5-7) — moved below mission content ── */}
        {showTrialNudge && (
          <Link href={trialComplete ? "/trial-review" : "/pricing"}>
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "rgba(200,154,62,0.07)", border: "1px solid rgba(200,154,62,0.22)" }}
            >
              <Zap className="w-4 h-4 shrink-0" style={{ color: "#C89A3E" }} strokeWidth={2.5} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground leading-tight">
                  {trialComplete
                    ? "Your Week 2 plan is ready — see your 7-day review"
                    : daysLeft === 1
                    ? "Last day of your trial. See what you've built."
                    : `Day ${trialDay} of 7 — ${daysLeft} days left in your free trial`}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        )}

        {/* ── Objectives ── */}
        {goals.length > 0 && (
          <div>
            <SectionLabel>Objectives</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-full capitalize"
                  style={{
                    background: "hsl(218 46% 12%)",
                    border: "1px solid hsl(217 32% 16%)",
                    color: "hsl(215 22% 70%)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Operations ── */}
        <div>
          <SectionLabel>Quick Links</SectionLabel>
          <div className="grid grid-cols-4 gap-2.5">
            <QuickAction href="/meals" icon={Utensils} label="Meal" />
            <QuickAction href="/coach" icon={MessageSquare} label="Coach" />
            <QuickAction href="/journal" icon={BookOpen} label="Journal" />
            <QuickAction href="/workouts" icon={Dumbbell} label="Train" />
          </div>
        </div>

      </div>
    </div>
  );
}
