import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayJournalEntry, useCreateJournalEntry, useGenerateReview,
  useGetTodayReview, useGetUserProfile,
  getGetTodayJournalEntryQueryKey, getGetTodayReviewQueryKey, getListReviewsQueryKey,
  getGetStreakQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function BooleanToggle({ label, value, onChange, testId }: { label: string; value: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
      <p className="text-sm">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn("px-3 py-1.5 text-xs border transition-colors rounded", value === true ? "bg-teal-500/15 text-teal-400 border-teal-500/30" : "text-slate-500 border-slate-800/50 hover:text-slate-400 hover:border-slate-700/50")}
          data-testid={`${testId}-yes`}
        >Yes</button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn("px-3 py-1.5 text-xs border transition-colors rounded", value === false ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "text-slate-500 border-slate-800/50 hover:text-slate-400 hover:border-slate-700/50")}
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
      // Streak is now driven by Daily Score — invalidate so dashboard refreshes
      queryClient.invalidateQueries({ queryKey: getGetStreakQueryKey() });
      setSubmitted(true);
      toast({
        title: "You kept the promise.",
        description: "Your coach is reviewing today's work. See you tomorrow.",
        className: "ascend-toast-success",
      });
    } catch (e) { console.error(e); }
  };

  if (loadingEntry) {
    return (
      <div className="h-full overflow-y-auto scroll-area">
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  const alreadySubmitted = !!todayEntry || submitted;

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-5">
          <p className="text-[10px] text-slate-500 tracking-wide">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Nightly Journal</h1>
        </div>

        {alreadySubmitted ? (
          <div className="space-y-6">
            <div className="p-4 text-center space-y-2 rounded-lg border border-teal-500/20 bg-teal-500/5">
              <div className="flex items-center justify-center gap-2">
                <Star className="w-4 h-4 text-teal-400" />
                <p className="font-semibold tracking-wide text-teal-400 text-sm">You kept the promise.</p>
              </div>
              <p className="text-[11px] text-slate-400">Your coach is reviewing today's work. See you tomorrow.</p>
              {review && review.dailyScore >= 80 && (
                <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 mt-1">Perfect Day — {review.dailyScore}/100</span>
              )}
            </div>

            {review && (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500">Daily Coach Review</p>
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 space-y-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs tracking-wide text-slate-500">Daily Score</span>
                    <span className="text-3xl font-bold text-slate-100">{review.dailyScore}<span className="text-base text-slate-500">/100</span></span>
                  </div>
                  <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 border text-xs tracking-wide font-semibold rounded", review.onPace ? "border-teal-500/30 text-teal-400 bg-teal-500/5" : "border-amber-500/30 text-amber-400 bg-amber-500/5")}>
                    {review.onPace ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {review.onPace ? "On Pace" : "Off Pace"}
                  </div>
                  <div className="space-y-3 pt-2 border-t border-slate-800/50">
                    <div>
                      <p className="text-[10px] text-teal-400 font-semibold tracking-wide mb-1">Biggest Win</p>
                      <p className="text-sm">{review.biggestWin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-400 font-semibold tracking-wide mb-1">Biggest Mistake</p>
                      <p className="text-sm">{review.biggestMistake}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-300 font-semibold tracking-wide mb-1">Fix for Tomorrow</p>
                      <p className="text-sm">{review.exactFixForTomorrow}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800/50 bg-slate-800/20 p-3 rounded -mx-1">
                    <p className="text-[10px] text-slate-300 font-semibold tracking-wide mb-1">Coach Says</p>
                    <p className="text-sm italic text-slate-300">{review.strictCoachMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-lg">
              <div className="p-3 border-b border-slate-800/50">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500">Today's Check</p>
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
                <p className="text-[10px] font-semibold tracking-wide text-slate-500">Energy Today: {form.energyRating}/10</p>
                <Slider min={1} max={10} step={1} value={[form.energyRating]} onValueChange={v => setForm(f => ({...f, energyRating: v[0]}))} data-testid="slider-energy" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500">Skin / Bloating Today: {form.skinBloatingRating}/10</p>
                <Slider min={1} max={10} step={1} value={[form.skinBloatingRating]} onValueChange={v => setForm(f => ({...f, skinBloatingRating: v[0]}))} data-testid="slider-skin" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500">Biggest Win Today</p>
              <Textarea value={form.biggestWin} onChange={e => setForm(f => ({...f, biggestWin: e.target.value}))} placeholder="What went right?" className="bg-slate-900/30 border-slate-800/50 resize-none text-sm rounded" rows={2} data-testid="textarea-biggest-win" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500">What Went Wrong?</p>
              <Textarea value={form.whatWentWrong} onChange={e => setForm(f => ({...f, whatWentWrong: e.target.value}))} placeholder="Honest answer only." className="bg-slate-900/30 border-slate-800/50 resize-none text-sm rounded" rows={2} data-testid="textarea-what-went-wrong" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500">What Do You Need Help With Tomorrow?</p>
              <Textarea value={form.needHelpWith} onChange={e => setForm(f => ({...f, needHelpWith: e.target.value}))} placeholder="Be specific." className="bg-slate-900/30 border-slate-800/50 resize-none text-sm rounded" rows={2} data-testid="textarea-need-help" />
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
    </div>
  );
}
