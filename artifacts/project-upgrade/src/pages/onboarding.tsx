import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateUserProfile,
  useGeneratePlan,
  useGetMe,
  getGetCurrentPlanQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const GOALS = [
  { label: "Lose Weight",  value: "lose weight",       emoji: "🔥" },
  { label: "Gain Weight",  value: "gain weight",        emoji: "⬆️" },
  { label: "Gain Muscle",  value: "build muscle",       emoji: "💪" },
  { label: "Stay Fit",     value: "maintain fitness",   emoji: "⚡" },
  { label: "More Energy",  value: "higher energy",      emoji: "🌟" },
] as const;

const WAKE_OPTIONS = [
  { label: "5–7 AM",      emoji: "🌅", wakeTime: "06:00", wakeTimeRange: JSON.stringify({ start: "05:00", end: "07:00" }) },
  { label: "7–9 AM",      emoji: "☀️",  wakeTime: "08:00", wakeTimeRange: JSON.stringify({ start: "07:00", end: "09:00" }) },
  { label: "9–11 AM",     emoji: "🕙",  wakeTime: "10:00", wakeTimeRange: JSON.stringify({ start: "09:00", end: "11:00" }) },
  { label: "After 11 AM", emoji: "🌤️", wakeTime: "11:30", wakeTimeRange: null },
  { label: "Varies",      emoji: "🔀",  wakeTime: "07:30", wakeTimeRange: null },
] as const;

const WEIGHT_GOALS = new Set(["lose weight", "gain weight"]);

const TOTAL_STEPS = 5;

// ─── helpers ──────────────────────────────────────────────────────────────────

function lbsToKg(lbs: number) {
  return Math.round((lbs / 2.2046226) * 10) / 10;
}
function ftInToCm(ft: number, inches: number) {
  return Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
}

// ─── main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();

  const createProfile = useCreateUserProfile();
  const generatePlan = useGeneratePlan();

  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [currentWeightLbs, setCurrentWeightLbs] = useState("");
  const [goalWeightLbs, setGoalWeightLbs] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [age, setAge] = useState("");
  const [wakeOption, setWakeOption] = useState<string>("");
  const [error, setError] = useState("");

  const isLoading = createProfile.isPending || generatePlan.isPending;
  const isWeightGoal = WEIGHT_GOALS.has(selectedGoal);

  // ── Step handlers ────────────────────────────────────────────────────────

  const handleStep1 = () => {
    if (!selectedGoal) { setError("Pick a goal to continue."); return; }
    setError(""); setStep(2);
  };

  const handleStep2 = () => {
    const cw = parseFloat(currentWeightLbs);
    if (!currentWeightLbs || isNaN(cw) || cw < 50 || cw > 700) {
      setError("Enter a valid current weight between 50 and 700 lbs."); return;
    }
    if (isWeightGoal) {
      const gw = parseFloat(goalWeightLbs);
      if (!goalWeightLbs || isNaN(gw) || gw < 50 || gw > 700) {
        setError("Enter a valid goal weight between 50 and 700 lbs."); return;
      }
    }
    setError(""); setStep(3);
  };

  const handleStep3 = () => {
    const ft = parseInt(heightFt);
    const inches = parseInt(heightIn) || 0;
    if (!heightFt || isNaN(ft) || ft < 3 || ft > 8 || inches < 0 || inches > 11) {
      setError("Enter a valid height."); return;
    }
    setError(""); setStep(4);
  };

  const handleStep4 = () => {
    const a = parseInt(age);
    if (!age || isNaN(a) || a < 13 || a > 100) {
      setError("Enter a valid age between 13 and 100."); return;
    }
    setError(""); setStep(5);
  };

  const handleSubmit = async () => {
    if (!wakeOption) { setError("Pick your usual wake-up time to continue."); return; }
    setError("");

    const ft = parseInt(heightFt) || 0;
    const inches = parseInt(heightIn) || 0;
    const a = parseInt(age);
    const currentWeightKg = lbsToKg(parseFloat(currentWeightLbs));
    const goalWeightKg = goalWeightLbs ? lbsToKg(parseFloat(goalWeightLbs)) : currentWeightKg;
    const selectedWake = WAKE_OPTIONS.find(o => o.label === wakeOption);

    const payload = {
      name: me?.email?.split("@")[0] ?? "User",
      age: a,
      gender: "prefer not to say",
      heightCm: ftInToCm(ft, inches),
      currentWeightKg,
      goalWeightKg,
      bodyType: "average",
      goals: [selectedGoal],
      skinConcerns: [],
      digestionConcerns: [],
      fitnessLevel: "beginner",
      gymAccess: "no",
      workoutDaysPerWeek: 3,
      wakeTime: selectedWake?.wakeTime ?? "07:00",
      wakeTimeRange: selectedWake?.wakeTimeRange ?? null,
      sleepTime: "22:30",
      sleepQuality: 5,
      energyLevel: 5,
      stressLevel: 5,
      mealsPerDay: 3,
      waterIntakeLiters: 2,
      commitmentLevel: "serious",
    } as any;

    try {
      await createProfile.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      await generatePlan.mutateAsync(undefined as any);
      queryClient.invalidateQueries({ queryKey: getGetCurrentPlanQueryKey() });
      setLocation("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  // ── Shared styles ────────────────────────────────────────────────────────
  const numInputCls = cn(
    "w-full bg-elevated border border-border rounded-2xl text-center text-3xl font-bold",
    "text-foreground placeholder:text-muted-foreground/40",
    "focus:outline-none focus:ring-2 focus:ring-primary/50",
    "h-20 px-4",
  );
  const smInputCls = cn(
    "w-full bg-elevated border border-border rounded-2xl text-center text-2xl font-bold",
    "text-foreground placeholder:text-muted-foreground/40",
    "focus:outline-none focus:ring-2 focus:ring-primary/50",
    "h-16 px-4",
  );
  const backBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick}
      className="h-14 px-5 rounded-2xl border border-border text-muted-foreground font-semibold hover:bg-elevated transition-colors">
      Back
    </button>
  );
  const continueBtn = (onClick: () => void, label = "Continue") => (
    <button type="button" onClick={onClick}
      className="flex-1 h-14 rounded-2xl text-[15px] font-semibold text-primary-foreground active:scale-[0.99] transition-all"
      style={{ background: "#C89A3E" }}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col bg-background text-foreground"
      style={{ height: "100dvh", overflow: "hidden", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>

      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-black tracking-tighter leading-none">
            Ascend<span style={{ color: "#C89A3E" }}>Fit</span>
          </span>
          <p className="text-sm font-medium text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
        </div>
        <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ background: "#C89A3E", width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-8 max-w-lg mx-auto flex flex-col gap-6">

          {/* ── Step 1: Goal ─────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">What's your main goal?</h1>
                <p className="text-sm text-muted-foreground mt-1">Pick the one that matters most right now.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map((g) => (
                  <button key={g.value} type="button"
                    onClick={() => { setSelectedGoal(g.value); setError(""); }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 transition-all active:scale-[0.97]",
                      selectedGoal === g.value
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-foreground hover:bg-elevated"
                    )}>
                    <span className="text-3xl leading-none">{g.emoji}</span>
                    <span className="text-sm font-semibold leading-tight text-center">{g.label}</span>
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="button" onClick={handleStep1} disabled={!selectedGoal}
                className="h-14 rounded-2xl text-[15px] font-semibold text-primary-foreground disabled:opacity-40 active:scale-[0.99] transition-all"
                style={{ background: "#C89A3E" }}>
                Continue
              </button>
            </>
          )}

          {/* ── Step 2: Current weight + Goal weight ─────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Your weight</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isWeightGoal
                    ? "We use these to track your progress and build your plan."
                    : "We use this to calibrate your daily targets."}
                </p>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">Current weight</p>
                  <div className="relative">
                    <input type="text" inputMode="decimal" value={currentWeightLbs} autoFocus
                      onChange={e => { setCurrentWeightLbs(e.target.value); setError(""); }}
                      placeholder="185" className={numInputCls} />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none">lbs</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold text-foreground">Goal weight</p>
                    {!isWeightGoal && <span className="text-xs text-muted-foreground">(optional)</span>}
                  </div>
                  <div className="relative">
                    <input type="text" inputMode="decimal" value={goalWeightLbs}
                      onChange={e => { setGoalWeightLbs(e.target.value); setError(""); }}
                      placeholder={isWeightGoal ? (selectedGoal === "lose weight" ? "165" : "200") : "Optional"}
                      className={smInputCls} />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground pointer-events-none">
                      {goalWeightLbs ? "lbs" : ""}
                    </span>
                  </div>
                  {isWeightGoal && currentWeightLbs && goalWeightLbs && (() => {
                    const cw = parseFloat(currentWeightLbs);
                    const gw = parseFloat(goalWeightLbs);
                    if (!isNaN(cw) && !isNaN(gw) && cw > 0 && gw > 0) {
                      const diff = Math.abs(cw - gw);
                      const isWarning = (selectedGoal === "lose weight" && gw >= cw) || (selectedGoal === "gain weight" && gw <= cw);
                      const dir = selectedGoal === "lose weight"
                        ? gw < cw ? `Losing ${diff.toFixed(0)} lbs` : "⚠️ Goal weight is higher than current"
                        : gw > cw ? `Gaining ${diff.toFixed(0)} lbs` : "⚠️ Goal weight is lower than current";
                      return <p className={cn("text-xs mt-1", isWarning ? "text-amber-400" : "text-muted-foreground")}>{dir}</p>;
                    }
                    return null;
                  })()}
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                {backBtn(() => setStep(1))}
                {continueBtn(handleStep2)}
              </div>
            </>
          )}

          {/* ── Step 3: Height ───────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">How tall are you?</h1>
                <p className="text-sm text-muted-foreground mt-1">Used to calibrate your calorie and nutrition targets.</p>
              </div>
              <div className="flex gap-3 py-4">
                <div className="flex-1 relative">
                  <input type="text" inputMode="numeric" value={heightFt} autoFocus
                    onChange={e => { setHeightFt(e.target.value); setError(""); }}
                    placeholder="5" className={numInputCls} />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none">ft</span>
                </div>
                <div className="flex-1 relative">
                  <input type="text" inputMode="numeric" value={heightIn}
                    onChange={e => { setHeightIn(e.target.value); setError(""); }}
                    placeholder="10" className={numInputCls} />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none">in</span>
                </div>
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <div className="flex gap-3">
                {backBtn(() => setStep(2))}
                {continueBtn(handleStep3)}
              </div>
            </>
          )}

          {/* ── Step 4: Age ──────────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">How old are you?</h1>
                <p className="text-sm text-muted-foreground mt-1">Your age affects your metabolism and daily targets.</p>
              </div>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative w-full max-w-xs">
                  <input type="text" inputMode="numeric" value={age} autoFocus
                    onChange={e => { setAge(e.target.value); setError(""); }}
                    placeholder="25" className={numInputCls} />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none">yrs</span>
                </div>
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <div className="flex gap-3">
                {backBtn(() => setStep(3))}
                {continueBtn(handleStep4)}
              </div>
            </>
          )}

          {/* ── Step 5: Wake-up time ─────────────────────────────────────── */}
          {step === 5 && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">When do you usually wake up?</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  We use this to build your daily schedule — meals, workouts, and reminders.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {WAKE_OPTIONS.map((o) => (
                  <button key={o.label} type="button"
                    onClick={() => { setWakeOption(o.label); setError(""); }}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all active:scale-[0.99]",
                      wakeOption === o.label
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-foreground hover:bg-elevated"
                    )}>
                    <span className="text-2xl leading-none">{o.emoji}</span>
                    <span className="text-base font-semibold">{o.label}</span>
                  </button>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={2.2} />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Not medical advice.</strong> Consult a healthcare professional before starting any diet or exercise program. By continuing you agree to our{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Privacy Policy</a>.
                </p>
              </div>

              <div className="flex gap-3">
                {backBtn(() => setStep(4))}
                <button type="button" onClick={handleSubmit} disabled={isLoading || !wakeOption}
                  className="flex-1 h-14 rounded-2xl text-[15px] font-semibold text-primary-foreground disabled:opacity-60 active:scale-[0.99] transition-all"
                  style={{ background: "#C89A3E" }}>
                  {isLoading ? "Building your plan…" : "Build My Plan →"}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
