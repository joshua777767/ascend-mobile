import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTodayMeals, useListMeals, useCreateMeal, useGenerateMeals, useGetUserProfile, useLogWater, getGetTodayMealsQueryKey, getListMealsQueryKey, getGetWaterTodayQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Utensils, CheckCircle, XCircle, AlertCircle, Camera, X, ChefHat, Sparkles, ArrowLeft, Droplets } from "lucide-react";

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

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function compressImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const GOAL_OPTIONS = [
  { value: "fat_loss", label: "Lose Weight" },
  { value: "maintain", label: "Maintain" },
  { value: "muscle_gain", label: "Gain Weight / Muscle" },
];

const MEAL_TYPE_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "full_day", label: "Full Day" },
];

const PREFERENCE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "high_protein", label: "High Protein" },
  { value: "cheap", label: "Cheap" },
  { value: "quick", label: "Quick" },
  { value: "no_cooking", label: "No Cooking" },
  { value: "school_friendly", label: "School Friendly" },
  { value: "athlete_friendly", label: "Athlete Friendly" },
];

export default function MealsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isError: profileError } = useGetUserProfile();
  const { data: todayMeals, isLoading: loadingToday } = useGetTodayMeals();
  useListMeals();
  const createMeal = useCreateMeal();
  const generateMeals = useGenerateMeals();
  const logWater = useLogWater();

  const [mealText, setMealText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [waterLog, setWaterLog] = useState<{ oz: number } | null>(null);
  const [waterConfirm, setWaterConfirm] = useState<{ oz: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meal generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genGoal, setGenGoal] = useState("fat_loss");
  const [genMealType, setGenMealType] = useState("breakfast");
  const [genPreference, setGenPreference] = useState("");
  const [genAvailable, setGenAvailable] = useState("");
  const [genResult, setGenResult] = useState<any>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await compressImage(file);
      setImageData(dataUrl);
    } catch {
      setError("Couldn't process that photo. Try another image.");
    } finally {
      setProcessing(false);
    }
  };

  const canSubmit = (!!mealText.trim() || !!imageData) && !createMeal.isPending && !processing;

  const handleConfirmWater = async (oz: number) => {
    setWaterConfirm(null);
    try {
      await logWater.mutateAsync({ data: { amountOz: oz } });
      setWaterLog({ oz });
      queryClient.invalidateQueries({ queryKey: getGetWaterTodayQueryKey() });
      setTimeout(() => setWaterLog(null), 5000);
    } catch {
      setError("Couldn't log water. Try again.");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setWaterLog(null);
    setWaterConfirm(null);
    try {
      const result = await createMeal.mutateAsync({
        data: {
          description: mealText.trim(),
          ...(imageData ? { imageUrl: imageData } : {}),
        },
      });
      setMealText("");
      setImageData(null);
      // Low-confidence water — ask user to confirm before logging
      if ((result as any)?.waterConfirmNeeded) {
        setWaterConfirm({ oz: (result as any).amountOz ?? 12 });
        return;
      }
      // High-confidence water — already logged on the server
      if ((result as any)?.waterLogged) {
        const oz = (result as any).amountOz ?? 12;
        setWaterLog({ oz });
        queryClient.invalidateQueries({ queryKey: getGetWaterTodayQueryKey() });
        setTimeout(() => setWaterLog(null), 5000);
        return;
      }
      queryClient.invalidateQueries({ queryKey: getGetTodayMealsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMealsQueryKey() });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      console.error(e);
      setError("Couldn't get coach feedback. Please try again.");
    }
  };

  const handleGenerate = async () => {
    setGenError(null);
    setGenResult(null);
    try {
      const result = await generateMeals.mutateAsync({
        data: {
          goal: genGoal as any,
          mealType: genMealType as any,
          ...(genPreference ? { preference: genPreference as any } : {}),
          ...(genAvailable.trim() ? { availableFoods: genAvailable.trim() } : {}),
        },
      });
      setGenResult(result);
    } catch (e) {
      console.error(e);
      setGenError("Couldn't generate meals. Try again.");
    }
  };

  const handleBack = () => {
    setShowGenerator(false);
    setGenResult(null);
    setGenError(null);
  };

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto">
        {/* Generator View */}
        {showGenerator ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBack} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Meal Generator</p>
                <h1 className="text-xl font-bold uppercase tracking-tighter mt-0.5 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary" />
                  Build Your Meals
                </h1>
              </div>
            </div>

            {!genResult ? (
              <div className="space-y-4">
                {/* Goal */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Goal</p>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGenGoal(g.value)}
                        className={cn(
                          "px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md border transition-colors",
                          genGoal === g.value
                            ? "bg-primary text-black border-primary"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meal type */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Meal Type</p>
                  <div className="flex flex-wrap gap-2">
                    {MEAL_TYPE_OPTIONS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setGenMealType(m.value)}
                        className={cn(
                          "px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md border transition-colors",
                          genMealType === m.value
                            ? "bg-primary text-black border-primary"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preference */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Preference (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_OPTIONS.map((p) => (
                      <button
                        key={p.value || "none"}
                        type="button"
                        onClick={() => setGenPreference(p.value)}
                        className={cn(
                          "px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md border transition-colors",
                          genPreference === p.value
                            ? "bg-primary text-black border-primary"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available foods */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Foods you have (optional)</p>
                  <Textarea
                    value={genAvailable}
                    onChange={(e) => setGenAvailable(e.target.value)}
                    placeholder="e.g. eggs, chicken, rice, pasta, yogurt, bananas..."
                    className="bg-card border-border min-h-[60px] resize-none text-sm"
                  />
                </div>

                <Button className="w-full" onClick={handleGenerate} disabled={generateMeals.isPending}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {generateMeals.isPending ? "Generating..." : "Generate Meals"}
                </Button>
                {genError && <p className="text-xs text-red-400 text-center">{genError}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result header */}
                <div className="border border-border p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {GOAL_OPTIONS.find((g) => g.value === genResult.goal)?.label} • {MEAL_TYPE_OPTIONS.find((m) => m.value === genResult.mealType)?.label}
                    </p>
                    {genResult.preference && (
                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                        {PREFERENCE_OPTIONS.find((p) => p.value === genResult.preference)?.label}
                      </p>
                    )}
                  </div>
                  {genResult.totalCalories !== undefined && (
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-bold">{genResult.totalCalories} cal</span>
                      <span className="text-sm text-muted-foreground">{genResult.totalProtein}g protein</span>
                    </div>
                  )}
                </div>

                {/* Options */}
                {genResult.options?.map((opt: any, i: number) => (
                  <div key={i} className="border border-border p-4 bg-card space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">{opt.name}</p>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{opt.calories} cal</p>
                        <p className="text-[10px] text-muted-foreground">{opt.protein}g protein</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ingredients</p>
                      <p className="text-xs text-muted-foreground">{opt.ingredients?.join(", ")}</p>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">How to make</p>
                      <p className="text-xs">{opt.instructions}</p>
                    </div>
                    {opt.substitutions && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Substitutions</p>
                        <p className="text-xs text-muted-foreground">{opt.substitutions}</p>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleGenerate} disabled={generateMeals.isPending}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setGenResult(null)}>
                    Change Options
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Normal meals page */}
            <div className="mb-5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Log & Track</p>
              <h1 className="text-2xl font-bold uppercase tracking-tighter mt-0.5">Meal Check-In</h1>
            </div>

            {/* Meal Generator CTA */}
            <div className="mb-5 border border-primary/30 bg-primary/5 p-4 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <ChefHat className="w-4 h-4" />
                    Meal Generator
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Generate 3-5 meal options with calories, protein, and instructions for your goal.</p>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => setShowGenerator(true)}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Build
                </Button>
              </div>
            </div>

            <div className="mb-7 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-meal-photo"
              />

              {imageData ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img src={imageData} alt="Meal preview" className="w-full max-h-72 object-cover" data-testid="img-meal-preview" />
                  <button
                    type="button"
                    onClick={() => setImageData(null)}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 hover:bg-black/90"
                    aria-label="Remove photo"
                    data-testid="button-remove-photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1.5 hover:bg-black/90"
                    data-testid="button-change-photo"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 py-8 text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                  data-testid="button-upload-photo"
                >
                  <Camera className="w-7 h-7" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    {processing ? "Processing..." : "Upload Meal Photo"}
                  </span>
                  <span className="text-[11px] text-muted-foreground normal-case tracking-normal">Take a photo or choose from your device</span>
                </button>
              )}

              <Textarea
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                placeholder="Optional: describe it — chicken rice and juice, 2 eggs, toast, coffee with milk..."
                className="bg-card border-border min-h-[80px] resize-none text-sm"
                data-testid="textarea-meal-description"
              />
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="button-submit-meal"
              >
                {createMeal.isPending ? "Getting Coach Feedback..." : "Get Coach Feedback"}
              </Button>
              {error && (
                <p className="text-xs text-red-400 text-center" data-testid="text-meal-error">{error}</p>
              )}
              {waterConfirm && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 space-y-3" data-testid="water-confirm-banner">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
                    <p className="text-xs font-semibold text-blue-300">Looks like water — add {waterConfirm.oz} oz to your water tracker?</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => handleConfirmWater(waterConfirm.oz)}
                      disabled={logWater.isPending}
                    >
                      Yes, add it
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-white/10"
                      onClick={() => setWaterConfirm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {waterLog && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 flex items-center justify-center gap-2" data-testid="water-logged-banner">
                  <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Detected water — added {waterLog.oz} oz to your water tracker.</p>
                </div>
              )}
              {submitted && (
                <div className="bg-primary/10 border border-primary/20 p-3 text-center">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Meal logged. Coach reviewed it below.</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Today's Meals</p>
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
                        {meal.imageUrl && (
                          <img src={meal.imageUrl} alt="Logged meal" className="w-full max-h-56 object-cover rounded-md" data-testid={`img-meal-${i}`} />
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                              {new Date(meal.loggedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {meal.description && <p className="text-sm font-medium">{meal.description}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-baseline gap-0.5">
                              <span className={cn("text-2xl font-bold leading-none", scoreColor(meal.score))} data-testid={`text-meal-score-${i}`}>{meal.score}</span>
                              <span className="text-[10px] text-muted-foreground">/100</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider">{quality}</span>
                            </div>
                          </div>
                        </div>
                        {(() => {
                          let foods: Array<{item:string;serving:string;calories:number;protein:number;carbs?:number;fat?:number}> | null = null;
                          try { if ((meal as any).detectedFoodsJson) foods = JSON.parse((meal as any).detectedFoodsJson); } catch {}
                          if (!foods || foods.length === 0) return null;
                          const totalCal = foods.reduce((s, f) => s + f.calories, 0);
                          const totalPro = foods.reduce((s, f) => s + f.protein, 0);
                          return (
                            <div className="pt-3 border-t border-current/20">
                              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2">Detected Foods</p>
                              <div className="space-y-1.5">
                                {foods.map((f, fi) => (
                                  <div key={fi} className="flex items-start justify-between gap-2 text-xs">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium">{f.item}</span>
                                      {f.serving && <span className="text-muted-foreground ml-1">— {f.serving}</span>}
                                    </div>
                                    <div className="shrink-0 flex gap-2 text-muted-foreground text-[10px] font-mono">
                                      <span>{f.calories} cal</span>
                                      <span>{f.protein}g P</span>
                                      {f.carbs != null && <span>{f.carbs}g C</span>}
                                      {f.fat != null && <span>{f.fat}g F</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 pt-2 border-t border-current/10 flex gap-4 text-[10px] font-semibold text-muted-foreground">
                                <span>Total: {totalCal} cal</span>
                                <span>{totalPro}g protein</span>
                              </div>
                            </div>
                          );
                        })()}
                        {meal.coachFeedback && (
                          <div className="pt-3 border-t border-current/20">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5">Coach Feedback</p>
                            <p className="text-sm">{meal.coachFeedback}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                          {meal.whatWasGood && (
                            <div>
                              <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">What was good</p>
                              <p className="text-xs">{meal.whatWasGood}</p>
                            </div>
                          )}
                          {meal.whatWasBad && (
                            <div>
                              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">What hurt the goal</p>
                              <p className="text-xs">{meal.whatWasBad}</p>
                            </div>
                          )}
                          {meal.whatToFixNext && (
                            <div>
                              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Fix next meal</p>
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
                  <p className="text-xs mt-1">Upload a photo or describe your first meal above.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
