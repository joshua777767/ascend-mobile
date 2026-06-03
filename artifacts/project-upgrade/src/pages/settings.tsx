import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogout,
  useResetUserProfile,
  useGetMe,
  useGetUserProfile,
  useUpdateUserProfile,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { LogOut, RotateCcw, AlertTriangle, Save, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: profile } = useGetUserProfile();
  const logout = useLogout();
  const resetProfile = useResetUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);

  // Workout profile state
  const [selectedSport, setSelectedSport] = useState("");
  const [sportCustomText, setSportCustomText] = useState("");
  const [scheduleChoice, setScheduleChoice] = useState<"" | "yes" | "no">("");
  const [ownScheduleText, setOwnScheduleText] = useState("");
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] = useState("");

  // Load current profile values
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    if (p.sport) setSelectedSport(p.sport);
    if (p.sportCustom) setSportCustomText(p.sportCustom);
    if (p.hasOwnSchedule) setScheduleChoice(p.hasOwnSchedule);
    if (p.ownSchedule) setOwnScheduleText(p.ownSchedule);
    if (p.workoutFocus) setSelectedWorkoutFocus(p.workoutFocus);
  }, [profile]);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // ignore — clear local state regardless
    }
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

  const handleSaveWorkout = async () => {
    const sportValue = selectedSport.toLowerCase();
    const payload: Record<string, string> = {};
    if (sportValue) payload.sport = sportValue;
    if (sportValue === "other" && sportCustomText) payload.sportCustom = sportCustomText;
    if (scheduleChoice) payload.hasOwnSchedule = scheduleChoice;
    if (scheduleChoice === "yes" && ownScheduleText) payload.ownSchedule = ownScheduleText;
    if (scheduleChoice === "no" && selectedWorkoutFocus) payload.workoutFocus = selectedWorkoutFocus;

    try {
      await updateProfile.mutateAsync({ data: payload as any });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
        <section className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-semibold text-foreground">Account</p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-email">
            {me?.email ?? "—"}
          </p>
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="mt-4 flex items-center justify-center gap-2 w-full bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
            data-testid="button-logout"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
            {logout.isPending ? "Logging out..." : "Log out"}
          </button>
        </section>

        {/* Workout profile */}
        <section className="rounded-2xl bg-card border border-border p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Workout profile</p>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Sport</p>
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
                className="mt-3 w-full bg-elevated border border-border rounded-xl h-11 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Workout schedule</p>
            <div className="flex gap-2 flex-wrap">
              <Chip
                label="I have my own schedule"
                selected={scheduleChoice === "yes"}
                onToggle={() => setScheduleChoice(prev => prev === "yes" ? "" : "yes")}
              />
              <Chip
                label="Generate one for me"
                selected={scheduleChoice === "no"}
                onToggle={() => setScheduleChoice(prev => prev === "no" ? "" : "no")}
              />
            </div>

            {scheduleChoice === "yes" && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Enter your weekly schedule. Example: Monday chest/back, Tuesday practice, Wednesday legs, Thursday rest, Friday full body.</p>
                <textarea
                  value={ownScheduleText}
                  onChange={e => setOwnScheduleText(e.target.value)}
                  placeholder="Mon: chest/back, Tue: practice, Wed: legs, Thu: rest, Fri: full body..."
                  className={textareaClass}
                  rows={3}
                />
              </div>
            )}

            {scheduleChoice === "no" && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">What do you want to focus on?</p>
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

          <button
            onClick={handleSaveWorkout}
            disabled={updateProfile.isPending}
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
                Saved
              </>
            ) : updateProfile.isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-[18px] h-[18px]" strokeWidth={2} />
                Save workout profile
              </>
            )}
          </button>
        </section>

        {/* Danger zone */}
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
