import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetUserProfile,
  useGetCurrentPlan,
  useGetTodayWorkout,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell, Utensils, MessageSquare, BookOpen, LineChart, ChevronRight, Zap } from "lucide-react";

function StatPill({ value, label, unit = "" }: { value: string | number; label: string; unit?: string }) {
  return (
    <div className="flex-1 bg-card border border-border px-3 py-3 text-center">
      <p className="text-lg font-bold text-primary leading-none">
        {value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 leading-none">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 bg-card border border-border py-5 active:bg-muted/50 transition-colors"
    >
      <Icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">{label}</span>
    </Link>
  );
}

function primaryGoalLabel(goals: string[]): string {
  if (!goals || goals.length === 0) return "Active";
  const priority = ["lose fat","lose weight","build muscle","gain weight","maintain fitness"];
  const match = priority.find(g => goals.includes(g));
  return match ? match.toUpperCase() : goals[0].toUpperCase();
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: loadingProfile, error } = useGetUserProfile();
  const { data: plan } = useGetCurrentPlan();
  const { data: workout } = useGetTodayWorkout();

  useEffect(() => {
    if (error) setLocation("/onboarding");
  }, [error, setLocation]);

  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  if (loadingProfile || !profile) {
    return (
      <div className="h-full overflow-y-auto scroll-area">
        <div className="p-4 max-w-lg mx-auto space-y-4 pt-6">
          <Skeleton className="h-8 w-40 bg-muted" />
          <Skeleton className="h-4 w-28 bg-muted" />
          <div className="flex gap-2">
            <Skeleton className="h-16 flex-1 bg-muted" />
            <Skeleton className="h-16 flex-1 bg-muted" />
            <Skeleton className="h-16 flex-1 bg-muted" />
          </div>
          <Skeleton className="h-20 w-full bg-muted" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20 bg-muted" />
            <Skeleton className="h-20 bg-muted" />
            <Skeleton className="h-20 bg-muted" />
            <Skeleton className="h-20 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const toGoKg = profile.currentWeightKg && profile.goalWeightKg
    ? Math.abs(profile.currentWeightKg - profile.goalWeightKg).toFixed(1)
    : null;

  const goals: string[] = Array.isArray(profile.goals) ? profile.goals : [];
  const statusLabel = primaryGoalLabel(goals);

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-6 space-y-5">

        {/* Greeting */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {dayName}, {dateStr}
          </p>
          <h1 className="text-3xl font-bold uppercase tracking-tighter mt-0.5">
            {profile.name}
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
            {statusLabel} · {profile.fitnessLevel}
          </p>
        </div>

        {/* Today's Targets */}
        {plan && (
          <div className="flex gap-2">
            <StatPill value={plan.calorieTarget} label="Cal" />
            <StatPill value={plan.proteinTargetG} label="Protein" unit="g" />
            <StatPill value={plan.waterTargetL} label="Water" unit="L" />
          </div>
        )}

        {/* Today's Workout */}
        {workout ? (
          <Link href="/workouts" className="block">
            <div className="bg-card border border-border p-4 flex items-center justify-between active:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-4 h-4 text-primary" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Today's Workout</p>
                  <p className="text-sm font-bold uppercase tracking-tight truncate">{workout.name}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {workout.type} · {workout.exercises?.length ?? 0} exercises
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
            </div>
          </Link>
        ) : (
          <Link href="/workouts" className="block">
            <div className="bg-card border border-border p-4 flex items-center justify-between active:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Today's Workout</p>
                  <p className="text-sm font-bold uppercase tracking-tight">View Training Plan</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>
        )}

        {/* Quick Actions */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction href="/meals" icon={Utensils} label="Log Meal" />
            <QuickAction href="/coach" icon={MessageSquare} label="Ask Coach" />
            <QuickAction href="/journal" icon={BookOpen} label="Journal" />
            <QuickAction href="/progress" icon={LineChart} label="Progress" />
          </div>
        </div>

        {/* Mission Status */}
        <div className="bg-card border border-border p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-primary" />
            Mission Status
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
              <p className="text-xl font-bold">{profile.currentWeightKg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Goal</p>
              <p className="text-xl font-bold text-primary">{profile.goalWeightKg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            </div>
            {toGoKg && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">To Go</p>
                <p className="text-xl font-bold">{toGoKg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frequency</p>
              <p className="text-xl font-bold">{profile.workoutDaysPerWeek}<span className="text-xs font-normal text-muted-foreground">x / wk</span></p>
            </div>
          </div>
          {goals.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Active Goals</p>
              <div className="flex flex-wrap gap-1.5">
                {goals.map(g => (
                  <span key={g} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">{g}</span>
                ))}
              </div>
            </div>
          )}
          {plan?.coachNotes && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">{plan.coachNotes}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
