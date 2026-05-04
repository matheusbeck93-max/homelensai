import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC · Virginia</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">These Terms of Service ("Terms") govern access to and use of the Homelens.ai platform, website, mobile applications, APIs, and AI-powered real estate tools (collectively, the "Platform"). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, you may not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Nature of the Service</h2>
            <p className="text-muted-foreground">The Platform provides AI-powered real estate assistance tools, including: buying power estimations, mortgage and investor simulations, property analysis, intelligent property search, AI chat assistant (text and voice), file/image attachment review, saved analyses, and the HomeLens Chrome Extension for in-browser property analysis on third-party listing sites. The Platform does not provide lending, brokerage, legal, tax, or financial advisory services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. No Financial, Legal, or Mortgage Advice</h2>
            <p className="text-muted-foreground">The Platform provides informational and analytical tools only. Nothing on the Platform constitutes financial advice, mortgage underwriting, legal advice, tax advice, investment advisory services, or real estate brokerage services. Users must consult licensed professionals before making financial decisions.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. No Mortgage Lending Relationship</h2>
            <p className="text-muted-foreground">Use of mortgage calculators or simulations does not create a lender-borrower relationship, a mortgage pre-approval, or a financing commitment. The Company is not a lender, mortgage broker, or financial institution.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. AI & Automated Decision-Making Disclaimer</h2>
            <p className="text-muted-foreground">The Platform uses artificial intelligence and algorithmic systems. Outputs are probabilistic, may contain inaccuracies, may rely on third-party data, and should not be relied upon as sole decision basis. The Company does not guarantee accuracy, completeness, or predictive performance. Users assume full responsibility for decisions made based on AI outputs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Fair Housing Compliance</h2>
            <p className="text-muted-foreground">The Platform is designed to comply with the Fair Housing Act (42 U.S.C. §§ 3601–3619). The Company does not permit discrimination based on race, color, religion, sex, disability, familial status, or national origin. Users are strictly prohibited from using the Platform in a discriminatory manner.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. User Accounts</h2>
            <p className="text-muted-foreground">Users must provide accurate information, maintain confidentiality of credentials, and be at least 18 years old. The Platform is not intended for children under 13 (COPPA compliance).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Acceptable Use</h2>
            <p className="text-muted-foreground">Users may not: (a) scrape MLS or third-party data unlawfully or in violation of source terms; (b) automate, resell, or redistribute AI outputs at scale; (c) reverse engineer AI models; (d) use outputs to discriminate against any class protected by the Fair Housing Act; (e) upload unlawful, infringing, or sensitive third-party financial data; or (f) interfere with security controls or rate limits. Violation may result in immediate termination.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Third-Party Data & APIs</h2>
            <p className="text-muted-foreground">The Platform may integrate with MLS systems, credit services, financial institutions, and data aggregators. The Company is not responsible for third-party accuracy, API downtime, or third-party compliance failures.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Subscription, Billing & Refunds</h2>
            <p className="text-muted-foreground">The Platform offers a free tier ($0) and a Premium tier at $9.97/month. Premium subscriptions renew automatically each month until cancelled. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing cycle, and you retain access to Premium features until then.</p>
            <p className="text-muted-foreground"><strong>Refunds:</strong> Subscriptions are generally non-refundable, and we do not provide pro-rata refunds for partial months. As a courtesy, you may request a full refund within 7 days of the initial Premium charge if no Premium-only feature has been used (e.g., no Saved Analyses created, no advanced calculator export). Refund requests must be sent to <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>. Payments are processed by Stripe, subject to Stripe's terms.</p>
            <p className="text-muted-foreground"><strong>Price changes:</strong> We may change subscription pricing with at least 30 days' prior notice; changes apply to the next renewal cycle.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Limitation of Liability</h2>
            <p className="text-muted-foreground">To the maximum extent permitted by law, the Company shall not be liable for indirect damages, lost profits, lost opportunities, real estate losses, investment losses, or mortgage denials. Total liability shall not exceed the greater of $100 or fees paid in the prior 12 months.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Indemnification</h2>
            <p className="text-muted-foreground">User agrees to indemnify the Company against claims arising from misuse of the Platform, regulatory violations, discriminatory use, or MLS violations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Arbitration & Class Action Waiver</h2>
            <p className="text-muted-foreground">Any dispute shall be resolved by binding arbitration under the Federal Arbitration Act. Venue: Virginia. Users waive class action participation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Governing Law</h2>
            <p className="text-muted-foreground">These Terms are governed by the laws of the State of Virginia, excluding conflict-of-law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">15. Modifications</h2>
            <p className="text-muted-foreground">The Company may update Terms with notice. Continued use constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">16. Contact</h2>
            <p className="text-muted-foreground">Questions about these Terms? Contact us at <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
