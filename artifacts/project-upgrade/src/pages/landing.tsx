import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetUserProfile } from "@workspace/api-client-react";
import { ArrowRight, Zap, Dumbbell, Brain, Moon } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  // isLoading = true on first fetch; data = undefined until resolved
  const { data: profile, isLoading } = useGetUserProfile();

  useEffect(() => {
    // Only redirect once we have confirmed profile data (not while loading)
    if (!isLoading && profile) {
      setLocation("/dashboard");
    }
  }, [isLoading, profile, setLocation]);

  // Show a neutral loading state while we check for an existing profile
  // so there's no flash of the welcome screen before a redirect
  if (isLoading) {
    return (
      <div
        style={{
          height: "100dvh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#F59E0B",
            animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top */}
      <div className="px-6 pt-10 pb-4">
        <p className="text-2xl font-bold uppercase tracking-tighter text-primary">UPGRADE</p>
      </div>

      {/* Hero text */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight mb-4">
          Your strict AI coach.<br />
          <span className="text-primary">No excuses.</span><br />
          No shortcuts.
        </h1>
        <p className="text-sm text-muted-foreground uppercase tracking-widest leading-relaxed max-w-xs">
          Daily schedules, meal feedback, workouts, nightly reviews — built around your life and goals.
        </p>

        {/* Features list */}
        <div className="mt-8 space-y-3">
          {[
            { icon: Dumbbell, text: "Personalized workout plan" },
            { icon: Zap,      text: "Calorie & protein targets" },
            { icon: Brain,    text: "AI coach chat — ask anything" },
            { icon: Moon,     text: "Nightly scored reviews" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 border border-primary/30 bg-primary/5 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-sm uppercase tracking-wider">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 space-y-3">
        <Link
          href="/onboarding"
          className="flex items-center justify-center gap-3 w-full bg-primary text-primary-foreground h-14 text-sm font-bold uppercase tracking-widest active:opacity-90 transition-opacity"
          data-testid="link-start-onboarding"
        >
          Build My Plan
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest">
          Takes 3 minutes · Free to start
        </p>
      </div>
    </div>
  );
}
