import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Copy, Check, ExternalLink, ShieldCheck, Lock, LogOut, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

const MCP_URL = "https://yckcdxtatwolzilboahx.supabase.co/functions/v1/mcp";

type ToolTier = "Free" | "Buyer+" | "Investor";

const TOOLS: { name: string; description: string; tier: ToolTier }[] = [
  { name: "echo", description: "Verify the connection is working.", tier: "Free" },
  { name: "get_profile", description: "Your goals, budget, target cities, and buyer persona.", tier: "Free" },
  { name: "list_saved_properties", description: "Every property you've saved in HomeLens.", tier: "Free" },
  { name: "list_saved_analyses", description: "Your saved AI property analyses with match scores.", tier: "Buyer+" },
  { name: "list_owned_properties", description: "Your investor portfolio: purchase price, value estimates, rental status.", tier: "Investor" },
  { name: "analyze_listing", description: "Paste a Zillow / Redfin / Realtor URL → MATCH_SCORE + buyability verdict. Free: 3/day.", tier: "Free" },
  { name: "market_trends", description: "Median price, days-on-market, and inventory for a US metro. Free: 5/day.", tier: "Free" },
  { name: "state_tax_and_flood", description: "State income tax, property tax rate, and flood-zone indicators.", tier: "Free" },
  { name: "mortgage_calculator", description: "Full PITI monthly payment (auto PMI, taxes, insurance, HOA) with AI commentary.", tier: "Free" },
  { name: "save_property", description: "Save a listing URL to your HomeLens dashboard.", tier: "Free" },
  { name: "neighborhood_insights", description: "Schools, crime, walkability, and demographics for a US address.", tier: "Buyer+" },
  { name: "compare_properties", description: "Rank 2–4 listings side-by-side with reasoning tuned to your buyer type.", tier: "Buyer+" },
  { name: "save_analysis", description: "Save an analysis from your assistant to your HomeLens Saved Analyses.", tier: "Buyer+" },
  { name: "rental_calculator", description: "Cash flow, cap rate, cash-on-cash, and DSCR for rental properties.", tier: "Investor" },
];

const EXAMPLE_PROMPTS = [
  "Paste this Zillow link and tell me — is this a good buy for a first-time buyer? (uses analyze_listing + get_profile)",
  "Compare these three listings and rank them for cash flow. (uses compare_properties + rental_calculator)",
  "What's the real monthly cost at 6.5% with 10% down on a $650k house? (uses mortgage_calculator)",
  "Give me schools, crime, and walkability for 78704 in Austin. (uses neighborhood_insights)",
  "Save this analysis to my HomeLens dashboard. (uses save_analysis)",
];

type ClientStep = { text: string; code?: string };
type ClientGuide = {
  id: string;
  label: string;
  blurb: string;
  steps: ClientStep[];
  prompts?: string[];
};

const CLIENTS: ClientGuide[] = [
  {
    id: "grok",
    label: "Grok Bot / Grok",
    blurb: "Grok (xAI) supports remote MCP over Streamable HTTP and runs an OAuth browser flow automatically. HomeLens is the MCP server; Grok is the client — you connect once, then ask Grok to analyze listings, set Watch Goals, and read your profile.",
    steps: [
      {
        text: "Copy the HomeLens MCP URL above — it's the same URL every other client uses.",
      },
      {
        text: "If you use the Grok CLI, add the server over HTTP transport:",
        code: "grok mcp add --transport http homelens https://yckcdxtatwolzilboahx.supabase.co/functions/v1/mcp",
      },
      {
        text: "If you use Grok's in-app connectors (or Grok Bot), add a new HTTP MCP server with the HomeLens URL and choose OAuth as the auth type.",
      },
      {
        text: "On first use, Grok opens a browser. Sign in with your HomeLens account and approve the connector on the consent screen. The token is stored by Grok and reused after that.",
      },
      {
        text: "Verify the connection is live:",
        code: "grok mcp doctor homelens",
      },
    ],
    prompts: [
      "Analyze https://www.zillow.com/homedetails/... and tell me the Match Score.",
      "Watch Tampa homes under $400k and notify me when something scores 7+.",
      "What's in my HomeLens profile — my budget and target cities?",
    ],
  },
  {
    id: "claude",
    label: "Claude Desktop",
    blurb: "Claude Desktop connects to remote MCP servers through its Connectors settings.",
    steps: [
      { text: "Open Claude Desktop → Settings → Connectors." },
      { text: "Click Add custom connector, paste the URL above, and confirm." },
      { text: "Sign in with your HomeLens account and approve on the consent screen." },
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    blurb: "ChatGPT supports remote MCP connectors from its Settings.",
    steps: [
      { text: "In ChatGPT, open Settings → Connectors → Add." },
      { text: "Paste the HomeLens MCP URL and continue." },
      { text: "Sign in with your HomeLens account and approve the connection." },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    blurb: "Cursor can connect to HTTP MCP servers from its MCP settings.",
    steps: [
      { text: "Open Cursor Settings → MCP → Add new MCP server." },
      { text: "Choose HTTP transport and paste the URL above." },
      { text: "Sign in with your HomeLens account when Cursor opens the browser." },
    ],
  },
  {
    id: "codex",
    label: "Codex / other",
    blurb: "Any MCP-capable client can connect to HomeLens over HTTP with OAuth.",
    steps: [
      { text: "In your MCP-capable client, add a new HTTP MCP server." },
      { text: "Use the HomeLens URL above and OAuth as the auth type." },
      { text: "Sign in with your HomeLens account and approve." },
    ],
  },
];

function TierBadge({ tier }: { tier: ToolTier }) {
  const cls =
    tier === "Free"
      ? "bg-muted text-muted-foreground border-border"
      : tier === "Buyer+"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {tier}
    </span>
  );
}

function CopyRow() {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <code className="flex-1 truncate rounded-md bg-background px-3 py-2 text-xs sm:text-sm font-mono select-all">
        {MCP_URL}
      </code>
      <Button onClick={onCopy} variant={copied ? "secondary" : "default"} className="shrink-0">
        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
        {copied ? "Copied" : "Copy URL"}
      </Button>
    </div>
  );
}

export default function Integrations() {
  return (
    <>
      <Helmet>
        <title>Connect HomeLens to Grok, Claude, ChatGPT & Cursor | HomeLens AI</title>
        <meta
          name="description"
          content="Bring your HomeLens saved properties, analyses, and investor portfolio into Grok Bot, Claude, ChatGPT, Cursor, and other AI assistants over MCP."
        />
        <link rel="canonical" href="https://homelensais.com/integrations" />
      </Helmet>
      <Navigation />
      <main className="pt-24 pb-16">
        <div className="container max-w-5xl mx-auto px-4 space-y-12">
          {/* Hero */}
          <section className="text-center space-y-4">
            <Badge variant="secondary" className="mx-auto">Agent integrations</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Bring HomeLens into Claude, ChatGPT, Cursor, or Grok Bot
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect Grok, Claude, ChatGPT, Cursor, or any MCP client to HomeLens.
              Chat with your saved properties, analyses, and portfolio — from wherever you already work.
            </p>
          </section>

          {/* MCP URL card */}
          <section>
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Your MCP server URL</h2>
                <p className="text-sm text-muted-foreground">
                  Paste this into your assistant's connector settings. You'll sign in with your existing HomeLens account.
                </p>
              </CardHeader>
              <CardContent>
                <CopyRow />
              </CardContent>
            </Card>
          </section>

          {/* Per-client install steps */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Install in your assistant</h2>
            <Tabs defaultValue="claude" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                {CLIENTS.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
                ))}
              </TabsList>
              {CLIENTS.map((c) => (
                <TabsContent key={c.id} value={c.id} className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <ol className="space-y-3">
                        {c.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-sm pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </section>

          {/* Tools & tiers */}
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">What your assistant can do</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Free accounts get basic tools. Paid plans unlock saved analyses and the investor portfolio.
              </p>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {TOOLS.map((t) => (
                  <div key={t.name} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-semibold">{t.name}</code>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    </div>
                    <TierBadge tier={t.tier} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="text-sm text-muted-foreground text-center">
              Need saved analyses or your portfolio in ChatGPT?{" "}
              <Link to="/pricing" className="text-primary hover:underline font-medium">
                See plans →
              </Link>
            </div>
          </section>

          {/* Example prompts */}
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Try asking your assistant</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Once connected, these prompts work in Claude, ChatGPT, or any MCP client.
              </p>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {EXAMPLE_PROMPTS.map((p) => (
                  <div key={p} className="px-5 py-4 text-sm">
                    <span className="text-foreground">&ldquo;{p.split(" (")[0]}&rdquo;</span>
                    {p.includes(" (") ? (
                      <span className="ml-2 text-xs text-muted-foreground">({p.split(" (")[1].replace(/\)$/, ")")}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Safety / FAQ */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Safe by default</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Only your data</h3>
                  <p className="text-sm text-muted-foreground">
                    Every tool call runs as you. Your assistant can only see what you'd see when signed into HomeLens.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">We never see your chats</h3>
                  <p className="text-sm text-muted-foreground">
                    HomeLens receives tool requests, not your conversation with Claude or ChatGPT.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <LogOut className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Revoke any time</h3>
                  <p className="text-sm text-muted-foreground">
                    Remove the connector from your assistant's settings and access ends immediately.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Secondary CTA */}
          <section className="text-center border-t border-border pt-10">
            <p className="text-sm text-muted-foreground mb-3">Questions?</p>
            <a
              href="mailto:h2@homelens-ai.com"
              className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
            >
              Contact support <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}