import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogout,
  useResetUserProfile,
  useGetMe,
  useGetUserProfile,
  useUpdateUserProfile,
  useGeneratePlan,
  getGetUserProfileQueryKey,
  getGetCurrentPlanQueryKey,
} from "@workspace/api-client-react";
import { LogOut, RotateCcw, AlertTriangle, Save, CheckCircle2, FileDown, Shield, ScrollText, CreditCard, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const GOALS = [
  "lose weight", "gain muscle", "gain weight and muscle", "stay fit",
];

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const BODY_TYPES = ["Slim", "Athletic", "Average", "Stocky", "Heavy"];
const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced", "Athlete"];
const GYM_ACCESS_OPTIONS = ["Yes", "No", "Home gym"];
const WORKOUT_TIME_OPTIONS = ["Early morning", "Morning", "Afternoon", "Evening", "Night"];
const SPORTS = [
  "No sport", "Football", "Basketball", "Soccer", "Track", "Boxing/MMA",
  "Baseball/Softball", "Volleyball", "Wrestling", "Other",
];
const WORKOUT_FOCUSES = [
  { label: "Lose fat", value: "lose_fat" },
  { label: "Build muscle", value: "build_muscle" },
  { label: "Strength", value: "strength" },
  { label: "Athletic performance", value: "athletic_performance" },
  { label: "Conditioning", value: "conditioning" },
  { label: "General fitness", value: "general_fitness" },
];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COMMITMENT_LEVELS = [
  { value: "casual", label: "Casual", desc: "Small changes, no pressure." },
  { value: "serious", label: "Serious", desc: "Follow the plan and track daily." },
  { value: "locked_in", label: "All In", desc: "Real results and honest accountability." },
  { value: "extreme_discipline", label: "Deep Focus", desc: "Strong habits, consistent effort. Small wins compound." },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function kgToLbs(kg: number) {
  return Math.round(kg * 2.20462 * 10) / 10;
}
function lbsToKg(lbs: number) {
  return Math.round((lbs / 2.20462) * 10) / 10;
}
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}
function ftInToCm(ft: number, inches: number) {
  return Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
}

// ─── shared components ────────────────────────────────────────────────────────

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-[0.97]",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-elevated text-muted-foreground border-border"
      )}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground tracking-wide">{label}</p>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-elevated border border-border rounded-xl h-11 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

function SaveBtn({
  onClick,
  pending,
  saved,
  label = "Save changes",
}: {
  onClick: () => void;
  pending: boolean;
  saved: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60",
        saved
          ? "bg-success/10 border border-success/40 text-success"
          : "bg-primary text-primary-foreground"
      )}
    >
      {saved ? (
        <>
          <CheckCircle2 className="w-[18px] h-[18px]" strokeWidth={2} />
          Settings updated. Your plan has been adjusted.
        </>
      ) : pending ? (
        "Saving..."
      ) : (
        <>
          <Save className="w-[18px] h-[18px]" strokeWidth={2} />
          {label}
        </>
      )}
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function SubscriptionSection() {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/portal", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error || "Could not open subscription portal. Please try again.");
      }
    } catch {
      setPortalError("Network error. Please check your connection and try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground">Subscription</p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CreditCard className="w-4 h-4 text-primary" strokeWidth={2} />
        <span>Cancel, update payment method, or view invoices</span>
      </div>
      {portalError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{portalError}</p>
      )}
      <button
        onClick={handleManageSubscription}
        disabled={portalLoading}
        className="flex items-center justify-center gap-2 w-full bg-primary/10 border border-primary/30 text-primary h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
      >
        {portalLoading ? (
          <><div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />Opening portal...</>
        ) : (
          <><ExternalLink className="w-[18px] h-[18px]" strokeWidth={2} />Manage subscription</>
        )}
      </button>
    </section>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: profile } = useGetUserProfile();
  const logout = useLogout();
  const resetProfile = useResetUserProfile();
  const updateProfile = useUpdateUserProfile();
  const generatePlan = useGeneratePlan();
  const [confirmReset, setConfirmReset] = useState(false);

  // Per-section saved state
  const [saved1, setSaved1] = useState(false);
  const [saved2, setSaved2] = useState(false);
  const [saved3, setSaved3] = useState(false);
  const [saved4, setSaved4] = useState(false);
  const [saved5, setSaved5] = useState(false);
  const [saved6, setSaved6] = useState(false);

  // ── Section 1: Personal Info ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [currentWeightLbs, setCurrentWeightLbs] = useState("");
  const [goalWeightLbs, setGoalWeightLbs] = useState("");
  const [bodyType, setBodyType] = useState("");

  // ── Section 2: Goals ──────────────────────────────────────────────────────
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");

  // ── Section 2b: Nutrition ─────────────────────────────────────────────────
  const [dietStyle, setDietStyle] = useState("");
  const [allergies, setAllergies] = useState("");
  const [dislikedFoods, setDislikedFoods] = useState("");

  // ── Section 3: Training ───────────────────────────────────────────────────
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [gymAccess, setGymAccess] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState(3);
  const [preferredWorkoutTime, setPreferredWorkoutTime] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [sportCustomText, setSportCustomText] = useState("");
  const [sportDays, setSportDays] = useState<string[]>([]);
  const [sportStartTime, setSportStartTime] = useState("16:00");
  const [sportDuration, setSportDuration] = useState(90);
  const [sportDurationRaw, setSportDurationRaw] = useState("90");
  const [sportIntensity, setSportIntensity] = useState("moderate");
  const [sportGameDays, setSportGameDays] = useState<string[]>([]);
  const [scheduleChoice, setScheduleChoice] = useState<"" | "yes" | "no">("");
  const [ownScheduleText, setOwnScheduleText] = useState("");
  const [customWorkoutDays, setCustomWorkoutDays] = useState<{ day: string; focus: string }[]>([]);
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] = useState("");

  // ── Section 4: Daily Schedule ─────────────────────────────────────────────
  const [wakeTime, setWakeTime] = useState("");
  const [sleepTime, setSleepTime] = useState("");
  const [wakeMode, setWakeMode] = useState<"exact" | "range">("exact");
  const [wakeRangeStart, setWakeRangeStart] = useState("");
  const [wakeRangeEnd, setWakeRangeEnd] = useState("");
  const [sleepMode, setSleepMode] = useState<"exact" | "range">("exact");
  const [sleepRangeStart, setSleepRangeStart] = useState("");
  const [sleepRangeEnd, setSleepRangeEnd] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [waterIntakeLiters, setWaterIntakeLiters] = useState(2);

  // ── Section 5: Preferences ────────────────────────────────────────────────
  const [commitmentLevel, setCommitmentLevel] = useState("");

  // ── Load profile into state ───────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;

    // Personal Info
    if (p.name) setName(p.name);
    if (p.age) setAge(String(p.age));
    if (p.gender) setGender(p.gender);
    if (p.heightCm) {
      const { ft, inches } = cmToFtIn(p.heightCm);
      setHeightFt(String(ft));
      setHeightIn(String(inches));
    }
    if (p.currentWeightKg) setCurrentWeightLbs(String(kgToLbs(p.currentWeightKg)));
    if (p.goalWeightKg) setGoalWeightLbs(String(kgToLbs(p.goalWeightKg)));
    if (p.bodyType) setBodyType(p.bodyType);

    // Goals
    if (Array.isArray(p.goals) && p.goals.length > 0) setSelectedGoals(p.goals);
    if (p.targetDate) setTargetDate(p.targetDate);

    // Nutrition
    if (p.dietStyle) setDietStyle(p.dietStyle);
    if (p.allergies) setAllergies(p.allergies);
    if (p.dislikedFoods) setDislikedFoods(p.dislikedFoods);

    // Training
    if (p.fitnessLevel) setFitnessLevel(p.fitnessLevel);
    if (p.gymAccess) setGymAccess(p.gymAccess);
    if (p.equipment) {
      try {
        const eq = JSON.parse(p.equipment);
        if (Array.isArray(eq)) setSelectedEquipment(eq);
      } catch { /* ignore */ }
    }
    if (p.workoutDaysPerWeek) setWorkoutDaysPerWeek(p.workoutDaysPerWeek);
    if (p.preferredWorkoutTime) setPreferredWorkoutTime(p.preferredWorkoutTime);
    if (p.sport) setSelectedSport(p.sport);
    if (p.sportCustom) setSportCustomText(p.sportCustom);
    if (p.hasOwnSchedule) setScheduleChoice(p.hasOwnSchedule);
    if (p.ownSchedule) setOwnScheduleText(p.ownSchedule);
    if (p.workoutFocus) setSelectedWorkoutFocus(p.workoutFocus);
    if (p.sportSchedule) {
      try {
        const ss = JSON.parse(p.sportSchedule);
        if (ss.days) setSportDays(ss.days);
        if (ss.startTime) setSportStartTime(ss.startTime);
        if (ss.durationMinutes) { setSportDuration(ss.durationMinutes); setSportDurationRaw(String(ss.durationMinutes)); }
        if (ss.intensity) setSportIntensity(ss.intensity);
        if (ss.gameDays) setSportGameDays(ss.gameDays);
      } catch { /* ignore */ }
    }
    if (p.customWorkoutSchedule) {
      try {
        const cs = JSON.parse(p.customWorkoutSchedule);
        if (cs.days) setCustomWorkoutDays(cs.days);
      } catch { /* ignore */ }
    }

    // Daily Schedule
    if (p.wakeTime) setWakeTime(p.wakeTime);
    if (p.sleepTime) setSleepTime(p.sleepTime);
    if (p.wakeTimeRange) {
      try {
        const wr = JSON.parse(p.wakeTimeRange);
        if (wr.start && wr.end) { setWakeMode("range"); setWakeRangeStart(wr.start); setWakeRangeEnd(wr.end); }
      } catch { /* ignore */ }
    }
    if (p.sleepTimeRange) {
      try {
        const sr = JSON.parse(p.sleepTimeRange);
        if (sr.start && sr.end) { setSleepMode("range"); setSleepRangeStart(sr.start); setSleepRangeEnd(sr.end); }
      } catch { /* ignore */ }
    }
    if (p.mealsPerDay) setMealsPerDay(p.mealsPerDay);
    if (p.waterIntakeLiters) setWaterIntakeLiters(p.waterIntakeLiters);

    // Preferences
    if (p.commitmentLevel) setCommitmentLevel(p.commitmentLevel);
  }, [profile]);

  // ── Shared save helper ────────────────────────────────────────────────────
  const saveAndRegenerate = async (
    payload: Record<string, unknown>,
    setSaved: (v: boolean) => void,
  ) => {
    await updateProfile.mutateAsync({ data: payload as any });
    await generatePlan.mutateAsync();
    queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCurrentPlanQueryKey() });
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const isSaving = updateProfile.isPending || generatePlan.isPending;

  // ── Section handlers ──────────────────────────────────────────────────────

  const handleSavePersonal = () => {
    const ft = parseInt(heightFt) || 0;
    const ins = parseInt(heightIn) || 0;
    const payload: Record<string, unknown> = {};
    if (name.trim()) payload.name = name.trim();
    if (age) payload.age = parseInt(age);
    if (gender) payload.gender = gender;
    if (ft > 0) payload.heightCm = ftInToCm(ft, ins);
    if (currentWeightLbs) payload.currentWeightKg = lbsToKg(parseFloat(currentWeightLbs));
    if (goalWeightLbs) payload.goalWeightKg = lbsToKg(parseFloat(goalWeightLbs));
    if (bodyType) payload.bodyType = bodyType;
    saveAndRegenerate(payload, setSaved1);
  };

  const handleSaveGoals = () => {
    const payload: Record<string, unknown> = { goals: selectedGoals };
    if (targetDate) payload.targetDate = targetDate;
    saveAndRegenerate(payload, setSaved2);
  };

  const handleSaveNutrition = () => {
    const payload: Record<string, unknown> = {};
    if (dietStyle) payload.dietStyle = dietStyle;
    if (allergies.trim()) payload.allergies = allergies.trim();
    if (dislikedFoods.trim()) payload.dislikedFoods = dislikedFoods.trim();
    saveAndRegenerate(payload, setSaved6);
  };

  const handleSaveTraining = () => {
    const sportValue = selectedSport.toLowerCase();
    const payload: Record<string, unknown> = {};
    if (fitnessLevel) payload.fitnessLevel = fitnessLevel;
    if (gymAccess) payload.gymAccess = gymAccess;
    payload.equipment = JSON.stringify(selectedEquipment);
    payload.workoutDaysPerWeek = workoutDaysPerWeek;
    if (preferredWorkoutTime) payload.preferredWorkoutTime = preferredWorkoutTime;
    if (sportValue) payload.sport = sportValue;
    if (sportValue === "other" && sportCustomText) payload.sportCustom = sportCustomText;
    if (scheduleChoice) payload.hasOwnSchedule = scheduleChoice;
    if (scheduleChoice === "yes" && ownScheduleText) payload.ownSchedule = ownScheduleText;
    if (scheduleChoice === "no" && selectedWorkoutFocus) payload.workoutFocus = selectedWorkoutFocus;
    if (sportValue && sportValue !== "no sport" && sportDays.length > 0) {
      payload.sportSchedule = JSON.stringify({
        sport: sportCustomText || sportValue,
        days: sportDays,
        startTime: sportStartTime,
        durationMinutes: sportDuration,
        intensity: sportIntensity,
        gameDays: sportGameDays.length > 0 ? sportGameDays : undefined,
      });
    }
    if (customWorkoutDays.length > 0) {
      payload.customWorkoutSchedule = JSON.stringify({ days: customWorkoutDays });
    }
    saveAndRegenerate(payload, setSaved3);
  };

  const handleSaveSchedule = () => {
    const payload: Record<string, unknown> = {};
    if (wakeMode === "range" && wakeRangeStart && wakeRangeEnd) {
      const midH = (parseInt(wakeRangeStart.split(":")[0]!, 10) * 60 + parseInt(wakeRangeStart.split(":")[1]!, 10)
        + parseInt(wakeRangeEnd.split(":")[0]!, 10) * 60 + parseInt(wakeRangeEnd.split(":")[1]!, 10)) / 2;
      const mh = Math.floor(midH / 60), mm = Math.round(midH % 60);
      payload.wakeTime = `${String(mh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      payload.wakeTimeRange = JSON.stringify({ start: wakeRangeStart, end: wakeRangeEnd });
    } else {
      if (wakeTime) payload.wakeTime = wakeTime;
      payload.wakeTimeRange = null;
    }
    if (sleepMode === "range" && sleepRangeStart && sleepRangeEnd) {
      const midH = (parseInt(sleepRangeStart.split(":")[0]!, 10) * 60 + parseInt(sleepRangeStart.split(":")[1]!, 10)
        + parseInt(sleepRangeEnd.split(":")[0]!, 10) * 60 + parseInt(sleepRangeEnd.split(":")[1]!, 10)) / 2;
      const mh = Math.floor(midH / 60), mm = Math.round(midH % 60);
      payload.sleepTime = `${String(mh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      payload.sleepTimeRange = JSON.stringify({ start: sleepRangeStart, end: sleepRangeEnd });
    } else {
      if (sleepTime) payload.sleepTime = sleepTime;
      payload.sleepTimeRange = null;
    }
    payload.mealsPerDay = mealsPerDay;
    payload.waterIntakeLiters = waterIntakeLiters;
    saveAndRegenerate(payload, setSaved4);
  };

  const handleSavePreferences = () => {
    const payload: Record<string, unknown> = {};
    if (commitmentLevel) payload.commitmentLevel = commitmentLevel;
    saveAndRegenerate(payload, setSaved5);
  };

  // ── Auth / reset ──────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await logout.mutateAsync(); } catch { /* ignore */ }
    queryClient.clear();
    window.location.replace("/login");
  };

  const handleReset = async () => {
    try {
      await resetProfile.mutateAsync();
      queryClient.clear();
      setLocation("/onboarding");
    } catch (e) {
      console.error(e);
    }
  };

  const textareaClass = "bg-elevated border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground w-full resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[90px]";

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-6 py-6 max-w-2xl w-full mx-auto space-y-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* Account */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Account</p>
          <p className="text-sm text-muted-foreground" data-testid="text-email">
            {me?.email ?? "—"}
          </p>

          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="flex items-center justify-center gap-2 w-full bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
            data-testid="button-logout"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
            {logout.isPending ? "Logging out..." : "Log out"}
          </button>
        </section>

        {/* Subscription */}
        <SubscriptionSection />

        {/* Data & Privacy */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Data & Privacy</p>

          <a
            href="/data-export"
            className="flex items-center justify-center gap-2 w-full bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
          >
            <FileDown className="w-[18px] h-[18px]" strokeWidth={2} />
            Export My Data
          </a>

          <div className="flex gap-2">
            <a
              href="/privacy"
              className="flex-1 flex items-center justify-center gap-2 bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
            >
              <Shield className="w-[18px] h-[18px]" strokeWidth={2} />
              Privacy
            </a>
            <a
              href="/terms"
              className="flex-1 flex items-center justify-center gap-2 bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
            >
              <ScrollText className="w-[18px] h-[18px]" strokeWidth={2} />
              Terms
            </a>
          </div>

          <a
            href="/delete-account"
            className="flex items-center justify-center gap-2 w-full bg-destructive/10 border border-destructive/30 text-destructive h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
          >
            <AlertTriangle className="w-[18px] h-[18px]" strokeWidth={2} />
            Delete Account
          </a>
        </section>

        {/* ── 1. Personal Info ─────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Personal Info</p>

          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input
                type="text"
                inputMode="numeric"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="25"
                className={inputCls}
              />
            </Field>
            <Field label="Gender">
              <div className="flex flex-wrap gap-2">
                {GENDERS.map(g => (
                  <Chip key={g} label={g} selected={gender === g} onToggle={() => setGender(prev => prev === g ? "" : g)} />
                ))}
              </div>
            </Field>
          </div>

          <Field label="Height">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={e => setHeightFt(e.target.value)}
                  placeholder="6"
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightIn}
                  onChange={e => setHeightIn(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Current weight (lbs)">
              <input
                type="text"
                inputMode="decimal"
                value={currentWeightLbs}
                onChange={e => setCurrentWeightLbs(e.target.value)}
                placeholder="180"
                className={inputCls}
              />
            </Field>
            <Field label="Goal weight (lbs)">
              <input
                type="text"
                inputMode="decimal"
                value={goalWeightLbs}
                onChange={e => setGoalWeightLbs(e.target.value)}
                placeholder="160"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Body type">
            <div className="flex flex-wrap gap-2">
              {BODY_TYPES.map(t => (
                <Chip key={t} label={t} selected={bodyType.toLowerCase() === t.toLowerCase()} onToggle={() => setBodyType(prev => prev.toLowerCase() === t.toLowerCase() ? "" : t.toLowerCase())} />
              ))}
            </div>
          </Field>

          <SaveBtn onClick={handleSavePersonal} pending={isSaving} saved={saved1} label="Save personal info" />
        </section>

        {/* ── 2. Goals ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Goals</p>

          <Field label="What are you working towards?">
            <p className="text-xs text-muted-foreground mb-2">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <Chip
                  key={g}
                  label={g}
                  selected={selectedGoals.includes(g)}
                  onToggle={() =>
                    setSelectedGoals(prev =>
                      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
                    )
                  }
                />
              ))}
            </div>
          </Field>

          <Field label="Target date (optional)">
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <SaveBtn onClick={handleSaveGoals} pending={isSaving} saved={saved2} label="Save goals" />
        </section>

        {/* ── 2b. Nutrition ────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Nutrition</p>
            <p className="text-xs text-muted-foreground mt-0.5">Helps your plan avoid foods that don't work for you.</p>
          </div>

          <Field label="Diet style">
            <div className="flex flex-wrap gap-2">
              {["None","Vegan","Vegetarian","Pescatarian","Keto","Paleo","Mediterranean","Halal","Kosher"].map(d => (
                <Chip
                  key={d}
                  label={d}
                  selected={dietStyle.toLowerCase() === d.toLowerCase()}
                  onToggle={() => setDietStyle(prev => prev.toLowerCase() === d.toLowerCase() ? "" : d.toLowerCase())}
                />
              ))}
            </div>
          </Field>

          <Field label="Allergies or intolerances (optional)">
            <textarea
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder="e.g. peanuts, dairy, gluten, shellfish"
              className={textareaClass}
              rows={2}
            />
          </Field>

          <Field label="Foods you dislike (optional)">
            <textarea
              value={dislikedFoods}
              onChange={e => setDislikedFoods(e.target.value)}
              placeholder="e.g. brussels sprouts, beets, fish"
              className={textareaClass}
              rows={2}
            />
          </Field>

          <SaveBtn onClick={handleSaveNutrition} pending={isSaving} saved={saved6} label="Save nutrition" />
        </section>

        {/* ── 3. Training ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Training</p>

          <Field label="Fitness level">
            <div className="flex flex-wrap gap-2">
              {FITNESS_LEVELS.map(l => (
                <Chip key={l} label={l} selected={fitnessLevel.toLowerCase() === l.toLowerCase()} onToggle={() => setFitnessLevel(prev => prev.toLowerCase() === l.toLowerCase() ? "" : l.toLowerCase())} />
              ))}
            </div>
          </Field>

          <Field label="Gym access">
            <div className="flex flex-wrap gap-2">
              {GYM_ACCESS_OPTIONS.map(g => (
                <Chip key={g} label={g} selected={gymAccess.toLowerCase() === g.toLowerCase()} onToggle={() => setGymAccess(prev => prev.toLowerCase() === g.toLowerCase() ? "" : g.toLowerCase())} />
              ))}
            </div>
          </Field>

          {gymAccess.toLowerCase() === "home gym" && (
            <Field label="Home gym equipment">
              <div className="flex flex-wrap gap-2">
                {["Dumbbells", "Barbell & plates", "Pull-up bar", "Resistance bands", "Kettlebells", "Bench", "Squat rack", "Jump rope"].map(eq => (
                  <Chip
                    key={eq}
                    label={eq}
                    selected={selectedEquipment.includes(eq)}
                    onToggle={() => setSelectedEquipment(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq])}
                  />
                ))}
              </div>
            </Field>
          )}

          <Field label={`Workout days — ${workoutDaysPerWeek} per week`}>
            <input
              type="range"
              min={1}
              max={7}
              value={workoutDaysPerWeek}
              onChange={e => setWorkoutDaysPerWeek(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {[1,2,3,4,5,6,7].map(n => <span key={n}>{n}</span>)}
            </div>
          </Field>

          <Field label="Preferred workout time">
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TIME_OPTIONS.map(t => (
                <Chip key={t} label={t} selected={preferredWorkoutTime === t} onToggle={() => setPreferredWorkoutTime(prev => prev === t ? "" : t)} />
              ))}
            </div>
          </Field>

          {/* Sport */}
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide mb-2.5">Sport</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map(s => (
                <Chip
                  key={s}
                  label={s}
                  selected={selectedSport.toLowerCase() === s.toLowerCase()}
                  onToggle={() => setSelectedSport(prev => prev.toLowerCase() === s.toLowerCase() ? "" : s)}
                />
              ))}
            </div>
            {selectedSport.toLowerCase() === "other" && (
              <input
                type="text"
                value={sportCustomText}
                onChange={e => setSportCustomText(e.target.value)}
                placeholder="What sport do you play?"
                className={cn(inputCls, "mt-3")}
              />
            )}

            {selectedSport && selectedSport.toLowerCase() !== "no sport" && selectedSport.toLowerCase() !== "none" && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground tracking-wide mb-1">Practice schedule</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Practice days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map(d => (
                      <Chip key={d} label={d.slice(0, 3)} selected={sportDays.includes(d)} onToggle={() => setSportDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Start time</p>
                    <input type="time" value={sportStartTime} onChange={e => setSportStartTime(e.target.value)} className={cn(inputCls, "h-10")} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Duration (min)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sportDurationRaw}
                      onChange={e => setSportDurationRaw(e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={e => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isNaN(val) || val <= 0) { setSportDurationRaw("60"); setSportDuration(60); }
                        else { const c = Math.max(15, Math.min(300, val)); setSportDurationRaw(String(c)); setSportDuration(c); }
                      }}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Intensity</p>
                  <div className="flex flex-wrap gap-2">
                    {["light", "moderate", "hard"].map(i => (
                      <Chip key={i} label={i} selected={sportIntensity === i} onToggle={() => setSportIntensity(i)} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Game days (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map(d => (
                      <Chip key={d} label={d.slice(0, 3)} selected={sportGameDays.includes(d)} onToggle={() => setSportGameDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workout schedule */}
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide mb-2.5">Workout schedule</p>
            <div className="flex gap-2 flex-wrap">
              <Chip label="I have my own schedule" selected={scheduleChoice === "yes"} onToggle={() => setScheduleChoice(prev => prev === "yes" ? "" : "yes")} />
              <Chip label="Generate one for me" selected={scheduleChoice === "no"} onToggle={() => setScheduleChoice(prev => prev === "no" ? "" : "no")} />
            </div>

            {scheduleChoice === "yes" && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Enter your weekly schedule. Example: Monday chest/back, Tuesday practice, Wednesday legs, Thursday rest, Friday full body.</p>
                <textarea
                  value={ownScheduleText}
                  onChange={e => setOwnScheduleText(e.target.value)}
                  placeholder="Mon: chest/back, Tue: practice, Wed: legs, Thu: rest, Fri: full body..."
                  className={textareaClass}
                  rows={3}
                />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Or build a structured split:</p>
                  {DAY_NAMES.map(d => {
                    const entry = customWorkoutDays.find(x => x.day === d);
                    return (
                      <div key={d} className="flex items-center gap-2">
                        <span className="text-xs font-medium w-20 text-muted-foreground">{d}</span>
                        <input
                          value={entry?.focus ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setCustomWorkoutDays(prev => {
                              const next = prev.filter(x => x.day !== d);
                              if (val.trim()) next.push({ day: d, focus: val.trim() });
                              return next;
                            });
                          }}
                          placeholder="e.g. chest, rest, practice"
                          className="flex-1 bg-elevated border border-border rounded-xl h-10 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {scheduleChoice === "no" && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">What do you want to focus on?</p>
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_FOCUSES.map(f => (
                    <Chip key={f.value} label={f.label} selected={selectedWorkoutFocus === f.value} onToggle={() => setSelectedWorkoutFocus(prev => prev === f.value ? "" : f.value)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <SaveBtn onClick={handleSaveTraining} pending={isSaving} saved={saved3} label="Save training" />
        </section>

        {/* ── 4. Daily Schedule ─────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Daily Schedule</p>

          {/* Wake time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground tracking-wide">Wake time</p>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                {(["exact","range"] as const).map(m => (
                  <button key={m} onClick={() => setWakeMode(m)}
                    className={`px-2.5 py-1 font-semibold capitalize transition-colors ${wakeMode === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {wakeMode === "exact" ? (
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className={inputCls} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Earliest</p>
                  <input type="time" value={wakeRangeStart} onChange={e => setWakeRangeStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Latest</p>
                  <input type="time" value={wakeRangeEnd} onChange={e => setWakeRangeEnd(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* Sleep time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground tracking-wide">Sleep time</p>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                {(["exact","range"] as const).map(m => (
                  <button key={m} onClick={() => setSleepMode(m)}
                    className={`px-2.5 py-1 font-semibold capitalize transition-colors ${sleepMode === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {sleepMode === "exact" ? (
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className={inputCls} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Earliest</p>
                  <input type="time" value={sleepRangeStart} onChange={e => setSleepRangeStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Latest</p>
                  <input type="time" value={sleepRangeEnd} onChange={e => setSleepRangeEnd(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          <Field label={`Meals per day — ${mealsPerDay}`}>
            <input
              type="range"
              min={1}
              max={8}
              value={mealsPerDay}
              onChange={e => setMealsPerDay(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {[1,2,3,4,5,6,7,8].map(n => <span key={n}>{n}</span>)}
            </div>
          </Field>

          <Field label={`Daily water — ${waterIntakeLiters}L`}>
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.5}
              value={waterIntakeLiters}
              onChange={e => setWaterIntakeLiters(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.5L</span><span>3L</span><span>6L</span>
            </div>
          </Field>

          <SaveBtn onClick={handleSaveSchedule} pending={isSaving} saved={saved4} label="Save schedule" />
        </section>

        {/* ── 5. Preferences ───────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Preferences</p>

          <Field label="Commitment level">
            <div className="space-y-2">
              {COMMITMENT_LEVELS.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setCommitmentLevel(level.value)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all",
                    commitmentLevel === level.value
                      ? "bg-primary/10 border-primary"
                      : "bg-elevated border-border hover:bg-card"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{level.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{level.desc}</p>
                </button>
              ))}
            </div>
          </Field>

          <SaveBtn onClick={handleSavePreferences} pending={isSaving} saved={saved5} label="Save preferences" />
        </section>

        {/* ── Danger zone ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-card border border-destructive/30 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-[18px] h-[18px] text-destructive" strokeWidth={2} />
            <p className="text-sm font-semibold text-foreground">Reset my profile</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This permanently deletes your profile, plan, workouts, meals, journal, reviews, weigh-ins, and
            coach chat. You'll start onboarding again. This cannot be undone.
          </p>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-destructive/10 border border-destructive/40 text-destructive h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
              data-testid="button-reset"
            >
              <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2} />
              Reset my profile
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <button
                onClick={handleReset}
                disabled={resetProfile.isPending}
                className="flex items-center justify-center gap-2 w-full bg-destructive text-destructive-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
                data-testid="button-reset-confirm"
              >
                {resetProfile.isPending ? "Resetting..." : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="w-full h-12 rounded-xl text-sm font-semibold text-muted-foreground"
                data-testid="button-reset-cancel"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
