import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

const PRO_FEATURES = [
  "Personalized daily schedule built around your real life",
  "Meal check-ins with honest AI coach feedback",
  "AI coach chat — ask anything, 24/7",
  "Custom workout plan based on your goals and gym access",
  "Nightly review and daily score",
  "Weekly adjustment based on your actual results",
  "Skin, energy, and sleep habit tracking",
  "Mission streak and progress tracking",
];

const TRIAL_DAYS = 7;

function getTrialEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async (priceId: string, trial = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId, trial }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const trialEndDate = getTrialEndDate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-16 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold uppercase tracking-tighter mb-4">One Price. Everything Included.</h1>
          <p className="text-muted-foreground">No upsells. No add-ons. The full AI coaching system.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-primary/40 p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-1">Best Value</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Free Trial</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-bold">$0</p>
                <p className="text-muted-foreground mb-1">today</p>
              </div>
              <p className="text-sm font-semibold text-foreground mt-1">
                {TRIAL_DAYS}-day free trial, then $19.99/month unless canceled.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cancel before {trialEndDate} and you won't be charged.
              </p>
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              {["Full onboarding & personalized plan","All Pro features during trial","AI meal feedback & coach chat","Custom workout plan","Dashboard & progress tracking"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2 text-center">{error}</p>
            )}
            <Button
              className="w-full"
              disabled={loading}
              onClick={() => handleSubscribe("price_monthly", true)}
              data-testid="button-start-trial"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Redirecting...
                </>
              ) : (
                `Start Free Trial — $0 for ${TRIAL_DAYS} days`
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Card required. Cancel anytime. No commitment.
            </p>
          </div>

          <div className="bg-card border border-border p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-1">Most Popular</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Ascend Pro</p>
              <p className="text-sm font-bold text-foreground mb-2 leading-snug">Your Week 2 plan is ready.<br />Upgrade to keep your progress going.</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-bold">$19.99</p>
                <p className="text-muted-foreground mb-1">/month</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cancel anytime</p>
              <div className="border-t border-border pt-3 flex items-center gap-2">
                <button
                  className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                  onClick={() => handleSubscribe("price_annual")}
                  disabled={loading}
                >
                  Or save 17% with $199.99/year
                </button>
              </div>
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </div>
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2 text-center">{error}</p>
            )}
            <Button
              className="w-full"
              disabled={loading}
              onClick={() => handleSubscribe("price_monthly")}
              data-testid="button-subscribe-pro"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Redirecting...
                </>
              ) : (
                "Start Pro — $19.99/month"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Secure checkout. Cancel anytime.</p>
          </div>
        </div>

        <div className="mt-12 bg-card border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight mb-4">Frequently Asked</h2>
          <div className="space-y-4">
            {[
              { q: "Is my card charged during the trial?", a: `No. You won't be charged until the ${TRIAL_DAYS}-day trial ends on ${trialEndDate}. Cancel before then and you pay nothing.` },
              { q: "Is this real AI coaching?", a: "Yes. Your plan, meal feedback, and coach chat are powered by AI that knows your profile, goals, and history." },
              { q: "Do I need a gym?", a: "No. Ascend builds workouts around your actual setup — full gym, home gym, or no equipment." },
              { q: "Is this medical advice?", a: "No. Ascend is not medical advice. Always speak with a healthcare professional before starting any new diet or exercise program." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel in one click from Settings before your trial ends or anytime after. No contracts, no commitments." },
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
