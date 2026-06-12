import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWeeklyReview,
  useCreateWeighIn,
  getListWeighInsQueryKey,
  getGetWeeklyReviewQueryKey,
} from "@workspace/api-client-react";

import { cn } from "@/lib/utils";
import { X, TrendingDown, TrendingUp, Minus, Calendar, Flame, BarChart3, Target, Sparkles, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const lbsToKg = (lbs: number) => lbs / 2.2046226;

export function WeeklyReviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: review, isLoading } = useGetWeeklyReview(
    { query: { queryKey: getGetWeeklyReviewQueryKey(), enabled: open } },
  );
  const [weight, setWeight] = useState("");
  const createWeighIn = useCreateWeighIn();
  const queryClient = useQueryClient();

  const handleWeighIn = async () => {
    if (!weight) return;
    try {
      await createWeighIn.mutateAsync({
        data: { weightKg: lbsToKg(parseFloat(weight)), notes: "Weekly review weigh-in" },
      });
      queryClient.invalidateQueries({ queryKey: getListWeighInsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWeeklyReviewQueryKey() });
      setWeight("");
      toast({
        title: "Weigh-in logged",
        description: "Your weekly review is updated.",
        className: "ascend-toast-success",
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't save weigh-in. Try again.", variant: "destructive" });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weekly Review</p>
            <h2 className="text-lg font-bold mt-0.5">
              {isLoading ? "Loading..." : review ? `Week ${review.weekNumber}` : "No review yet"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-4">
            <div className="h-8 rounded-lg bg-elevated animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl bg-elevated animate-pulse" />
              <div className="h-20 rounded-xl bg-elevated animate-pulse" />
            </div>
          </div>
        ) : !review ? (
          <div className="p-5 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No weekly review available yet. Log your first weigh-in and check back in a week.</p>
            <div className="space-y-2">
              <input
                type="number"
                step="0.1"
                placeholder="Current weight (lbs)"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm text-foreground"
              />
              <button
                onClick={handleWeighIn}
                disabled={createWeighIn.isPending || !weight}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                {createWeighIn.isPending ? "Saving..." : "Log Weigh-In"}
              </button>
            </div>
            <button onClick={onClose} className="text-xs text-muted-foreground">
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Weight change */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: review.weightChangeLbs < 0 ? "rgba(16,185,129,0.12)" : review.weightChangeLbs > 0 ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.12)" }}>
                {review.weightChangeLbs < 0 ? (
                  <TrendingDown className="w-6 h-6 text-green-400" />
                ) : review.weightChangeLbs > 0 ? (
                  <TrendingUp className="w-6 h-6 text-red-400" />
                ) : (
                  <Minus className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold">
                  {review.weightChangeLbs > 0 ? "+" : ""}{review.weightChangeLbs.toFixed(1)} lbs this week
                </p>
                <p className="text-xs text-muted-foreground">
                  {review.weightChangeLbs < 0 ? "Moving in the right direction" : review.weightChangeLbs > 0 ? "Review your intake — coach is watching" : "Flat week — check the consistency"}
                </p>
              </div>
            </div>

            {/* Consistency grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Consistency</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Calories", value: review.calorieConsistency, color: "#3B82F6" },
                  { label: "Protein", value: review.proteinConsistency, color: "#10B981" },
                  { label: "Water", value: review.waterConsistency, color: "#06B6D4" },
                  { label: "Workouts", value: review.workoutConsistency, color: "#F59E0B" },
                ].map((item) => (
                  <div key={item.label} className="bg-elevated rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
                      <span className="text-xs font-bold">{item.value}/7</span>
                    </div>
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(item.value / 7) * 100}%`, background: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Streak summary */}
            <div className="flex items-center gap-3 bg-elevated rounded-xl p-3">
              <Flame className="w-5 h-5 text-amber-400" />
              <p className="text-sm font-semibold">{review.streakSummary}</p>
            </div>

            {/* Goal pace & predictor */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Goal Pace</p>
              </div>
              <div className="bg-elevated rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">{review.goalPace}</p>
                {review.estimatedGoalDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Estimated goal date: {review.estimatedGoalDate}</span>
                  </div>
                )}
                {review.currentPace != null && (
                  <p className="text-xs text-muted-foreground">
                    Current pace: {review.currentPace > 0 ? "+" : ""}{review.currentPace.toFixed(2)} lbs/week
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full",
                    review.status === "ahead" ? "bg-green-500/15 text-green-400" :
                    review.status === "on_track" ? "bg-blue-500/15 text-blue-400" :
                    "bg-amber-500/15 text-amber-400"
                  )}>
                    {review.status === "ahead" ? "Ahead of Pace" : review.status === "on_track" ? "On Track" : "Behind Pace"}
                  </span>
                </div>
              </div>
            </div>

            {/* What to improve */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Focus This Week</p>
              </div>
              <div className="bg-elevated rounded-xl p-4">
                <p className="text-sm font-medium">{review.whatToImprove}</p>
              </div>
            </div>

            {/* Coach message */}
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Coach Message</p>
              <p className="text-sm leading-relaxed">{review.coachMessage}</p>
            </div>

            {/* CTA */}
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Got it — back to the mission
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
