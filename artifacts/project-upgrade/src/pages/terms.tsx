import { Link } from "wouter";
import { AscendMark } from "@/components/ascend-mark";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Terms of Service</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 9, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By using Ascend, you agree to these Terms of Service. If you do not agree, do not use the service. Ascend is an AI-powered fitness coaching platform that provides personalized workout plans, meal guidance, and habit tracking.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Not Medical Advice</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Ascend is not a medical device and does not provide medical advice.</strong> All recommendations, including workout plans, meal suggestions, and AI coaching responses, are for informational purposes only. Always consult a qualified healthcare professional before starting any diet or exercise program, especially if you have pre-existing health conditions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. User Accounts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must be at least 18 years old to use Ascend. You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during onboarding and to keep your profile updated. You may delete your account at any time through the Settings page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Subscription & Payments</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend offers a free 7-day trial, followed by a paid subscription. Payments are processed through Stripe. Subscriptions auto-renew unless cancelled. You can cancel anytime through your account settings or by contacting support. No refunds are provided for partial billing periods.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Data & Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your use of Ascend is also governed by our <Link href="/privacy" className="text-primary font-semibold">Privacy Policy</Link>. You retain ownership of your data. We do not sell your personal information. You may request a data export or account deletion at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree not to use Ascend for any unlawful purpose, attempt to reverse engineer the app, interfere with other users' accounts, or misuse the AI coaching system. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for any injuries, health issues, or damages that may result from following our workout or nutrition recommendations. Use the service at your own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. Continued use after changes constitutes acceptance. We will notify users of significant changes through the app or email.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about these Terms, contact support@ascend.app.
            </p>
          </section>

          <div className="pt-4 border-t border-border">
            <Link href="/" className="text-sm text-primary font-semibold">
              &larr; Back to Ascend
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
