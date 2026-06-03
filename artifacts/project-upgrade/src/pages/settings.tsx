import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogout,
  useResetUserProfile,
  useGetMe,
} from "@workspace/api-client-react";
import { LogOut, RotateCcw, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const logout = useLogout();
  const resetProfile = useResetUserProfile();
  const [confirmReset, setConfirmReset] = useState(false);

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
