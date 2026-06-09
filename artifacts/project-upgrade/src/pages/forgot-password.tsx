import { useState } from "react";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { AscendMark } from "@/components/ascend-mark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const forgotPassword = useForgotPassword();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await forgotPassword.mutateAsync({ data: { email } });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
        {sent ? (
          <div className="text-center space-y-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14h0" />
              </svg>
            </div>
            <h1 className="text-[1.7rem] font-extrabold tracking-tight">Check your inbox</h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              If an account exists with that email, a reset link has been sent.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The link expires in 1 hour and can only be used once.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 text-primary font-semibold text-sm"
            >
              ← Back to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Forgot password?</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-elevated border border-border rounded-xl h-12 px-4 text-base outline-none focus:border-primary transition-colors"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={forgotPassword.isPending}
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                {forgotPassword.isPending ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Remember it?{" "}
              <Link href="/login" className="text-primary font-semibold">
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
