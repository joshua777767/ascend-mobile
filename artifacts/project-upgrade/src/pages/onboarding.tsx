import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateUserProfile, useGeneratePlan, getGetCurrentPlanQueryKey, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ChevronLeft, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

const GOALS = [
  "lose fat","lose weight","gain weight","build muscle",
  "maintain fitness","better skin","higher energy","better sleep","discipline",
];
const SKIN_CONCERNS = ["acne","oily skin","dry skin","dull skin","none"];
const DIGESTION_CONCERNS = ["bloating","constipation","stomach pain","none"];
const STRUGGLES = [
  "cravings","consistency","late-night eating","motivation","fast food",
  "no appetite","no time","binge eating","skipping meals","not eating enough",
];

const SPORTS = [
  "No sport","Football","Basketball","Soccer","Track","Boxing/MMA",
  "Baseball/Softball","Volleyball","Wrestling","Other",
];

const WORKOUT_FOCUSES = [
  { label: "Lose fat", value: "lose_fat" },
  { label: "Build muscle", value: "build_muscle" },
  { label: "Strength", value: "strength" },
  { label: "Athletic performance", value: "athletic_performance" },
  { label: "Conditioning", value: "conditioning" },
  { label: "General fitness", value: "general_fitness" },
];

const step1Schema = z.object({
  name: z.string().min(1, "Required"),
  age: z.coerce.number().int().min(13).max(100),
  gender: z.string().min(1, "Required"),
  heightFt: z.coerce.number().int().min(3).max(8),
  heightIn: z.coerce.number().int().min(0).max(11),
  currentWeightLbs: z.coerce.number().min(66).max(660),
  goalWeightLbs: z.coerce.number().min(66).max(660),
  bodyType: z.string().min(1, "Required"),
});

const step2Schema = z.object({
  fitnessLevel: z.string().min(1, "Required"),
  gymAccess: z.string().min(1, "Required"),
  workoutDaysPerWeek: z.coerce.number().int().min(1).max(7),
  preferredWorkoutTime: z.string().optional(),
  targetDate: z.string().optional(),
});

const step3Schema = z.object({
  wakeTime: z.string().min(1, "Required"),
  sleepTime: z.string().min(1, "Required"),
  workSchedule: z.string().optional(),
});

const step4Schema = z.object({
  mealsPerDay: z.coerce.number().int().min(1).max(8),
  waterIntakeLiters: z.coerce.number().min(0.5).max(10),
  allergies: z.string().optional(),
  dislikedFoods: z.string().optional(),
  dietStyle: z.string().optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;
type Step4 = z.infer<typeof step4Schema>;

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "About you",
  "Your training",
  "Daily routine",
  "Nutrition & health",
  "Your commitment",
  "Review & launch",
];

const STEP_SUBTITLES = [
  "Let's set up your profile",
  "How you like to train",
  "When you wake, work, and rest",
  "What you eat and how you feel",
  "How serious are you about this goal?",
  "Confirm and build your plan",
];

const COMMITMENT_LEVELS = [
  { value: "casual", label: "Casual", desc: "I want to make small changes, no pressure." },
  { value: "serious", label: "Serious", desc: "I'm focused. I'll follow the plan and track daily." },
  { value: "locked_in", label: "Locked In", desc: "No fake tracking. I want real results and honest accountability." },
  { value: "extreme_discipline", label: "Extreme Discipline", desc: "I want to push. Maximum focus, strict habits, no excuses." },
];

function Chip({ label, selected, onToggle, testId }: { label: string; selected: boolean; onToggle: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "px-4 py-2.5 rounded-full text-sm font-medium capitalize border transition-all active:scale-[0.97]",
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
          : "bg-card text-muted-foreground border-border active:bg-elevated"
      )}
      data-testid={testId ?? `chip-${label.replace(/\s+/g, "-")}`}
    >
      {label}
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1.5">{msg}</p>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground mb-2.5">{children}</p>;
}

const inputClass = "bg-elevated border-border rounded-xl h-12 text-base";
const textareaClass = "bg-elevated border border-border rounded-xl p-3 text-base text-foreground placeholder:text-muted-foreground w-full resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [digestionConcerns, setDigestionConcerns] = useState<string[]>([]);
  const [biggestStruggle, setBiggestStruggle] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [formData, setFormData] = useState<Partial<Step1 & Step2 & Step3 & Step4>>({});
  const [commitmentLevel, setCommitmentLevel] = useState<string>("");

  // Sport & schedule state
  const [selectedSport, setSelectedSport] = useState("");
  const [sportCustomText, setSportCustomText] = useState("");
  const [scheduleChoice, setScheduleChoice] = useState<"" | "yes" | "no">("");
  const [ownScheduleText, setOwnScheduleText] = useState("");
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] = useState("");

  const createProfile = useCreateUserProfile();
  const generatePlan = useGeneratePlan();

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { workoutDaysPerWeek: 3 } });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema), defaultValues: { wakeTime: "06:30", sleepTime: "22:30" } });
  const form4 = useForm<Step4>({ resolver: zodResolver(step4Schema), defaultValues: { mealsPerDay: 3, waterIntakeLiters: 2 } });

  const toggleGoal = (g: string) => setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleSkin = (s: string) => setSkinConcerns(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleDigestion = (d: string) => setDigestionConcerns(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleStep1 = form1.handleSubmit((data) => {
    if (selectedGoals.length === 0) return;
    setFormData(prev => ({ ...prev, ...data }));
    setStep(2);
  });
  const handleStep2 = form2.handleSubmit((data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setStep(3);
  });
  const handleStep3 = form3.handleSubmit((data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setStep(4);
  });
  const handleStep4 = form4.handleSubmit((data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setStep(5);
  });

  const handleStep5 = () => {
    if (!commitmentLevel) return;
    setStep(6);
  };

  const handleSubmit = async () => {
    const { heightFt, heightIn, currentWeightLbs, goalWeightLbs, ...rest } = formData;
    const heightCm = Math.round((((heightFt ?? 0) * 12 + (heightIn ?? 0)) * 2.54) * 10) / 10;
    const currentWeightKg = Math.round(((currentWeightLbs ?? 0) / 2.2046226) * 10) / 10;
    const goalWeightKg = Math.round(((goalWeightLbs ?? 0) / 2.2046226) * 10) / 10;

    const sportValue = selectedSport.toLowerCase();
    const sportCustom = selectedSport.toLowerCase() === "other" ? sportCustomText : undefined;
    const hasOwnSchedule = scheduleChoice || undefined;
    const ownSchedule = scheduleChoice === "yes" ? ownScheduleText : undefined;
    const workoutFocus = scheduleChoice === "no" ? selectedWorkoutFocus : undefined;

    const payload = {
      ...rest,
      heightCm,
      currentWeightKg,
      goalWeightKg,
      goals: selectedGoals,
      skinConcerns,
      digestionConcerns,
      biggestStruggle,
      sleepQuality,
      energyLevel,
      stressLevel,
      mealsPerDay: formData.mealsPerDay ?? 3,
      waterIntakeLiters: formData.waterIntakeLiters ?? 2,
      workoutDaysPerWeek: formData.workoutDaysPerWeek ?? 3,
      wakeTime: formData.wakeTime ?? "06:30",
      sleepTime: formData.sleepTime ?? "22:30",
      ...(sportValue ? { sport: sportValue } : {}),
      ...(sportCustom ? { sportCustom } : {}),
      ...(hasOwnSchedule ? { hasOwnSchedule } : {}),
      ...(ownSchedule ? { ownSchedule } : {}),
      ...(workoutFocus ? { workoutFocus } : {}),
      commitmentLevel,
    } as any;
    try {
      await createProfile.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      await generatePlan.mutateAsync(undefined as any);
      queryClient.invalidateQueries({ queryKey: getGetCurrentPlanQueryKey() });
      setLocation("/dashboard");
    } catch (e) {
      console.error(e);
    }
  };

  const isLoading = createProfile.isPending || generatePlan.isPending;

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{ height: "100dvh", overflow: "hidden", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Sticky header */}
      <div className="shrink-0 px-5 pt-5 pb-4 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-xs">A</span>
            </div>
            <span className="text-sm font-bold tracking-tight">Ascend</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-area">
        <div className="px-5 pt-2 pb-6 max-w-lg mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{STEP_TITLES[step - 1]}</h1>
            <p className="text-sm text-muted-foreground mt-1">{STEP_SUBTITLES[step - 1]}</p>
          </div>

          {/* STEP 1 — Identity */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-6">
              <div>
                <SectionLabel>Your name</SectionLabel>
                <Input
                  {...form1.register("name")}
                  placeholder="First name or nickname"
                  className={inputClass}
                  data-testid="input-name"
                  autoComplete="given-name"
                />
                <FieldError msg={form1.formState.errors.name?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Age</SectionLabel>
                  <Input {...form1.register("age")} type="number" inputMode="numeric" placeholder="25" className={inputClass} data-testid="input-age" />
                  <FieldError msg={form1.formState.errors.age?.message} />
                </div>
                <div>
                  <SectionLabel>Gender</SectionLabel>
                  <div className="flex gap-2 flex-wrap">
                    {["Male","Female","Other"].map(g => (
                      <Chip key={g} label={g} selected={form1.watch("gender") === g} onToggle={() => form1.setValue("gender", g)} testId={`option-${g}`} />
                    ))}
                  </div>
                  <FieldError msg={form1.formState.errors.gender?.message} />
                </div>
              </div>

              <div>
                <SectionLabel>Height</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input {...form1.register("heightFt")} type="number" inputMode="numeric" placeholder="6" className={inputClass} data-testid="input-height-ft" />
                    <p className="text-xs text-muted-foreground mt-1">feet</p>
                  </div>
                  <div>
                    <Input {...form1.register("heightIn")} type="number" inputMode="numeric" placeholder="0" className={inputClass} data-testid="input-height-in" />
                    <p className="text-xs text-muted-foreground mt-1">inches</p>
                  </div>
                </div>
                <FieldError msg={form1.formState.errors.heightFt?.message ?? form1.formState.errors.heightIn?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Current weight</SectionLabel>
                  <Input {...form1.register("currentWeightLbs")} type="number" inputMode="decimal" step="0.1" placeholder="220" className={inputClass} data-testid="input-current-weight" />
                  <p className="text-xs text-muted-foreground mt-1">lbs</p>
                </div>
                <div>
                  <SectionLabel>Goal weight</SectionLabel>
                  <Input {...form1.register("goalWeightLbs")} type="number" inputMode="decimal" step="0.1" placeholder="200" className={inputClass} data-testid="input-goal-weight" />
                  <p className="text-xs text-muted-foreground mt-1">lbs</p>
                </div>
              </div>

              <div>
                <SectionLabel>Body type</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["skinny","overweight","fit","average"].map(t => (
                    <Chip key={t} label={t} selected={form1.watch("bodyType") === t} onToggle={() => form1.setValue("bodyType", t)} testId={`option-${t}`} />
                  ))}
                </div>
                <FieldError msg={form1.formState.errors.bodyType?.message} />
              </div>

              <div>
                <SectionLabel>Main goals</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map(g => (
                    <Chip key={g} label={g} selected={selectedGoals.includes(g)} onToggle={() => toggleGoal(g)} />
                  ))}
                </div>
                {selectedGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Pick all that apply — at least one.</p>
                )}
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl text-[15px] font-semibold gap-2" data-testid="button-next-step1">
                Continue <ArrowRight className="w-[18px] h-[18px]" />
              </Button>
            </form>
          )}

          {/* STEP 2 — Training */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-6">
              <div>
                <SectionLabel>Fitness level</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["beginner","intermediate","advanced"].map(l => (
                    <Chip key={l} label={l} selected={form2.watch("fitnessLevel") === l} onToggle={() => form2.setValue("fitnessLevel", l)} testId={`option-${l}`} />
                  ))}
                </div>
                <FieldError msg={form2.formState.errors.fitnessLevel?.message} />
              </div>

              <div>
                <SectionLabel>Gym access</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["full gym","home gym","no gym"].map(g => (
                    <Chip key={g} label={g} selected={form2.watch("gymAccess") === g} onToggle={() => form2.setValue("gymAccess", g)} testId={`option-${g.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
                <FieldError msg={form2.formState.errors.gymAccess?.message} />
              </div>

              <div>
                <SectionLabel>Workout days — {form2.watch("workoutDaysPerWeek") ?? 3} per week</SectionLabel>
                <Slider
                  min={1} max={7} step={1}
                  value={[form2.watch("workoutDaysPerWeek") ?? 3]}
                  onValueChange={v => form2.setValue("workoutDaysPerWeek", v[0])}
                  data-testid="slider-workout-days"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1 day</span><span>7 days</span>
                </div>
              </div>

              <div>
                <SectionLabel>Preferred workout time</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["morning","afternoon","evening","any"].map(t => (
                    <Chip key={t} label={t} selected={form2.watch("preferredWorkoutTime") === t} onToggle={() => form2.setValue("preferredWorkoutTime", t)} testId={`option-${t}`} />
                  ))}
                </div>
              </div>

              {/* Sport question */}
              <div>
                <SectionLabel>Do you play any sports?</SectionLabel>
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
                  <div className="mt-3">
                    <Input
                      value={sportCustomText}
                      onChange={e => setSportCustomText(e.target.value)}
                      placeholder="What sport do you play?"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {/* Schedule question */}
              <div>
                <SectionLabel>Do you already have a workout schedule?</SectionLabel>
                <div className="flex gap-2">
                  <Chip
                    label="Yes, I have one"
                    selected={scheduleChoice === "yes"}
                    onToggle={() => setScheduleChoice(prev => prev === "yes" ? "" : "yes")}
                  />
                  <Chip
                    label="No, generate one"
                    selected={scheduleChoice === "no"}
                    onToggle={() => setScheduleChoice(prev => prev === "no" ? "" : "no")}
                  />
                </div>

                {scheduleChoice === "yes" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Enter your weekly schedule. Example: Monday chest/back, Tuesday football practice, Wednesday legs, Thursday rest, Friday full body.</p>
                    <textarea
                      value={ownScheduleText}
                      onChange={e => setOwnScheduleText(e.target.value)}
                      placeholder="Mon: chest/back, Tue: practice, Wed: legs, Thu: rest, Fri: full body..."
                      className={textareaClass}
                      rows={4}
                    />
                  </div>
                )}

                {scheduleChoice === "no" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">What do you want to focus on? A schedule will be built for you.</p>
                    <div className="flex flex-wrap gap-2">
                      {WORKOUT_FOCUSES.map(f => (
                        <Chip
                          key={f.value}
                          label={f.label}
                          selected={selectedWorkoutFocus === f.value}
                          onToggle={() => setSelectedWorkoutFocus(prev => prev === f.value ? "" : f.value)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <SectionLabel>Target date (optional)</SectionLabel>
                <Input {...form2.register("targetDate")} type="date" className={inputClass} data-testid="input-target-date" />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-14 px-5 rounded-2xl" data-testid="button-back-step2">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button type="submit" className="flex-1 h-14 rounded-2xl text-[15px] font-semibold gap-2" data-testid="button-next-step2">
                  Continue <ArrowRight className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3 — Daily Routine */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Wake time</SectionLabel>
                  <Input {...form3.register("wakeTime")} type="time" className={inputClass} data-testid="input-wake-time" />
                  <FieldError msg={form3.formState.errors.wakeTime?.message} />
                </div>
                <div>
                  <SectionLabel>Sleep time</SectionLabel>
                  <Input {...form3.register("sleepTime")} type="time" className={inputClass} data-testid="input-sleep-time" />
                  <FieldError msg={form3.formState.errors.sleepTime?.message} />
                </div>
              </div>

              <div>
                <SectionLabel>Work / school schedule</SectionLabel>
                <Input
                  {...form3.register("workSchedule")}
                  placeholder="e.g. 9am–5pm office, student, N/A"
                  className={inputClass}
                  data-testid="input-work-schedule"
                />
              </div>

              <div className="space-y-6">
                <div>
                  <SectionLabel>Sleep quality — {sleepQuality}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[sleepQuality]} onValueChange={v => setSleepQuality(v[0])} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Poor</span><span>Excellent</span>
                  </div>
                </div>
                <div>
                  <SectionLabel>Energy level — {energyLevel}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[energyLevel]} onValueChange={v => setEnergyLevel(v[0])} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Exhausted</span><span>Full energy</span>
                  </div>
                </div>
                <div>
                  <SectionLabel>Stress level — {stressLevel}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[stressLevel]} onValueChange={v => setStressLevel(v[0])} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Calm</span><span>Very stressed</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="h-14 px-5 rounded-2xl" data-testid="button-back-step3">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button type="submit" className="flex-1 h-14 rounded-2xl text-[15px] font-semibold gap-2" data-testid="button-next-step3">
                  Continue <ArrowRight className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 4 — Nutrition & Health */}
          {step === 4 && (
            <form onSubmit={handleStep4} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Meals per day</SectionLabel>
                  <Input {...form4.register("mealsPerDay")} type="number" inputMode="numeric" min={1} max={8} placeholder="3" className={inputClass} data-testid="input-meals-per-day" />
                </div>
                <div>
                  <SectionLabel>Water (L/day)</SectionLabel>
                  <Input {...form4.register("waterIntakeLiters")} type="number" inputMode="decimal" step="0.5" placeholder="2" className={inputClass} data-testid="input-water" />
                </div>
              </div>

              <div>
                <SectionLabel>Diet style</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["no preference","vegetarian","vegan","keto","high protein","paleo"].map(d => (
                    <Chip key={d} label={d} selected={form4.watch("dietStyle") === d} onToggle={() => form4.setValue("dietStyle", d)} testId={`option-${d.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Foods you dislike or won't eat</SectionLabel>
                <Input {...form4.register("dislikedFoods")} placeholder="e.g. broccoli, fish, tofu" className={inputClass} data-testid="input-disliked-foods" />
              </div>

              <div>
                <SectionLabel>Allergies</SectionLabel>
                <Input {...form4.register("allergies")} placeholder="e.g. nuts, dairy, gluten, none" className={inputClass} data-testid="input-allergies" />
              </div>

              <div>
                <SectionLabel>Skin concerns</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {SKIN_CONCERNS.map(s => (
                    <Chip key={s} label={s} selected={skinConcerns.includes(s)} onToggle={() => toggleSkin(s)} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Digestion / bloating</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {DIGESTION_CONCERNS.map(d => (
                    <Chip key={d} label={d} selected={digestionConcerns.includes(d)} onToggle={() => toggleDigestion(d)} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Biggest struggle</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {STRUGGLES.map(s => (
                    <Chip key={s} label={s} selected={biggestStruggle === s} onToggle={() => setBiggestStruggle(prev => prev === s ? "" : s)} testId={`option-${s.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(3)} className="h-14 px-5 rounded-2xl" data-testid="button-back-step4">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button type="submit" className="flex-1 h-14 rounded-2xl text-[15px] font-semibold gap-2" data-testid="button-next-step4">
                  Continue <ArrowRight className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 5 — Commitment Level */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-3">
                {COMMITMENT_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setCommitmentLevel(level.value)}
                    className={cn(
                      "w-full text-left rounded-2xl border p-4 transition-all",
                      commitmentLevel === level.value
                        ? "bg-primary/10 border-primary shadow-sm shadow-primary/10"
                        : "bg-card border-border hover:bg-elevated"
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{level.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{level.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(4)} className="h-14 px-5 rounded-2xl" data-testid="button-back-step5">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  type="button"
                  onClick={handleStep5}
                  disabled={!commitmentLevel}
                  className="flex-1 h-14 rounded-2xl text-[15px] font-semibold gap-2"
                  data-testid="button-next-step5"
                >
                  Continue <ArrowRight className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6 — Review & Launch */}
          {step === 6 && (
            <div className="space-y-5">
              {/* Summary of collected data */}
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Your profile</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Name</span><br /><span className="font-semibold">{formData.name}</span></div>
                  <div><span className="text-muted-foreground text-xs">Age</span><br /><span className="font-semibold">{formData.age}</span></div>
                  <div><span className="text-muted-foreground text-xs">Height</span><br /><span className="font-semibold">{formData.heightFt} ft {formData.heightIn ?? 0} in</span></div>
                  <div><span className="text-muted-foreground text-xs">Current weight</span><br /><span className="font-semibold">{formData.currentWeightLbs} lbs</span></div>
                  <div><span className="text-muted-foreground text-xs">Goal weight</span><br /><span className="font-semibold text-primary">{formData.goalWeightLbs} lbs</span></div>
                  <div><span className="text-muted-foreground text-xs">Fitness level</span><br /><span className="font-semibold capitalize">{formData.fitnessLevel}</span></div>
                  <div><span className="text-muted-foreground text-xs">Gym access</span><br /><span className="font-semibold capitalize">{formData.gymAccess}</span></div>
                  <div><span className="text-muted-foreground text-xs">Workout days</span><br /><span className="font-semibold">{formData.workoutDaysPerWeek}x / week</span></div>
                  <div><span className="text-muted-foreground text-xs">Schedule</span><br /><span className="font-semibold">{formData.wakeTime} – {formData.sleepTime}</span></div>
                  {selectedSport && selectedSport.toLowerCase() !== "no sport" && (
                    <div>
                      <span className="text-muted-foreground text-xs">Sport</span><br />
                      <span className="font-semibold capitalize">
                        {selectedSport.toLowerCase() === "other" && sportCustomText ? sportCustomText : selectedSport}
                      </span>
                    </div>
                  )}
                  {scheduleChoice && (
                    <div>
                      <span className="text-muted-foreground text-xs">Workout plan</span><br />
                      <span className="font-semibold">{scheduleChoice === "yes" ? "Custom schedule" : "AI generated"}</span>
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Goals</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedGoals.map(g => (
                      <span key={g} className="text-xs font-medium px-3 py-1.5 rounded-full bg-elevated border border-border capitalize">{g}</span>
                    ))}
                  </div>
                </div>
                {scheduleChoice === "yes" && ownScheduleText && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Your schedule</p>
                    <p className="text-xs text-foreground leading-relaxed">{ownScheduleText}</p>
                  </div>
                )}
                {scheduleChoice === "no" && selectedWorkoutFocus && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Workout focus</p>
                    <p className="text-xs font-medium text-primary capitalize">{selectedWorkoutFocus.replace(/_/g, " ")}</p>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-xs text-muted-foreground mb-1">Commitment level</p>
                <p className="text-sm font-semibold text-primary">
                  {COMMITMENT_LEVELS.find(c => c.value === commitmentLevel)?.label ?? "Not selected"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {COMMITMENT_LEVELS.find(c => c.value === commitmentLevel)?.desc ?? ""}
                </p>
              </div>

              {/* What you'll get */}
              <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">What's being built for you</p>
                {[
                  "Calorie & protein targets from your stats",
                  scheduleChoice === "yes"
                    ? "Your custom schedule saved — coach works around it"
                    : "A personalized workout schedule for your focus & sport",
                  "Meal check-ins with instant coach feedback",
                  "Nightly reviews with a performance score",
                  "Weekly weigh-in plan adjustments",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-[18px] h-[18px] text-success shrink-0 mt-0.5" strokeWidth={2.2} />
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="rounded-2xl bg-elevated border border-border p-4 flex gap-3">
                <AlertTriangle className="w-[18px] h-[18px] text-warning shrink-0 mt-0.5" strokeWidth={2.2} />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ascend is not medical advice. If you have a history of eating disorders, diabetes, pregnancy, or any serious health condition, consult a healthcare professional before starting.
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(5)} className="h-14 px-5 rounded-2xl" data-testid="button-back-step6">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 h-14 rounded-2xl text-[15px] font-semibold gap-2"
                  data-testid="button-launch"
                >
                  {isLoading ? "Building your plan…" : "Launch my plan"}
                  {!isLoading && <ArrowRight className="w-[18px] h-[18px]" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
