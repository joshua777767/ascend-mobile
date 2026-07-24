import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

export default function LandingPage() {
  const benefits = [
    "Know exactly what to eat",
    "Get workouts built for your goal and equipment",
    "Adjust your plan as you progress",
  ];

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient background orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ top: "-5%", left: "-10%", background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)" }}
        />
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ top: "30%", right: "-20%", background: "radial-gradient(circle, rgba(16,185,129,0.5) 0%, transparent 70%)" }}
        />
        <div
          className="absolute w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ bottom: "10%", left: "20%", background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Brand */}
        <div className="px-6 pt-8 flex items-center gap-2.5">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Your Daily Coach</p>
          </div>
        </div>

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10">
          <h1 className="text-[2rem] leading-[1.12] font-extrabold tracking-tight max-w-md">
            Your complete AI fitness coach—not just a calorie tracker.
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-md">
            Ascend creates your personalized calories, protein, meals, workouts, progress adjustments, meal-photo feedback, and 24/7 AI coaching.
          </p>

          {/* Benefits */}
          <div className="mt-6 space-y-3">
            {benefits.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                </div>
                <span className="text-sm font-medium text-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-8 space-y-4">
          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C89A3E 0%, #A87E2E 100%)",
              boxShadow: "0 4px 24px rgba(200,154,62,0.25), 0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
            data-testid="link-start-onboarding"
          >
            <span className="text-background">Build My Personal Plan</span>
            <ArrowRight className="w-[18px] h-[18px] text-background" strokeWidth={2.4} />
          </Link>
          <p className="text-center text-[13px] text-muted-foreground">
            For losing fat, gaining healthy weight, or building muscle.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold" data-testid="link-login">
              Log in
            </Link>
          </p>
        </div>
        <div className="px-6 pb-6 flex items-center justify-center gap-4 border-t border-border/30 pt-4">
          <Link href="/terms" className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            Terms of Service
          </Link>
          <span className="text-[11px] text-muted-foreground/30">·</span>
          <Link href="/privacy" className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>
          <span className="text-[11px] text-muted-foreground/30">·</span>
          <span className="text-[11px] text-muted-foreground/40">Not medical advice</span>
        </div>
      </div>
    </div>
  );
}
