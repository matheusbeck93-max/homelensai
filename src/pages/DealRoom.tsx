/**
 * Deal Room — the artifact you get after analyzing a listing.
 *
 * Routes:
 *   /deal-room?url=…   → analyzes the listing and creates a room
 *   /deal-room/:id     → re-opens a stored room
 *
 * Persistence note: rooms are stored in this browser (localStorage) in v1.
 * Signed-in users can also push the analysis into Saved Analyses.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  MapPin,
  Share2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useCurrentPersona } from "@/lib/personas/useCurrentPersona";
import { supabase } from "@/integrations/supabase/client";
import { SaveAnalysisButton } from "@/components/chat/SaveAnalysisButton";
import { AskGrokModal } from "@/components/dealRoom/AskGrokModal";
import { analyzeListing } from "@/lib/dealRoom/analyze";
import { findRoomByUrl, getDealRoom, saveDealRoom } from "@/lib/dealRoom/store";
import { VERDICT_LABEL, type DealRoom as DealRoomType } from "@/lib/dealRoom/types";

const VERDICT_STYLE: Record<string, string> = {
  strong_fit: "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30",
  dig_deeper: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  walk_away: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30",
};

function scoreColor(score: number) {
  if (score >= 8) return "hsl(142 71% 35%)";
  if (score >= 5) return "hsl(38 92% 45%)";
  return "hsl(0 72% 48%)";
}

function money(n?: number) {
  return typeof n === "number" && n > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
    : null;
}

/** Simple monthly sketch: 30-yr, 20% down, 6.5% — clearly labelled as an estimate. */
function mortgageSketch(price?: number) {
  if (!price || price <= 0) return null;
  const loan = price * 0.8;
  const r = 0.065 / 12;
  const n = 360;
  const pi = (loan * r) / (1 - Math.pow(1 + r, -n));
  const taxes = (price * 0.011) / 12;
  const insurance = (price * 0.004) / 12;
  return {
    down: price * 0.2,
    pi: Math.round(pi),
    taxes: Math.round(taxes),
    insurance: Math.round(insurance),
    total: Math.round(pi + taxes + insurance),
  };
}

export default function DealRoom() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium, tier } = useSubscription() as { isPremium: boolean; tier: string };
  const { persona } = useCurrentPersona();

  const urlParam = params.get("url")?.trim() || "";
  const [room, setRoom] = useState<DealRoomType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askGrok, setAskGrok] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [goals, setGoals] = useState<{ budgetMin?: number; budgetMax?: number; cities?: string[] } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("budget_min, budget_max, preferred_cities")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as Record<string, unknown>;
      setGoals({
        budgetMin: typeof row.budget_min === "number" ? row.budget_min : undefined,
        budgetMax: typeof row.budget_max === "number" ? row.budget_max : undefined,
        cities: Array.isArray(row.preferred_cities) ? (row.preferred_cities as string[]) : undefined,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runAnalysis = useCallback(
    async (listingUrl: string) => {
      setLoading(true);
      setError(null);
      try {
        const created = await analyzeListing(listingUrl);
        const stored = saveDealRoom(created);
        setRoom(stored);
        navigate(`/deal-room/${stored.id}`, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not analyze that listing.");
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (id) {
      const found = getDealRoom(id);
      if (found) {
        setRoom(found);
        return;
      }
      setError("That deal room isn't on this device. Paste the listing link to rebuild it.");
      return;
    }
    if (urlParam) {
      const existing = findRoomByUrl(urlParam);
      if (existing) {
        setRoom(existing);
        navigate(`/deal-room/${existing.id}`, { replace: true });
        return;
      }
      void runAnalysis(urlParam);
    }
  }, [id, urlParam, runAnalysis, navigate]);

  const facts = room?.facts;
  const addressLine =
    [facts?.address, facts?.city, facts?.state].filter(Boolean).join(", ") || "Listing";
  const priceText = money(facts?.price);
  const sketch = useMemo(() => mortgageSketch(facts?.price), [facts?.price]);
  const isInvestor = persona === "investor" || tier === "investor";

  const toggleCheck = (itemId: string) => {
    if (!room) return;
    const next = {
      ...room,
      checklist: room.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
    };
    setRoom(saveDealRoom(next));
  };

  const share = async () => {
    const shareUrl = window.location.href;
    const text = `${addressLine}${priceText ? ` — ${priceText}` : ""} · HomeLens Deal Room`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HomeLens Deal Room", text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: "Link copied", description: "Deal room link copied to your clipboard." });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const budgetFit = (() => {
    if (!goals || !facts?.price) return null;
    const { budgetMin, budgetMax } = goals;
    if (!budgetMax && !budgetMin) return null;
    if (budgetMax && facts.price > budgetMax) return { ok: false, text: `Above your budget ceiling of ${money(budgetMax)}` };
    if (budgetMin && facts.price < budgetMin) return { ok: true, text: `Below your usual range (${money(budgetMin)}+)` };
    return { ok: true, text: `Inside your budget${budgetMax ? ` (up to ${money(budgetMax)})` : ""}` };
  })();

  const cityFit = (() => {
    if (!goals?.cities?.length || !facts?.city) return null;
    const hit = goals.cities.some((c) => c.toLowerCase().includes(facts.city!.toLowerCase()));
    return { ok: hit, text: hit ? `${facts.city} is on your list` : `${facts.city} isn't on your city list` };
  })();

  /* ---------- Empty / loading / error states ---------- */

  if (!id && !urlParam) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Deal Room — analyze a listing | HomeLens</title>
          <meta name="description" content="Paste a listing link to open a Deal Room: Match Score, verdict, numbers and your next-step checklist." />
        </Helmet>
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-3xl font-bold mb-2">Open a Deal Room</h1>
          <p className="text-muted-foreground mb-6">
            Paste a Zillow, Redfin or Realtor.com link. You'll get the Match Score, the verdict, the numbers and a
            checklist — all in one place.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pasteUrl.trim()) navigate(`/deal-room?url=${encodeURIComponent(pasteUrl.trim())}`);
            }}
          >
            <Input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="https://www.zillow.com/homedetails/…"
              aria-label="Listing URL"
              className="h-12"
            />
            <Button type="submit" size="lg" disabled={!pasteUrl.trim()}>
              Open Deal Room
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the listing and scoring it against your profile…
        </p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">We couldn't open that deal room</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => navigate("/deal-room")}>Try another listing</Button>
      </div>
    );
  }

  if (!room) return null;

  /* ---------- Room ---------- */

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <Helmet>
        <title>{`Deal Room — ${addressLine}`.slice(0, 58)} | HomeLens</title>
        <meta name="description" content={`Match Score, verdict and next steps for ${addressLine}.`.slice(0, 158)} />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold truncate">{addressLine}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 truncate">
              {priceText && <span className="font-medium text-foreground">{priceText}</span>}
              {facts?.beds ? <span>{facts.beds} bd</span> : null}
              {facts?.baths ? <span>{facts.baths} ba</span> : null}
              {facts?.sqft ? <span>{facts.sqft.toLocaleString()} sqft</span> : null}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={share}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAskGrok(true)}>
              <Bot className="h-4 w-4 mr-2" /> Ask Grok
            </Button>
            {signedIn ? (
              <SaveAnalysisButton
                analysis={{
                  propertyUrl: room.listingUrl,
                  propertyAddress: facts?.address ?? addressLine,
                  propertyPrice: facts?.price ?? null,
                  analysisSummary: room.analysis,
                  investmentScore: room.score !== null ? Math.round(room.score * 10) : null,
                  scoreLabel: room.verdict ? VERDICT_LABEL[room.verdict] : null,
                  source: "app",
                }}
              />
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">Sign in to save</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* RIGHT column content first on mobile: score + verdict */}
        <aside className="order-1 lg:order-2 space-y-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div
                className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-8"
                style={{ borderColor: room.score !== null ? scoreColor(room.score) : "hsl(var(--muted))" }}
              >
                <span
                  className="text-4xl font-bold"
                  style={{ color: room.score !== null ? scoreColor(room.score) : undefined }}
                >
                  {room.score !== null ? room.score : "—"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Match Score out of 10</p>
              {room.verdict && (
                <Badge variant="outline" className={`mt-3 text-sm px-3 py-1 ${VERDICT_STYLE[room.verdict]}`}>
                  {VERDICT_LABEL[room.verdict]}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">Fit with your goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {budgetFit || cityFit ? (
                <>
                  {budgetFit && (
                    <p className={budgetFit.ok ? "text-foreground" : "text-destructive"}>{budgetFit.text}</p>
                  )}
                  {cityFit && <p className={cityFit.ok ? "text-foreground" : "text-muted-foreground"}>{cityFit.text}</p>}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    Tell HomeLens your budget and target cities and this room will score the fit for you.
                  </p>
                  <Button size="sm" asChild>
                    <Link to="/profile-setup">
                      Set your preferences <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">Your next steps</CardTitle>
              <CardDescription>You decide — HomeLens just keeps the list honest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {room.checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className="flex w-full items-start gap-3 rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
                  aria-pressed={item.done}
                >
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    <span className={`block text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" /> Take it to Grok
              </CardTitle>
              <CardDescription>
                Connect Grok once and it can pull this deal — and your profile — straight from HomeLens.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAskGrok(true)}>Ask Grok about this deal</Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integrations">Connect Grok</Link>
              </Button>
            </CardContent>
          </Card>

          {!isPremium && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> Go deeper
                </CardTitle>
                <CardDescription>
                  You keep the score and the verdict for free. Saved analyses, rental projections and unlimited deep
                  dives come with a paid plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" asChild>
                  <Link to="/pricing">See plans</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* LEFT column */}
        <main className="order-2 lg:order-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-lg">The listing</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {addressLine}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a
                href={room.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 break-all"
              >
                View the original listing
              </a>
              <p className="text-xs text-muted-foreground">
                Analyzed {new Date(room.createdAt).toLocaleString("en-US")}
              </p>
            </CardContent>
          </Card>

          <section aria-labelledby="why-heading">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary" id="why-heading">
                Why / Why not
              </span>
              <Separator className="flex-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle as="h3" className="text-sm text-green-700 dark:text-green-400">Working in its favour</CardTitle>
                </CardHeader>
                <CardContent>
                  {room.why.length ? (
                    <ul className="space-y-2 text-sm list-disc pl-4">
                      {room.why.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing stood out as a clear plus.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle as="h3" className="text-sm text-red-700 dark:text-red-400">Worth pushing back on</CardTitle>
                </CardHeader>
                <CardContent>
                  {room.whyNot.length ? (
                    <ul className="space-y-2 text-sm list-disc pl-4">
                      {room.whyNot.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No red flags surfaced in this pass.</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              HomeLens evaluates homes and their economics only — never people or neighbourhood demographics.{" "}
              <Link to="/fair-housing" className="underline underline-offset-2">Fair Housing</Link>
            </p>
          </section>

          <section aria-labelledby="numbers-heading">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary" id="numbers-heading">
                Numbers
              </span>
              <Separator className="flex-1" />
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h3" className="text-base">Monthly cost sketch</CardTitle>
                <CardDescription>Estimate — 20% down, 30-year fixed at 6.5%, typical taxes and insurance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {sketch ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Down payment</span><span className="font-medium">{money(sketch.down)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Principal & interest</span><span className="font-medium">{money(sketch.pi)}/mo</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span className="font-medium">{money(sketch.taxes)}/mo</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span className="font-medium">{money(sketch.insurance)}/mo</span></div>
                    <Separator />
                    <div className="flex justify-between text-base"><span className="font-semibold">Estimated monthly</span><span className="font-bold">{money(sketch.total)}</span></div>
                    <Button variant="outline" size="sm" asChild className="mt-2">
                      <Link to="/calculators">Run the full numbers</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">We couldn't read a price from this listing, so there's no cost sketch yet.</p>
                )}
              </CardContent>
            </Card>

            {isInvestor && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle as="h3" className="text-base">Rental angle</CardTitle>
                  <CardDescription>Quick teaser — the investor calculator does the full model.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {sketch ? (
                    <p>
                      To break even on the monthly carry you'd need roughly{" "}
                      <span className="font-semibold">{money(sketch.total)}</span> in rent, before vacancy, management
                      and maintenance.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Add a price to see the rent needed to carry this home.</p>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/investor/calculator">Open the investor calculator</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>

          <section aria-labelledby="analysis-heading">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary" id="analysis-heading">
                Full analysis
              </span>
              <Separator className="flex-1" />
            </div>
            <Card>
              <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{room.analysis}</ReactMarkdown>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur p-2 flex gap-2 sm:hidden">
        <Button variant="outline" size="sm" className="flex-1" onClick={share}>
          <Share2 className="h-4 w-4 mr-1" /> Share
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setAskGrok(true)}>
          <Bot className="h-4 w-4 mr-1" /> Ask Grok
        </Button>
        {signedIn ? (
          <SaveAnalysisButton
            analysis={{
              propertyUrl: room.listingUrl,
              propertyAddress: facts?.address ?? addressLine,
              propertyPrice: facts?.price ?? null,
              analysisSummary: room.analysis,
              investmentScore: room.score !== null ? Math.round(room.score * 10) : null,
              scoreLabel: room.verdict ? VERDICT_LABEL[room.verdict] : null,
              source: "app",
            }}
          />
        ) : (
          <Button size="sm" className="flex-1" asChild>
            <Link to="/auth">
              <Sparkles className="h-4 w-4 mr-1" /> Save
            </Link>
          </Button>
        )}
      </div>

      <AskGrokModal
        open={askGrok}
        onOpenChange={setAskGrok}
        listingUrl={room.listingUrl}
        address={facts?.address ?? addressLine}
      />
    </div>
  );
}
