import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, DollarSign, Sparkles, Home, TrendingUp, Wrench } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBudgetCap, parseAndRecordBudget402 } from "@/lib/ai/budgetCap";
import { BudgetCapBanner } from "@/components/ai/BudgetCapBanner";
import { BudgetCapBlocker } from "@/components/ai/BudgetCapBlocker";

const PAGE_URL = "https://homelensais.com/calculators/brrrr";
const PAGE_TITLE = "BRRRR Calculator — Cash-on-Cash After Refinance | HomeLens";
const PAGE_DESC =
  "Free BRRRR calculator. Enter purchase, rehab, ARV, and rent to see all-in cost, capital left in deal, monthly cash flow, and cash-on-cash return after refinance.";

const usd = (n: number) =>
  Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—";

function amortize(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export default function CalculatorBrrrr() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cap = useBudgetCap();
  const isCapExceeded = cap.warningLevel === "exceeded";

  // Acquisition & rehab
  const [purchasePrice, setPurchasePrice] = useState(180000);
  const [closingCosts, setClosingCosts] = useState(4500);
  const [rehabBudget, setRehabBudget] = useState(35000);
  const [holdingMonths, setHoldingMonths] = useState(4);
  const [monthlyHoldingCost, setMonthlyHoldingCost] = useState(600);

  // Refi & rent
  const [arv, setArv] = useState(285000);
  const [refiLtvPct, setRefiLtvPct] = useState(75);
  const [refiRate, setRefiRate] = useState(7.25);
  const [refiTermYears, setRefiTermYears] = useState(30);
  const [monthlyRent, setMonthlyRent] = useState(2200);
  const [monthlyOpEx, setMonthlyOpEx] = useState(650);

  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState("");

  const results = useMemo(() => {
    const allInCost =
      purchasePrice + closingCosts + rehabBudget + holdingMonths * monthlyHoldingCost;
    const refiLoanAmount = arv * (refiLtvPct / 100);
    const cashLeftInDeal = Math.max(allInCost - refiLoanAmount, 0);
    const cashRecycled = Math.min(allInCost, refiLoanAmount);
    const monthlyPI = amortize(refiLoanAmount, refiRate, refiTermYears);
    const monthlyCashFlow = monthlyRent - monthlyOpEx - monthlyPI;
    const annualCashFlow = monthlyCashFlow * 12;
    const cashOnCashPct = cashLeftInDeal > 0 ? (annualCashFlow / cashLeftInDeal) * 100 : null;
    const equityCreated = arv - allInCost;
    return {
      allInCost,
      refiLoanAmount,
      cashLeftInDeal,
      cashRecycled,
      monthlyPI,
      monthlyCashFlow,
      annualCashFlow,
      cashOnCashPct,
      equityCreated,
    };
  }, [
    purchasePrice,
    closingCosts,
    rehabBudget,
    holdingMonths,
    monthlyHoldingCost,
    arv,
    refiLtvPct,
    refiRate,
    refiTermYears,
    monthlyRent,
    monthlyOpEx,
  ]);

  const cocColor =
    results.cashOnCashPct === null
      ? "text-primary"
      : results.cashOnCashPct >= 8
      ? "text-green-600"
      : results.cashOnCashPct >= 4
      ? "text-yellow-600"
      : "text-red-600";

  const handleReset = () => {
    setPurchasePrice(180000);
    setClosingCosts(4500);
    setRehabBudget(35000);
    setHoldingMonths(4);
    setMonthlyHoldingCost(600);
    setArv(285000);
    setRefiLtvPct(75);
    setRefiRate(7.25);
    setRefiTermYears(30);
    setMonthlyRent(2200);
    setMonthlyOpEx(650);
    setAiInsights("");
  };

  const handleGenerateInsights = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      navigate("/auth?redirect=/calculators/brrrr");
      return;
    }
    setIsLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("brrrr-insights", {
        body: {
          inputs: {
            purchasePrice,
            closingCosts,
            rehabBudget,
            holdingMonths,
            monthlyHoldingCost,
            arv,
            refiLtvPct,
            refiRate,
            refiTermYears,
            monthlyRent,
            monthlyOpEx,
          },
          results: {
            allInCost: Math.round(results.allInCost),
            refiLoanAmount: Math.round(results.refiLoanAmount),
            cashLeftInDeal: Math.round(results.cashLeftInDeal),
            cashRecycled: Math.round(results.cashRecycled),
            monthlyPI: Math.round(results.monthlyPI),
            monthlyCashFlow: Math.round(results.monthlyCashFlow),
            annualCashFlow: Math.round(results.annualCashFlow),
            cashOnCashPct: results.cashOnCashPct,
            equityCreated: Math.round(results.equityCreated),
          },
        },
      });
      if (error) throw error;
      setAiInsights(data.insights);
    } catch (error: any) {
      const wasCap = await parseAndRecordBudget402(error, "brrrr_insights");
      if (wasCap) return;
      toast({
        title: "Error",
        description: error?.message ?? "Could not generate insights",
        variant: "destructive",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HomeLens BRRRR Calculator",
    applicationCategory: "FinanceApplication",
    applicationSubCategory: "FinancialApplication",
    operatingSystem: "Web",
    url: PAGE_URL,
    description: PAGE_DESC,
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://homelensais.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Calculators",
        item: "https://homelensais.com/calculators",
      },
      { "@type": "ListItem", position: 3, name: "BRRRR Calculator", item: PAGE_URL },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESC} />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESC} />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESC} />
        <script type="application/ld+json">{JSON.stringify(softwareJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>
      <Navigation />

      <div className="container mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <BudgetCapBanner surface="brrrr_insights" />

        <div className="mb-8 space-y-3">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span className="mx-1.5">/</span>
            <Link to="/calculators" className="hover:text-foreground">Calculators</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">BRRRR</span>
          </nav>
          <h1 className="text-4xl font-bold">BRRRR Calculator</h1>
          <p className="max-w-2xl text-muted-foreground">
            Model a Buy, Rehab, Rent, Refinance, Repeat deal end to end. See all-in cost,
            how much capital you pull back out at refi, monthly cash flow, and cash-on-cash
            return once the property is stabilized.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to defaults
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Acquisition & Rehab
                </CardTitle>
                <CardDescription>Everything it takes to own it, fix it, and hold it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchasePrice">Purchase price ($)</Label>
                    <Input id="purchasePrice" type="number" value={purchasePrice || ""}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="closingCosts">Closing costs ($)</Label>
                    <Input id="closingCosts" type="number" value={closingCosts || ""}
                      onChange={(e) => setClosingCosts(Number(e.target.value))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rehabBudget">Rehab budget ($)</Label>
                  <Input id="rehabBudget" type="number" value={rehabBudget || ""}
                    onChange={(e) => setRehabBudget(Number(e.target.value))} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="holdingMonths">Holding period (months)</Label>
                    <Input id="holdingMonths" type="number" value={holdingMonths || ""}
                      onChange={(e) => setHoldingMonths(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="monthlyHoldingCost">Monthly holding cost ($)</Label>
                    <Input id="monthlyHoldingCost" type="number" value={monthlyHoldingCost || ""}
                      onChange={(e) => setMonthlyHoldingCost(Number(e.target.value))} className="mt-1"
                      placeholder="Taxes, insurance, utilities" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Refinance & Rent
                </CardTitle>
                <CardDescription>The stabilized side of the deal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="arv">After-Repair Value / ARV ($)</Label>
                  <Input id="arv" type="number" value={arv || ""}
                    onChange={(e) => setArv(Number(e.target.value))} className="mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="refiLtvPct">Refi LTV (%)</Label>
                    <Input id="refiLtvPct" type="number" step="1" value={refiLtvPct || ""}
                      onChange={(e) => setRefiLtvPct(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="refiRate">Refi rate (%)</Label>
                    <Input id="refiRate" type="number" step="0.01" value={refiRate || ""}
                      onChange={(e) => setRefiRate(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="refiTermYears">Term (yrs)</Label>
                    <Input id="refiTermYears" type="number" value={refiTermYears || ""}
                      onChange={(e) => setRefiTermYears(Number(e.target.value))} className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthlyRent">Monthly rent ($)</Label>
                    <Input id="monthlyRent" type="number" value={monthlyRent || ""}
                      onChange={(e) => setMonthlyRent(Number(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="monthlyOpEx">Monthly operating expenses ($)</Label>
                    <Input id="monthlyOpEx" type="number" value={monthlyOpEx || ""}
                      onChange={(e) => setMonthlyOpEx(Number(e.target.value))} className="mt-1"
                      placeholder="Taxes, ins, PM, maint, vacancy" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Deal Results
                </CardTitle>
                <CardDescription>Updates live as you change the inputs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="All-in cost" value={usd(results.allInCost)} />
                  <Metric label="ARV" value={usd(arv)} />
                  <Metric label="Refi loan amount" value={usd(results.refiLoanAmount)} />
                  <Metric label="Capital recycled" value={usd(results.cashRecycled)} />
                  <Metric label="Cash left in deal" value={usd(results.cashLeftInDeal)} />
                  <Metric label="Equity created" value={usd(results.equityCreated)} />
                  <Metric label="Monthly P&I" value={usd(results.monthlyPI)} />
                  <Metric label="Monthly cash flow" value={usd(results.monthlyCashFlow)} />
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Cash-on-cash return after refi</p>
                  <p className={`text-3xl font-bold ${cocColor}`}>
                    {results.cashOnCashPct === null
                      ? "Infinite (no cash left in)"
                      : `${results.cashOnCashPct.toFixed(1)}%`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Annual cash flow of {usd(results.annualCashFlow)} on {usd(results.cashLeftInDeal)} left in the deal.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Deal Read
                </CardTitle>
                <CardDescription>Verdict-first analysis of this BRRRR scenario.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleGenerateInsights}
                  disabled={isLoadingInsights || isCapExceeded}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isLoadingInsights ? "Analyzing…" : "Generate AI insights"}
                </Button>
                {isCapExceeded && <BudgetCapBlocker surface="brrrr_insights" compact />}
                {aiInsights && (
                  <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
                    {aiInsights}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Explainer for SEO / users */}
        <section className="mx-auto mt-16 max-w-3xl space-y-6">
          <h2 className="text-2xl font-bold">How the BRRRR calculator works</h2>
          <p className="text-muted-foreground">
            BRRRR stands for Buy, Rehab, Rent, Refinance, Repeat. The whole strategy hinges on
            two numbers: how much capital you pull back out at the cash-out refinance, and
            whether the stabilized rent covers the new loan plus expenses with room to spare.
            This calculator shows both, side by side.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Home className="h-4 w-4" />
                  <span className="text-sm font-semibold">All-in cost</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Purchase price + closing costs + rehab + holding costs during the rehab
                  window. This is the total capital you have in the deal before refinance.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-semibold">Cash-on-cash after refi</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Annual cash flow divided by the capital still trapped in the deal after the
                  cash-out refi. Above 8% is strong for a stabilized BRRRR; below 4% usually
                  means the deal only works if you can refi out most of your capital.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Looking for a straight mortgage or buying-power calculator instead? Head to the{" "}
            <Link to="/calculators" className="text-primary underline">
              main calculators page
            </Link>
            .
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}