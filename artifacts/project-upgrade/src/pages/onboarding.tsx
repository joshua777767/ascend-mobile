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
import { ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";

const GOALS = [
  "lose fat","lose weight","gain weight","build muscle","maintain fitness",
  "get leaner","athletic performance","better skin","higher energy",
  "better sleep","less bloating","better digestion","discipline","confidence"
];
const SKIN_CONCERNS = ["acne","oily skin","dry skin","dull skin","none"];
const DIGESTION_CONCERNS = ["bloating","constipation","stomach pain","none"];
const STRUGGLES = [
  "cravings","consistency","late-night eating","motivation","fast food",
  "no appetite","no time","binge eating","skipping meals","not eating enough"
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
  equipment: z.string().optional(),
  workoutDaysPerWeek: z.coerce.number().int().min(1).max(7),
  preferredWorkoutTime: z.string().optional(),
  targetDate: z.string().optional(),
});

const step3Schema = z.object({
  wakeTime: z.string().min(1, "Required"),
  sleepTime: z.string().min(1, "Required"),
  workSchedule: z.string().optional(),
  averageDailySteps: z.coerce.number().int().min(0).max(50000).optional(),
});

const step4Schema = z.object({
  mealsPerDay: z.coerce.number().int().min(1).max(8),
  waterIntakeLiters: z.coerce.number().min(0.5).max(10),
  allergies: z.string().optional(),
  dislikedFoods: z.string().optional(),
  dietStyle: z.string().optional(),
  foodBudget: z.string().optional(),
  caffeineUse: z.string().optional(),
  screenTimeBeforeBed: z.string().optional(),
  biggestStruggle: z.string().optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;
type Step4 = z.infer<typeof step4Schema>;

const TOTAL_STEPS = 5;

function ToggleChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "px-3 py-1.5 text-xs font-medium uppercase tracking-wider border transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      )}
      data-testid={`chip-${label.replace(/\s+/g,"-")}`}
    >
      {label}
    </button>
  );
}

function SelectOption({ label, value, selected, onSelect }: { label: string; value: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "px-4 py-2 text-sm font-medium uppercase tracking-wider border transition-colors text-left",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      )}
      data-testid={`option-${value}`}
    >
      {label}
    </button>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn("h-1 transition-all", i + 1 === current ? "w-8 bg-primary" : "w-3 bg-border")}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [digestionConcerns, setDigestionConcerns] = useState<string[]>([]);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [formData, setFormData] = useState<Partial<Step1 & Step2 & Step3 & Step4>>({});

  const createProfile = useCreateUserProfile();
  const generatePlan = useGeneratePlan();

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { mealsPerDay: 3, workoutDaysPerWeek: 3 } as any });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { workoutDaysPerWeek: 3 } });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema), defaultValues: { wakeTime: "06:30", sleepTime: "22:30" } });
  const form4 = useForm<Step4>({ resolver: zodResolver(step4Schema), defaultValues: { mealsPerDay: 3, waterIntakeLiters: 2 } });

  const toggleGoal = (g: string) => setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleSkin = (g: string) => setSkinConcerns(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleDigestion = (g: string) => setDigestionConcerns(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleStep1 = form1.handleSubmit((data) => {
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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-tighter text-primary mb-1">Project Upgrade</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Build Your Profile</p>
        </div>
        <StepDots current={step} total={TOTAL_STEPS} />

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-5">
            <h2 className="text-lg font-bold uppercase tracking-tight">Personal Info</h2>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input {...form1.register("name")} placeholder="Your name" data-testid="input-name" className="bg-card border-border" />
              {form1.formState.errors.name && <p className="text-xs text-destructive">{form1.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Age</Label>
                <Input {...form1.register("age")} type="number" placeholder="25" data-testid="input-age" className="bg-card border-border" />
                {form1.formState.errors.age && <p className="text-xs text-destructive">{form1.formState.errors.age.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                <div className="flex gap-2">
                  {["Male","Female","Other"].map(g => (
                    <SelectOption key={g} label={g} value={g} selected={form1.watch("gender") === g} onSelect={() => form1.setValue("gender", g)} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Height (cm)</Label>
                <Input {...form1.register("heightCm")} type="number" placeholder="175" data-testid="input-height" className="bg-card border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current (kg)</Label>
                <Input {...form1.register("currentWeightKg")} type="number" step="0.1" placeholder="80" data-testid="input-current-weight" className="bg-card border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Goal (kg)</Label>
                <Input {...form1.register("goalWeightKg")} type="number" step="0.1" placeholder="70" data-testid="input-goal-weight" className="bg-card border-border" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body Type</Label>
              <div className="flex flex-wrap gap-2">
                {["skinny","overweight","fit","average"].map(t => (
                  <SelectOption key={t} label={t} value={t} selected={form1.watch("bodyType") === t} onSelect={() => form1.setValue("bodyType", t)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Goals (select all that apply)</Label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => <ToggleChip key={g} label={g} selected={selectedGoals.includes(g)} onToggle={() => toggleGoal(g)} />)}
              </div>
              {selectedGoals.length === 0 && <p className="text-xs text-muted-foreground">Select at least one goal</p>}
            </div>
            <Button type="submit" className="w-full" data-testid="button-next-step1">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-5">
            <h2 className="text-lg font-bold uppercase tracking-tight">Training Info</h2>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fitness Level</Label>
              <div className="flex flex-wrap gap-2">
                {["beginner","intermediate","advanced"].map(l => (
                  <SelectOption key={l} label={l} value={l} selected={form2.watch("fitnessLevel") === l} onSelect={() => form2.setValue("fitnessLevel", l)} />
                ))}
              </div>
              {form2.formState.errors.fitnessLevel && <p className="text-xs text-destructive">{form2.formState.errors.fitnessLevel.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gym Access</Label>
              <div className="flex flex-wrap gap-2">
                {["full gym","home gym","no gym"].map(g => (
                  <SelectOption key={g} label={g} value={g} selected={form2.watch("gymAccess") === g} onSelect={() => form2.setValue("gymAccess", g)} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Equipment Available</Label>
              <Input {...form2.register("equipment")} placeholder="Dumbbells, barbell, etc." data-testid="input-equipment" className="bg-card border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Workout Days Per Week: {form2.watch("workoutDaysPerWeek") ?? 3}</Label>
              <Slider min={1} max={7} step={1} value={[form2.watch("workoutDaysPerWeek") ?? 3]} onValueChange={v => form2.setValue("workoutDaysPerWeek", v[0])} data-testid="slider-workout-days" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preferred Workout Time</Label>
              <div className="flex flex-wrap gap-2">
                {["morning","afternoon","evening"].map(t => (
                  <SelectOption key={t} label={t} value={t} selected={form2.watch("preferredWorkoutTime") === t} onSelect={() => form2.setValue("preferredWorkoutTime", t)} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Date (optional)</Label>
              <Input {...form2.register("targetDate")} type="date" data-testid="input-target-date" className="bg-card border-border" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back-step2"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button type="submit" className="flex-1" data-testid="button-next-step2">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleStep3} className="space-y-5">
            <h2 className="text-lg font-bold uppercase tracking-tight">Daily Routine</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wake Time</Label>
                <Input {...form3.register("wakeTime")} type="time" data-testid="input-wake-time" className="bg-card border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sleep Time</Label>
                <Input {...form3.register("sleepTime")} type="time" data-testid="input-sleep-time" className="bg-card border-border" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Work / School Schedule</Label>
              <Input {...form3.register("workSchedule")} placeholder="9am-5pm office, or N/A" data-testid="input-work-schedule" className="bg-card border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Average Daily Steps</Label>
              <Input {...form3.register("averageDailySteps")} type="number" placeholder="5000" data-testid="input-steps" className="bg-card border-border" />
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sleep Quality: {sleepQuality}/10</Label>
                <Slider min={1} max={10} step={1} value={[sleepQuality]} onValueChange={v => setSleepQuality(v[0])} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Energy Level: {energyLevel}/10</Label>
                <Slider min={1} max={10} step={1} value={[energyLevel]} onValueChange={v => setEnergyLevel(v[0])} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stress Level: {stressLevel}/10</Label>
                <Slider min={1} max={10} step={1} value={[stressLevel]} onValueChange={v => setStressLevel(v[0])} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back-step3"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button type="submit" className="flex-1" data-testid="button-next-step3">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={handleStep4} className="space-y-5">
            <h2 className="text-lg font-bold uppercase tracking-tight">Nutrition & Lifestyle</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Meals Per Day</Label>
                <Input {...form4.register("mealsPerDay")} type="number" min={1} max={8} placeholder="3" data-testid="input-meals-per-day" className="bg-card border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Water (liters/day)</Label>
                <Input {...form4.register("waterIntakeLiters")} type="number" step="0.5" placeholder="2" data-testid="input-water" className="bg-card border-border" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Allergies</Label>
              <Input {...form4.register("allergies")} placeholder="Nuts, dairy, gluten, etc." data-testid="input-allergies" className="bg-card border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Foods You Dislike</Label>
              <Input {...form4.register("dislikedFoods")} placeholder="Broccoli, fish, etc." data-testid="input-disliked-foods" className="bg-card border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Diet Style</Label>
              <div className="flex flex-wrap gap-2">
                {["no preference","vegetarian","vegan","keto","high protein","paleo"].map(d => (
                  <SelectOption key={d} label={d} value={d} selected={form4.watch("dietStyle") === d} onSelect={() => form4.setValue("dietStyle", d)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Food Budget</Label>
              <div className="flex flex-wrap gap-2">
                {["low","medium","high"].map(b => (
                  <SelectOption key={b} label={b} value={b} selected={form4.watch("foodBudget") === b} onSelect={() => form4.setValue("foodBudget", b)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Skin Concerns</Label>
              <div className="flex flex-wrap gap-2">
                {SKIN_CONCERNS.map(s => <ToggleChip key={s} label={s} selected={skinConcerns.includes(s)} onToggle={() => toggleSkin(s)} />)}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Digestion Concerns</Label>
              <div className="flex flex-wrap gap-2">
                {DIGESTION_CONCERNS.map(d => <ToggleChip key={d} label={d} selected={digestionConcerns.includes(d)} onToggle={() => toggleDigestion(d)} />)}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Biggest Struggle</Label>
              <div className="flex flex-wrap gap-2">
                {STRUGGLES.map(s => (
                  <SelectOption key={s} label={s} value={s} selected={form4.watch("biggestStruggle") === s} onSelect={() => form4.setValue("biggestStruggle", s)} />
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(3)} data-testid="button-back-step4"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button type="submit" className="flex-1" data-testid="button-next-step4">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </form>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold uppercase tracking-tight">Review & Start</h2>
            <div className="bg-card border border-border p-4 space-y-2">
              <p className="text-sm font-medium">You're about to get your personalized plan. This covers:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-none">
                {["Calorie & protein targets","Daily schedule","Workout plan","Meal check-in feedback","Nightly coach reviews","Weekly adjustments"].map(i => (
                  <li key={i} className="flex items-center gap-2"><span className="w-1 h-1 bg-primary inline-block" />{i}</li>
                ))}
              </ul>
            </div>
            <div className="bg-muted/30 border border-border p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Safety Disclaimer</p>
                <p className="text-xs text-muted-foreground">Project Upgrade is not medical advice. If you are a minor, have a history of eating disorders, diabetes, pregnancy, or any serious health condition, please speak with a qualified healthcare professional before starting any diet or exercise program.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(4)} disabled={isLoading} data-testid="button-back-step5"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isLoading || selectedGoals.length === 0} data-testid="button-submit-onboarding">
                {isLoading ? "Building your plan..." : "Start My Plan"}
              </Button>
            </div>
            {(createProfile.isError || generatePlan.isError) && (
              <p className="text-xs text-destructive text-center">Something went wrong. Try again.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
