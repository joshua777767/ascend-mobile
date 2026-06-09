import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProgressSummary, useGetMissionStreak, useListWeighIns, useCreateWeighIn,
  useListReviews, useGetUserProfile, useUpdateGoal,
  useListGoalCheckIns, useCreateGoalCheckIn,
  useGetMilestones,
  getListWeighInsQueryKey, getGetProgressSummaryQueryKey, getGetMissionStreakQueryKey,
  getGetUserProfileQueryKey, getListGoalCheckInsQueryKey
} from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, CheckCircle, XCircle, Trophy, ArrowRight, Target, Sparkles, Star, Medal, Lock } from "lucide-react";

export default function ProgressPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: streak } = useGetMissionStreak();
  const { data: weighIns, isLoading: loadingWeighIns } = useListWeighIns();
  const { data: reviews } = useListReviews();
  const { data: goalCheckIns } = useListGoalCheckIns();
  const { data: milestonesData } = useGetMilestones();
  const createWeighIn = useCreateWeighIn();
  const createGoalCheckIn = useCreateGoalCheckIn();
  const updateGoal = useUpdateGoal();
  const [weight, setWeight] = useState("");
  const [weighNotes, setWeighNotes] = useState("");
  const [weighEffort, setWeighEffort] = useState("");
  const [latestAdjustment, setLatestAdjustment] = useState<any>(null);
  const [newGoal, setNewGoal] = useState("");
  const [showGoalSet, setShowGoalSet] = useState(false);
  const [activeGoal, setActiveGoal] = useState<string>("");
  const [goalScore, setGoalScore] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalTrend, setGoalTrend] = useState("");
  const [goalWhatHelped, setGoalWhatHelped] = useState("");
  const [goalWhatHardened, setGoalWhatHardened] = useState("");
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null);
  const [completedGoals, setCompletedGoals] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascend.completedGoals") ?? "[]") as string[]; }
    catch { return []; }
  });

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const kgToLbs = (kg: number) => kg * 2.2046226;
  const lbsToKg = (lbs: number) => lbs / 2.2046226;

  const handleWeighIn = async () => {
    if (!weight) return;
    try {
      const notesWithEffort = weighEffort
        ? `Effort: ${weighEffort}${weighNotes ? ` | ${weighNotes}` : ""}`
        : weighNotes;
      const result = await createWeighIn.mutateAsync({ data: { weightKg: lbsToKg(parseFloat(weight)), notes: notesWithEffort } });
      queryClient.invalidateQueries({ queryKey: getListWeighInsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMissionStreakQueryKey() });
      setLatestAdjustment(result);
      setWeight("");
      setWeighNotes("");
      setWeighEffort("");
    } catch (e) { console.error(e); }
  };

  const handleSetNewGoal = async () => {
    if (!newGoal) return;
    const goalKg = lbsToKg(parseFloat(newGoal));
    try {
      await updateGoal.mutateAsync({ data: { goalWeightKg: goalKg, goals: ["fat loss"] } });
      queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      setNewGoal("");
      setShowGoalSet(false);
    } catch (e) { console.error(e); }
  };

  function getTrendQuestion(goal: string): string {
    if (goal === "better skin") return "Is your skin better, same, or worse than last week?";
    if (goal === "higher energy") return "Is your energy better, same, or worse than last week?";
    if (goal === "better sleep") return "Is your sleep better, same, or worse than last week?";
    if (goal === "discipline") return "Were you more or less consistent than last week?";
    if (["lose fat", "lose weight", "build muscle", "gain weight"].includes(goal))
      return "Did this week feel easier, same, or harder?";
    return "Is your progress better, same, or worse than last week?";
  }

  function handleConfirmGoalComplete(goal: string) {
    const updated = [...completedGoals, goal];
    setCompletedGoals(updated);
    try { localStorage.setItem("ascend.completedGoals", JSON.stringify(updated)); } catch {}
    setActiveCheckIn(null);
  }

  function handleNextPhase(phase: string, goal: string) {
    const updated = completedGoals.filter(g => g !== goal);
    setCompletedGoals(updated);
    try { localStorage.setItem("ascend.completedGoals", JSON.stringify(updated)); } catch {}
    if (phase === "new_goal" || phase === "level_up") setLocation("/settings");
    else if (phase === "challenge") setLocation("/coach");
  }

  const handleGoalCheckIn = async () => {
    if (!activeGoal || !goalScore) return;
    try {
      const result = await createGoalCheckIn.mutateAsync({
        data: {
          goal: activeGoal,
          score: parseInt(goalScore),
          notes: goalNotes || undefined,
          trend: (goalTrend as any) || undefined,
          whatHelped: goalWhatHelped || undefined,
          whatHardened: goalWhatHardened || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListGoalCheckInsQueryKey() });
      setActiveCheckIn(result);
      setActiveGoal("");
      setGoalScore("");
      setGoalNotes("");
      setGoalTrend("");
      setGoalWhatHelped("");
      setGoalWhatHardened("");
    } catch (e) { console.error(e); }
  };

  const userGoals = (profile as any)?.goals ?? [];
  const checkInsByGoal = (goalCheckIns ?? []).reduce((acc, c) => {
    if (!acc[c.goal]) acc[c.goal] = [];
    acc[c.goal].push(c);
    return acc;
  }, {} as Record<string, any[]>);
  const latestByGoal = Object.fromEntries(
    Object.entries(checkInsByGoal).map(([g, arr]) => [g, arr[0]])
  );

  const chartData = weighIns?.slice(-12).map((w) => ({
    week: `W${w.weekNumber}`,
    weight: Math.round(kgToLbs(w.weightKg) * 10) / 10,
  })) ?? [];

  const trend = weighIns && weighIns.length >= 2
    ? kgToLbs(weighIns[weighIns.length - 1].weightKg - weighIns[weighIns.length - 2].weightKg)
    : null;

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Track Your Transformation</p>
          <h1 className="text-2xl font-bold uppercase tracking-tighter mt-0.5">Progress</h1>
        </div>

        {completedGoals.map(cGoal => (
          <div key={cGoal} className="bg-primary/10 border border-primary/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <p className="text-lg font-bold text-primary capitalize">Goal Complete — {cGoal}</p>
            </div>
            <p className="text-sm text-muted-foreground">Choose your next phase:</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "maintain", label: "Maintain" },
                { key: "level_up", label: "Level Up" },
                { key: "new_goal", label: "New Goal" },
                { key: "challenge", label: "Challenge Mode" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleNextPhase(key, cGoal)}
                  className="h-10 rounded-xl border border-border text-sm font-semibold bg-card text-foreground active:scale-[0.98] transition-transform"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {summary?.goalReached && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6 text-primary" strokeWidth={2} />
              <p className="text-lg font-bold text-primary tracking-tight">Goal Reached</p>
            </div>
            <p className="text-sm text-muted-foreground">
              You hit your target of {Math.round(kgToLbs(summary.goalWeightKg))} lbs.
              {summary.goalReachedAt && ` Reached on ${new Date(summary.goalReachedAt).toLocaleDateString()}.`}
            </p>
            {!showGoalSet ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGoalSet(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground h-11 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
                >
                  <Target className="w-4 h-4" />
                  Set a new goal
                </button>
                <Link
                  href="/coach"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-card border border-border text-foreground h-11 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
                >
                  <ArrowRight className="w-4 h-4" />
                  Talk to Coach
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={newGoal}
                    onChange={e => setNewGoal(e.target.value)}
                    placeholder="New goal weight (lbs)"
                    className="bg-background border-border flex-1"
                  />
                  <Button onClick={handleSetNewGoal} disabled={updateGoal.isPending || !newGoal}>
                    {updateGoal.isPending ? "Saving..." : "Set Goal"}
                  </Button>
                </div>
                <button onClick={() => setShowGoalSet(false)} className="text-xs text-muted-foreground">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {loadingSummary ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Current Weight", value: `${Math.round(kgToLbs(summary.currentWeightKg))} lbs`, sub: `Goal: ${Math.round(kgToLbs(summary.goalWeightKg))} lbs` },
              { label: "Total Change", value: `${(summary.totalLbsChange ?? 0) > 0 ? "+" : ""}${summary.totalLbsChange ?? 0} lbs`, sub: `Started at ${Math.round(kgToLbs(summary.startWeightKg))} lbs` },
              { label: "Avg Score", value: summary.avgDailyScore.toFixed(0), sub: "out of 100" },
              { label: "Workouts", value: summary.totalWorkouts, sub: "total logged" },
            ].map((stat, i) => (
              <div key={i} className="bg-card border border-border p-4 text-center" data-testid={`stat-${i}`}>
                <p className={`text-2xl font-bold ${stat.label === "Total Change" && (summary.totalLbsChange ?? 0) < 0 ? "text-green-400" : stat.label === "Total Change" && (summary.totalLbsChange ?? 0) > 0 ? "text-red-400" : "text-primary"}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {streak && (
          <div className="bg-card border border-primary/30 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Mission Streak</p>
              <p className="text-3xl font-bold text-primary mt-1">{streak.currentStreak} <span className="text-sm font-normal text-muted-foreground">days</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Longest</p>
              <p className="text-xl font-bold mt-1">{streak.longestStreak} <span className="text-xs font-normal text-muted-foreground">days</span></p>
            </div>
          </div>
        )}

        {chartData.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Weight History</p>
              {trend !== null && (
                <div className={cn("flex items-center gap-1 text-xs font-semibold", trend < 0 ? "text-green-400" : trend > 0 ? "text-red-400" : "text-muted-foreground")}>
                  {trend < 0 ? <TrendingDown className="w-3 h-3" /> : trend > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {trend > 0 ? "+" : ""}{trend.toFixed(1)} lbs last week
                </div>
              )}
            </div>
            <div className="bg-card border border-border p-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={["auto","auto"]} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, fontSize: 11 }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Weekly Weigh-In</p>
          <div className="bg-card border border-border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Weight (lbs)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="e.g. 200"
                  className="bg-background border-border"
                  data-testid="input-weigh-in"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                <Input
                  value={weighNotes}
                  onChange={e => setWeighNotes(e.target.value)}
                  placeholder="How are you feeling?"
                  className="bg-background border-border"
                  data-testid="input-weigh-notes"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Did this week feel easier, same, or harder?</Label>
              <div className="flex gap-2">
                {(["easier", "same", "harder"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setWeighEffort(weighEffort === e ? "" : e)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors",
                      weighEffort === e
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-muted-foreground"
                    )}
                  >
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleWeighIn}
              disabled={createWeighIn.isPending || !weight}
              data-testid="button-submit-weigh-in"
            >
              {createWeighIn.isPending ? "Analyzing..." : "Submit Weigh-In"}
            </Button>

            {latestAdjustment && (
              <div className="border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Coach Adjustment</p>
                <p className="text-sm font-medium">{latestAdjustment.adjustment}</p>
                <p className="text-sm text-muted-foreground">{latestAdjustment.coachMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Goal Check-Ins */}
        {userGoals.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Goal Check-Ins</p>
            <div className="space-y-3">
              {userGoals.map((goal: string) => {
                const latest = latestByGoal[goal];
                const isActive = activeGoal === goal;
                return (
                  <div key={goal} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold capitalize">{goal}</p>
                      </div>
                      {latest && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-primary" />
                          <span className="text-sm font-bold text-primary">{latest.score}/10</span>
                        </div>
                      )}
                    </div>
                    {latest && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">Week {latest.weekNumber}</p>
                          {latest.trend && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                              latest.trend === "better" ? "bg-green-500/15 text-green-400" :
                              latest.trend === "worse" ? "bg-red-500/15 text-red-400" :
                              "bg-muted/30 text-muted-foreground"
                            )}>
                              {latest.trend === "better" ? "↑ Better" : latest.trend === "worse" ? "↓ Worse" : "→ Same"}
                            </span>
                          )}
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ml-auto",
                            latest.status === "achieved" || latest.status === "needs_confirmation" || latest.status === "goal_complete" ? "bg-green-500/15 text-green-400" :
                            latest.status === "plateau" ? "bg-orange-500/15 text-orange-400" :
                            "bg-muted/30 text-muted-foreground"
                          )}>
                            {latest.status === "needs_confirmation" ? "★ Goal complete?" : latest.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm">{latest.coachFeedback}</p>
                      </div>
                    )}
                    {!isActive ? (
                      <button
                        onClick={() => setActiveGoal(goal)}
                        className="w-full h-10 rounded-xl bg-elevated border border-border text-sm font-semibold text-foreground active:scale-[0.99] transition-transform"
                      >
                        {latest ? "Check in again" : "Check in"}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{getTrendQuestion(goal)}</Label>
                          <div className="flex gap-2">
                            {(["better", "same", "worse"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setGoalTrend(goalTrend === t ? "" : t)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors",
                                  goalTrend === t
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background border border-border text-muted-foreground"
                                )}
                              >
                                {t === "better" ? "↑ Better" : t === "worse" ? "↓ Worse" : "→ Same"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rate this week (1–10)</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={goalScore || "5"}
                              onChange={e => setGoalScore(e.target.value)}
                              className="flex-1 accent-primary"
                            />
                            <span className="text-sm font-bold w-8 text-center">{goalScore || "5"}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">What helped?</Label>
                          <Input
                            value={goalWhatHelped}
                            onChange={e => setGoalWhatHelped(e.target.value)}
                            placeholder="e.g. stayed consistent with water"
                            className="bg-background border-border text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">What made it harder?</Label>
                          <Input
                            value={goalWhatHardened}
                            onChange={e => setGoalWhatHardened(e.target.value)}
                            placeholder="e.g. stress, late nights"
                            className="bg-background border-border text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={handleGoalCheckIn}
                            disabled={createGoalCheckIn.isPending || !goalScore}
                          >
                            {createGoalCheckIn.isPending ? "Submitting..." : "Submit Check-In"}
                          </Button>
                          <button
                            onClick={() => { setActiveGoal(""); setGoalScore(""); setGoalNotes(""); setGoalTrend(""); setGoalWhatHelped(""); setGoalWhatHardened(""); }}
                            className="px-4 h-10 rounded-xl text-sm text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {activeCheckIn?.goal === goal && (
                      <div className="space-y-2">
                        <div className="border border-primary/20 bg-primary/5 rounded-xl p-3">
                          <p className="text-xs font-semibold text-primary">Coach Feedback</p>
                          <p className="text-sm mt-1">{activeCheckIn.coachFeedback}</p>
                        </div>
                        {activeCheckIn.status === "needs_confirmation" && !completedGoals.includes(goal) && (
                          <div className="border border-primary/40 bg-primary/5 rounded-xl p-3 space-y-2">
                            <p className="text-sm font-bold text-primary">🏆 Do you feel your {goal} goal is complete?</p>
                            <p className="text-xs text-muted-foreground">You've rated this goal 9–10 two weeks in a row.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleConfirmGoalComplete(goal)}
                                className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                              >
                                Yes, goal complete
                              </button>
                              <button
                                onClick={() => setActiveCheckIn(null)}
                                className="flex-1 h-8 rounded-lg border border-border text-xs text-muted-foreground"
                              >
                                Not yet
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Milestone Badges ── */}
        {milestonesData?.milestones && milestonesData.milestones.some(m => m.unlockedAt) && (() => {
          const unlocked = milestonesData.milestones.filter(m => m.unlockedAt);
          const locked = milestonesData.milestones.filter(m => !m.unlockedAt).slice(0, 4);
          const categoryColor: Record<string, string> = {
            streak: "text-amber-400 bg-amber-500/15",
            weight: "text-green-400 bg-green-500/15",
            meals: "text-blue-400 bg-blue-500/15",
            consistency: "text-purple-400 bg-purple-500/15",
          };
          const categoryIcon: Record<string, string> = {
            streak: "🔥", weight: "⚖️", meals: "🥗", consistency: "📓",
          };
          return (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Medal className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Milestones</p>
                <span className="ml-auto text-[10px] font-bold text-primary">{unlocked.length} unlocked</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {unlocked.map(m => (
                  <div
                    key={m.id}
                    title={m.description}
                    className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold", categoryColor[m.category] ?? "text-primary bg-primary/15")}
                  >
                    <span>{categoryIcon[m.category] ?? "🏅"}</span>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              {locked.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Next up</p>
                  <div className="flex flex-wrap gap-2">
                    {locked.map(m => (
                      <div
                        key={m.id}
                        title={m.description}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-muted/20 text-muted-foreground border border-border/50"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {reviews && reviews.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Recent Reviews</p>
            <div className="space-y-3">
              {reviews.slice(-5).reverse().map((r, i) => (
                <div key={i} className="bg-card border border-border p-4 space-y-2" data-testid={`review-card-${i}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.date}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-primary">{r.dailyScore}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                      {r.onPace
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>
                  <p className="text-sm">{r.strictCoachMessage}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
