import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check } from "lucide-react";
import { FEATURES_BY_SLUG, type FeatureSlug } from "@/components/marketing/featureRegistry";

export default function FeaturePage() {
  const { slug } = useParams<{ slug: FeatureSlug }>();
  const feature = slug ? FEATURES_BY_SLUG[slug as FeatureSlug] : undefined;

  useEffect(() => {
    if (!feature) return;
    const prevTitle = document.title;
    document.title = `${feature.name} · HomeLens`;
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const m = document.createElement("meta");
        m.setAttribute("name", "description");
        document.head.appendChild(m);
        return m;
      })();
    const prevDesc = meta.getAttribute("content") || "";
    meta.setAttribute("content", feature.short);
    return () => {
      document.title = prevTitle;
      meta.setAttribute("content", prevDesc);
    };
  }, [feature]);

  if (!feature) return <Navigate to="/" replace />;

  const Icon = feature.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative mx-auto px-4 pb-16 pt-24 md:pb-24 md:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {feature.name}
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
                {feature.headline}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                {feature.subheadline}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/auth?mode=signup">
                    Get started free <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              {feature.screenshot ? (
                <div className="relative rounded-xl border bg-card p-2 shadow-2xl">
                  <img
                    src={feature.screenshot}
                    alt={feature.screenshotAlt || feature.name}
                    className="w-full rounded-lg"
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="relative flex aspect-[4/3] items-center justify-center rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card shadow-xl">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Icon className="h-12 w-12" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">What you get</h2>
          <p className="mt-3 text-muted-foreground">
            Built for one thing: helping you make a better real estate decision.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {feature.benefits.map((b) => (
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
            Big decisions deserve the full picture.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start with the free plan. Upgrade when you're ready to underwrite seriously.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth?mode=signup">Create your account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}