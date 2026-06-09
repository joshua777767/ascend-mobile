import { Link } from "wouter";
import { ArrowRight, Dumbbell, Apple, Moon, Sparkles, BatteryCharging, ShieldCheck, Zap, Brain, Heart } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

export default function LandingPage() {
  const pillars = [
    { icon: Dumbbell, label: "Workouts", color: "text-primary" },
    { icon: Apple, label: "Meals", color: "text-success" },
    { icon: Moon, label: "Sleep", color: "text-primary" },
    { icon: BatteryCharging, label: "Energy", color: "text-success" },
    { icon: Sparkles, label: "Skin", color: "text-primary" },
    { icon: ShieldCheck, label: "Habits", color: "text-success" },
  ];

  const highlights = [
    { icon: Zap, text: "AI-powered daily plan" },
    { icon: Brain, text: "Smart coach feedback" },
    { icon: Heart, text: "Built for your real life" },
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
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Your Daily Coach</p>
          </div>
        </div>

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-elevated border border-border px-3 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">AI-powered personal coaching</span>
          </div>

          <h1 className="text-[2.1rem] leading-[1.12] font-extrabold tracking-tight">
            Your AI Coach for{" "}
            <span className="text-primary">Body</span>,{" "}
            <span className="text-success">Energy</span>, and{" "}
            <span className="text-foreground">Focus</span>
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-md">
            A personalized daily plan built for your real life — workouts, meals, sleep, energy, and skin. Your AI coach reviews every day.
          </p>

          {/* Highlights row */}
          <div className="mt-6 flex flex-wrap gap-3">
            {highlights.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="inline-flex items-center gap-1.5 rounded-full bg-elevated/60 border border-border/60 px-3 py-1.5"
              >
                <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
                <span className="text-[11px] font-medium text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>

          {/* Pillars */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {pillars.map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-all duration-300 hover:scale-[1.02]"
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
                  <Icon className={`w-4 h-4 ${color}`} strokeWidth={2} />
                </div>
                <span className="text-xs font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-8 space-y-4">
          <p className="text-center text-[13px] leading-relaxed text-muted-foreground px-2">
            Personalized coaching for fat loss, muscle gain, better sleep, higher energy, and daily habits.
          </p>
          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
              boxShadow: "0 4px 24px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
            data-testid="link-start-onboarding"
          >
            <span className="text-white">Start 7-Day Free Trial</span>
            <ArrowRight className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />
          </Link>
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
