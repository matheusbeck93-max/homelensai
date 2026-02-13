import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CookiePolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 02/13/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">What Are Cookies?</h2>
            <p className="text-muted-foreground">Cookies are small text files placed on your device when you visit our Platform. They help us provide a better experience, remember your preferences, and understand how the Platform is used.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Types of Cookies We Use</h2>
            <p className="text-muted-foreground"><strong>Essential Cookies:</strong> Required for the Platform to function. These include authentication tokens, session identifiers, and security cookies. They cannot be disabled.</p>
            <p className="text-muted-foreground"><strong>Functional Cookies:</strong> Enable enhanced functionality and personalization, such as remembering your search preferences, theme settings, and language preferences.</p>
            <p className="text-muted-foreground"><strong>Analytics Cookies:</strong> Help us understand how visitors interact with the Platform by collecting information about pages visited, time spent, and navigation paths. We use this data to improve the Platform.</p>
            <p className="text-muted-foreground"><strong>Advertising Cookies:</strong> May be used to deliver relevant advertisements and measure the effectiveness of marketing campaigns. These cookies may be set by third-party advertising partners.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Retention Period</h2>
            <p className="text-muted-foreground">Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period (typically 30 days to 2 years) or until you delete them manually.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Third-Party Trackers</h2>
            <p className="text-muted-foreground">We may use third-party analytics and advertising services that place their own cookies on your device. These third parties have their own privacy policies governing the use of such cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">How to Opt Out</h2>
            <p className="text-muted-foreground">You can manage cookie preferences through your browser settings. Most browsers allow you to block or delete cookies. Note that disabling essential cookies may affect Platform functionality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Global Privacy Control (GPC)</h2>
            <p className="text-muted-foreground">We recognize and honor the Global Privacy Control (GPC) signal as required under California law. When we detect a GPC signal from your browser, we will treat it as a valid opt-out request for the sale or sharing of your personal information.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
