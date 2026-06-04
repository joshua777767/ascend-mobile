import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetUserProfile,
  useGetCurrentPlan,
  useGetTodayWorkout,
  useGetTodayReview,
  useGetTodayMeals,
} from "@workspace/api-client-react";
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
} from "lucide-react";

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

function DailyChecklist({ habits }: { habits: string[] }) {
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
      // ignore storage errors
    }
  }, [done, storageKey]);

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

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: loadingProfile, error } = useGetUserProfile();
  const { data: plan } = useGetCurrentPlan();
  const { data: workout } = useGetTodayWorkout();
  const { data: review } = useGetTodayReview();
  const { data: todayMeals, refetch: refetchMeals } = useGetTodayMeals();
  useEffect(() => { refetchMeals(); }, [refetchMeals]);

  useEffect(() => {
    if (error) setLocation("/onboarding");
  }, [error, setLocation]);

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
              <ScoreRing score={reviewScore ?? 0} />
              <span className="text-[10px] text-muted-foreground mt-1.5">
                {reviewScore !== null ? "Today" : "No score yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Today's Checklist — combined daily mission from selected goals */}
        {plan && Array.isArray(plan.keyHabits) && plan.keyHabits.length > 0 && (
          <DailyChecklist habits={plan.keyHabits} />
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

        {/* Other Targets */}
        {plan && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Daily Targets</p>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard icon={Droplets} value={plan.waterTargetL} unit="L" label="Water" tint="blue" />
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
