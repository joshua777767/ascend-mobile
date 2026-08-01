import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogin,
  getMe,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight, Eye, EyeOff, Dumbbell, Apple, Moon, BatteryCharging, Sparkles, ShieldCheck } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

const pillars = [
  { icon: Dumbbell,        label: "Workouts", color: "#3B82F6" },
  { icon: Apple,           label: "Meals",    color: "#10B981" },
  { icon: Moon,            label: "Sleep",    color: "#3B82F6" },
  { icon: BatteryCharging, label: "Energy",   color: "#10B981" },
  { icon: Sparkles,        label: "Skin",     color: "#3B82F6" },
  { icon: ShieldCheck,     label: "Habits",   color: "#10B981" },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ data: { email, password } });

      // Confirm the session cookie is usable before navigating. This avoids a
      // race where the router mounts /dashboard while its first /auth/me check
      // still has the pre-login 401 cached, making users submit the form again.
      const user = await getMe();
      queryClient.setQueryData(getGetMeQueryKey(), user);
      queryClient.removeQueries({ queryKey: getGetUserProfileQueryKey() });

      // Start the authenticated app from a clean document so every auth
      // consumer sees the confirmed session and no stale public-route state.
      window.location.replace("/dashboard");
    } catch (err: any) {
      setError(err?.data?.error ?? "Invalid email or password");
    }
  };

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient orbs — same palette as landing */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ top: "-5%", left: "-10%", background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)" }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ top: "30%", right: "-20%", background: "radial-gradient(circle, rgba(16,185,129,0.5) 0%, transparent 70%)" }} />
        <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ bottom: "10%", left: "20%", background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex flex-col">
        {/* Brand header — identical to landing page */}
        <div className="px-6 pt-8 flex items-center gap-2.5">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Your Daily Coach</p>
          </div>
        </div>

        {/* Hero line */}
        <div className="px-6 pt-6 pb-1">
          <h1 className="text-[2.1rem] leading-[1.12] font-extrabold tracking-tight">
            Your AI Coach for{" "}
            <span className="text-primary">Body</span>,{" "}
            <span className="text-success">Energy</span>, and{" "}
            <span className="text-foreground">Focus</span>
          </h1>
        </div>

        {/* Pillar grid — same as landing */}
        <div className="px-6 pt-5 grid grid-cols-3 gap-3">
          {pillars.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4"
              style={{
                background: "linear-gradient(145deg, hsl(220 52% 9%) 0%, hsl(220 48% 7%) 100%)",
                border: "1px solid hsl(217 32% 18%)",
                boxShadow: "0 0 20px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)" }}
              >
                <Icon style={{ width: 16, height: 16, color, flexShrink: 0 }} strokeWidth={2} />
              </div>
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Login form */}
        <div className="px-6 pt-7 pb-8 space-y-5">
          <div>
            <h2 className="text-[1.55rem] font-extrabold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">Log in to continue your transformation.</p>
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
                className="w-full rounded-xl h-12 px-4 text-base outline-none transition-colors"
                style={{
                  background: "linear-gradient(145deg, hsl(220 52% 9%) 0%, hsl(220 48% 7%) 100%)",
                  border: "1px solid hsl(217 32% 18%)",
                  color: "inherit",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1px solid #F59E0B")}
                onBlur={(e) => (e.currentTarget.style.border = "1px solid hsl(217 32% 18%)")}
                data-testid="input-email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium" style={{ color: "#F59E0B" }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl h-12 px-4 pr-12 text-base outline-none transition-colors"
                  style={{
                    background: "linear-gradient(145deg, hsl(220 52% 9%) 0%, hsl(220 48% 7%) 100%)",
                    border: "1px solid hsl(217 32% 18%)",
                    color: "inherit",
                  }}
                  onFocus={(e) => (e.currentTarget.style.border = "1px solid #F59E0B")}
                  onBlur={(e) => (e.currentTarget.style.border = "1px solid hsl(217 32% 18%)")}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: "var(--color-muted-foreground)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 16, height: 16 }} />
                    : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={login.isPending}
              className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #6B8BAE 0%, #5A7A9E 100%)",
                boxShadow: "0 4px 24px rgba(107,139,174,0.25), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
              data-testid="button-login"
            >
              <span className="text-white">{login.isPending ? "Logging in…" : "Log in"}</span>
              {!login.isPending && <ArrowRight style={{ width: 18, height: 18, color: "white" }} strokeWidth={2.4} />}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" style={{ color: "#F59E0B" }} className="font-semibold" data-testid="link-signup">
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-center gap-4 border-t pt-4" style={{ borderColor: "hsl(217 32% 16% / 0.3)" }}>
          <Link href="/terms" className="text-[11px] transition-colors" style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}>
            Terms of Service
          </Link>
          <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.3)" }}>·</span>
          <Link href="/privacy" className="text-[11px] transition-colors" style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
