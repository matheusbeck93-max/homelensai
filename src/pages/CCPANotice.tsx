import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CCPANotice() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">California Privacy Notice (CCPA/CPRA)</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Scope</h2>
            <p className="text-muted-foreground">This California Privacy Notice supplements the Homelens.ai Privacy Policy and applies solely to residents of the State of California, as required by the California Consumer Privacy Act of 2018, as amended by the California Privacy Rights Act of 2020 (collectively, "CCPA").</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Categories of Personal Information Collected</h2>
            <p className="text-muted-foreground">In the preceding 12 months, we may have collected the following categories of personal information:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Identifiers:</strong> Name, email address, IP address, device identifiers.</li>
              <li><strong>Financial Information:</strong> Self-reported income, assets, debt information.</li>
              <li><strong>Commercial Information:</strong> Property preferences, search history, saved properties.</li>
              <li><strong>Internet or Network Activity:</strong> Browsing history, interaction data, clickstream data.</li>
              <li><strong>Geolocation Data:</strong> Approximate location based on IP address.</li>
              <li><strong>Inferences:</strong> Profiles generated from the above categories reflecting preferences and characteristics.</li>
              <li><strong>Sensory Data (Sensitive):</strong> Voice input audio (transcribed and discarded) when you use voice features, and file/image attachments you upload to the AI chat.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Sources of Personal Information</h2>
            <p className="text-muted-foreground">We collect personal information from: direct user input, cookies and tracking technologies, third-party APIs, MLS integrations, and analytics providers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Business or Commercial Purposes</h2>
            <p className="text-muted-foreground">We use personal information for: providing AI-powered real estate tools, improving algorithm performance, fraud prevention and security, compliance with legal obligations, and marketing communications (with consent).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Categories of Third Parties</h2>
            <p className="text-muted-foreground">We may disclose personal information to the following categories of third parties: Lovable Cloud (Supabase) for hosting and database; Google AI (Gemini) and Perplexity for AI processing; ElevenLabs for voice synthesis; Stripe for payment processing; Firecrawl, RapidAPI/Zillow56 for property data; Mapbox for maps; Sentry for error monitoring; and legal authorities when required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Sale and Sharing of Personal Information</h2>
            <p className="text-muted-foreground">Homelens.ai does not sell personal information as defined under the CCPA. We do not share personal information for cross-context behavioral advertising purposes. We honor the Global Privacy Control (GPC) signal as a valid opt-out request.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Your California Privacy Rights</h2>
            <p className="text-muted-foreground">As a California resident, you have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Know:</strong> Request disclosure of personal information collected, used, and disclosed.</li>
              <li><strong>Delete:</strong> Request deletion of personal information we hold about you.</li>
              <li><strong>Correct:</strong> Request correction of inaccurate personal information.</li>
              <li><strong>Opt-Out:</strong> Opt out of the sale or sharing of personal information.</li>
              <li><strong>Limit Use of Sensitive Information:</strong> Limit the use and disclosure of sensitive personal information.</li>
              <li><strong>Non-Discrimination:</strong> Not be discriminated against for exercising your privacy rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. How to Exercise Your Rights</h2>
            <p className="text-muted-foreground">You may submit a verifiable consumer request by emailing <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>. We will verify your identity before processing your request. We will respond within 45 days of receiving your request, with a possible 45-day extension if reasonably necessary.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Authorized Agents</h2>
            <p className="text-muted-foreground">You may designate an authorized agent to make a request on your behalf. We may require verification of the agent's authorization and your identity before processing the request.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Data Retention</h2>
            <p className="text-muted-foreground">We retain personal information only as long as necessary for the purposes described in this Notice, or as required by applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Contact Information</h2>
            <p className="text-muted-foreground">Homelens.ai LLC · Virginia · <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
