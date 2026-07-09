import { useEffect } from "react";
import { SeoCanonical } from "@/components/seo/SeoCanonical";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What exactly is HomeLens?",
    a: [
      "HomeLens is not a property listing site. It's a decision platform designed to help you evaluate homes before making one of the biggest financial commitments of your life.",
      "Instead of just showing listings, HomeLens helps you understand affordability, risk, long-term cost, and whether a property truly makes financial sense for you.",
      "You can explore the market, analyze properties, compare options, and gain clarity — all guided by AI.",
    ],
  },
  {
    q: "Can I paste any property listing URL?",
    a: [
      "Yes. You can paste a listing URL from most major real estate platforms and HomeLens will generate a detailed financial and market analysis.",
      "We extract relevant property data and combine it with market insights, affordability models, and scenario projections — so you can see the full financial picture behind the listing.",
      "Pro users unlock deeper analysis, including advanced financial breakdowns and long-term projections.",
    ],
  },
  {
    q: "Can HomeLens help me avoid overpaying?",
    a: [
      "That's exactly what it's built for. HomeLens evaluates properties using financial modeling, local market data, and affordability analysis so you can see if the price aligns with market trends, whether the monthly cost fits your financial profile, and the long-term impact of the purchase.",
    ],
  },
  {
    q: "How accurate are the financial estimates?",
    a: [
      "Our calculations are based on standard mortgage formulas, publicly available market data, and your personalized financial inputs. They provide realistic projections and scenario modeling — not generic averages.",
      "Estimates should always be validated with your lender or financial advisor before making a final decision. HomeLens is a decision-support tool, not financial advice.",
    ],
  },
  {
    q: "What do I get with the Pro plan?",
    a: [
      "Pro unlocks advanced property analysis, detailed overpayment and risk indicators, long-term ownership projections, side-by-side comparison, saved analyses, and ongoing tracking of properties and scenarios.",
    ],
  },
  {
    q: "How does the HomeLens Chrome Extension work?",
    a: [
      "The extension brings AI-powered analysis directly to your browser while you browse listings on sites like Zillow, Redfin, and Realtor.com.",
      "Once installed, it detects when you're viewing a listing and lets you get an instant AI analysis, see a personalized Property Match Score, ask follow-up questions, and sync everything with your HomeLens account.",
    ],
  },
];

export default function Faq() {
  useEffect(() => {
    document.title = "FAQ · HomeLens";
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a.join(" "),
      },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SeoCanonical />
      <Helmet>
        <title>FAQ · HomeLens</title>
        <meta
          name="description"
          content="Answers to common questions about HomeLens: how listing analysis works, Pro plan features, the Chrome extension, and how our financial estimates are built."
        />
        <meta property="og:title" content="HomeLens FAQ — how the decision platform works" />
        <meta
          property="og:description"
          content="How HomeLens analyzes listings, what Pro unlocks, and how the Chrome extension brings AI analysis to Zillow, Redfin, and Realtor."
        />
        <meta name="twitter:title" content="HomeLens FAQ — how the decision platform works" />
        <meta
          name="twitter:description"
          content="How HomeLens analyzes listings, what Pro unlocks, and how the Chrome extension brings AI analysis to Zillow, Redfin, and Realtor."
        />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <section className="container mx-auto max-w-3xl px-4 pb-16 pt-24 md:pt-32">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-muted-foreground">
            Everything you need to know about HomeLens. Can't find an answer?{" "}
            <Link to="/auth?mode=signup" className="text-primary underline">
              Ask us inside the app.
            </Link>
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-12 w-full space-y-2">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="rounded-lg border px-4">
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="space-y-3 text-muted-foreground">
                {f.a.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-16 text-center">
          <Button size="lg" asChild>
            <Link to="/auth?mode=signup">Try HomeLens free</Link>
          </Button>
        </div>
      </section>
      <Footer />
    </div>
  );
}