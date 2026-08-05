import { Navigation } from "@/components/Navigation";
import { SeoCanonical } from "@/components/seo/SeoCanonical";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ExtensionPrivacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SeoCanonical />
      <Helmet>
        <title>Chrome Extension Privacy Policy — HomeLens</title>
        <meta name="description" content="What the HomeLens Chrome extension reads on listing pages, what leaves your browser, how long data is retained, and the permissions it requests." />
        <meta property="og:title" content="Chrome Extension Privacy Policy — HomeLens" />
        <meta property="og:description" content="What the HomeLens Chrome extension reads on listing pages and how that data is handled." />
        <meta property="og:url" content="https://homelensais.com/extension-privacy" />
      </Helmet>
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Chrome Extension Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Effective Date: 05/04/2026 · HomeLens — AI Real Estate Advisor
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Overview</h2>
            <p className="text-muted-foreground">
              The HomeLens Chrome Extension ("Extension") helps users analyze U.S. real estate
              listings on third-party websites (such as Zillow, Redfin, and Realtor.com) using
              AI. This policy explains what data the Extension accesses, how it is used, and
              what is — and is not — stored.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data the Extension Accesses</h2>
            <p className="text-muted-foreground">
              When you visit a real estate listing page, the Extension reads <strong>publicly
              visible content from the active tab</strong> in order to identify property details
              such as price, address, beds, baths, and square footage. This data is used solely
              to power AI analysis you explicitly request.
            </p>
            <p className="text-muted-foreground">
              The Extension does <strong>not</strong> access, collect, or transmit:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Personally identifiable information (name, email, phone)</li>
              <li>Login credentials or passwords</li>
              <li>Financial or payment information</li>
              <li>Browsing history outside listing pages you actively analyze</li>
              <li>Health, location (GPS), or biometric data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How Data Is Used</h2>
            <p className="text-muted-foreground">
              Property data extracted from a page is sent to HomeLens AI servers (powered by
              Google Gemini and Perplexity) <strong>only when you click "Analyze" or send a
              chat message</strong>. The AI returns insights such as fair-price assessment,
              neighborhood context, and investment estimates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Data Storage</h2>
            <p className="text-muted-foreground">
              Chat history within the Extension is stored locally in your browser using
              <code className="px-1 mx-1 bg-muted rounded">chrome.storage.session</code>, which
              is automatically cleared when you close the browser. It is isolated per website
              and is not synced or sent to our servers for storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Permissions Justification</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>activeTab:</strong> Required to read the URL and content of the listing
                page only when the user clicks the Extension icon or the in-page "Analyze"
                button.
              </li>
              <li>
                <strong>storage:</strong> Required to save Extension settings and per-site chat
                session locally in the browser.
              </li>
              <li>
                <strong>scripting:</strong> Required to inject the floating "Analyze with
                HomeLens" button on detected real estate listing pages.
              </li>
              <li>
                <strong>host_permissions (https://*/*):</strong> Required because real estate
                listings are distributed across hundreds of brokerage websites (Zillow, Redfin,
                Realtor.com, Compass, RE/MAX, local MLS portals, etc.). The Extension uses
                content-based detection and only activates on pages that match real estate
                listing patterns. It does not run on email, banking, social media, or other
                excluded sites.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
            <p className="text-muted-foreground">
              When you request analysis, property data is processed by:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Google Gemini AI (via Lovable AI Gateway) — for property analysis</li>
              <li>Perplexity AI — for real-time market and neighborhood data</li>
              <li>Supabase — for authentication and account data (HomeLens account holders only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Data Sharing & Sale</h2>
            <p className="text-muted-foreground">
              We do <strong>not</strong> sell, rent, or share your data with advertisers or
              data brokers. Data is never used for advertising, profiling, or
              creditworthiness determination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. User Control</h2>
            <p className="text-muted-foreground">
              You can uninstall the Extension at any time via{" "}
              <code className="px-1 bg-muted rounded">chrome://extensions</code>. Uninstalling
              removes all locally stored Extension data immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy? Email{" "}
              <a href="mailto:h2@homelens-ai.com" className="text-primary underline">
                h2@homelens-ai.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes</h2>
            <p className="text-muted-foreground">
              We may update this policy as the Extension evolves. Material changes will be
              reflected in the "Effective Date" above.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}