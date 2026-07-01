import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Home, Briefcase, Check } from "lucide-react";
import buyerVideo from "@/assets/buyer-intro.mp4.asset.json";
import investorVideo from "@/assets/investor-intro.mp4.asset.json";

type SolutionCopy = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  videoUrl: string;
  benefits: { title: string; body: string }[];
  ctaHref: string;
  icon: typeof Home;
};

const SOLUTIONS_COPY: Record<"buyer" | "investor", SolutionCopy> = {
  buyer: {
    eyebrow: "Buyer Plan",
    headline: "Buy your next home without second-guessing.",
    subheadline:
      "HomeLens for buyers turns listings, mortgage math, and neighborhood data into a single, clear answer: is this the right home for you, at the right price?",
    videoUrl: buyerVideo.url,
    icon: Home,
    ctaHref: "/pricing",
    benefits: [
      { title: "Know your real number", body: "Buying Power shows both the safe range and the max approval — no more shopping in the wrong tier." },
      { title: "Score every listing", body: "Paste a URL or use the Chrome extension to see how each home stacks up against your profile." },
      { title: "Compare with confidence", body: "Save analyses and put homes side by side — HomeLens narrates the trade-offs in plain English." },
      { title: "Ask anything, any time", body: "The AI chat knows your profile and pulls in live data so answers are personalized, not generic." },
    ],
  },
  investor: {
    eyebrow: "Investor Plan",
    headline: "Underwrite like a pro. Track like a portfolio manager.",
    subheadline:
      "HomeLens for investors combines macro market briefs, deal underwriting, and portfolio tracking so you can move faster without losing rigor.",
    videoUrl: investorVideo.url,
    icon: Briefcase,
    ctaHref: "/pricing",
    benefits: [
      { title: "Macro market briefs", body: "Labor, wages, permits, and rate signals synthesized per metro — updated on a rolling schedule." },
      { title: "Full deal underwriting", body: "Cap rate, cash-on-cash, IRR, and tax-aware exit modeling — with every assumption exposed." },
      { title: "Portfolio tracking", body: "Track equity, rental yield, and Schedule E figures for every property you already own." },
      { title: "AI-narrated insights", body: "Every brief and deal ends with deep-dive prompts so you can pressure-test the thesis in one click." },
    ],
  },
};

export default function SolutionPage() {
  const { slug } = useParams<{ slug: "buyer" | "investor" }>();
  const copy = slug ? SOLUTIONS_COPY[slug] : undefined;

  useEffect(() => {
    if (!copy) return;
    const prevTitle = document.title;
    document.title = `${copy.eyebrow} · HomeLens`;
  }, [copy]);

  if (!copy) return <Navigate to="/" replace />;
  const Icon = copy.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative mx-auto px-4 pb-16 pt-24 md:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              {copy.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              {copy.subheadline}
            </p>
          </div>

          {/* Video */}
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="relative overflow-hidden rounded-xl border bg-card p-2 shadow-2xl">
              <video
                src={copy.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What's included</h2>
          <p className="mt-3 text-muted-foreground">
            Everything HomeLens builds for {slug === "buyer" ? "homebuyers" : "investors"}, in one plan.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
          {copy.benefits.map((b) => (
            <Card key={b.title} className="border-border/60">
              <CardContent className="p-6">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Check className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to make the next move?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth?mode=signup">
                Get started free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to={copy.ctaHref}>See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}