import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateUserProfile, useGeneratePlan, getGetCurrentPlanQueryKey, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ChevronLeft, AlertTriangle, CheckCircle } from "lucide-react";

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

const step1Schema = z.object({
  name: z.string().min(1, "Required"),
  age: z.coerce.number().int().min(13).max(100),
  gender: z.string().min(1, "Required"),
  heightCm: z.coerce.number().min(100).max(250),
  currentWeightKg: z.coerce.number().min(30).max(300),
  goalWeightKg: z.coerce.number().min(30).max(300),
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

const TOTAL_STEPS = 5;

const STEP_TITLES = [
  "Who are you?",
  "Training",
  "Daily Routine",
  "Nutrition",
  "Review & Launch",
];

function Chip({ label, selected, onToggle, testId }: { label: string; selected: boolean; onToggle: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border active:bg-muted"
      )}
      data-testid={testId ?? `chip-${label.replace(/\s+/g, "-")}`}
    >
      {label}
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{children}</p>;
}

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

  const handleSubmit = async () => {
    const payload = {
      ...formData,
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
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold uppercase tracking-tighter text-primary">UPGRADE</p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {step}/{TOTAL_STEPS}
          </p>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div
            className="h-1 bg-primary transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-2">
          {STEP_TITLES[step - 1]}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-area">
        <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

          {/* STEP 1 — Identity */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div className="space-y-1">
                <SectionLabel>Your Name</SectionLabel>
                <Input
                  {...form1.register("name")}
                  placeholder="First name or nickname"
                  className="bg-card border-border"
                  data-testid="input-name"
                  autoComplete="given-name"
                />
                <FieldError msg={form1.formState.errors.name?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <SectionLabel>Age</SectionLabel>
                  <Input {...form1.register("age")} type="number" inputMode="numeric" placeholder="25" className="bg-card border-border" data-testid="input-age" />
                  <FieldError msg={form1.formState.errors.age?.message} />
                </div>
                <div className="space-y-1">
                  <SectionLabel>Gender</SectionLabel>
                  <div className="flex gap-1.5 flex-wrap">
                    {["Male","Female","Other"].map(g => (
                      <Chip key={g} label={g} selected={form1.watch("gender") === g} onToggle={() => form1.setValue("gender", g)} testId={`option-${g}`} />
                    ))}
                  </div>
                  <FieldError msg={form1.formState.errors.gender?.message} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <SectionLabel>Height (cm)</SectionLabel>
                  <Input {...form1.register("heightCm")} type="number" inputMode="numeric" placeholder="175" className="bg-card border-border" data-testid="input-height" />
                </div>
                <div className="space-y-1">
                  <SectionLabel>Current (kg)</SectionLabel>
                  <Input {...form1.register("currentWeightKg")} type="number" inputMode="decimal" step="0.1" placeholder="80" className="bg-card border-border" data-testid="input-current-weight" />
                </div>
                <div className="space-y-1">
                  <SectionLabel>Goal (kg)</SectionLabel>
                  <Input {...form1.register("goalWeightKg")} type="number" inputMode="decimal" step="0.1" placeholder="70" className="bg-card border-border" data-testid="input-goal-weight" />
                </div>
              </div>

              <div>
                <SectionLabel>Body Type</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["skinny","overweight","fit","average"].map(t => (
                    <Chip key={t} label={t} selected={form1.watch("bodyType") === t} onToggle={() => form1.setValue("bodyType", t)} testId={`option-${t}`} />
                  ))}
                </div>
                <FieldError msg={form1.formState.errors.bodyType?.message} />
              </div>

              <div>
                <SectionLabel>Main Goals (pick all that apply)</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map(g => (
                    <Chip key={g} label={g} selected={selectedGoals.includes(g)} onToggle={() => toggleGoal(g)} />
                  ))}
                </div>
                {selectedGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">Select at least one</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12 text-sm uppercase tracking-widest font-bold" data-testid="button-next-step1">
                  Continue →
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2 — Training */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <div>
                <SectionLabel>Fitness Level</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["beginner","intermediate","advanced"].map(l => (
                    <Chip key={l} label={l} selected={form2.watch("fitnessLevel") === l} onToggle={() => form2.setValue("fitnessLevel", l)} testId={`option-${l}`} />
                  ))}
                </div>
                <FieldError msg={form2.formState.errors.fitnessLevel?.message} />
              </div>

              <div>
                <SectionLabel>Gym Access</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["full gym","home gym","no gym"].map(g => (
                    <Chip key={g} label={g} selected={form2.watch("gymAccess") === g} onToggle={() => form2.setValue("gymAccess", g)} testId={`option-${g.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
                <FieldError msg={form2.formState.errors.gymAccess?.message} />
              </div>

              <div>
                <SectionLabel>Workout Days Per Week — {form2.watch("workoutDaysPerWeek") ?? 3} days</SectionLabel>
                <Slider
                  min={1} max={7} step={1}
                  value={[form2.watch("workoutDaysPerWeek") ?? 3]}
                  onValueChange={v => form2.setValue("workoutDaysPerWeek", v[0])}
                  data-testid="slider-workout-days"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>1 day</span><span>7 days</span>
                </div>
              </div>

              <div>
                <SectionLabel>Preferred Workout Time</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["morning","afternoon","evening","any"].map(t => (
                    <Chip key={t} label={t} selected={form2.watch("preferredWorkoutTime") === t} onToggle={() => form2.setValue("preferredWorkoutTime", t)} testId={`option-${t}`} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Target Date (optional)</SectionLabel>
                <Input {...form2.register("targetDate")} type="date" className="bg-card border-border" data-testid="input-target-date" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 px-5" data-testid="button-back-step2">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" className="flex-1 h-12 text-sm uppercase tracking-widest font-bold" data-testid="button-next-step2">
                  Continue →
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3 — Daily Routine */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Wake Time</SectionLabel>
                  <Input {...form3.register("wakeTime")} type="time" className="bg-card border-border" data-testid="input-wake-time" />
                  <FieldError msg={form3.formState.errors.wakeTime?.message} />
                </div>
                <div>
                  <SectionLabel>Sleep Time</SectionLabel>
                  <Input {...form3.register("sleepTime")} type="time" className="bg-card border-border" data-testid="input-sleep-time" />
                  <FieldError msg={form3.formState.errors.sleepTime?.message} />
                </div>
              </div>

              <div>
                <SectionLabel>Work / School Schedule</SectionLabel>
                <Input
                  {...form3.register("workSchedule")}
                  placeholder="e.g. 9am–5pm office, student, N/A"
                  className="bg-card border-border"
                  data-testid="input-work-schedule"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <SectionLabel>Current Sleep Quality — {sleepQuality}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[sleepQuality]} onValueChange={v => setSleepQuality(v[0])} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Poor</span><span>Excellent</span>
                  </div>
                </div>
                <div>
                  <SectionLabel>Current Energy Level — {energyLevel}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[energyLevel]} onValueChange={v => setEnergyLevel(v[0])} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Exhausted</span><span>Full energy</span>
                  </div>
                </div>
                <div>
                  <SectionLabel>Stress Level — {stressLevel}/10</SectionLabel>
                  <Slider min={1} max={10} step={1} value={[stressLevel]} onValueChange={v => setStressLevel(v[0])} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Calm</span><span>Very stressed</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="h-12 px-5" data-testid="button-back-step3">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" className="flex-1 h-12 text-sm uppercase tracking-widest font-bold" data-testid="button-next-step3">
                  Continue →
                </Button>
              </div>
            </form>
          )}

          {/* STEP 4 — Nutrition & Health */}
          {step === 4 && (
            <form onSubmit={handleStep4} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Meals Per Day</SectionLabel>
                  <Input {...form4.register("mealsPerDay")} type="number" inputMode="numeric" min={1} max={8} placeholder="3" className="bg-card border-border" data-testid="input-meals-per-day" />
                </div>
                <div>
                  <SectionLabel>Water (L/day)</SectionLabel>
                  <Input {...form4.register("waterIntakeLiters")} type="number" inputMode="decimal" step="0.5" placeholder="2" className="bg-card border-border" data-testid="input-water" />
                </div>
              </div>

              <div>
                <SectionLabel>Diet Style</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["no preference","vegetarian","vegan","keto","high protein","paleo"].map(d => (
                    <Chip key={d} label={d} selected={form4.watch("dietStyle") === d} onToggle={() => form4.setValue("dietStyle", d)} testId={`option-${d.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Foods You Dislike or Won't Eat</SectionLabel>
                <Input {...form4.register("dislikedFoods")} placeholder="e.g. broccoli, fish, tofu" className="bg-card border-border" data-testid="input-disliked-foods" />
              </div>

              <div>
                <SectionLabel>Allergies</SectionLabel>
                <Input {...form4.register("allergies")} placeholder="e.g. nuts, dairy, gluten, none" className="bg-card border-border" data-testid="input-allergies" />
              </div>

              <div>
                <SectionLabel>Skin Concerns</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {SKIN_CONCERNS.map(s => (
                    <Chip key={s} label={s} selected={skinConcerns.includes(s)} onToggle={() => toggleSkin(s)} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Digestion / Bloating Concerns</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {DIGESTION_CONCERNS.map(d => (
                    <Chip key={d} label={d} selected={digestionConcerns.includes(d)} onToggle={() => toggleDigestion(d)} />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Biggest Struggle</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {STRUGGLES.map(s => (
                    <Chip key={s} label={s} selected={biggestStruggle === s} onToggle={() => setBiggestStruggle(prev => prev === s ? "" : s)} testId={`option-${s.replace(/\s+/g,"-")}`} />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)} className="h-12 px-5" data-testid="button-back-step4">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" className="flex-1 h-12 text-sm uppercase tracking-widest font-bold" data-testid="button-next-step4">
                  Continue →
                </Button>
              </div>
            </form>
          )}

          {/* STEP 5 — Review & Launch */}
          {step === 5 && (
            <div className="space-y-5">
              {/* Summary of collected data */}
              <div className="bg-card border border-border p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your Profile</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground text-xs">Name</span><br /><span className="font-semibold">{formData.name}</span></div>
                  <div><span className="text-muted-foreground text-xs">Age</span><br /><span className="font-semibold">{formData.age}</span></div>
                  <div><span className="text-muted-foreground text-xs">Current weight</span><br /><span className="font-semibold">{formData.currentWeightKg} kg</span></div>
                  <div><span className="text-muted-foreground text-xs">Goal weight</span><br /><span className="font-semibold text-primary">{formData.goalWeightKg} kg</span></div>
                  <div><span className="text-muted-foreground text-xs">Fitness level</span><br /><span className="font-semibold">{formData.fitnessLevel}</span></div>
                  <div><span className="text-muted-foreground text-xs">Gym access</span><br /><span className="font-semibold">{formData.gymAccess}</span></div>
                  <div><span className="text-muted-foreground text-xs">Workout days</span><br /><span className="font-semibold">{formData.workoutDaysPerWeek}x / week</span></div>
                  <div><span className="text-muted-foreground text-xs">Schedule</span><br /><span className="font-semibold">{formData.wakeTime} – {formData.sleepTime}</span></div>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1.5">Goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGoals.map(g => (
                      <span key={g} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">{g}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* What you'll get */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">What's being built for you</p>
                {[
                  "Calorie & protein targets (calculated from your stats)",
                  "Personalized daily schedule",
                  "Workout plan for your level & equipment",
                  "Meal check-in with instant coach feedback",
                  "Nightly reviews with scored performance",
                  "Weekly weigh-in plan adjustments",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="bg-muted/20 border border-border p-3 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Project Upgrade is not medical advice. If you have a history of eating disorders, diabetes, pregnancy, or any serious health condition, consult a healthcare professional before starting.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(4)} disabled={isLoading} className="h-12 px-5" data-testid="button-back-step5">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  className="flex-1 h-12 text-sm uppercase tracking-widest font-bold"
                  onClick={handleSubmit}
                  disabled={isLoading || selectedGoals.length === 0}
                  data-testid="button-submit-onboarding"
                >
                  {isLoading ? "Building your plan…" : "Launch My Plan"}
                </Button>
              </div>

              {(createProfile.isError || generatePlan.isError) && (
                <p className="text-xs text-destructive text-center">Something went wrong. Check your connection and try again.</p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
