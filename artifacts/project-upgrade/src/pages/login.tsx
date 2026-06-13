import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogin,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthHeader } from "@/components/ascend-mark";

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
      const user = await login.mutateAsync({ data: { email, password } });
      // Write the user directly into the /me cache so isAuthed is true
      // immediately when the router evaluates — avoids a race where the cache
      // is empty during the background refetch and redirects back to /login.
      queryClient.setQueryData(getGetMeQueryKey(), user);
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
      className="flex flex-col bg-background text-foreground relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute w-80 h-80 rounded-full blur-3xl opacity-15" style={{ top: "-10%", right: "-15%", background: "radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)" }} />
        <div className="absolute w-72 h-72 rounded-full blur-3xl opacity-10" style={{ bottom: "10%", left: "-10%", background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <AuthHeader />

        <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
          <div className="rounded-2xl p-6 space-y-6" style={{ background: "linear-gradient(145deg, hsl(220 52% 8%) 0%, hsl(220 48% 6%) 100%)", border: "1px solid hsl(217 32% 16%)", boxShadow: "0 0 32px rgba(245,158,11,0.06), inset 0 1px 0 rgba(255,255,255,0.03)" }}>
            <div>
              <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">Log in to continue your transformation.</p>
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
                className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  boxShadow: "0 4px 24px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
                }}
                data-testid="button-login"
              >
                <span className="text-white">{login.isPending ? "Logging in..." : "Log in"}</span>
                {!login.isPending && <ArrowRight className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary font-semibold" data-testid="link-signup">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
