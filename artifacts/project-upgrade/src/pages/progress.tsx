import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProgressSummary, useGetMissionStreak, useListWeighIns, useCreateWeighIn,
  useListReviews, useGetUserProfile,
  getListWeighInsQueryKey, getGetProgressSummaryQueryKey, getGetMissionStreakQueryKey
} from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, CheckCircle, XCircle } from "lucide-react";

export default function ProgressPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isError: profileError } = useGetUserProfile();
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: streak } = useGetMissionStreak();
  const { data: weighIns, isLoading: loadingWeighIns } = useListWeighIns();
  const { data: reviews } = useListReviews();
  const createWeighIn = useCreateWeighIn();
  const [weight, setWeight] = useState("");
  const [weighNotes, setWeighNotes] = useState("");
  const [latestAdjustment, setLatestAdjustment] = useState<any>(null);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const handleWeighIn = async () => {
    if (!weight) return;
    try {
      const result = await createWeighIn.mutateAsync({ data: { weightKg: parseFloat(weight), notes: weighNotes } });
      queryClient.invalidateQueries({ queryKey: getListWeighInsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMissionStreakQueryKey() });
      setLatestAdjustment(result);
      setWeight("");
      setWeighNotes("");
    } catch (e) { console.error(e); }
  };

  const chartData = weighIns?.slice(-12).map((w, i) => ({
    week: `W${w.weekNumber}`,
    weight: w.weightKg,
  })) ?? [];

  const trend = weighIns && weighIns.length >= 2
    ? weighIns[weighIns.length - 1].weightKg - weighIns[weighIns.length - 2].weightKg
    : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Progress</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Track your transformation</p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Current Weight", value: `${summary.currentWeightKg}kg`, sub: `Goal: ${summary.goalWeightKg}kg` },
            { label: "Progress", value: `${Math.round(summary.progressPercent)}%`, sub: `${Math.abs(summary.currentWeightKg - summary.goalWeightKg).toFixed(1)}kg to go` },
            { label: "Avg Score", value: summary.avgDailyScore.toFixed(0), sub: "out of 100" },
            { label: "Workouts", value: summary.totalWorkouts, sub: "total logged" },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-border p-4 text-center" data-testid={`stat-${i}`}>
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {streak && (
        <div className="bg-card border border-primary/30 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Mission Streak</p>
            <p className="text-3xl font-bold text-primary mt-1">{streak.currentStreak} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Longest</p>
            <p className="text-xl font-bold">{streak.longestStreak} <span className="text-xs font-normal text-muted-foreground">days</span></p>
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight History</h2>
            {trend !== null && (
              <div className={cn("flex items-center gap-1 text-xs font-semibold", trend < 0 ? "text-green-400" : trend > 0 ? "text-red-400" : "text-muted-foreground")}>
                {trend < 0 ? <TrendingDown className="w-3 h-3" /> : trend > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {trend > 0 ? "+" : ""}{trend.toFixed(1)}kg last week
              </div>
            )}
          </div>
          <div className="bg-card border border-border p-4 h-48">
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weekly Weigh-In</h2>
        <div className="bg-card border border-border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="e.g. 79.5"
                className="bg-background border-border"
                data-testid="input-weigh-in"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Input
                value={weighNotes}
                onChange={e => setWeighNotes(e.target.value)}
                placeholder="How are you feeling?"
                className="bg-background border-border"
                data-testid="input-weigh-notes"
              />
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
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Coach Adjustment</p>
              <p className="text-sm font-medium">{latestAdjustment.adjustment}</p>
              <p className="text-sm text-muted-foreground">{latestAdjustment.coachMessage}</p>
            </div>
          )}
        </div>
      </div>

      {reviews && reviews.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Reviews</h2>
          <div className="space-y-3">
            {reviews.slice(-5).reverse().map((r, i) => (
              <div key={i} className="bg-card border border-border p-4 space-y-2" data-testid={`review-card-${i}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{r.date}</p>
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
  );
}
