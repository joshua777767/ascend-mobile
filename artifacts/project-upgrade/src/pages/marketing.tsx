import { Link } from "wouter";
import { AscendMark } from "@/components/ascend-mark";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Your AI Coach for Body, Energy, and Focus</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Ascend: AI Fitness</h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Your personal AI coach that builds personalized daily schedules, meal plans, workouts, and habit trackers — all adapted to your real life and goals. Get honest feedback, nightly reviews, and weekly adjustments that keep you moving forward.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">What You Get</h2>
            <div className="grid gap-3">
              {[
                "AI-generated daily schedules tailored to your goals",
                "Unlimited coach chat with context-aware responses",
                "Personalized workout plans that adapt to your progress",
                "Nightly journal with scored daily reviews (0–100)",
                "Weekly plan adjustments based on your weigh-ins",
                "Meal photo feedback with instant AI analysis",
                "Water, sleep, and habit tracking with streaks",
                "14-day free trial, then $19.99/month — cancel anytime",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold mt-0.5 shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Pricing</h2>
            <div className="rounded-2xl border border-primary/30 bg-card p-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">$19.99</span>
                <span className="text-muted-foreground">/ month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Start with a 7-day free trial. Cancel anytime. No commitment.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Download</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend is available on iOS. Download it from the{" "}
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">
                App Store
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Support</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Need help? Visit our{" "}
              <Link href="/support" className="text-primary font-semibold">Support Center</Link>
              {" "}or email{" "}
              <a href="mailto:support@ascendfit.fitness" className="text-primary font-semibold">support@ascendfit.fitness</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Legal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <Link href="/terms" className="text-primary font-semibold">Terms of Service</Link>
              {" "}·{" "}
              <Link href="/privacy" className="text-primary font-semibold">Privacy Policy</Link>
              {" "}·{" "}
              <Link href="/support" className="text-primary font-semibold">Support</Link>
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-8">
            Ascend Fit · v1.0.0 · © 2026 Ascend Fit. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
