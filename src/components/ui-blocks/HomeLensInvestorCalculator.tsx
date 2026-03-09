import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, ChevronDown, ChevronRight, HelpCircle, RotateCcw, Download, AlertTriangle,
  AlertCircle, DollarSign, BarChart3, Shield, Loader2, Info
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import {
  InvestorInputs, DEFAULT_INPUTS, US_STATES, FLOOD_RISK_STATES, FALLBACK_TAX_RATES
} from "./investor-calc/types";
import { computeResults, computeStressScenarios } from "./investor-calc/calculations";
import { useStateTaxData } from "./investor-calc/useStateTaxData";
import { exportToExcel } from "./investor-calc/ExcelExport";

interface HomeLensInvestorCalculatorProps {
  title: string;
  inputs: {
    price: number;
    downPct: number;
    ratePct: number;
    years: number;
    rentMonthly: number;
    vacancyPct: number;
    taxPct: number;
    insuranceAnnual: number;
    repairsPct: number;
    capexPct: number;
    managementPct: number;
    hoaMonthly: number;
    closingCosts: number;
  };
  rentEstimate?: {
    amount: number;
    source: 'rentcast' | 'user';
  };
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function MetricBadge({ value, thresholds }: { value: number; thresholds: [number, number]; }) {
  const color = value >= thresholds[1] ? 'bg-green-500/15 text-green-700 dark:text-green-400'
    : value >= thresholds[0] ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-500/15 text-red-700 dark:text-red-400';
  return <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
    {value >= thresholds[1] ? 'Good' : value >= thresholds[0] ? 'Fair' : 'Low'}
  </span>;
}

function MetricBadgeInverse({ value, thresholds }: { value: number; thresholds: [number, number]; }) {
  const color = value <= thresholds[0] ? 'bg-green-500/15 text-green-700 dark:text-green-400'
    : value <= thresholds[1] ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-500/15 text-red-700 dark:text-red-400';
  return <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
    {value <= thresholds[0] ? 'Good' : value <= thresholds[1] ? 'Fair' : 'High'}
  </span>;
}

function Section({ title, icon, defaultOpen = true, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-1 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export const HomeLensInvestorCalculator: React.FC<HomeLensInvestorCalculatorProps> = ({
  title,
  inputs: initialInputs,
  rentEstimate,
}) => {
  const [inputs, setInputs] = useState<InvestorInputs>(() => ({
    ...DEFAULT_INPUTS,
    price: Math.max(0, initialInputs.price),
    downPct: Math.max(0, Math.min(100, initialInputs.downPct)),
    ratePct: Math.max(0, initialInputs.ratePct),
    years: Math.max(1, Math.min(50, initialInputs.years)),
    rentMonthly: Math.max(0, initialInputs.rentMonthly),
    vacancyPct: Math.max(0, Math.min(100, initialInputs.vacancyPct)),
    taxPct: Math.max(0, initialInputs.taxPct),
    insuranceAnnual: Math.max(0, initialInputs.insuranceAnnual),
    repairsPct: Math.max(0, Math.min(100, initialInputs.repairsPct)),
    capexPct: Math.max(0, Math.min(100, initialInputs.capexPct)),
    managementPct: Math.max(0, Math.min(100, initialInputs.managementPct)),
    hoaMonthly: Math.max(0, initialInputs.hoaMonthly),
    closingCostsDollar: Math.max(0, initialInputs.closingCosts),
    closingCostsMode: initialInputs.closingCosts > 0 ? 'dollar' : 'percent',
  }));

  // Down payment as dollar value — derives downPct for calculations
  const [downPaymentDollar, setDownPaymentDollar] = useState(() => {
    const price = Math.max(0, initialInputs.price);
    const pct = Math.max(0, Math.min(100, initialInputs.downPct));
    return Math.round(price * pct / 100);
  });

  const handleDownPaymentChange = useCallback((value: number) => {
    const v = Math.max(0, value);
    setDownPaymentDollar(v);
    setInputs(prev => {
      const pct = prev.price > 0 ? Math.min(100, (v / prev.price) * 100) : 0;
      return { ...prev, downPct: pct };
    });
  }, []);

  const handlePriceChange = useCallback((value: number) => {
    const v = Math.max(0, value);
    setInputs(prev => {
      // Keep the same down payment dollar amount, recalculate percentage
      const pct = v > 0 ? Math.min(100, (downPaymentDollar / v) * 100) : 0;
      return { ...prev, price: v, downPct: pct };
    });
  }, [downPaymentDollar]);

  const update = useCallback(<K extends keyof InvestorInputs>(field: K, value: InvestorInputs[K]) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateNum = useCallback((field: keyof InvestorInputs, value: number, max?: number) => {
    let v = Math.max(0, value);
    if (max !== undefined) v = Math.min(max, v);
    setInputs(prev => ({ ...prev, [field]: v }));
  }, []);

  const { loading: taxLoading, taxSource } = useStateTaxData(inputs.state, (rate) => {
    setInputs(prev => ({ ...prev, taxPct: rate }));
  });

  const results = useMemo(() => computeResults(inputs), [inputs]);
  const scenarios = useMemo(() => computeStressScenarios(inputs), [inputs]);

  const isPositiveCashFlow = results.monthlyCashFlow > 0;
  const isFloodRisk = FLOOD_RISK_STATES.includes(inputs.state);
  const pmiAmount = results.monthlyPMI;
  const ltvAbove80 = inputs.downPct < 20;
  const downPctDisplay = inputs.price > 0 ? (downPaymentDollar / inputs.price * 100).toFixed(1) : '0.0';

  const equityChartData = results.projections.map(p => ({
    year: `Yr ${p.year}`,
    appreciation: Math.round(p.appreciationEquity),
    amortization: Math.round(p.amortizationEquity),
  }));

  const alerts: { icon: React.ReactNode; text: string; variant: 'warning' | 'error' }[] = [];
  if (results.dscr < 1.25) alerts.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `DSCR ${results.dscr.toFixed(2)}x — below lender threshold of 1.25x`, variant: 'warning' });
  if (!isPositiveCashFlow) alerts.push({ icon: <AlertCircle className="h-4 w-4" />, text: `Negative cash flow — requires ${formatCurrency(Math.abs(results.monthlyCashFlow))}/mo out-of-pocket`, variant: 'error' });
  if (ltvAbove80) alerts.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `PMI required — adds ${formatCurrency(pmiAmount)}/mo until equity reaches 20%`, variant: 'warning' });
  if (isFloodRisk) alerts.push({ icon: <AlertTriangle className="h-4 w-4" />, text: 'High flood risk state — consider flood insurance ($1,500–$3,000/yr)', variant: 'warning' });
  if (results.capRate < inputs.ratePct) alerts.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Cap rate (${results.capRate.toFixed(1)}%) below mortgage rate (${inputs.ratePct}%) — negative leverage`, variant: 'warning' });

  return (
    <TooltipProvider>
      <Card className="w-full my-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setInputs({ ...DEFAULT_INPUTS }); setDownPaymentDollar(Math.round(DEFAULT_INPUTS.price * DEFAULT_INPUTS.downPct / 100)); }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(inputs, results, scenarios)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-5 gap-6">
            {/* ───── LEFT: INPUTS (2 cols) ───── */}
            <div className="lg:col-span-2 space-y-1">

              {/* Purchase & Financing */}
              <Section title="Purchase & Financing" icon={<DollarSign className="h-4 w-4" />} defaultOpen>
                <div>
                  <Label>Purchase Price ($)</Label>
                  <Input type="number" value={inputs.price} onChange={e => handlePriceChange(+e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Down Payment ($)<InfoTip text="Dollar amount paid upfront. The percentage is calculated automatically based on purchase price." /></Label>
                  <Input type="number" value={downPaymentDollar} onChange={e => handleDownPaymentChange(+e.target.value)} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">{downPctDisplay}% of purchase price</p>
                  {ltvAbove80 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      PMI applies (~{formatCurrency(pmiAmount)}/mo) — removed when equity reaches 20%
                    </p>
                  )}
                </div>
                <div>
                  <Label>Interest Rate (APR %)</Label>
                  <Input type="number" step="0.01" value={inputs.ratePct} onChange={e => updateNum('ratePct', +e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Loan Term (years)</Label>
                  <Input type="number" value={inputs.years} onChange={e => updateNum('years', +e.target.value, 50)} className="mt-1" />
                </div>
                <div>
                  <Label>Loan Type</Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={inputs.loanType === 'fixed' ? 'default' : 'outline'} onClick={() => update('loanType', 'fixed')}>Fixed Rate</Button>
                    <Button size="sm" variant={inputs.loanType === 'arm' ? 'default' : 'outline'} onClick={() => update('loanType', 'arm')}>ARM</Button>
                  </div>
                </div>
                {inputs.loanType === 'arm' && (
                  <>
                    <div>
                      <Label>ARM Period</Label>
                      <Select value={inputs.armPeriod} onValueChange={v => update('armPeriod', v as any)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5/1">5/1 ARM</SelectItem>
                          <SelectItem value="7/1">7/1 ARM</SelectItem>
                          <SelectItem value="10/1">10/1 ARM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rate Cap After Adjustment (%)<InfoTip text="Maximum rate increase after ARM adjustment period." /></Label>
                      <Input type="number" step="0.5" value={inputs.armRateCap} onChange={e => updateNum('armRateCap', +e.target.value)} className="mt-1" />
                    </div>
                  </>
                )}
              </Section>

              <Separator />

              {/* Rental Income */}
              <Section title="Rental Income" icon={<DollarSign className="h-4 w-4" />} defaultOpen>
                <div>
                  <Label>Monthly Rent</Label>
                  <Input type="number" value={inputs.rentMonthly} onChange={e => updateNum('rentMonthly', +e.target.value)} className="mt-1" />
                  {rentEstimate?.source === 'rentcast' && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Pre-filled from RentCast (editable)
                    </p>
                  )}
                </div>
                <div>
                  <Label>Vacancy Rate (%)<InfoTip text="Expected percentage of time property is unoccupied." /></Label>
                  <Input type="number" step="0.1" value={inputs.vacancyPct} onChange={e => updateNum('vacancyPct', +e.target.value, 100)} className="mt-1" />
                </div>
                <div>
                  <Label>Rent Growth Rate (%/yr)<InfoTip text="Historical U.S. average: 3–4%/year. Used to project future rent in multi-year analysis." /></Label>
                  <Slider value={[inputs.rentGrowthPct]} min={0} max={10} step={0.5} onValueChange={([v]) => update('rentGrowthPct', v)} className="mt-2" />
                  <span className="text-xs text-muted-foreground">{inputs.rentGrowthPct}%</span>
                </div>
              </Section>

              <Separator />

              {/* Operating Expenses */}
              <Section title="Operating Expenses" icon={<BarChart3 className="h-4 w-4" />} defaultOpen>
                <div>
                  <Label>State</Label>
                  <Select value={inputs.state} onValueChange={v => update('state', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isFloodRisk && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                      ⚠️ High flood risk state — consider additional flood insurance ($1,500–$3,000/yr)
                    </p>
                  )}
                </div>
                <div>
                  <Label>
                    Annual Property Tax (%)
                    {taxLoading && <Loader2 className="h-3 w-3 ml-1 inline animate-spin text-muted-foreground" />}
                    <InfoTip text="Effective annual property tax rate as a percentage of property value." />
                  </Label>
                  <Input type="number" step="0.01" value={inputs.taxPct} onChange={e => updateNum('taxPct', +e.target.value)} className="mt-1" />
                  {taxLoading && <p className="text-xs text-muted-foreground mt-1">Updating with current data...</p>}
                  {taxSource && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Source: {taxSource.source} · Updated {new Date(taxSource.updatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Insurance (annual)<InfoTip text="Annual homeowner's insurance premium." /></Label>
                  <Input type="number" value={inputs.insuranceAnnual} onChange={e => updateNum('insuranceAnnual', +e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Routine Maintenance (% of rent)<InfoTip text="Ongoing maintenance costs as percentage of gross rent." /></Label>
                  <Input type="number" step="0.1" value={inputs.repairsPct} onChange={e => updateNum('repairsPct', +e.target.value, 100)} className="mt-1" />
                </div>
                <div>
                  <Label>CapEx Reserve (% of rent)<InfoTip text="Capital expenditure reserve for major repairs (roof, HVAC, plumbing). Industry standard: 5–10% of gross rent." /></Label>
                  <Input type="number" step="0.1" value={inputs.capexPct} onChange={e => updateNum('capexPct', +e.target.value, 100)} className="mt-1" />
                </div>
                <div>
                  <Label>Property Management<InfoTip text="Typically 8–12% of gross rent. Standard for non-owner-managed rentals." /></Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Switch checked={!inputs.selfManaged} onCheckedChange={v => update('selfManaged', !v)} />
                    <span className="text-sm">{inputs.selfManaged ? 'Self-managed (0%)' : 'Professional'}</span>
                  </div>
                  {!inputs.selfManaged && (
                    <Input type="number" step="0.1" value={inputs.managementPct} onChange={e => updateNum('managementPct', +e.target.value, 100)} className="mt-1" placeholder="% of gross rent" />
                  )}
                </div>
                <div>
                  <Label>HOA (monthly)</Label>
                  <Input type="number" value={inputs.hoaMonthly} onChange={e => updateNum('hoaMonthly', +e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Expense Growth Rate (%/yr)<InfoTip text="Annual increase in property taxes, insurance, and maintenance costs." /></Label>
                  <Slider value={[inputs.expenseGrowthPct]} min={0} max={8} step={0.5} onValueChange={([v]) => update('expenseGrowthPct', v)} className="mt-2" />
                  <span className="text-xs text-muted-foreground">{inputs.expenseGrowthPct}%</span>
                </div>
              </Section>

              <Separator />

              {/* Acquisition Costs */}
              <Section title="Acquisition Costs" icon={<DollarSign className="h-4 w-4" />} defaultOpen={false}>
                <div>
                  <Label>Closing Costs<InfoTip text="Typically 2–5% of purchase price. Includes lender fees, title insurance, escrow, and prepaid items." /></Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={inputs.closingCostsMode === 'percent' ? 'default' : 'outline'} onClick={() => update('closingCostsMode', 'percent')}>%</Button>
                    <Button size="sm" variant={inputs.closingCostsMode === 'dollar' ? 'default' : 'outline'} onClick={() => update('closingCostsMode', 'dollar')}>$</Button>
                  </div>
                  {inputs.closingCostsMode === 'percent' ? (
                    <Input type="number" step="0.1" value={inputs.closingCostsPct} onChange={e => updateNum('closingCostsPct', +e.target.value, 100)} className="mt-1" />
                  ) : (
                    <Input type="number" value={inputs.closingCostsDollar} onChange={e => updateNum('closingCostsDollar', +e.target.value)} className="mt-1" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">= {formatCurrency(results.closingCosts)}</p>
                </div>
              </Section>

              <Separator />

              {/* Exit Strategy */}
              <Section title="Exit Strategy" icon={<Shield className="h-4 w-4" />} defaultOpen={false}>
                <div>
                  <Label>Appreciation Rate (%/yr)<InfoTip text="Expected annual property value increase." /></Label>
                  <Slider value={[inputs.appreciationPct]} min={0} max={10} step={0.5} onValueChange={([v]) => update('appreciationPct', v)} className="mt-2" />
                  <span className="text-xs text-muted-foreground">{inputs.appreciationPct}%</span>
                </div>
                <div>
                  <Label>Selling Costs (%)<InfoTip text="Agent commissions (~5%) + transfer taxes and closing costs (~1%). Applied to projected sale price at exit." /></Label>
                  <Input type="number" step="0.1" value={inputs.sellingCostsPct} onChange={e => updateNum('sellingCostsPct', +e.target.value, 100)} className="mt-1" />
                </div>
                <div>
                  <Label>Holding Period</Label>
                  <Select value={String(inputs.holdingPeriod)} onValueChange={v => update('holdingPeriod', +v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 7, 10, 15, 20].map(y => <SelectItem key={y} value={String(y)}>{y} years</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Investor Profile<InfoTip text="Capital gains tax at federal level: 15–20% for long-term holdings. State taxes may also apply." /></Label>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant={inputs.investorProfile === 'primary' ? 'default' : 'outline'} onClick={() => update('investorProfile', 'primary')}>Primary Residence</Button>
                    <Button size="sm" variant={inputs.investorProfile === 'investment' ? 'default' : 'outline'} onClick={() => update('investorProfile', 'investment')}>Investment</Button>
                  </div>
                  {inputs.investorProfile === 'primary' && inputs.holdingPeriod >= 2 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">$250k capital gains exemption applies (single filer)</p>
                  )}
                </div>
                {inputs.investorProfile === 'investment' && (
                  <div>
                    <Label>Marginal Tax Rate</Label>
                    <Select value={String(inputs.marginalTaxRate)} onValueChange={v => update('marginalTaxRate', +v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="23.8">23.8% (incl. NIIT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </Section>
            </div>

            {/* ───── RIGHT: RESULTS (3 cols) ───── */}
            <div className="lg:col-span-3 space-y-4">
              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <Alert key={i} variant={a.variant === 'error' ? 'destructive' : 'default'} className="py-2">
                      {a.icon}
                      <AlertDescription className="text-xs ml-2">{a.text}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <Tabs defaultValue="cashflow" className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="cashflow" className="text-xs">Cash Flow</TabsTrigger>
                  <TabsTrigger value="returns" className="text-xs">Returns</TabsTrigger>
                  <TabsTrigger value="projections" className="text-xs">Projections</TabsTrigger>
                  <TabsTrigger value="risk" className="text-xs">Risk</TabsTrigger>
                </TabsList>

                {/* ── TAB 1: Monthly Cash Flow ── */}
                <TabsContent value="cashflow" className="space-y-4">
                  <div className={`p-4 rounded-lg ${isPositiveCashFlow ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <div className="text-sm font-medium text-muted-foreground">Net Monthly Cash Flow</div>
                    <div className="text-3xl font-bold mt-1">
                      <span className={isPositiveCashFlow ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(results.monthlyCashFlow)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(results.monthlyCashFlow * 12)}/year</div>
                    {inputs.loanType === 'arm' && results.armMonthlyCashFlow !== undefined && (
                      <div className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                        Post-ARM adjustment: <span className={results.armMonthlyCashFlow > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatCurrency(results.armMonthlyCashFlow)}/mo</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Gross Rental Income</span><span className="font-semibold">{formatCurrency(inputs.rentMonthly)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Vacancy Loss ({inputs.vacancyPct}%)</span><span>-{formatCurrency(inputs.rentMonthly - results.effectiveRent)}</span></div>
                    <div className="flex justify-between font-medium border-t border-border/50 pt-1"><span>Effective Gross Income</span><span>{formatCurrency(results.effectiveRent)}</span></div>
                    <Separator />
                    <div className="flex justify-between text-muted-foreground"><span>Mortgage (P&I)</span><span>-{formatCurrency(results.monthlyMortgage)}</span></div>
                    {results.monthlyPMI > 0 && <div className="flex justify-between text-muted-foreground"><span>PMI</span><span>-{formatCurrency(results.monthlyPMI)}</span></div>}
                    <div className="flex justify-between text-muted-foreground"><span>Property Tax</span><span>-{formatCurrency(results.monthlyTax)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Insurance</span><span>-{formatCurrency(results.monthlyInsurance)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Property Management</span><span>-{formatCurrency(results.monthlyManagement)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Routine Maintenance</span><span>-{formatCurrency(results.monthlyRepairs)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>CapEx Reserve</span><span>-{formatCurrency(results.monthlyCapex)}</span></div>
                    {results.monthlyHOA > 0 && <div className="flex justify-between text-muted-foreground"><span>HOA</span><span>-{formatCurrency(results.monthlyHOA)}</span></div>}
                  </div>
                </TabsContent>

                {/* ── TAB 2: Investment Returns ── */}
                <TabsContent value="returns" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        Cap Rate<InfoTip text="Annual NOI / Purchase Price × 100. Measures property return independent of financing." />
                      </div>
                      <div className="text-xl font-bold">{formatPercent(results.capRate)}</div>
                      <MetricBadge value={results.capRate} thresholds={[4, 6]} />
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        Cash-on-Cash<InfoTip text="Annual Net Cash Flow / Total Cash Invested × 100." />
                      </div>
                      <div className="text-xl font-bold">{formatPercent(results.cashOnCash)}</div>
                      <MetricBadge value={results.cashOnCash} thresholds={[4, 8]} />
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        GRM<InfoTip text="Gross Rent Multiplier = Price / Annual Rent. Lower is better." />
                      </div>
                      <div className="text-xl font-bold">{results.grm.toFixed(1)}</div>
                      <MetricBadgeInverse value={results.grm} thresholds={[10, 15]} />
                    </div>
                    <div className={`p-3 rounded-lg ${results.dscr >= 1.25 ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        DSCR<InfoTip text="Debt Service Coverage Ratio = Annual NOI / Annual Debt Service. Lenders require >1.25." />
                      </div>
                      <div className="text-xl font-bold">{results.dscr.toFixed(2)}x</div>
                      <MetricBadge value={results.dscr} thresholds={[1.0, 1.25]} />
                    </div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Break-Even Occupancy<InfoTip text="Total Monthly Expenses / Gross Monthly Rent × 100." /></div>
                    <div className="text-lg font-bold">{results.breakEvenOccupancy.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">
                      You need {results.breakEvenOccupancy.toFixed(0)}% occupancy to break even ({Math.round((1 - results.breakEvenOccupancy / 100) * 30)} days/month vacant max)
                    </div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Break-Even Rent</div>
                    <div className="text-lg font-semibold">{formatCurrency(results.breakEvenRent)}/mo</div>
                    <div className="text-xs text-muted-foreground">Minimum rent needed for $0 cash flow</div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Annual NOI</div>
                    <div className="text-lg font-bold">{formatCurrency(results.annualNOI)}</div>
                  </div>

                  {rentEstimate?.source === 'rentcast' && (
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="h-4 w-4" /> Market Data
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Estimated Rent (RentCast)</span>
                        <span className="font-medium text-foreground">{formatCurrency(rentEstimate.amount)}/mo</span>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── TAB 3: Projections ── */}
                <TabsContent value="projections" className="space-y-4">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    IRR over {inputs.holdingPeriod} years: <span className="text-foreground">{results.irr.toFixed(2)}%</span>
                    <InfoTip text="IRR accounts for the time value of money and total return including appreciation and rental income." />
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Year</TableHead>
                          <TableHead className="text-xs">Property Value</TableHead>
                          <TableHead className="text-xs">Equity</TableHead>
                          <TableHead className="text-xs">Annual Rent</TableHead>
                          <TableHead className="text-xs">Annual NOI</TableHead>
                          <TableHead className="text-xs">Cash Flow</TableHead>
                          <TableHead className="text-xs">Cumulative CF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.projections.map(p => (
                          <TableRow key={p.year} className={p.year === inputs.holdingPeriod ? 'bg-primary/5 font-medium' : ''}>
                            <TableCell className="text-xs py-2">{p.year}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.propertyValue)}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.equity)}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.annualRent)}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.annualNOI)}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.annualCashFlow)}</TableCell>
                            <TableCell className="text-xs py-2">{formatCurrency(p.cumulativeCashFlow)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Exit summary */}
                  <div className="bg-muted/30 p-3 rounded-lg space-y-1 text-sm">
                    <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Exit Analysis ({inputs.holdingPeriod}yr)</div>
                    <div className="flex justify-between"><span>Projected Sale Price</span><span className="font-semibold">{formatCurrency(results.projectedSalePrice)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Selling Costs</span><span>-{formatCurrency(results.sellingCosts)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Remaining Loan</span><span>-{formatCurrency(results.remainingLoanBalance)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Capital Gains Tax</span><span>-{formatCurrency(results.capitalGainsTax)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold"><span>Net Proceeds</span><span>{formatCurrency(results.netProceeds)}</span></div>
                    <div className="flex justify-between font-bold text-primary"><span>Total Return</span><span>{formatCurrency(results.totalReturn)}</span></div>
                  </div>

                  {/* Equity chart */}
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equity Build-Up</div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={equityChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="year" className="text-xs" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="appreciation" stackId="a" name="Appreciation" className="fill-primary" />
                        <Bar dataKey="amortization" stackId="a" name="Amortization" className="fill-primary/50" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* ── TAB 4: Risk Analysis ── */}
                <TabsContent value="risk" className="space-y-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stress Test</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Scenario</TableHead>
                          <TableHead className="text-xs">Vacancy</TableHead>
                          <TableHead className="text-xs">Rent Growth</TableHead>
                          <TableHead className="text-xs">Appreciation</TableHead>
                          <TableHead className="text-xs">Cash Flow/mo</TableHead>
                          <TableHead className="text-xs">CoC Return</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarios.map((s, i) => (
                          <TableRow key={i} className={i === 1 ? 'bg-primary/5' : ''}>
                            <TableCell className="text-xs py-2 font-medium">{s.label}</TableCell>
                            <TableCell className="text-xs py-2">{s.vacancyPct}%</TableCell>
                            <TableCell className="text-xs py-2">{s.rentGrowthPct}%</TableCell>
                            <TableCell className="text-xs py-2">{s.appreciationPct}%</TableCell>
                            <TableCell className={`text-xs py-2 font-medium ${s.monthlyCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {formatCurrency(s.monthlyCashFlow)}
                            </TableCell>
                            <TableCell className="text-xs py-2">{s.cashOnCash.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Risk alerts */}
                  {alerts.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Automated Alerts</div>
                      {alerts.map((a, i) => (
                        <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${a.variant === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'}`}>
                          {a.icon}
                          <span>{a.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
