import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Accessibility() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Accessibility Statement</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Commitment to Accessibility</h2>
            <p className="text-muted-foreground">Homelens.ai is committed to ensuring digital accessibility for individuals with disabilities. We strive to provide an inclusive, user-friendly experience for all users, regardless of ability or technology. Our goal is to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Accessibility Standards</h2>
            <p className="text-muted-foreground">Homelens.ai endeavors to align its Platform with Title III of the Americans with Disabilities Act (ADA), Section 504 of the Rehabilitation Act, WCAG 2.1 Level AA guidelines, and applicable state-level accessibility laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Accessibility Features</h2>
            <p className="text-muted-foreground">We have implemented or are actively implementing: keyboard navigability, logical tab order and focus indicators, screen reader compatibility (ARIA labels, semantic HTML), alternative text for images, accessible form labels, color contrast ratios meeting WCAG 2.1 AA, resizable text, error identification and messaging, and descriptive link text.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. AI-Generated Content Accessibility</h2>
            <p className="text-muted-foreground">We are committed to structuring AI outputs in accessible formats, ensuring text-based alternatives for non-textual AI content, maintaining readable formatting compatible with assistive technologies, and monitoring automated content for accessibility compliance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Third-Party Content and Integrations</h2>
            <p className="text-muted-foreground">The Platform may integrate with third-party services. While we strive to work with vendors who support accessibility standards, we do not control the accessibility of third-party systems. If you encounter issues, please contact us.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Ongoing Efforts</h2>
            <p className="text-muted-foreground">Homelens.ai maintains an ongoing accessibility improvement program including periodic audits, automated testing, manual user testing, remediation tracking, and developer accessibility training.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Known Limitations</h2>
            <p className="text-muted-foreground">Some areas may not yet be fully compliant, including legacy interface components, dynamic AI visualizations, and certain third-party embedded tools. We are actively working to remediate these.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Reasonable Accommodations</h2>
            <p className="text-muted-foreground">If you experience difficulty accessing any portion of our Platform, we will make reasonable efforts to provide alternative formats, assisted navigation, direct support, and equivalent access to AI-generated insights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Contact</h2>
            <p className="text-muted-foreground">For accessibility concerns, please contact us at <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
