import { Link } from "wouter";
import { CheckCircle2, Flame, Target, Dumbbell, Utensils, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetUserProfile, useGetCurrentPlan, useGetProgressSummary } from "@workspace/api-client-react";
import { useTrialDay } from "@/hooks/use-trial";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
        border: "1px solid hsl(217 32% 14%)",
      }}
    >
      <div className="text-primary mb-1">{icon}</div>
      <p className="text-[1.5rem] font-black tracking-tight leading-none">{value}</p>
      {sub && <p className="text-[11px] font-bold text-muted-foreground">{sub}</p>}
      <p className="label-caps text-muted-foreground mt-1" style={{ fontSize: "9px" }}>{label}</p>
    </div>
  );
}

function LearnedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0" style={{ borderColor: "hsl(217 32% 13%)" }}>
      <span className="label-caps text-muted-foreground shrink-0" style={{ fontSize: "9px", paddingTop: "2px" }}>{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}

export default function TrialReviewPage() {
  const { data: profile, isLoading: loadingProfile } = useGetUserProfile();
  const { data: plan, isLoading: loadingPlan } = useGetCurrentPlan();
  const { data: progress, isLoading: loadingProgress } = useGetProgressSummary();
  const { trialDay } = useTrialDay();

  const isLoading = loadingProfile || loadingPlan || loadingProgress;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto scroll-area">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-10 space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl bg-elevated" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-elevated" />)}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl bg-elevated" />
          <Skeleton className="h-16 w-full rounded-2xl bg-elevated" />
        </div>
      </div>
    );
  }

  const firstName = profile?.name?.split(" ")[0] ?? "Coach";
  const goals: string[] = Array.isArray(profile?.goals) ? profile.goals : [];
  const mealsLogged = progress?.recentMeals?.length ?? 0;
  const workoutsLogged = progress?.totalWorkouts ?? 0;
  const streak = progress?.dayStreak ?? 0;
  const avgScore = progress?.avgDailyScore ?? 0;

  const goalLabel =
    goals.length > 0
      ? goals.slice(0, 2).map((g) => g.replace(/_/g, " ")).join(", ")
      : "Transformation";

  const bodyTypeLabel =
    profile?.bodyType === "ectomorph"
      ? "Ectomorph (lean, hard gainer)"
      : profile?.bodyType === "endomorph"
      ? "Endomorph (stores fat easily)"
      : profile?.bodyType === "mesomorph"
      ? "Mesomorph (athletic build)"
      : profile?.bodyType ?? "—";

  const keyHabits: string[] = Array.isArray(plan?.keyHabits) ? plan.keyHabits : [];

  const scoreColor =
    avgScore >= 80 ? "#4A9B78" : avgScore >= 60 ? "#C89A3E" : "#EF4444";

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-12 space-y-5">

        {/* ── Header ── */}
        <div
          className="rounded-2xl p-5 text-center space-y-2"
          style={{
            background: "linear-gradient(145deg, rgba(74,155,120,0.08) 0%, rgba(107,139,174,0.04) 100%)",
            border: "1px solid rgba(74,155,120,0.20)",
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5" style={{ color: "#4A9B78" }} strokeWidth={2.5} />
            <span
              className="label-caps"
              style={{ fontSize: "9px", color: "#4A9B78" }}
            >
              Day {trialDay} of 7 — Trial Complete
            </span>
          </div>
          <h1 className="text-[1.8rem] font-black tracking-tight leading-tight">
            {firstName}, your first week is done.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Here's what you built — and what's waiting for you in Week 2.
          </p>
        </div>

        {/* ── Stats ── */}
        <div>
          <p className="label-caps text-muted-foreground mb-3">Your 7-Day Results</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Utensils className="w-4 h-4" />}
              label="Meals Logged"
              value={mealsLogged}
              sub="with AI feedback"
            />
            <StatCard
              icon={<Dumbbell className="w-4 h-4" />}
              label="Workouts"
              value={workoutsLogged}
              sub="sessions tracked"
            />
            <StatCard
              icon={<Flame className="w-4 h-4" style={{ color: "#C89A3E" }} />}
              label="Day Streak"
              value={streak > 0 ? `${streak}🔥` : "—"}
              sub={streak > 0 ? "days in a row" : "start one today"}
            />
            <StatCard
              icon={<Trophy className="w-4 h-4" />}
              label="Avg Ascend Score"
              value={avgScore > 0 ? `${Math.round(avgScore)}` : "—"}
              sub={avgScore > 0 ? (
                avgScore >= 80 ? "excellent" : avgScore >= 60 ? "solid" : "room to grow"
              ) : "complete your nightly review"}
            />
          </div>
          {avgScore > 0 && (
            <div className="mt-3 rounded-xl overflow-hidden h-2 bg-elevated">
              <div
                className="h-full rounded-xl transition-all"
                style={{ width: `${Math.min(100, avgScore)}%`, background: scoreColor }}
              />
            </div>
          )}
        </div>

        {/* ── What Ascend Learned ── */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 7%) 100%)",
            border: "1px solid hsl(217 32% 14%)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="label-caps text-foreground" style={{ fontSize: "9px" }}>What Ascend Learned About You</p>
          </div>
          <div>
            <LearnedRow label="Primary Goal" value={goalLabel} />
            <LearnedRow label="Body Type" value={bodyTypeLabel} />
            <LearnedRow label="Fitness Level" value={profile?.fitnessLevel ?? "—"} />
            {plan?.calorieTarget && (
              <LearnedRow label="Daily Calorie Target" value={`${plan.calorieTarget.toLocaleString()} kcal`} />
            )}
            {plan?.proteinTargetG && (
              <LearnedRow label="Protein Target" value={`${plan.proteinTargetG}g / day`} />
            )}
            {keyHabits.length > 0 && (
              <LearnedRow label="Top Habit" value={keyHabits[0]} />
            )}
            {profile?.sport && profile.sport !== "none" && (
              <LearnedRow label="Sport" value={profile.sportCustom ?? profile.sport} />
            )}
          </div>
        </div>

        {/* ── Week 2 Plan Ready ── */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{
            background: "linear-gradient(145deg, rgba(59,130,246,0.10) 0%, rgba(45,212,191,0.06) 100%)",
            border: "1px solid rgba(59,130,246,0.30)",
            boxShadow: "0 0 32px rgba(59,130,246,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="label-caps text-primary" style={{ fontSize: "9px" }}>Week 2 Plan Ready</span>
          </div>
          <h2 className="text-[1.3rem] font-black tracking-tight leading-snug">
            Your Week 2 plan is ready.<br />Upgrade to keep your progress going.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ascend already knows your body, your habits, and where you struggled.
            Week 2 adjusts for that — refined meals, progressive workouts, stronger targets.
            Your progress stays. Your data stays. You just keep building.
          </p>
          <div className="space-y-2 pt-1">
            {[
              "Personalized Week 2 workout plan",
              "Adjusted calorie & macro targets",
              "Continued AI meal feedback",
              "Coach chat — ask anything",
              "Nightly review & weekly weigh-in adjustment",
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" strokeWidth={2.2} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
          <Link href="/pricing">
            <Button className="w-full mt-2 gap-2 font-bold" size="lg">
              Continue with Ascend Pro
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">7-day trial · Cancel anytime</p>
        </div>

        {/* ── Not ready ── */}
        <div className="text-center pb-2">
          <p className="text-xs text-muted-foreground mb-2">Not ready to commit? Your data stays safe.</p>
          <Link href="/dashboard">
            <button className="text-sm text-muted-foreground underline underline-offset-2">
              Back to Dashboard
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
