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
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 02/13/2026 · Homelens.ai LLC · Virginia</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">These Terms of Service ("Terms") govern access to and use of the Homelens.ai platform, website, mobile applications, APIs, and AI-powered real estate tools (collectively, the "Platform"). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, you may not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Nature of the Service</h2>
            <p className="text-muted-foreground">The Platform provides AI-powered real estate assistance tools, including buying power estimations, mortgage simulations and calculations, property analysis, intelligent property search, and investment decision-support insights. The Platform does not provide lending services, brokerage services, legal services, tax advice, or financial advisory services.</p>
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
            <p className="text-muted-foreground">Users may not scrape MLS data unlawfully, reverse engineer AI models, use outputs to discriminate, upload unlawful financial data, or interfere with security controls. Violation may result in immediate termination.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Third-Party Data & APIs</h2>
            <p className="text-muted-foreground">The Platform may integrate with MLS systems, credit services, financial institutions, and data aggregators. The Company is not responsible for third-party accuracy, API downtime, or third-party compliance failures.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">To the maximum extent permitted by law, the Company shall not be liable for indirect damages, lost profits, lost opportunities, real estate losses, investment losses, or mortgage denials. Total liability shall not exceed the greater of $100 or fees paid in the prior 12 months.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Indemnification</h2>
            <p className="text-muted-foreground">User agrees to indemnify the Company against claims arising from misuse of the Platform, regulatory violations, discriminatory use, or MLS violations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Arbitration & Class Action Waiver</h2>
            <p className="text-muted-foreground">Any dispute shall be resolved by binding arbitration under the Federal Arbitration Act. Venue: Virginia. Users waive class action participation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Governing Law</h2>
            <p className="text-muted-foreground">These Terms are governed by the laws of the State of Virginia, excluding conflict-of-law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Modifications</h2>
            <p className="text-muted-foreground">The Company may update Terms with notice. Continued use constitutes acceptance.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
