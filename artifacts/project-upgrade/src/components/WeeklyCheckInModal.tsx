import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useCreateGoalCheckIn,
  useCreateWeighIn,
  getListGoalCheckInsQueryKey,
  getListWeighInsQueryKey,
  getGetProgressSummaryQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Trophy,
  Sparkles,
  Star,
  CheckCircle,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const LOSE_FAT_GOALS = ["lose fat", "lose weight"];
const BUILD_MUSCLE_GOALS = ["build muscle", "gain weight"];

// ── Types ─────────────────────────────────────────────────────────────────────
interface GoalAnswers {
  score: string;
  trend: string;
  whatHelped: string;
  whatHardened: string;
  weight: string;
  mealsLogged: string;
  workoutsCompleted: string;
  avgSleepHours: string;
  missionPercent: string;
  // lose-fat specific
  stepsCardio: string;
  caloriesCravingsStruggle: string;
  // build-muscle specific
  proteinConsistency: string;
  strengthProgress: string;
  recoverySoreness: string;
}

interface CheckInResult {
  goal: string;
  score: number;
  coachFeedback?: string | null;
  status?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  goals: string[];
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function TrendButtons({
  value,
  onChange,
  labels = ["↑ Better", "→ Same", "↓ Worse"],
}: {
  value: string;
  onChange: (v: string) => void;
  labels?: string[];
}) {
  const options = ["better", "same", "worse"];
  return (
    <div className="flex gap-2">
      {options.map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(value === t ? "" : t)}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors",
            value === t
              ? "bg-primary text-primary-foreground"
              : "bg-background border border-border text-muted-foreground"
          )}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="10"
          value={value || "5"}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 accent-primary"
        />
        <span className="text-sm font-bold w-10 text-center text-primary">
          {value || "5"}/10
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-background border-border text-sm"
        step={type === "number" ? "0.1" : undefined}
        min={type === "number" ? "0" : undefined}
      />
    </div>
  );
}

// ── Goal-specific forms ───────────────────────────────────────────────────────
function LoseFatGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <Field
        label="Current weight (lbs)"
        type="number"
        value={ans.weight}
        onChange={(v) => update("weight", v)}
        placeholder="e.g. 185"
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Did this week feel easier, same, or harder?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="Meals logged this week"
        type="number"
        value={ans.mealsLogged}
        onChange={(v) => update("mealsLogged", v)}
        placeholder="0–21"
      />
      <Field
        label="Steps / cardio consistency"
        value={ans.stepsCardio}
        onChange={(v) => update("stepsCardio", v)}
        placeholder="e.g. 8k steps daily, 3 cardio sessions"
      />
      <Field
        label="Biggest struggle with calories or cravings"
        value={ans.caloriesCravingsStruggle}
        onChange={(v) => update("caloriesCravingsStruggle", v)}
        placeholder="e.g. late-night snacking, office donuts"
      />
    </>
  );
}

function BuildMuscleGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <Field
        label="Current weight (lbs)"
        type="number"
        value={ans.weight}
        onChange={(v) => update("weight", v)}
        placeholder="e.g. 185"
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Is your progress better, same, or worse than last week?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="Workouts completed"
        type="number"
        value={ans.workoutsCompleted}
        onChange={(v) => update("workoutsCompleted", v)}
        placeholder="0–7"
      />
      <Field
        label="Protein consistency"
        value={ans.proteinConsistency}
        onChange={(v) => update("proteinConsistency", v)}
        placeholder="e.g. hit protein goal 5/7 days"
      />
      <Field
        label="Strength progress: did you add reps or weight?"
        value={ans.strengthProgress}
        onChange={(v) => update("strengthProgress", v)}
        placeholder="e.g. +5 lbs on bench, +2 reps on pull-ups"
      />
      <Field
        label="Recovery / soreness"
        value={ans.recoverySoreness}
        onChange={(v) => update("recoverySoreness", v)}
        placeholder="e.g. DOMS day 1, fine by day 3"
      />
    </>
  );
}

function SkinGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <ScoreSlider
        label="Skin rating this week (1–10)"
        value={ans.score}
        onChange={(v) => update("score", v)}
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Is your skin better, same, or worse than last week?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="What helped your skin this week?"
        value={ans.whatHelped}
        onChange={(v) => update("whatHelped", v)}
        placeholder="e.g. extra water, less sugar, 8h sleep"
      />
      <Field
        label="What made it worse?"
        value={ans.whatHardened}
        onChange={(v) => update("whatHardened", v)}
        placeholder="e.g. stress, dairy, late nights"
      />
    </>
  );
}

function EnergyGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <ScoreSlider
        label="Energy rating this week (1–10)"
        value={ans.score}
        onChange={(v) => update("score", v)}
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Is your energy better, same, or worse than last week?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="What's been consistent? (sleep, water, food)"
        value={ans.whatHelped}
        onChange={(v) => update("whatHelped", v)}
        placeholder="e.g. 8h sleep, 3L water"
      />
      <Field
        label="What drained your energy most?"
        value={ans.whatHardened}
        onChange={(v) => update("whatHardened", v)}
        placeholder="e.g. late nights, missed meals"
      />
    </>
  );
}

function SleepGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <ScoreSlider
        label="Sleep quality this week (1–10)"
        value={ans.score}
        onChange={(v) => update("score", v)}
      />
      <Field
        label="Average hours of sleep per night"
        type="number"
        value={ans.avgSleepHours}
        onChange={(v) => update("avgSleepHours", v)}
        placeholder="e.g. 7.5"
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          How was your bedtime consistency?
        </Label>
        <TrendButtons
          value={ans.trend}
          onChange={(v) => update("trend", v)}
          labels={["↑ Better", "→ Same", "↓ Worse"]}
        />
      </div>
      <Field
        label="What hurt your sleep this week?"
        value={ans.whatHardened}
        onChange={(v) => update("whatHardened", v)}
        placeholder="e.g. screen time, stress, late caffeine"
      />
    </>
  );
}

function DisciplineGoalForm({
  ans,
  update,
}: {
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  const pct = parseInt(ans.missionPercent || "50");
  return (
    <>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Mission completion this week
        </Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={ans.missionPercent || "50"}
            onChange={(e) => update("missionPercent", e.target.value)}
            className="flex-1 accent-primary"
          />
          <span className="text-sm font-bold w-12 text-center text-primary">
            {pct}%
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Were you more or less consistent than last week?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="What made consistency hard?"
        value={ans.whatHardened}
        onChange={(v) => update("whatHardened", v)}
        placeholder="e.g. busy schedule, low motivation"
      />
      <Field
        label="What helped you stay on track?"
        value={ans.whatHelped}
        onChange={(v) => update("whatHelped", v)}
        placeholder="e.g. morning routine, accountability"
      />
    </>
  );
}

function GenericGoalForm({
  goal,
  ans,
  update,
}: {
  goal: string;
  ans: GoalAnswers;
  update: (k: keyof GoalAnswers, v: string) => void;
}) {
  return (
    <>
      <ScoreSlider
        label={`Rate your progress on "${goal}" (1–10)`}
        value={ans.score}
        onChange={(v) => update("score", v)}
      />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Is your progress better, same, or worse than last week?
        </Label>
        <TrendButtons value={ans.trend} onChange={(v) => update("trend", v)} />
      </div>
      <Field
        label="What helped?"
        value={ans.whatHelped}
        onChange={(v) => update("whatHelped", v)}
        placeholder="What moved the needle this week?"
      />
      <Field
        label="What made it harder?"
        value={ans.whatHardened}
        onChange={(v) => update("whatHardened", v)}
        placeholder="What got in the way?"
      />
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTrialDay(): number {
  let s = localStorage.getItem("ascend.trialStartDate");
  if (!s) {
    s = new Date().toISOString();
    localStorage.setItem("ascend.trialStartDate", s);
  }
  return Math.floor((Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function defaultAnswers(): GoalAnswers {
  return {
    score: "5",
    trend: "",
    whatHelped: "",
    whatHardened: "",
    weight: "",
    mealsLogged: "",
    workoutsCompleted: "",
    avgSleepHours: "",
    missionPercent: "50",
    stepsCardio: "",
    caloriesCravingsStruggle: "",
    proteinConsistency: "",
    strengthProgress: "",
    recoverySoreness: "",
  };
}

function computeScore(goal: string, ans: GoalAnswers): number {
  if (goal === "discipline") {
    return Math.max(1, Math.min(10, Math.round(parseInt(ans.missionPercent || "50") / 10)));
  }
  return Math.max(1, Math.min(10, parseInt(ans.score || "5")));
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function WeeklyCheckInModal({ open, onClose, goals }: Props) {
  const queryClient = useQueryClient();
  const createGoalCheckIn = useCreateGoalCheckIn();
  const createWeighIn = useCreateWeighIn();

  const trialDay = getTrialDay();
  const isDay6Warning = trialDay === 6;
  const isTrialEnded = trialDay >= 7;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, GoalAnswers>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<CheckInResult[]>([]);
  const [trialContinue, setTrialContinue] = useState(false);

  const activeGoals = goals.filter((g) => typeof g === "string" && g.trim().length > 0);
  const totalSteps = activeGoals.length;

  function getAnswers(goal: string): GoalAnswers {
    return answers[goal] ?? defaultAnswers();
  }

  function updateAnswer(goal: string, key: keyof GoalAnswers, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [goal]: { ...(prev[goal] ?? defaultAnswers()), [key]: value },
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const submitted: CheckInResult[] = [];

    for (const goal of activeGoals) {
      const ans = getAnswers(goal);
      const score = computeScore(goal, ans);

      const noteParts: string[] = [];
      if (LOSE_FAT_GOALS.includes(goal) && ans.mealsLogged)
        noteParts.push(`Meals logged: ${ans.mealsLogged}`);
      if (LOSE_FAT_GOALS.includes(goal) && ans.stepsCardio)
        noteParts.push(`Steps/cardio: ${ans.stepsCardio}`);
      if (LOSE_FAT_GOALS.includes(goal) && ans.caloriesCravingsStruggle)
        noteParts.push(`Cravings struggle: ${ans.caloriesCravingsStruggle}`);
      if (BUILD_MUSCLE_GOALS.includes(goal) && ans.workoutsCompleted)
        noteParts.push(`Workouts: ${ans.workoutsCompleted}`);
      if (BUILD_MUSCLE_GOALS.includes(goal) && ans.proteinConsistency)
        noteParts.push(`Protein: ${ans.proteinConsistency}`);
      if (BUILD_MUSCLE_GOALS.includes(goal) && ans.strengthProgress)
        noteParts.push(`Strength: ${ans.strengthProgress}`);
      if (BUILD_MUSCLE_GOALS.includes(goal) && ans.recoverySoreness)
        noteParts.push(`Recovery: ${ans.recoverySoreness}`);
      if (goal === "better sleep" && ans.avgSleepHours)
        noteParts.push(`Avg sleep: ${ans.avgSleepHours}h`);

      try {
        const result = await createGoalCheckIn.mutateAsync({
          data: {
            goal,
            score,
            trend: (ans.trend as "better" | "same" | "worse") || undefined,
            whatHelped: ans.whatHelped || undefined,
            whatHardened: ans.whatHardened || undefined,
            notes: noteParts.length > 0 ? noteParts.join(", ") : undefined,
          },
        });
        submitted.push({
          goal,
          score,
          coachFeedback: result.coachFeedback,
          status: result.status,
        });

        if ((LOSE_FAT_GOALS.includes(goal) || BUILD_MUSCLE_GOALS.includes(goal)) && ans.weight && parseFloat(ans.weight) > 0) {
          try {
            await createWeighIn.mutateAsync({
              data: { weightKg: parseFloat(ans.weight) / 2.2046226 },
            });
          } catch {
            // weight log failing shouldn't block results
          }
        }
      } catch {
        submitted.push({ goal, score, coachFeedback: "Check-in saved. Keep pushing." });
      }
    }

    setResults(submitted);
    setStep(totalSteps + 1);
    setSubmitting(false);

    localStorage.setItem("ascend.lastWeeklyCheckIn", new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: getListGoalCheckInsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListWeighInsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
  }

  async function handleNext() {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  }

  if (!open) return null;

  // ── Trial ended screen ─────────────────────────────────────────────────────
  if (isTrialEnded && !trialContinue && step === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ascend</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold tracking-tight">Trial Complete</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {trialDay} days of Ascend complete. Upgrade to keep your momentum going.
            </p>
          </div>
          <div className="w-full text-left space-y-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Upgrade to continue:
            </p>
            {[
              "Weekly check-ins & plan adjustments",
              "Coach memory across conversations",
              "Meal history & AI feedback",
              "Streaks & progress tracking",
              "Personalized week-by-week evolution",
            ].map((f) => (
              <div key={f} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{f}</p>
              </div>
            ))}
          </div>
          <div className="w-full space-y-3 pt-2">
            <Link href="/pricing" onClick={onClose}>
              <button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold tracking-wide">
                Upgrade to Ascend Pro
              </button>
            </Link>
            <button
              onClick={() => setTrialContinue(true)}
              className="w-full text-xs text-muted-foreground underline underline-offset-2 py-1"
            >
              Continue without upgrading
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (step === totalSteps + 1) {
    const avgScore =
      results.length > 0
        ? results.reduce((s, r) => s + r.score, 0) / results.length
        : 5;
    const overallStatus =
      avgScore >= 7.5 ? "On Track" : avgScore >= 5 ? "Improving" : "Needs Focus";
    const statusColor =
      avgScore >= 7.5
        ? "text-green-400"
        : avgScore >= 5
        ? "text-amber-400"
        : "text-red-400";
    const statusBg =
      avgScore >= 7.5
        ? "bg-green-500/15"
        : avgScore >= 5
        ? "bg-amber-500/15"
        : "bg-red-500/15";
    const nextFocus =
      overallStatus === "On Track"
        ? "You're executing well. Tighten your weakest area and maintain the habits that are working."
        : overallStatus === "Improving"
        ? "You're making progress. Identify the one thing that slipped this week and fix it tomorrow."
        : "Review your daily habits. Pick the single biggest blocker and eliminate it this week.";

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Week {trialDay}
            </p>
            <p className="text-sm font-semibold mt-0.5">Check-In Summary</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 max-w-2xl mx-auto w-full">
          <div className={cn("rounded-2xl p-5 text-center", statusBg)}>
            <p className={cn("text-2xl font-bold tracking-tight", statusColor)}>
              {overallStatus}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Avg score this week: {avgScore.toFixed(1)}/10
            </p>
          </div>

          {results.map((r) => (
            <div
              key={r.goal}
              className="bg-card border border-border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold capitalize">{r.goal}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-primary" />
                  <span className="text-sm font-bold text-primary">{r.score}/10</span>
                </div>
              </div>
              {r.coachFeedback && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {r.coachFeedback}
                </p>
              )}
              {r.status === "needs_confirmation" && (
                <p className="text-xs font-semibold text-green-400">
                  ★ You may have reached this goal. Check the Progress page to confirm.
                </p>
              )}
            </div>
          ))}

          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Next Week Focus
            </p>
            <p className="text-sm leading-relaxed">{nextFocus}</p>
          </div>

          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ── Intro step (step === 0) ────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Week {trialDay} Check-In
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 max-w-2xl mx-auto w-full">
          {isDay6Warning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-sm font-semibold text-amber-400">
                Your trial ends tomorrow
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your Week 2 plan is almost ready. Upgrade to keep your results going.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Weekly Check-In</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Quick progress check on your goals. Takes about 2 minutes. Your coach uses this to adjust next week's plan.
            </p>
          </div>
          {activeGoals.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Goals this week
              </p>
              {activeGoals.map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <p className="text-sm capitalize">{g}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-6 pt-3 border-t border-border">
          <Button
            className="w-full"
            onClick={() => setStep(1)}
            disabled={activeGoals.length === 0}
          >
            {activeGoals.length === 0 ? "No goals set" : "Start Check-In →"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Per-goal step ─────────────────────────────────────────────────────────
  const currentGoal = activeGoals[step - 1];
  const ans = getAnswers(currentGoal);
  const isLastGoal = step === totalSteps;

  const renderGoalForm = () => {
    const update = (k: keyof GoalAnswers, v: string) =>
      updateAnswer(currentGoal, k, v);
    if (LOSE_FAT_GOALS.includes(currentGoal))
      return <LoseFatGoalForm ans={ans} update={update} />;
    if (BUILD_MUSCLE_GOALS.includes(currentGoal))
      return <BuildMuscleGoalForm ans={ans} update={update} />;
    if (currentGoal === "better skin")
      return <SkinGoalForm ans={ans} update={update} />;
    if (currentGoal === "higher energy")
      return <EnergyGoalForm ans={ans} update={update} />;
    if (currentGoal === "better sleep")
      return <SleepGoalForm ans={ans} update={update} />;
    if (currentGoal === "discipline")
      return <DisciplineGoalForm ans={ans} update={update} />;
    return <GenericGoalForm goal={currentGoal} ans={ans} update={update} />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Goal {step} of {totalSteps}
          </p>
          <p className="text-sm font-semibold capitalize mt-0.5">{currentGoal}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 px-5 py-2">
        {activeGoals.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < step ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {renderGoalForm()}
      </div>

      <div className="px-5 pb-6 pt-3 border-t border-border flex gap-3">
        <button
          onClick={() => setStep(step - 1)}
          className="flex-none px-4 h-11 rounded-xl text-sm text-muted-foreground border border-border"
        >
          Back
        </button>
        <Button className="flex-1" onClick={handleNext} disabled={submitting}>
          {submitting
            ? "Submitting…"
            : isLastGoal
            ? "Submit Check-In"
            : "Next →"}
        </Button>
      </div>
    </div>
  );
}
