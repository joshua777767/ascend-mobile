import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTrialDay } from "@/hooks/use-trial";
import {
  useGetUserProfile,
  useGetCurrentPlan,
  useGetTodayWorkout,
  useGetTodayReview,
  useGetTodayMeals,
  useGetWaterToday,
  useLogWater,
  useGetStreak,
  useRecordStreak,
  useGetProgressSummary,
  useListGoalCheckIns,
  getGetWaterTodayQueryKey,
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
} from "lucide-react";

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
    ? "rgba(59,130,246,0.18)"
    : "rgba(16,185,129,0.18)";
  const iconColor = tint === "blue" ? "#3B82F6" : "#10B981";
  const glow = tint === "blue"
    ? "0 0 14px rgba(59,130,246,0.18)"
    : "0 0 14px rgba(16,185,129,0.18)";

  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
        borderColor: "hsl(217 32% 15%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: iconBg, boxShadow: glow }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2.2} />
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight leading-none">
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
      </p>
      <p className="label-caps text-muted-foreground mt-1.5" style={{ fontSize: "9px" }}>{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 active:scale-[0.97] transition-all"
      style={{
        background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
        border: "1px solid hsl(217 32% 15%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{label}</span>
    </Link>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#10B981" : pct >= 50 ? "#3B82F6" : "#F59E0B";
  const glow = pct >= 80
    ? "0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.15)"
    : pct >= 50
    ? "0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.15)"
    : "0 0 20px rgba(245,158,11,0.4), 0 0 40px rgba(245,158,11,0.15)";
  return (
    <div
      className="relative w-20 h-20 rounded-full shrink-0"
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, hsl(218 46% 12%) 0deg)`,
        boxShadow: pct > 0 ? glow : "none",
      }}
    >
      <div
        className="absolute inset-1.5 rounded-full flex flex-col items-center justify-center"
        style={{ background: "hsl(220 52% 8%)" }}
      >
        <span className="text-xl font-black tracking-tight leading-none">{pct}</span>
        <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-muted-foreground mt-0.5">Score</span>
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
    ? "linear-gradient(90deg, #3B82F6, #2DD4BF)"
    : "linear-gradient(90deg, #10B981, #34D399)";
  const iconBg = tint === "blue" ? "rgba(59,130,246,0.18)" : "rgba(16,185,129,0.18)";
  const iconColor = tint === "blue" ? "#3B82F6" : "#10B981";
  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
        borderColor: "hsl(217 32% 15%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
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
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{label}</span>
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
          <p className="label-caps text-muted-foreground">Today's Mission</p>
          {allDone && (
            <span
              className="text-[8px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
            >
              COMPLETE
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
          background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
          border: "1px solid hsl(217 32% 15%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
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
              style={{ borderColor: "hsl(217 32% 13%)" }}
            >
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all"
                style={isDone
                  ? { background: "#10B981", borderColor: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.4)" }
                  : { borderColor: "hsl(217 32% 22%)" }}
              >
                {isDone && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-sm leading-snug flex-1 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {habit}
              </span>
              {isDone && (
                <span className="text-[8px] font-black tracking-[0.15em] uppercase" style={{ color: "#10B981" }}>
                  Done
                </span>
              )}
            </button>
          );
        })}
      </div>
      {allDone && (
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mt-2 text-center">
          No skipped basics. Keep the streak alive.
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
        background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
        borderColor: "hsl(217 32% 15%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.18)" }}
          >
            <Droplets className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} />
          </div>
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Hydration</span>
        </div>
        {met && !isAnalyzing && (
          <span
            className="text-[8px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
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
              ? "linear-gradient(90deg, #10B981, #34D399)"
              : "linear-gradient(90deg, #3B82F6, #2DD4BF)",
          }}
        />
      </div>

      {photoFeedback && (
        <p className="text-xs font-semibold mb-3" style={{ color: "#10B981" }}>{photoFeedback}</p>
      )}

      {confirmOz !== null && (
        <div
          className="mb-3 rounded-xl p-3 space-y-2"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.22)" }}
        >
          <p className="text-xs font-semibold leading-snug" style={{ color: "#93C5FD" }}>
            Couldn't clearly detect water. How much to add?
          </p>
          <div className="flex gap-2">
            {[8, 12, 16].map((oz) => (
              <button
                key={oz}
                type="button"
                onClick={() => onConfirmOz(oz)}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(59,130,246,0.15)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#3B82F6",
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
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              color: "#3B82F6",
            }}
          >
            +{oz} oz
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="py-2 px-3 rounded-xl text-xs font-semibold text-muted-foreground active:bg-card transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
  const { data: profile, isLoading: loadingProfile, error } = useGetUserProfile();
  const { data: plan } = useGetCurrentPlan();
  const { data: workout } = useGetTodayWorkout();
  const { data: review } = useGetTodayReview();
  const { data: todayMeals, refetch: refetchMeals } = useGetTodayMeals();
  const { data: waterData, refetch: refetchWater } = useGetWaterToday();
  const { mutateAsync: logWaterFn, isPending: waterLogging } = useLogWater();
  const { data: streakData } = useGetStreak();
  const { mutateAsync: recordStreakFn } = useRecordStreak();
  const { data: progress } = useGetProgressSummary();
  const { data: goalCheckIns } = useListGoalCheckIns();

  useEffect(() => { refetchMeals(); }, [refetchMeals]);
  useEffect(() => { refetchWater(); }, [refetchWater]);

  const habits = prioritizeHabits(plan && Array.isArray(plan.keyHabits) ? plan.keyHabits : []);
  const todayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `ascend.checklist.${todayKey}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done, storageKey]);

  const waterOz = waterData?.totalOz ?? 0;
  const waterTargetOz = waterData?.targetOz ?? (plan ? Math.round(plan.waterTargetL * 33.814) : 64);

  // Auto-check the water habit when daily target is met
  useEffect(() => {
    if (waterOz > 0 && waterTargetOz > 0 && waterOz >= waterTargetOz) {
      const waterHabit = habits.find((h) => h.toLowerCase().includes("water"));
      if (waterHabit && !done[waterHabit]) {
        setDone((prev) => ({ ...prev, [waterHabit]: true }));
      }
    }
  }, [waterOz, waterTargetOz, habits]); // eslint-disable-line react-hooks/exhaustive-deps

  const checklistCompleted = habits.filter((h) => done[h]).length;
  const checklistScore = habits.length ? Math.round((checklistCompleted / habits.length) * 100) : 0;

  // Record streak when today's mission hits 70%
  useEffect(() => {
    if (checklistScore >= 70 && habits.length > 0) {
      const lastDate = streakData?.lastStreakDate ?? null;
      const today = new Date().toISOString().slice(0, 10);
      if (lastDate !== today) {
        recordStreakFn().catch(() => {});
      }
    }
  }, [checklistScore, habits.length, streakData?.lastStreakDate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { trialDay, daysLeft, trialComplete } = useTrialDay();
  const showTrialNudge = trialDay >= 5;

  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

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

  const todayCalories = (todayMeals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0);
  const todayProtein = (todayMeals ?? []).reduce((s, m) => s + (m.protein ?? 0), 0);

  // Blended Ascend Score — reflects real daily progress across 4 signals
  // Weights: calories 30 | protein 25 | water 20 | mission checklist 25 = 100 pts max
  const calorieProgress = plan && plan.calorieTarget > 0
    ? Math.min(todayCalories / plan.calorieTarget, 1) : 0;
  const proteinProgress = plan && plan.proteinTargetG > 0
    ? Math.min(todayProtein / plan.proteinTargetG, 1) : 0;
  const waterProgress = waterTargetOz > 0
    ? Math.min(waterOz / waterTargetOz, 1) : 0;
  const missionProgress = habits.length > 0 ? checklistCompleted / habits.length : 0;
  const ascendScore = Math.round(
    calorieProgress * 30 +
    proteinProgress * 25 +
    waterProgress * 20 +
    missionProgress * 25,
  );

  const displayScore = reviewScore !== null ? reviewScore : ascendScore;
  const hasAnyData = todayCalories > 0 || todayProtein > 0 || waterOz > 0 || checklistCompleted > 0;

  // --- Personalized mission copy ---
  const calorieDeficit = plan ? plan.calorieTarget - todayCalories : 0;
  const proteinDeficit = plan ? plan.proteinTargetG - todayProtein : 0;
  const isBulking = plan ? (profile.goalWeightKg ?? 0) > (profile.currentWeightKg ?? 0) : false;
  const isCutting = plan ? (profile.goalWeightKg ?? 0) < (profile.currentWeightKg ?? 0) : false;
  const missionComplete = checklistScore >= 100 && habits.length > 0;

  function buildMission(): string {
    if (missionComplete) {
      return "Mission complete. Growth requires proof — keep the streak alive tomorrow.";
    }
    if (plan && calorieDeficit > 500) {
      return `You're ${calorieDeficit} calories behind. Eat again before bed. No skipped basics.`;
    }
    if (plan && proteinDeficit > 30) {
      return `${proteinDeficit}g protein short. Make the next meal count. Finish the mission.`;
    }
    if (isBulking && plan) {
      return `${firstName}, you're building. Hit ${plan.calorieTarget.toLocaleString()} calories today. No skipped meals.`;
    }
    if (isCutting && plan) {
      return `${firstName}, stay locked in: protein, steps, water, clean tracking. Your next move matters.`;
    }
    if (goals.includes("better skin")) {
      return "Clear skin mission: water, sleep, face wash, no sugary drinks. No skipped basics.";
    }
    if (goals.includes("higher energy")) {
      return "Energy mission: protein breakfast, water, sunlight, sleep. Finish the mission.";
    }
    if (goals.includes("better sleep")) {
      return "Sleep mission: no screens after 9, magnesium, cool room, same wake time.";
    }
    if (goals.includes("discipline")) {
      return "Discipline mission: show up, hit every item, no excuses. Growth requires proof.";
    }
    return plan?.coachNotes?.trim() || "Hit protein, follow the workout, drink water early, and protect your sleep. No random snacks — no excuses.";
  }

  const coachMessage = buildMission();

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">

        {/* ── Greeting ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="label-caps text-muted-foreground" style={{ fontSize: "9px" }}>
              {dayName} · {dateStr}
            </p>
            <h1 className="text-[1.9rem] font-black tracking-tight leading-tight mt-0.5">
              {firstName}
            </h1>
            {streakData && (streakData.currentStreak ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <Flame className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} strokeWidth={2.4} />
                <p className="text-[11px] font-black tracking-[0.1em]" style={{ color: "#F59E0B" }}>
                  {streakData.currentStreak}-DAY STREAK
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            {hasAnyData || reviewScore !== null ? (
              <>
                <ScoreRing score={displayScore} />
                <span className="label-caps text-muted-foreground" style={{ fontSize: "8px" }}>Today</span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-0.5 w-14 text-center">
                <span className="text-[9px] font-bold tracking-wide text-muted-foreground uppercase leading-tight">Start today's mission</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Trial Nudge (days 5-7) ── */}
        {showTrialNudge && (
          <Link href={trialComplete ? "/trial-review" : "/pricing"}>
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-opacity hover:opacity-80"
              style={{
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.22)",
              }}
            >
              <Zap className="w-4 h-4 shrink-0" style={{ color: "#F59E0B" }} strokeWidth={2.5} />
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

        {/* ── Goal Reached ── */}
        {progress?.goalReached && (
          <div
            className="rounded-2xl p-4 text-center space-y-2"
            style={{
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.25)",
              boxShadow: "0 0 24px rgba(59,130,246,0.08)",
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
                    background: "rgba(59,130,246,0.07)",
                    border: "1px solid rgba(59,130,246,0.2)",
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold capitalize"
                          style={{
                            background: "hsl(220 52% 8%)",
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

        {/* ── Mission Card ── */}
        <div className="ascend-mission-card rounded-2xl p-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: missionComplete ? "#10B981" : "#3B82F6",
                    boxShadow: missionComplete
                      ? "0 0 6px rgba(16,185,129,0.8)"
                      : "0 0 6px rgba(59,130,246,0.8)",
                    animation: missionComplete ? "none" : "pulse 2s infinite",
                  }}
                />
                <p className="label-caps" style={{ color: missionComplete ? "#10B981" : "#3B82F6", fontSize: "9px" }}>
                  {missionComplete ? "Mission Complete" : "Mission Active"}
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground font-medium">{coachMessage}</p>
            </div>
            {displayScore === 0 && (
              <div className="shrink-0 pt-1">
                <ScoreRing score={0} />
              </div>
            )}
          </div>
        </div>

        {/* ── Today's Mission Checklist ── */}
        {habits.length > 0 && (
          <DailyChecklist habits={habits} done={done} setDone={setDone} />
        )}

        {/* ── Fuel Intake ── */}
        {plan && (
          <div>
            <SectionLabel>Fuel Intake</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <IntakeBar icon={Flame} label="Calories" eaten={todayCalories} target={plan.calorieTarget} tint="blue" />
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

        {/* ── Performance Targets ── */}
        {plan && (
          <div>
            <SectionLabel>Performance Targets</SectionLabel>
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
              background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
              border: "1px solid hsl(217 32% 15%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(59,130,246,0.18)", boxShadow: "0 0 14px rgba(59,130,246,0.18)" }}
              >
                <Dumbbell className="w-5 h-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground" style={{ fontSize: "9px" }}>Today's Training</p>
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

        {/* ── Active Objectives ── */}
        {goals.length > 0 && (
          <div>
            <SectionLabel>Active Objectives</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-full capitalize tracking-wide"
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

        {/* ── Quick Access ── */}
        <div>
          <SectionLabel>Quick Access</SectionLabel>
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
