import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function DoNotSell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Do Not Sell or Share My Personal Information</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">Your Right to Opt Out</h2>
            <p className="text-muted-foreground">Under the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA), and similar state privacy laws, you have the right to opt out of the "sale" or "sharing" of your personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Our Practices</h2>
            <p className="text-muted-foreground">Homelens.ai does not sell your personal information to third parties for monetary consideration. We do not share your personal information for cross-context behavioral advertising purposes.</p>
            <p className="text-muted-foreground">We may share limited data with service providers who assist in operating the Platform, but these providers are contractually prohibited from using your data for their own purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Global Privacy Control (GPC)</h2>
            <p className="text-muted-foreground">Homelens.ai recognizes and honors the Global Privacy Control (GPC) signal. If your browser sends a GPC signal, we will treat it as a valid opt-out request for the sale or sharing of your personal information associated with that browser.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">How to Submit a Request</h2>
            <p className="text-muted-foreground">If you would like to exercise your right to opt out, you may:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Enable the Global Privacy Control (GPC) signal in your browser.</li>
              <li>Email us at: <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a> with the subject line "Do Not Sell or Share My Information."</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Verification</h2>
            <p className="text-muted-foreground">We may need to verify your identity before processing your request. We will not discriminate against you for exercising your privacy rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <p className="text-muted-foreground">Homelens.ai LLC · Virginia · <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
