import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

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
            <p className="text-muted-foreground"><strong>Chat Content:</strong> Text prompts, voice input transcripts, and file/image attachments (PDF, JPG, PNG, WEBP, HEIC; up to 5 files of 10MB each per message) you submit to the AI assistant.</p>
            <p className="text-muted-foreground"><strong>Voice Data:</strong> When you use voice input, audio is transcribed to text and processed; synthesized voice (TTS) audio is generated on demand and not stored on our servers beyond delivery.</p>
            <p className="text-muted-foreground"><strong>Saved Analyses:</strong> Property analyses you choose to save (Premium feature), including property details and AI-generated match scores.</p>
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
            <p className="text-muted-foreground">We may share data with infrastructure and processing subprocessors (listed below), MLS and real estate data partners, and legal authorities when required. We do not sell personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6a. Subprocessors</h2>
            <p className="text-muted-foreground">We rely on the following third-party providers to operate the Platform. Each is bound by contractual confidentiality and data-protection obligations:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Lovable Cloud (Supabase):</strong> Database, authentication, file storage, edge functions.</li>
              <li><strong>Google AI (Gemini, via Lovable AI Gateway):</strong> Primary AI model for chat, property analysis, and image/file understanding.</li>
              <li><strong>Perplexity:</strong> Real-time web search for market data, neighborhood insights, and current information.</li>
              <li><strong>ElevenLabs:</strong> Text-to-speech voice synthesis when voice output is enabled.</li>
              <li><strong>Stripe:</strong> Payment processing for Premium subscriptions.</li>
              <li><strong>Firecrawl:</strong> Web scraping fallback for extracting property listing details.</li>
              <li><strong>RapidAPI / Zillow56:</strong> Property listing and Zestimate data.</li>
              <li><strong>Mapbox:</strong> Map rendering and geographic visualizations.</li>
              <li><strong>Sentry:</strong> Error monitoring and performance tracking (with PII masking).</li>
            </ul>
            <p className="text-muted-foreground">Chat prompts, including any text you type, voice transcripts, file/image attachments, and property details, are sent to Google AI and/or Perplexity strictly to generate the response you request. We do not authorize these providers to use your content to train their models.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Consumer Rights</h2>
            <p className="text-muted-foreground">Residents of CA, CO, VA, TX, FL, NY may have rights to access, correction, deletion, opt-out of sale/sharing, and limit sensitive data processing. Requests may be submitted at: <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>.</p>
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
            <p className="text-muted-foreground">Homelens.ai LLC · Virginia · <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
