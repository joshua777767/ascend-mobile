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
            <p className="text-sm text-muted-foreground">Last updated: June 11, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend collects information you provide directly, including your name, email address, age, height, weight, body type, fitness goals, workout schedule, meal preferences, sleep habits, stress levels, and other health-related data you enter during onboarding or while using the app. We also collect activity data such as journal entries, meal logs, weigh-ins, streak counts, and coach chat messages to power your personalized AI coaching experience.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Sensitive Health Data</h2>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Ascend collects health and fitness information, including body weight, calorie intake, sleep quality, stress levels, and physical activity.</strong> This data is treated as sensitive. We do not sell, rent, or share this information with advertisers or data brokers. It is used solely to provide and improve your personalized coaching experience. You may delete all your data at any time through the Settings page.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use your data to generate personalized fitness plans, meal schedules, workout recommendations, and daily coaching feedback. Your data is processed by our AI systems to provide context-aware responses, weekly adjustments, and progress tracking. We may use aggregated, anonymized data to improve the service; this data cannot be used to identify you individually.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. AI Processing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your profile data and daily logs may be processed by OpenAI's API (GPT-4o-mini) to generate personalized coaching responses. Only the data necessary to answer your query or generate your plan is sent. We do not send identifiable payment information or passwords to OpenAI. OpenAI processes data subject to its own <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Privacy Policy</a>. No medical diagnosis or treatment is provided.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Data Storage, Security & Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored in secure PostgreSQL databases with encrypted connections (TLS). Passwords are hashed using bcrypt and never stored in plain text. We use session-based authentication with secure, HTTP-only cookies. We take reasonable industry-standard measures to protect your data from unauthorized access, disclosure, or loss, but cannot guarantee absolute security.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Retention:</strong> Your data is retained for as long as your account is active. When you delete your account, all personal data — including your profile, meals, journal entries, and chat history — is permanently deleted from our systems within 30 days. Aggregated, anonymized data may be retained for analytical purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have the right to access, update, correct, or delete your personal data at any time through the Settings page. You may request a full export of your data or request complete account deletion. We will respond to data requests within 30 days.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">California residents (CCPA):</strong> You have the right to know what personal information we collect, to request deletion of your data, and to opt out of the sale of your personal information. Ascend does not sell personal information. To exercise your rights, contact us at <a href="mailto:support@ascend.app" className="text-primary font-semibold">support@ascend.app</a>.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">EEA/UK residents (GDPR):</strong> You have the right to access, rectification, erasure, restriction of processing, data portability, and to lodge a complaint with a supervisory authority. Our legal basis for processing is your consent and the performance of our service agreement with you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Cookies & Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use session cookies to maintain your login state. We do not use third-party advertising or tracking cookies. We may use basic server-side logs for operational monitoring and error diagnostics. We do not use analytics platforms that track your behavior across other websites.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Stripe:</strong> Payment processing is handled by Stripe. Ascend does not store credit card numbers. Stripe processes your payment data subject to its own <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Privacy Policy</a>.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">OpenAI:</strong> AI coaching features are powered by OpenAI. Relevant portions of your profile and activity data are sent to OpenAI for processing. See Section 4 above.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Children's Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ascend is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected information from a minor, please contact us and we will delete it promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes through the app or by email. Continued use of Ascend after changes constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related questions, data requests, or to exercise your rights, contact us at <a href="mailto:support@ascend.app" className="text-primary font-semibold">support@ascend.app</a>.
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
