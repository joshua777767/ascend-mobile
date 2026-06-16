import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useResetUserProfile, useLogout } from "@workspace/api-client-react";
import { AscendMark } from "@/components/ascend-mark";
import { AlertTriangle, Trash2, ArrowLeft } from "lucide-react";

export default function DeleteAccountPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const resetProfile = useResetUserProfile();
  const logout = useLogout();

  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  const CONFIRM_PHRASE = "DELETE MY ACCOUNT";
  const canDelete = confirmText === CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!canDelete) return;
    setError("");
    try {
      await resetProfile.mutateAsync();
      // Clear all local storage
      try {
        localStorage.clear();
      } catch { /* ignore */ }
      setDeleted(true);
      // Auto logout after showing confirmation
      setTimeout(async () => {
        try { await logout.mutateAsync(); } catch { /* ignore */ }
        queryClient.clear();
        window.location.replace("/");
      }, 3000);
    } catch (e: any) {
      setError(e?.data?.error ?? "Failed to delete account. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8 max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Delete Account</p>
          </div>
        </div>

        {deleted ? (
          <div className="text-center space-y-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A9B78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">Account Deleted</h1>
            <p className="text-sm text-muted-foreground">
              All your data has been permanently removed. Thank you for using Ascend.
            </p>
            <p className="text-xs text-muted-foreground">Redirecting...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-destructive">Delete Account</h1>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Deleting your account will permanently remove:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1.5 ml-4">
                <li className="flex items-center gap-2">
                  <span className="text-destructive">&times;</span> Your profile and all personal data
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-destructive">&times;</span> All workout logs, meal logs, and journal entries
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-destructive">&times;</span> Progress tracking, streaks, and milestones
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-destructive">&times;</span> Chat history and AI coaching data
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-destructive">&times;</span> Active subscription (if applicable)
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">
                Type <span className="font-mono bg-elevated px-1.5 py-0.5 rounded text-xs">{CONFIRM_PHRASE}</span> to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full bg-elevated border border-border rounded-xl h-12 px-4 text-sm outline-none focus:border-destructive transition-colors font-mono uppercase"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl p-3">{error}</p>
            )}

            <button
              onClick={handleDelete}
              disabled={!canDelete || resetProfile.isPending}
              className="flex items-center justify-center gap-2 w-full bg-destructive text-destructive-foreground h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
              {resetProfile.isPending ? "Deleting..." : "Permanently Delete Account"}
            </button>

            <Link
              href="/settings"
              className="flex items-center justify-center gap-2 w-full bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Cancel and go back
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
