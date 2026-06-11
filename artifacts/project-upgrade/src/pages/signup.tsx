import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSignup,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const signup = useSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    try {
      const user = await signup.mutateAsync({ data: { email, password } });
      // Write the user directly into the /me cache so isAuthed is true
      // immediately when the router evaluates — avoids a race where the cache
      // is empty during the background refetch and redirects to /login.
      queryClient.setQueryData(getGetMeQueryKey(), user);
      // Clear any leftover profile cache so the onboarding guard fetches fresh
      // for this brand-new account (no profile yet → onboarding).
      queryClient.removeQueries({ queryKey: getGetUserProfileQueryKey() });
      // Defer navigation one tick so React Query's subscriber re-render (which
      // sets isAuthed=true) fires before Wouter evaluates the route guard.
      // Without this, the router sees the old isAuthed=false on the first paint
      // and redirects to /login before the cache update propagates.
      setTimeout(() => setLocation("/onboarding"), 0);
    } catch (err: any) {
      setError(err?.data?.error ?? "Could not create account");
    }
  };

  return (
    <div
      className="flex flex-col bg-background text-foreground relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute w-80 h-80 rounded-full blur-3xl opacity-15" style={{ top: "-10%", right: "-15%", background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)" }} />
        <div className="absolute w-72 h-72 rounded-full blur-3xl opacity-10" style={{ bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-6 pt-8 flex items-center gap-2.5">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Your Daily Coach</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
          <div className="rounded-2xl p-6 space-y-6" style={{ background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 6%) 100%)", border: "1px solid hsl(217 32% 16%)", boxShadow: "0 0 32px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.03)" }}>
            <div>
              <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Create your account</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">Start building your personalized plan.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
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
                  data-testid="input-email"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-elevated border border-border rounded-xl h-12 px-4 pr-12 text-base outline-none focus:border-primary transition-colors"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary shrink-0"
                  data-testid="checkbox-agree"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I am 18 or older and agree to the{" "}
                  <Link href="/terms" className="text-primary font-semibold underline-offset-2 hover:underline" target="_blank">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-primary font-semibold underline-offset-2 hover:underline" target="_blank">Privacy Policy</Link>
                  . I understand that Ascend is not medical advice and I should consult a doctor before starting any diet or exercise program.
                </span>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={signup.isPending}
                className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  boxShadow: "0 4px 24px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
                }}
                data-testid="button-signup"
              >
                <span className="text-white">{signup.isPending ? "Creating account..." : "Create account"}</span>
                {!signup.isPending && <ArrowRight className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold" data-testid="link-login">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
