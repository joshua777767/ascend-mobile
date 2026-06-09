import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { AscendMark } from "@/components/ascend-mark";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const resetPassword = useResetPassword();

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-background text-foreground px-6">
        <p className="text-destructive text-sm">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="mt-4 text-primary font-semibold text-sm">
          Request new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ data: { token, password } });
      setDone(true);
      setTimeout(() => setLocation("/login"), 2500);
    } catch (err: any) {
      setError(err?.data?.error ?? "This reset link is invalid or has expired.");
    }
  };

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-6 pt-8 flex items-center gap-2.5">
        <AscendMark size="lg" />
        <div>
          <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Your Daily Coach</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
        {done ? (
          <div className="text-center space-y-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
              style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-[1.7rem] font-extrabold tracking-tight">Password updated!</h1>
            <p className="text-[15px] text-muted-foreground">Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Set new password</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Choose a strong password. Minimum 8 characters.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-elevated border border-border rounded-xl h-12 px-4 text-base outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-elevated border border-border rounded-xl h-12 px-4 text-base outline-none focus:border-primary transition-colors"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={resetPassword.isPending}
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                {resetPassword.isPending ? "Updating..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
