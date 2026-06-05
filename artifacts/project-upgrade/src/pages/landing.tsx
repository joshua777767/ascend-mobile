import { Link } from "wouter";
import { ArrowRight, Dumbbell, Apple, Moon, Sparkles, BatteryCharging, ShieldCheck } from "lucide-react";
import { AscendMark } from "@/components/ascend-mark";

export default function LandingPage() {
  const pillars = [
    { icon: Dumbbell, label: "Workouts", color: "text-primary" },
    { icon: Apple, label: "Meals", color: "text-success" },
    { icon: Moon, label: "Sleep", color: "text-primary" },
    { icon: BatteryCharging, label: "Energy", color: "text-success" },
    { icon: Sparkles, label: "Skin", color: "text-primary" },
    { icon: ShieldCheck, label: "Discipline", color: "text-success" },
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
      {/* Brand */}
      <div className="px-6 pt-8 flex items-center gap-2.5">
        <AscendMark size="lg" />
        <div>
          <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Command Center</p>
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-elevated border border-border px-3 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-xs font-medium text-muted-foreground">AI-powered personal coaching</span>
        </div>

        <h1 className="text-[2.1rem] leading-[1.12] font-extrabold tracking-tight">
          Your AI Coach for{" "}
          <span className="text-primary">Body</span>,{" "}
          <span className="text-success">Energy</span>, and Discipline
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-md">
          Build a daily plan for your real life — workouts, meals, sleep, energy, skin habits, and strict coach reviews.
        </p>

        {/* Pillars */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {pillars.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border border-border py-4"
            >
              <Icon className={`w-5 h-5 ${color}`} strokeWidth={2} />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 space-y-4">
        <p className="text-center text-[13px] leading-relaxed text-muted-foreground px-2">
          Personalized coaching for fat loss, muscle gain, better sleep, higher energy, skin habits, and daily discipline.
        </p>
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform"
          data-testid="link-start-onboarding"
        >
          Start 7-Day Free Trial
          <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.4} />
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold" data-testid="link-login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
