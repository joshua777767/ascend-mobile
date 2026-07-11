import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useGetMe } from "@workspace/api-client-react";
import { sendToNative, onFromNative } from "@/lib/native-bridge";

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
  const { isPro, isNative, currentPackage } = useSubscription();
  const [location] = useLocation();
  const { data: me } = useGetMe();

  const isExpired = location.includes("expired=1") || (!!me?.trialExpired && !me?.hasAccess);
  const hasTrial = me ? !me.trialUsed : true;

  useEffect(() => {
    if (isPro) {
      window.location.href = "/dashboard";
    }
  }, [isPro]);

  // Listen for Pro confirmation from the native paywall and redirect.
  useEffect(() => {
    if (!isNative) return;
    return onFromNative("SUBSCRIPTION_STATUS", (payload) => {
      const p = payload as { isPro?: boolean } | null;
      if (p?.isPro) {
        window.location.href = "/dashboard";
      }
    });
  }, [isNative]);

  const handleSubscribe = async (_trial = false) => {
    setError("");
    if (isNative) {
      // Hand off entirely to the native RevenueCat paywall.
      sendToNative("REQUEST_PAYWALL");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trial: _trial }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch (e: any) {
      setError(e?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    if (isNative) {
      sendToNative("REQUEST_PAYWALL");
      return;
    }
  };

  const trialEndDate = getTrialEndDate();

  return (
    <div
      className="bg-background text-foreground"
      style={{
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-12 pb-16 md:py-16">
        {isExpired && (
          <div className="mb-8 bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your free trial has ended</p>
              <p className="text-sm text-muted-foreground mt-0.5">Subscribe to continue using Ascend Pro.</p>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <p className="text-xs font-medium tracking-wide text-primary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">One Price. Everything Included.</h1>
          <p className="text-muted-foreground">No upsells. No add-ons. The full AI coaching system.</p>
        </div>

        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <p className="text-sm text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Trial Card */}
          <div className="bg-card border border-primary/40 p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium tracking-wide bg-primary text-primary-foreground px-2 py-1">Best Value</span>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-primary mb-1">Free Trial</p>
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
              {["Full onboarding & personalized plan", "All Pro features during trial", "AI meal feedback & coach chat", "Custom workout plan", "Dashboard & progress tracking"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={loading || !hasTrial}
              onClick={() => handleSubscribe(true)}
              data-testid="button-start-trial"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting...</>
              ) : !hasTrial ? (
                "Trial already used"
              ) : (
                `Start Free Trial — $0 for ${TRIAL_DAYS} days`
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Card required. Cancel anytime. No commitment.
            </p>
          </div>

          {/* Pro Card */}
          <div className="bg-card border border-border p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium tracking-wide bg-primary text-primary-foreground px-2 py-1">Most Popular</span>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-primary mb-1">Ascend Pro</p>
              <p className="text-sm font-bold text-foreground mb-2 leading-snug">Your Week 2 plan is ready.<br />Upgrade to keep your progress going.</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-bold">$19.99</p>
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
              disabled={loading}
              onClick={() => handleSubscribe(false)}
              data-testid="button-subscribe-pro"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting...</>
              ) : (
                "Start Pro — $19.99/month"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Secure checkout. Cancel anytime.</p>
          </div>
        </div>

        <div className="mt-12 bg-card border border-border p-6">
          <h2 className="text-sm font-semibold tracking-tight mb-4">Frequently Asked</h2>
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

        {isNative && (
          <div className="mt-8 text-center">
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleRestore}
              disabled={loading}
            >
              {loading ? "Restoring..." : "Restore Purchases"}
            </button>
          </div>
        )}

        {!isExpired && (
          <div className="mt-8 text-center">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-muted-foreground text-sm" data-testid="link-back-to-dashboard">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
