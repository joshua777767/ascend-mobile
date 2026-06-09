import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogin,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

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
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      // Drop any stale profile cache from a previous session / new-user attempt
      // so the route guard refetches fresh and decides dashboard vs onboarding
      // from this user's real profile, not a leftover 404/401.
      queryClient.removeQueries({ queryKey: getGetUserProfileQueryKey() });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err?.data?.error ?? "Invalid email or password");
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
        <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Log in to continue your transformation.</p>

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
              data-testid="input-email"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary font-medium">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={login.isPending}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform disabled:opacity-60"
            data-testid="button-login"
          >
            {login.isPending ? "Logging in..." : "Log in"}
            {!login.isPending && <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.4} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-semibold" data-testid="link-signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
