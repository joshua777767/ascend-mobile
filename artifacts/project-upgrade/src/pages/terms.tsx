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
            <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Terms of Service</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 11, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By creating an account or using Ascend, you agree to these Terms of Service and our <Link href="/privacy" className="text-primary font-semibold">Privacy Policy</Link>. If you do not agree, do not use the service. You must be at least 13 years old to use Ascend. Users under 18 must have parental or legal guardian consent before creating an account. Ascend does not knowingly collect data from children under 13.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Not Medical Advice — Important Health Warning</h2>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-400">⚠️ Please read this section carefully.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Ascend is not a medical device and does not provide medical, nutritional, or psychological advice.</strong> All content — including workout plans, meal suggestions, calorie targets, and AI coaching responses — is for general informational and motivational purposes only and does not constitute professional advice of any kind.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Before starting any new diet or exercise program, you should consult a qualified healthcare professional</strong>, particularly if you have or suspect you have any medical condition, including but not limited to: cardiovascular disease, diabetes, hypertension, pregnancy, eating disorders, orthopedic injuries, or any condition requiring medication.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ascend is not a substitute for professional medical, nutritional, or psychological care. If you experience pain, dizziness, shortness of breath, or any adverse symptoms during exercise or as a result of dietary changes, stop immediately and seek medical attention.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. No Guarantees — Disclaimer of Results</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Results are not guaranteed.</strong> Individual outcomes depend on many factors outside our control, including genetics, adherence, pre-existing conditions, and lifestyle. Ascend makes no warranties, express or implied, regarding weight loss, muscle gain, performance improvement, or any other health outcome. Any testimonials or example results do not represent typical outcomes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. User Responsibility</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are solely responsible for your own health and safety decisions. By using Ascend, you acknowledge that you are voluntarily participating in fitness and nutritional activities and that you assume all risks associated with those activities. You agree to use your own judgment and to consult a professional before acting on any recommendation made by Ascend.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must be at least 13 years old to use Ascend. Users under 18 must have parental or legal guardian consent. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information and keep your profile updated.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Subscription & Payments</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend offers a <strong className="text-foreground">7-day free trial</strong>, after which a paid subscription is required to continue using Pro features.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-none">
              <li>• <strong className="text-foreground">Price:</strong> $19.99 per month after the free trial ends.</li>
              <li>• <strong className="text-foreground">Auto-renewal:</strong> Your subscription automatically renews monthly unless you cancel before the renewal date. By starting a trial or subscribing, you authorize Ascend to charge your payment method on a recurring monthly basis.</li>
              <li>• <strong className="text-foreground">Free trial:</strong> You will not be charged during the 7-day trial. Cancel before the trial ends and you will not be charged anything.</li>
              <li>• <strong className="text-foreground">Cancellation:</strong> You may cancel at any time through your account Settings page or by contacting support@ascend.app. Cancellation takes effect at the end of the current billing period; you retain access until then.</li>
              <li>• <strong className="text-foreground">Refunds:</strong> Payments are non-refundable except where required by applicable law. No refunds are issued for partial billing periods. If you cancel after a charge has been processed, you retain access through the end of that paid period.</li>
              <li>• <strong className="text-foreground">Payment processing:</strong> Payments are processed securely by Stripe. Ascend does not store your credit card information.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Data & Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your use of Ascend is also governed by our <Link href="/privacy" className="text-primary font-semibold">Privacy Policy</Link>. You retain ownership of your personal data. We do not sell your personal information to third parties. You may request a data export or account deletion at any time through the Settings page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree not to use Ascend for any unlawful purpose; attempt to reverse engineer, hack, or disrupt the service; create multiple accounts to abuse free trials; or misuse the AI coaching system to generate harmful content. We reserve the right to suspend or terminate accounts that violate these terms without refund.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, Ascend, its owners, employees, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages — including but not limited to physical injury, illness, eating disorders, psychological harm, or financial loss — arising from or related to your use of the service or your reliance on any content provided by Ascend.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, error-free, or that any specific results will be achieved. Use the service at your own risk.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In jurisdictions that do not allow the exclusion of certain warranties or limitation of liability, our liability is limited to the greatest extent permitted by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes through the app or by email. Continued use of Ascend after changes constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at <a href="mailto:support@ascend.app" className="text-primary font-semibold">support@ascend.app</a>.
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
