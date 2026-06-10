import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function FairHousing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">Fair Housing Statement</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">Equal Opportunity</h2>
            <p className="text-muted-foreground">Homelens.ai is committed to compliance with the Fair Housing Act (42 U.S.C. §§ 3601–3619) and all applicable federal, state, and local fair housing laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Our Commitment</h2>
            <p className="text-muted-foreground">We do not discriminate on the basis of race, color, religion, sex, disability, familial status, national origin, sexual orientation, gender identity, or any other protected class under applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">AI & Fair Housing</h2>
            <p className="text-muted-foreground">Our AI systems are designed to provide unbiased property search results and analysis. We actively monitor and audit our algorithms to prevent discriminatory outcomes. If you believe any output or feature of our Platform violates fair housing principles, please report it immediately to <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">User Responsibilities</h2>
            <p className="text-muted-foreground">Users of the Platform are strictly prohibited from using any features, tools, or data in a manner that discriminates against any protected class. Violations may result in immediate account termination.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Filing a Complaint</h2>
            <p className="text-muted-foreground">If you believe you have experienced housing discrimination, you may file a complaint with the U.S. Department of Housing and Urban Development (HUD) at hud.gov or call 1-800-669-9777.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
