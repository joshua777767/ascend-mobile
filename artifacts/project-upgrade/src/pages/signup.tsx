import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSignup,
  getGetMeQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const signup = useSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await signup.mutateAsync({ data: { email, password } });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      // Clear any leftover profile cache so the onboarding guard fetches fresh
      // for this brand-new account (no profile yet → onboarding).
      queryClient.removeQueries({ queryKey: getGetUserProfileQueryKey() });
      setLocation("/onboarding");
    } catch (err: any) {
      setError(err?.data?.error ?? "Could not create account");
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
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Command Center</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
        <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-tight">Create your account</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Start building your personalized plan.</p>

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
            <label className="text-sm font-semibold text-foreground mb-2 block">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-elevated border border-border rounded-xl h-12 px-4 text-base outline-none focus:border-primary transition-colors"
              data-testid="input-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={signup.isPending}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform disabled:opacity-60"
            data-testid="button-signup"
          >
            {signup.isPending ? "Creating account..." : "Create account"}
            {!signup.isPending && <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.4} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold" data-testid="link-login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
