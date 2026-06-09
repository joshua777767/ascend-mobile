import { Link } from "wouter";
import { AscendMark } from "@/components/ascend-mark";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Privacy Policy</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 9, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend collects information you provide directly, including your name, email, age, height, weight, body type, fitness goals, workout schedule, meal preferences, and other health-related data you enter during onboarding or use of the app. We also collect usage data, streaks, and journal entries to provide AI coaching.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use your data to generate personalized fitness plans, meal schedules, and workout recommendations. Your data is used by our AI coach to provide feedback, adjustments, and motivation. We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. AI Processing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your profile data and daily logs may be processed by OpenAI's GPT-4o-mini to generate personalized coaching responses. We do not share identifiable personal data beyond what is necessary for this service. No medical advice is provided.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored in secure PostgreSQL databases with encrypted connections. Passwords are hashed using bcrypt. We use session-based authentication with secure cookies. We take reasonable measures to protect your data but cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can access, update, or delete your profile data at any time through the Settings page. You may request a full export of your data or request account deletion. Account deletion permanently removes all your data from our systems.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Cookies & Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use session cookies to maintain your login state. We do not use third-party tracking cookies or analytics beyond basic server logs for operational monitoring.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use Stripe for payment processing. Stripe handles your payment information directly; Ascend does not store credit card numbers. We use OpenAI for AI coaching features. Both services have their own privacy policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or by email. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related questions or data requests, contact us at support@ascend.app.
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
