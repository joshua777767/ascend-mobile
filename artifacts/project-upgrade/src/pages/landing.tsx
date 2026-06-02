import React from "react";
import { Link } from "wouter";
import { ArrowRight, Activity, Crosshair, ShieldAlert } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl uppercase tracking-tighter text-primary">Upgrade</div>
          <div className="flex gap-4 items-center">
            <Link href="/pricing" className="text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground font-medium transition-colors" data-testid="link-pricing">
              Pricing
            </Link>
            <Link href="/onboarding" className="text-sm uppercase tracking-widest bg-primary text-primary-foreground px-4 py-2 font-bold hover:bg-primary/90 transition-colors" data-testid="link-start-nav">
              Initiate
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main>
        <section className="relative pt-24 pb-32 px-6 overflow-hidden flex flex-col items-center text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-none mb-6 max-w-5xl">
            Your strict AI coach for upgrading your <span className="text-primary">body, energy, & discipline.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl uppercase tracking-wider mb-10">
            Get daily schedules, workouts, meal feedback, nightly reviews, and weekly adjustments built around your real life.
          </p>
          <Link href="/onboarding" className="group flex items-center justify-center gap-3 bg-primary text-primary-foreground px-8 py-5 text-lg font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)]" data-testid="link-start-hero">
            Start 7-Day Free Trial
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* Features */}
        <section className="py-24 bg-card border-y border-border px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
            <div>
              <Activity className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-4">Uncompromising Accountability</h3>
              <p className="text-muted-foreground text-sm uppercase tracking-wider leading-relaxed">
                No gamification. No coddling. Just real metrics, hard truths, and the structure you need to perform at your peak.
              </p>
            </div>
            <div>
              <Crosshair className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-4">Tactical Protocols</h3>
              <p className="text-muted-foreground text-sm uppercase tracking-wider leading-relaxed">
                Workouts and nutrition dialed in for your exact schedule, equipment, and biological reality.
              </p>
            </div>
            <div>
              <ShieldAlert className="w-12 h-12 text-primary mb-6" />
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-4">Nightly Debriefs</h3>
              <p className="text-muted-foreground text-sm uppercase tracking-wider leading-relaxed">
                Log your sleep, skin, bloating, and discipline. The coach analyzes failures and dictates tomorrow's adjustments.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 text-center px-6">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          © {new Date().getFullYear()} Project Upgrade. Precision AI Coaching.
        </p>
      </footer>
    </div>
  );
}
