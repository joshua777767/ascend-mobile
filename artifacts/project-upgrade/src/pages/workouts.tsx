import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayWorkout, useListWorkouts, useCreateWorkout,
  getListWorkoutsQueryKey
} from "@workspace/api-client-react";
import { useGetUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle, Dumbbell, Clock, ChevronDown, ChevronUp,
  Plus, Trash2, Settings2
} from "lucide-react";

const CUSTOM_MODE_KEY = "ascend.useCustomWorkouts";

interface CustomExercise {
  name: string;
  sets: string;
  reps: string;
  done: boolean;
}

export default function WorkoutsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: todayWorkout, isLoading: loadingToday } = useGetTodayWorkout();
  const { data: workouts, isLoading: loadingHistory } = useListWorkouts();
  const createWorkout = useCreateWorkout();

  // ─── Ascend-generated workout state ───────────────────────────────────────
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // ─── Custom workout mode ──────────────────────────────────────────────────
  const [useCustomWorkouts, setUseCustomWorkouts] = useState(
    () => localStorage.getItem(CUSTOM_MODE_KEY) === "true"
  );
  const [customWorkoutName, setCustomWorkoutName] = useState("");
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customWorkoutLogged, setCustomWorkoutLogged] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExSets, setNewExSets] = useState("");
  const [newExReps, setNewExReps] = useState("");

  // ─── Workout Settings panel ───────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  // ─── Mode toggle helpers ──────────────────────────────────────────────────
  const enableCustomMode = () => {
    localStorage.setItem(CUSTOM_MODE_KEY, "true");
    setUseCustomWorkouts(true);
    setCustomWorkoutName("");
    setCustomExercises([]);
    setCustomWorkoutLogged(false);
    setNewExName("");
    setNewExSets("");
    setNewExReps("");
  };

  const disableCustomMode = () => {
    localStorage.removeItem(CUSTOM_MODE_KEY);
    setUseCustomWorkouts(false);
    setWorkoutLogged(false);
    setCompletedExercises(new Set());
    setShowSettings(false);
  };

  // ─── Custom workout helpers ───────────────────────────────────────────────
  const addCustomExercise = () => {
    if (!newExName.trim()) return;
    setCustomExercises(prev => [
      ...prev,
      { name: newExName.trim(), sets: newExSets.trim() || "3", reps: newExReps.trim() || "10", done: false },
    ]);
    setNewExName("");
    setNewExSets("");
    setNewExReps("");
  };

  const toggleCustomExercise = (idx: number) => {
    setCustomExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, done: !ex.done } : ex));
  };

  const removeCustomExercise = (idx: number) => {
    setCustomExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const logCustomWorkout = async () => {
    const name = customWorkoutName.trim() || "Custom Workout";
    const done = customExercises.filter(e => e.done).length;
    const total = customExercises.length;
    try {
      await createWorkout.mutateAsync({
        data: {
          name,
          type: "Custom",
          durationMinutes: 45,
          notes: total > 0
            ? `Completed ${done}/${total} exercises: ${customExercises.map(e => e.name).join(", ")}`
            : "Custom workout logged",
        },
      });
      queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      setCustomWorkoutLogged(true);
    } catch (e) { console.error(e); }
  };

  // ─── Ascend workout helpers ───────────────────────────────────────────────
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
        },
      });
      queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      setWorkoutLogged(true);
    } catch (e) { console.error(e); }
  };

  const allDone = todayWorkout && completedExercises.size === todayWorkout.exercises.length;

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <h1 className="text-2xl font-bold mt-0.5">Workout Planner</h1>
        </div>

        {/* Today's workout */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Today's workout</p>

          {useCustomWorkouts ? (
            /* ══════════════ Custom Workout Tracker ══════════════ */
            <div className="space-y-3">
              <div className="bg-card border border-primary/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary">Your Plan</p>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {customExercises.filter(e => e.done).length}/{customExercises.length} done
                  </Badge>
                </div>

                <Input
                  placeholder="Workout name (e.g. Upper Body, Leg Day)"
                  value={customWorkoutName}
                  onChange={e => setCustomWorkoutName(e.target.value)}
                  disabled={customWorkoutLogged}
                />

                {/* Exercise list */}
                {customExercises.length > 0 && (
                  <div className="space-y-2">
                    {customExercises.map((ex, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "border p-3 flex items-center gap-3 transition-all",
                          ex.done ? "border-primary/40 bg-primary/5" : "border-border"
                        )}
                      >
                        <button
                          onClick={() => toggleCustomExercise(idx)}
                          disabled={customWorkoutLogged}
                          className={cn(
                            "shrink-0 transition-colors",
                            ex.done ? "text-primary" : "text-muted-foreground hover:text-primary"
                          )}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", ex.done && "line-through text-muted-foreground")}>
                            {ex.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{ex.sets} sets × {ex.reps} reps</p>
                        </div>
                        {!customWorkoutLogged && (
                          <button
                            onClick={() => removeCustomExercise(idx)}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add exercise form */}
                {!customWorkoutLogged && (
                  <div className="border border-dashed border-border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Add exercise</p>
                    <Input
                      placeholder="Exercise name"
                      value={newExName}
                      onChange={e => setNewExName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addCustomExercise(); }}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Sets"
                        value={newExSets}
                        onChange={e => setNewExSets(e.target.value)}
                        className="w-20"
                        type="number"
                        min="1"
                      />
                      <Input
                        placeholder="Reps"
                        value={newExReps}
                        onChange={e => setNewExReps(e.target.value)}
                        className="w-20"
                        type="number"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCustomExercise}
                        disabled={!newExName.trim()}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {!customWorkoutLogged ? (
                <Button
                  className="w-full"
                  onClick={logCustomWorkout}
                  disabled={createWorkout.isPending}
                  data-testid="button-log-custom-workout"
                >
                  {createWorkout.isPending ? "Logging..." : "Log Workout"}
                </Button>
              ) : (
                <div className="bg-success/10 border border-success/20 p-4 text-center">
                  <p className="text-sm font-semibold text-success">Workout Logged</p>
                  <p className="text-xs text-muted-foreground mt-1">Good work. Rest and recover.</p>
                </div>
              )}
            </div>

          ) : (
            /* ══════════════ Ascend Generated Workout ══════════════ */
            loadingToday ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : todayWorkout ? (
              <div className="space-y-3">
                <div className="bg-card border border-border p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{todayWorkout.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{todayWorkout.day} — {todayWorkout.type}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
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
                            <p className={cn("font-semibold text-sm", done && "line-through text-muted-foreground")}>
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
                            <p className="text-xs text-primary font-medium mb-1">Coach Tip</p>
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
                    {createWorkout.isPending ? "Logging..." : allDone ? "Log Completed Workout" : `Log Workout (${completedExercises.size} done)`}
                  </Button>
                ) : (
                  <div className="bg-success/10 border border-success/20 p-4 text-center">
                    <p className="text-sm font-semibold text-success">Workout Logged</p>
                    <p className="text-xs text-muted-foreground mt-1">Good work. Rest and recover.</p>
                  </div>
                )}

                {/* Opt out of Ascend plan */}
                <button
                  onClick={enableCustomMode}
                  className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/50 py-3 transition-colors"
                  data-testid="button-use-own-plan"
                >
                  I use my own workout plan
                </button>
              </div>
            ) : (
              /* Rest day / no plan yet */
              <div className="text-center py-12 text-muted-foreground border border-border space-y-3">
                <Dumbbell className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Rest day or no plan yet.</p>
                <button
                  onClick={enableCustomMode}
                  className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/50 py-2 px-4 transition-colors"
                  data-testid="button-use-own-plan-rest"
                >
                  I use my own workout plan
                </button>
              </div>
            )
          )}
        </div>

        {/* Recent Workouts */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Recent Workouts</p>
          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : workouts && workouts.length > 0 ? (
            <div className="space-y-2">
              {workouts.slice(-10).reverse().map((w, i) => (
                <div key={i} className="bg-card border border-border p-3 flex items-center justify-between" data-testid={`workout-history-${i}`}>
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(w.completedAt).toLocaleDateString()} — {w.durationMinutes} min</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{w.type}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border border-border">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No workouts logged yet.</p>
            </div>
          )}
        </div>

        {/* Workout Settings */}
        <div className="mt-8 pt-5 border-t border-border/50">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-workout-settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Workout Settings
            {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showSettings && (
            <div className="mt-3 bg-card border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Workout Plan Source</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {useCustomWorkouts
                      ? "Using your own workout plan"
                      : "Using Ascend-generated workouts"}
                  </p>
                </div>
                {useCustomWorkouts ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disableCustomMode}
                    data-testid="button-use-ascend-workouts"
                  >
                    Use Ascend workouts again
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={enableCustomMode}
                    data-testid="button-use-own-plan-settings"
                  >
                    Use my own plan
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
