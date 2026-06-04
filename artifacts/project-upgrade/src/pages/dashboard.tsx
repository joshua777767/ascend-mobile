import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
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
  ListChecks,
  CheckCircle2,
  Circle,
  Plus,
  Camera,
} from "lucide-react";

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
  const ring = tint === "blue" ? "bg-primary/15 text-primary" : "bg-success/15 text-success";
  return (
    <div className="rounded-2xl bg-card border border-border p-3.5">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${ring}`}>
        <Icon className="w-4 h-4" strokeWidth={2.2} />
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight leading-none">
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground mt-1 leading-none">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border border-border py-4 active:bg-elevated transition-colors"
    >
      <Icon className="w-5 h-5 text-foreground" strokeWidth={2} />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "hsl(160 84% 39%)" : pct >= 50 ? "hsl(217 91% 60%)" : "hsl(38 92% 50%)";
  return (
    <div
      className="relative w-16 h-16 rounded-full shrink-0"
      style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, hsl(222 38% 15%) 0deg)` }}
    >
      <div className="absolute inset-[5px] rounded-full bg-card flex items-center justify-center">
        <span className="text-lg font-bold tracking-tight">{pct}</span>
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
  const barColor = tint === "blue" ? "bg-primary" : "bg-success";
  const ringColor = tint === "blue" ? "bg-primary/15 text-primary" : "bg-success/15 text-success";
  return (
    <div className="rounded-2xl bg-card border border-border p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${ringColor}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{pct}%</span>
      </div>
      <p className="text-lg font-bold tracking-tight leading-none mb-2">
        {eaten.toLocaleString()}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
        <span className="text-xs font-normal text-muted-foreground ml-1">/ {target.toLocaleString()}{unit}</span>
      </p>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-4 h-4 text-primary" strokeWidth={2.4} />
          <p className="text-sm font-semibold text-foreground">Today's Checklist</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {completed}/{habits.length} done
        </span>
      </div>
      <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
        {habits.map((habit) => {
          const isDone = !!done[habit];
          return (
            <button
              key={habit}
              type="button"
              onClick={() => setDone((d) => ({ ...d, [habit]: !d[habit] }))}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-elevated transition-colors"
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" strokeWidth={2.2} />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0" strokeWidth={2} />
              )}
              <span
                className={
                  "text-sm leading-snug " +
                  (isDone ? "line-through text-muted-foreground" : "text-foreground")
                }
              >
                {habit}
              </span>
            </button>
          );
        })}
      </div>
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
}: {
  totalOz: number;
  targetOz: number;
  onLog: (oz: number) => void;
  onLogPhoto: (imageUrl: string) => void;
  isLogging: boolean;
  isAnalyzing: boolean;
  photoFeedback: string | null;
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
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Droplets className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} />
          </div>
          <span className="text-sm font-semibold text-foreground">Water</span>
        </div>
        {met && !isAnalyzing && (
          <span className="text-xs font-semibold text-success bg-success/15 px-2 py-0.5 rounded-full">
            Target met ✓
          </span>
        )}
        {isAnalyzing && (
          <span className="text-xs font-medium text-primary animate-pulse">
            Analyzing photo…
          </span>
        )}
      </div>

      <p className="text-2xl font-bold tracking-tight leading-none mb-1">
        {totalOz}
        <span className="text-xs font-medium text-muted-foreground ml-0.5">oz</span>
        <span className="text-sm font-normal text-muted-foreground ml-1.5">
          / {targetOz} oz
        </span>
      </p>

      <div className="h-1.5 rounded-full bg-elevated overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ${met ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {photoFeedback && (
        <p className="text-xs text-success mb-3 font-medium">{photoFeedback}</p>
      )}

      <div className="flex gap-2 mb-3">
        {[8, 16, 24].map((oz) => (
          <button
            key={oz}
            type="button"
            disabled={busy}
            onClick={() => onLog(oz)}
            className="flex-1 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary active:bg-primary/20 transition-colors disabled:opacity-50"
          >
            +{oz} oz
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="py-2 px-3 rounded-xl bg-elevated border border-border text-xs font-semibold text-muted-foreground active:bg-card transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
          className="flex-1 h-9 rounded-xl bg-elevated border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

  useEffect(() => { refetchMeals(); }, [refetchMeals]);
  useEffect(() => { refetchWater(); }, [refetchWater]);

  const habits = plan && Array.isArray(plan.keyHabits) ? plan.keyHabits : [];
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

  // Auto-check the water habit in the checklist when daily target is met
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

  async function handleLogWater(oz: number) {
    try {
      await logWaterFn({ data: { amountOz: oz } });
      await queryClient.invalidateQueries({ queryKey: ["getWaterToday"] });
      refetchWater();
    } catch {
      // fail silently — the button re-enables immediately
    }
  }

  async function handleLogWaterPhoto(imageUrl: string) {
    setWaterAnalyzing(true);
    setWaterPhotoFeedback(null);
    try {
      const result = await logWaterFn({ data: { imageUrl } });
      await queryClient.invalidateQueries({ queryKey: ["getWaterToday"] });
      refetchWater();
      if (result?.detectedOz) {
        setWaterPhotoFeedback(`Photo detected ~${result.detectedOz} oz — added!`);
        setTimeout(() => setWaterPhotoFeedback(null), 4000);
      }
    } catch {
      setWaterPhotoFeedback("Couldn't analyze photo. Try again.");
      setTimeout(() => setWaterPhotoFeedback(null), 3000);
    } finally {
      setWaterAnalyzing(false);
    }
  }

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
  const displayScore = reviewScore !== null ? reviewScore : checklistScore;
  const displayLabel = reviewScore !== null ? "Today" : "Checklist";
  const coachMessage =
    plan?.coachNotes?.trim() ||
    "Today's focus is simple: hit protein, follow the workout, drink water early, and protect your sleep. No random snacks, no excuses.";

  const firstName = profile.name?.split(" ")[0] ?? profile.name;

  const todayCalories = (todayMeals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0);
  const todayProtein = (todayMeals ?? []).reduce((s, m) => s + (m.protein ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">

        {/* Greeting */}
        <div>
          <p className="text-sm text-muted-foreground">
            {dayName}, {dateStr}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Hi, {firstName}
          </h1>
          {streakData && (streakData.currentStreak ?? 0) > 0 && (
            <p className="text-xs font-semibold text-primary mt-1 flex items-center gap-1">
              <Flame className="w-3 h-3" strokeWidth={2.4} />
              {streakData.currentStreak} Day Ascend Streak
            </p>
          )}
        </div>

        {/* Today's Mission + Daily Score */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-success/5 border border-primary/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" strokeWidth={2.4} />
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Today's Mission</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{coachMessage}</p>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <ScoreRing score={displayScore} />
              <span className="text-[10px] text-muted-foreground mt-1.5">
                {displayLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Today's Checklist — combined daily mission from selected goals */}
        {plan && Array.isArray(plan.keyHabits) && plan.keyHabits.length > 0 && (
          <DailyChecklist habits={plan.keyHabits} done={done} setDone={setDone} />
        )}

        {/* Today's Intake */}
        {plan && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Today's Intake</p>
            <div className="grid grid-cols-2 gap-3">
              <IntakeBar icon={Flame} label="Calories" eaten={todayCalories} target={plan.calorieTarget} tint="blue" />
              <IntakeBar icon={Beef} label="Protein" eaten={todayProtein} target={plan.proteinTargetG} unit="g" tint="green" />
            </div>
          </div>
        )}

        {/* Water Tracker */}
        {plan && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Water</p>
            <WaterTracker
              totalOz={waterOz}
              targetOz={waterTargetOz}
              onLog={handleLogWater}
              onLogPhoto={handleLogWaterPhoto}
              isLogging={waterLogging}
              isAnalyzing={waterAnalyzing}
              photoFeedback={waterPhotoFeedback}
            />
          </div>
        )}

        {/* Other Targets */}
        {plan && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Daily Targets</p>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard icon={Footprints} value={plan.stepsTarget.toLocaleString()} label="Steps" tint="green" />
              <MetricCard icon={Moon} value={plan.sleepTargetHours} unit="h" label="Sleep" tint="blue" />
              <MetricCard
                icon={Target}
                value={profile.workoutDaysPerWeek}
                unit="x"
                label="Workouts/wk"
                tint="green"
              />
            </div>
          </div>
        )}

        {/* Today's Workout */}
        <Link href="/workouts" className="block">
          <div className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between active:bg-elevated transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Today's Workout</p>
                <p className="text-sm font-semibold truncate">
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

        {/* Goals */}
        {goals.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Your Goals</p>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <span
                  key={g}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-elevated border border-border text-foreground capitalize"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Quick Actions</p>
          <div className="grid grid-cols-4 gap-3">
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
