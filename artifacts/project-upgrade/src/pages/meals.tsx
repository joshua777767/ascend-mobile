import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTodayMeals, useListMeals, useCreateMeal, useGetUserProfile, getGetTodayMealsQueryKey, getListMealsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Utensils, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const QUALITY_STYLE: Record<string, string> = {
  good: "text-green-400 border-green-400/30 bg-green-400/5",
  neutral: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  bad: "text-red-400 border-red-400/30 bg-red-400/5",
};

const QUALITY_ICON: Record<string, any> = {
  good: CheckCircle,
  neutral: AlertCircle,
  bad: XCircle,
};

export default function MealsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: todayMeals, isLoading: loadingToday } = useGetTodayMeals();
  const { data: allMeals } = useListMeals();
  const createMeal = useCreateMeal();
  const [mealText, setMealText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const handleSubmit = async () => {
    if (!mealText.trim()) return;
    try {
      await createMeal.mutateAsync({ data: { description: mealText.trim() } });
      queryClient.invalidateQueries({ queryKey: getGetTodayMealsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMealsQueryKey() });
      setMealText("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Meal Check-In</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Log what you ate — get coach feedback</p>
      </div>

      <div className="mb-8 space-y-3">
        <Textarea
          value={mealText}
          onChange={e => setMealText(e.target.value)}
          placeholder="Describe what you ate. Be specific — 2 eggs, toast, coffee with milk..."
          className="bg-card border-border min-h-[100px] resize-none text-sm"
          data-testid="textarea-meal-description"
        />
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={createMeal.isPending || !mealText.trim()}
          data-testid="button-submit-meal"
        >
          {createMeal.isPending ? "Getting Coach Feedback..." : "Submit Meal"}
        </Button>
        {submitted && (
          <div className="bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Meal logged. Coach reviewed it below.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Today's Meals</h2>
        {loadingToday ? (
          <div className="space-y-3">
            {Array.from({length:2}).map((_,i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : todayMeals && todayMeals.length > 0 ? (
          <div className="space-y-4">
            {todayMeals.map((meal, i) => {
              const quality = meal.quality || "neutral";
              const colorClass = QUALITY_STYLE[quality] || QUALITY_STYLE.neutral;
              const Icon = QUALITY_ICON[quality] || AlertCircle;
              return (
                <div key={i} className={cn("border p-4 space-y-3", colorClass)} data-testid={`meal-card-${i}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        {new Date(meal.loggedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-sm font-medium">{meal.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">{quality}</span>
                    </div>
                  </div>
                  {meal.coachFeedback && (
                    <div className="pt-3 border-t border-current/20">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5">Coach Feedback</p>
                      <p className="text-sm">{meal.coachFeedback}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {meal.whatWasGood && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">What was good</p>
                        <p className="text-xs">{meal.whatWasGood}</p>
                      </div>
                    )}
                    {meal.whatWasBad && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">What was bad</p>
                        <p className="text-xs">{meal.whatWasBad}</p>
                      </div>
                    )}
                    {meal.whatToFixNext && (
                      <div>
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Fix next meal</p>
                        <p className="text-xs">{meal.whatToFixNext}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-border">
            <Utensils className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm uppercase tracking-wider">No meals logged today.</p>
            <p className="text-xs mt-1">Log your first meal above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
