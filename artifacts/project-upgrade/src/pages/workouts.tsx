import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayWorkout, useListWorkouts, useCreateWorkout,
  getListWorkoutsQueryKey
} from "@workspace/api-client-react";
import { useGetUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, Dumbbell, Clock, ChevronDown, ChevronUp } from "lucide-react";

export default function WorkoutsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: todayWorkout, isLoading: loadingToday } = useGetTodayWorkout();
  const { data: workouts, isLoading: loadingHistory } = useListWorkouts();
  const createWorkout = useCreateWorkout();
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const toggleExercise = (idx: number) => {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const logWorkout = async () => {
    if (!todayWorkout) return;
    try {
      await createWorkout.mutateAsync({
        data: {
          name: todayWorkout.name,
          type: todayWorkout.type,
          durationMinutes: 45,
          notes: `Completed ${completedExercises.size}/${todayWorkout.exercises.length} exercises`,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      setWorkoutLogged(true);
    } catch (e) { console.error(e); }
  };

  const allDone = todayWorkout && completedExercises.size === todayWorkout.exercises.length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Workout Planner</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {new Date().toLocaleDateString("en-US", { weekday: "long" })}
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Today's Workout</h2>
        {loadingToday ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : todayWorkout ? (
          <div className="space-y-3">
            <div className="bg-card border border-border p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold uppercase tracking-tight">{todayWorkout.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{todayWorkout.day} — {todayWorkout.type}</p>
              </div>
              <Badge variant="outline" className="text-xs uppercase tracking-wider border-primary/30 text-primary">
                {completedExercises.size}/{todayWorkout.exercises.length}
              </Badge>
            </div>

            {todayWorkout.exercises.map((ex, idx) => {
              const done = completedExercises.has(idx);
              const isExpanded = expanded[idx];
              return (
                <div
                  key={idx}
                  className={cn(
                    "border transition-all",
                    done ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                  )}
                  data-testid={`exercise-card-${idx}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className={cn("font-semibold text-sm uppercase tracking-tight", done && "line-through text-muted-foreground")}>
                          {ex.name}
                        </p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{ex.sets} sets × {ex.reps}</span>
                          <span>{ex.restSeconds}s rest</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`button-expand-${idx}`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => toggleExercise(idx)}
                          className={cn("transition-colors", done ? "text-primary" : "text-muted-foreground hover:text-primary")}
                          data-testid={`button-complete-exercise-${idx}`}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-primary font-medium uppercase tracking-wider mb-1">Coach Tip</p>
                        <p className="text-xs text-muted-foreground">{ex.coachTip}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!workoutLogged ? (
              <Button
                className="w-full"
                onClick={logWorkout}
                disabled={createWorkout.isPending || completedExercises.size === 0}
                data-testid="button-log-workout"
              >
                {createWorkout.isPending ? "Logging..." : allDone ? "Log Completed Workout" : `Log Workout (${completedExercises.size} exercises done)`}
              </Button>
            ) : (
              <div className="bg-primary/10 border border-primary/20 p-4 text-center">
                <p className="text-sm font-semibold text-primary uppercase tracking-wider">Workout Logged</p>
                <p className="text-xs text-muted-foreground mt-1">Good work. Rest and recover.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-border">
            <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm uppercase tracking-wider">Rest day or no plan yet.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Workouts</h2>
        {loadingHistory ? (
          <div className="space-y-2">
            {Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : workouts && workouts.length > 0 ? (
          <div className="space-y-2">
            {workouts.slice(-10).reverse().map((w, i) => (
              <div key={i} className="bg-card border border-border p-3 flex items-center justify-between" data-testid={`workout-history-${i}`}>
                <div>
                  <p className="text-sm font-medium uppercase tracking-tight">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(w.completedAt).toLocaleDateString()} — {w.durationMinutes} min</p>
                </div>
                <Badge variant="outline" className="text-xs uppercase tracking-wider">{w.type}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border border-border">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs uppercase tracking-wider">No workouts logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
