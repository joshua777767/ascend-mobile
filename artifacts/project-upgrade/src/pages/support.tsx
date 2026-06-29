import { Link } from "wouter";
import { AscendMark } from "@/components/ascend-mark";

export default function SupportPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-background text-foreground" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="px-4 py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Support</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Support</h1>
            <p className="text-sm text-muted-foreground">We are here to help.</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions, bug reports, or feedback, email us at{" "}
              <a href="mailto:support@ascend.app" className="text-primary font-semibold">support@ascend.app</a>.
              We typically respond within 24 hours.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">How do I cancel my subscription?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Open the Ascend app, go to Settings, and tap "Manage Subscription." From there, you can cancel, change plans, or restore purchases. You can also cancel through your Apple ID subscriptions in Settings on your iPhone.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">What happens after my free trial ends?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Your subscription will automatically convert to $19.99/month unless you cancel at least 24 hours before the trial ends. You can cancel anytime during the trial at no charge.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Can I get a refund?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Refund requests are handled by Apple. Go to reportaproblem.apple.com and follow the steps to request a refund for your Ascend subscription.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">My data is not syncing across devices</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Make sure you are signed in with the same account on all devices. If the issue persists, try signing out and signing back in. If that does not work, contact us at support@ascend.app.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Is Ascend a medical service?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  No. Ascend provides general fitness, nutrition, and habit-tracking information only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting any new fitness or diet program.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Legal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <Link href="/terms" className="text-primary font-semibold">Terms of Service</Link>
              {" "}·{" "}
              <Link href="/privacy" className="text-primary font-semibold">Privacy Policy</Link>
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
