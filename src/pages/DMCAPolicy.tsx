import { Navigation } from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function DMCAPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-2">DMCA Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: 05/04/2026 · Homelens.ai LLC</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Overview</h2>
            <p className="text-muted-foreground">Homelens.ai respects the intellectual property rights of others and expects its users to do the same. In accordance with the Digital Millennium Copyright Act of 1998 ("DMCA"), we will respond expeditiously to claims of copyright infringement committed using the Homelens.ai platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Reporting Copyright Infringement</h2>
            <p className="text-muted-foreground">If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible on the Platform, please notify our designated DMCA agent with the following information:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>A physical or electronic signature of the copyright owner or authorized agent.</li>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Identification of the material that is claimed to be infringing, including its location on the Platform.</li>
              <li>Your contact information (address, telephone number, and email address).</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, under penalty of perjury, that the information in the notification is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. DMCA Agent</h2>
            <p className="text-muted-foreground">All DMCA notices should be sent to:</p>
            <p className="text-muted-foreground">Homelens.ai LLC<br />Attn: DMCA Agent<br />Email: <a href="mailto:h2@homelens-ai.com" className="text-primary underline">h2@homelens-ai.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Counter-Notification</h2>
            <p className="text-muted-foreground">If you believe that your content was removed or disabled by mistake or misidentification, you may submit a counter-notification containing:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that was removed and its prior location on the Platform.</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed as a result of mistake or misidentification.</li>
              <li>Your name, address, telephone number, and a statement consenting to jurisdiction of the federal court in Virginia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Repeat Infringers</h2>
            <p className="text-muted-foreground">Homelens.ai will, in appropriate circumstances, disable and/or terminate the accounts of users who are repeat infringers of copyrighted material.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Good Faith</h2>
            <p className="text-muted-foreground">Please note that under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material or activity is infringing may be subject to liability for damages.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
