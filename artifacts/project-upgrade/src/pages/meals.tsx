import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTodayMeals, useListMeals, useCreateMeal, useGetUserProfile, getGetTodayMealsQueryKey, getListMealsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Utensils, CheckCircle, XCircle, AlertCircle, Camera, X } from "lucide-react";

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

// Resize + compress an image file to a JPEG data URL kept small enough to store/send.
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

export default function MealsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isError: profileError } = useGetUserProfile();
  const { data: todayMeals, isLoading: loadingToday } = useGetTodayMeals();
  useListMeals();
  const createMeal = useCreateMeal();
  const [mealText, setMealText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

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

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createMeal.mutateAsync({
        data: {
          description: mealText.trim(),
          ...(imageData ? { imageUrl: imageData } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetTodayMealsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMealsQueryKey() });
      setMealText("");
      setImageData(null);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      console.error(e);
      setError("Couldn't get coach feedback. Please try again.");
    }
  };

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Log & Track</p>
          <h1 className="text-2xl font-bold uppercase tracking-tighter mt-0.5">Meal Check-In</h1>
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
            onChange={e => setMealText(e.target.value)}
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
      </div>
    </div>
  );
}
