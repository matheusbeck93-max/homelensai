import { Navigation } from "@/components/Navigation";
import { SeoCanonical } from "@/components/seo/SeoCanonical";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CookiePolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SeoCanonical />
      <Helmet>
        <title>Cookie Policy — HomeLens</title>
        <meta name="description" content="Which cookies and similar technologies HomeLens uses for authentication, analytics, and preferences, and how you can control them in your browser." />
        <meta property="og:title" content="Cookie Policy — HomeLens" />
        <meta property="og:description" content="The cookies HomeLens uses for login, analytics, and preferences — and how to control them." />
        <meta property="og:url" content="https://homelensais.com/cookies" />
      </Helmet>
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">What Are Cookies?</h2>
            <p className="text-muted-foreground">Cookies are small text files placed on your device when you visit our Platform. They help us provide a better experience, remember your preferences, and understand how the Platform is used.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Types of Cookies We Use</h2>
            <p className="text-muted-foreground"><strong>Essential (cannot be disabled):</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><code className="px-1 bg-muted rounded">sb-*</code> — authentication and session tokens (Lovable Cloud / Supabase).</li>
              <li><code className="px-1 bg-muted rounded">homelens_cookie_consent</code> — stores your cookie banner choice.</li>
            </ul>
            <p className="text-muted-foreground"><strong>Functional (local storage):</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><code className="px-1 bg-muted rounded">theme</code> — your dark/light mode preference.</li>
              <li><code className="px-1 bg-muted rounded">homelens_*</code> keys — featured-home cache, comparison list, investor calculator mode, and chunk-reload safety flag.</li>
            </ul>
            <p className="text-muted-foreground"><strong>Analytics & error monitoring:</strong> Sentry stores a small client identifier to deduplicate error reports. PII is masked.</p>
            <p className="text-muted-foreground"><strong>Chrome Extension session storage:</strong> The HomeLens Chrome Extension uses <code className="px-1 bg-muted rounded">chrome.storage.session</code> to keep per-site chat history that is automatically cleared when you close the browser.</p>
            <p className="text-muted-foreground"><strong>We do NOT use:</strong> advertising cookies, cross-site tracking pixels, or third-party marketing cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Retention Period</h2>
            <p className="text-muted-foreground">Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period (typically 30 days to 2 years) or until you delete them manually.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Third-Party Trackers</h2>
            <p className="text-muted-foreground">The only third-party services that may set client-side identifiers are Sentry (error monitoring) and Stripe (only on payment pages, for fraud prevention). We do not use third-party advertising trackers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">How to Opt Out</h2>
            <p className="text-muted-foreground">You can manage cookie preferences through your browser settings. Most browsers allow you to block or delete cookies. Note that disabling essential cookies may affect Platform functionality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Global Privacy Control (GPC)</h2>
            <p className="text-muted-foreground">We recognize and honor the Global Privacy Control (GPC) signal as required under California law. When we detect a GPC signal from your browser, we will treat it as a valid opt-out request for the sale or sharing of your personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">Questions about cookies? Contact us at <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
