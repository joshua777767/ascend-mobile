import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const PRO_FEATURES = [
  "Personalized daily schedule built around your real life",
  "Meal check-ins with strict AI coach feedback",
  "AI coach chat — ask anything, 24/7",
  "Custom workout plan based on your goals and gym access",
  "Nightly review and daily score",
  "Weekly adjustment based on your actual results",
  "Skin, energy, and sleep habit tracking",
  "Mission streak and progress tracking",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold uppercase tracking-tighter mb-4">One Price. Everything Included.</h1>
          <p className="text-muted-foreground">No upsells. No add-ons. The full strict AI coaching system.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Free Trial</p>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground mt-1">7 days, no credit card required</p>
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              {["Full onboarding","Personalized plan","3 meal check-ins","1 workout plan","Dashboard access"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/onboarding">
              <Button variant="outline" className="w-full" data-testid="button-start-trial">
                Start Free Trial
              </Button>
            </Link>
          </div>

          <div className="bg-card border border-primary/40 p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-1">Most Popular</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Project Upgrade Pro</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-bold">$9.99</p>
                <p className="text-muted-foreground mb-1">/month</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cancel anytime</p>
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={() => alert("Payment integration coming soon. This is a demo.")}
              data-testid="button-subscribe-pro"
            >
              Start Pro — $9.99/month
            </Button>
            <p className="text-xs text-muted-foreground text-center">Secure checkout. Cancel anytime.</p>
          </div>
        </div>

        <div className="mt-12 bg-card border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight mb-4">Frequently Asked</h2>
          <div className="space-y-4">
            {[
              { q: "Is this real AI coaching?", a: "Yes. Your plan, meal feedback, and coach chat are powered by AI that knows your profile, goals, and history." },
              { q: "Do I need a gym?", a: "No. Project Upgrade builds workouts around your actual setup — full gym, home gym, or no equipment." },
              { q: "Is this medical advice?", a: "No. Project Upgrade is not medical advice. Always speak with a healthcare professional before starting any new diet or exercise program." },
              { q: "Can I cancel anytime?", a: "Yes. No contracts, no commitments. Cancel in one click." },
            ].map((item, i) => (
              <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-semibold mb-1">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-muted-foreground text-sm" data-testid="link-back-to-dashboard">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
