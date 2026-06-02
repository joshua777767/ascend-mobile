import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayJournalEntry, useCreateJournalEntry, useGenerateReview,
  useGetTodayReview, useGetUserProfile,
  getGetTodayJournalEntryQueryKey, getGetTodayReviewQueryKey, getListReviewsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BookOpen, CheckCircle, XCircle } from "lucide-react";

function BooleanToggle({ label, value, onChange, testId }: { label: string; value: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <p className="text-sm">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn("px-3 py-1 text-xs uppercase tracking-wider border transition-colors", value === true ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-muted-foreground border-border hover:border-green-500/30")}
          data-testid={`${testId}-yes`}
        >Yes</button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn("px-3 py-1 text-xs uppercase tracking-wider border transition-colors", value === false ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-muted-foreground border-border hover:border-red-500/30")}
          data-testid={`${testId}-no`}
        >No</button>
      </div>
    </div>
  );
}

export default function JournalPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isError: profileError } = useGetUserProfile();
  const { data: todayEntry, isLoading: loadingEntry } = useGetTodayJournalEntry();
  const { data: review } = useGetTodayReview();
  const createEntry = useCreateJournalEntry();
  const generateReview = useGenerateReview();

  const [form, setForm] = useState({
    followedSchedule: false,
    hitProtein: false,
    stayedNearCalories: false,
    workedOut: false,
    drankWater: false,
    sleptOnTime: false,
    energyRating: 5,
    skinBloatingRating: 5,
    whatWentWrong: "",
    biggestWin: "",
    needHelpWith: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const handleSubmit = async () => {
    try {
      await createEntry.mutateAsync({ data: form });
      queryClient.invalidateQueries({ queryKey: getGetTodayJournalEntryQueryKey() });
      await generateReview.mutateAsync(undefined as any);
      queryClient.invalidateQueries({ queryKey: getGetTodayReviewQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
      setSubmitted(true);
    } catch (e) { console.error(e); }
  };

  if (loadingEntry) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const alreadySubmitted = !!todayEntry || submitted;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Nightly Journal</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {alreadySubmitted ? (
        <div className="space-y-6">
          <div className="bg-primary/10 border border-primary/20 p-4 text-center">
            <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="font-semibold uppercase tracking-wider text-primary">Journal Submitted</p>
            <p className="text-xs text-muted-foreground mt-1">Your coach reviewed today's performance.</p>
          </div>

          {review && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Coach Review</h2>
              <div className="bg-card border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Daily Score</span>
                  <span className="text-3xl font-bold text-primary">{review.dailyScore}<span className="text-base text-muted-foreground">/100</span></span>
                </div>
                <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 border text-xs uppercase tracking-wider font-semibold", review.onPace ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-red-500/30 text-red-400 bg-red-500/5")}>
                  {review.onPace ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {review.onPace ? "On Pace" : "Off Pace"}
                </div>
                <div className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-1">Biggest Win</p>
                    <p className="text-sm">{review.biggestWin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">Biggest Mistake</p>
                    <p className="text-sm">{review.biggestMistake}</p>
                  </div>
                  <div>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Fix for Tomorrow</p>
                    <p className="text-sm">{review.exactFixForTomorrow}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border bg-primary/5 p-3 -mx-1">
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Coach Says</p>
                  <p className="text-sm italic">{review.strictCoachMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border">
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Check</p>
            </div>
            <div className="px-4">
              <BooleanToggle label="Did you follow your schedule?" value={form.followedSchedule} onChange={v => setForm(f => ({...f, followedSchedule: v}))} testId="journal-schedule" />
              <BooleanToggle label="Did you hit your protein target?" value={form.hitProtein} onChange={v => setForm(f => ({...f, hitProtein: v}))} testId="journal-protein" />
              <BooleanToggle label="Did you stay near your calorie target?" value={form.stayedNearCalories} onChange={v => setForm(f => ({...f, stayedNearCalories: v}))} testId="journal-calories" />
              <BooleanToggle label="Did you work out or walk?" value={form.workedOut} onChange={v => setForm(f => ({...f, workedOut: v}))} testId="journal-workout" />
              <BooleanToggle label="Did you drink enough water?" value={form.drankWater} onChange={v => setForm(f => ({...f, drankWater: v}))} testId="journal-water" />
              <BooleanToggle label="Did you go to sleep on time?" value={form.sleptOnTime} onChange={v => setForm(f => ({...f, sleptOnTime: v}))} testId="journal-sleep" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Energy Today: {form.energyRating}/10</p>
              <Slider min={1} max={10} step={1} value={[form.energyRating]} onValueChange={v => setForm(f => ({...f, energyRating: v[0]}))} data-testid="slider-energy" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skin / Bloating Today: {form.skinBloatingRating}/10</p>
              <Slider min={1} max={10} step={1} value={[form.skinBloatingRating]} onValueChange={v => setForm(f => ({...f, skinBloatingRating: v[0]}))} data-testid="slider-skin" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biggest Win Today</p>
            <Textarea value={form.biggestWin} onChange={e => setForm(f => ({...f, biggestWin: e.target.value}))} placeholder="What went right?" className="bg-card border-border resize-none text-sm" rows={2} data-testid="textarea-biggest-win" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What Went Wrong?</p>
            <Textarea value={form.whatWentWrong} onChange={e => setForm(f => ({...f, whatWentWrong: e.target.value}))} placeholder="Honest answer only." className="bg-card border-border resize-none text-sm" rows={2} data-testid="textarea-what-went-wrong" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What Do You Need Help With Tomorrow?</p>
            <Textarea value={form.needHelpWith} onChange={e => setForm(f => ({...f, needHelpWith: e.target.value}))} placeholder="Be specific." className="bg-card border-border resize-none text-sm" rows={2} data-testid="textarea-need-help" />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={createEntry.isPending || generateReview.isPending || !form.biggestWin.trim()}
            data-testid="button-submit-journal"
          >
            {createEntry.isPending || generateReview.isPending ? "Generating Your Review..." : "Submit Journal + Get Coach Review"}
          </Button>
        </div>
      )}
    </div>
  );
}
