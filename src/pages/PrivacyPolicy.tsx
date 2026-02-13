import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 02/13/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Scope</h2>
            <p className="text-muted-foreground">This Privacy Policy describes how Homelens.ai collects, uses, discloses, and protects personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Categories of Personal Information Collected</h2>
            <p className="text-muted-foreground"><strong>Identifiers:</strong> Name, email, IP address, device identifiers.</p>
            <p className="text-muted-foreground"><strong>Financial Information:</strong> Income (self-reported), assets, debt information, credit-related inputs (if provided).</p>
            <p className="text-muted-foreground"><strong>Commercial Information:</strong> Property preferences, search behavior.</p>
            <p className="text-muted-foreground"><strong>Internet Activity:</strong> Browsing history, interaction data, clickstream data.</p>
            <p className="text-muted-foreground"><strong>Geolocation Data:</strong> Approximate location.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Sources of Information</h2>
            <p className="text-muted-foreground">Direct user input, cookies & tracking technologies, third-party APIs, MLS integrations, and analytics providers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Purposes of Processing</h2>
            <p className="text-muted-foreground">Providing AI functionality, improving algorithm performance, fraud detection, compliance with law, and marketing (if consented).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Legal Bases</h2>
            <p className="text-muted-foreground">Where applicable under state privacy laws: performance of contract, legitimate business interest, user consent, and legal compliance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Sharing of Information</h2>
            <p className="text-muted-foreground">We may share data with cloud providers, analytics vendors, MLS partners, credit reporting agencies (if integrated), and legal authorities. We do not sell personal information unless disclosed and permitted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Consumer Rights</h2>
            <p className="text-muted-foreground">Residents of CA, CO, VA, TX, FL, NY may have rights to access, correction, deletion, opt-out of sale/sharing, and limit sensitive data processing. Requests may be submitted at: privacy@homelens.ai</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Data Retention</h2>
            <p className="text-muted-foreground">We retain data only as long as the account remains active, necessary for service delivery, or required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Security Measures</h2>
            <p className="text-muted-foreground">We implement encryption in transit (TLS 1.2+), encryption at rest, access controls, and logging & monitoring.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Children's Privacy (COPPA)</h2>
            <p className="text-muted-foreground">We do not knowingly collect data from children under 13. If discovered, data will be deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. California Privacy Rights</h2>
            <p className="text-muted-foreground">A California Privacy Notice supplements this Policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Contact Information</h2>
            <p className="text-muted-foreground">Homelens.ai LLC · Virginia · privacy@homelens.ai</p>
          </section>
        </div>
      </div>
    </div>
  );
}
