import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import type { Preferences } from "./preferencesTypes";

const money = (n?: number | null) =>
  n != null ? `$${Number(n).toLocaleString()}` : null;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1 text-sm">
      <span className="text-muted-foreground min-w-[140px]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Chips({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i} variant="secondary" className="text-xs font-normal">
          {i}
        </Badge>
      ))}
    </span>
  );
}

function importance(v?: string | null) {
  return v ? v[0].toUpperCase() + v.slice(1) : null;
}

export function PreferencesSummaryCard({ preferences }: { preferences: Preferences | null }) {
  const p = preferences ?? {};
  const budget =
    p.budget?.purchase_price_max || p.budget?.monthly_payment_max || p.budget?.down_payment
      ? [
          p.budget?.purchase_price_max ? `Max ${money(p.budget.purchase_price_max)}` : null,
          p.budget?.monthly_payment_max ? `${money(p.budget.monthly_payment_max)}/mo` : null,
          p.budget?.down_payment ? `${money(p.budget.down_payment)} down` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const beds = p.property?.bedrooms_min ? `${p.property.bedrooms_min}+ bd` : null;
  const baths = p.property?.bathrooms_min ? `${p.property.bathrooms_min}+ ba` : null;
  const sqft = p.property?.sqft_min ? `${p.property.sqft_min}+ sqft` : null;
  const bedbath = [beds, baths, sqft].filter(Boolean).join(" / ");

  const lifestyle = p.lifestyle
    ? Object.entries(p.lifestyle)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.replace("_importance", "").replace(/_/g, " ")}: ${importance(v as string)}`)
        .join(" · ")
    : null;

  const inv = p.investment;
  const investmentLine = inv
    ? [
        inv.strategy ? `${inv.strategy}` : null,
        inv.cash_flow_target ? `cash flow ${money(inv.cash_flow_target)}/mo` : null,
        inv.risk_tolerance ? `risk: ${inv.risk_tolerance}` : null,
        inv.fixer_upper_ok != null ? `fixer-upper: ${inv.fixer_upper_ok ? "ok" : "no"}` : null,
        inv.appreciation_focus ? `appreciation focus` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const goalLabel = p.goal
    ? ({
        buy_home: "Buy a home",
        invest: "Invest",
        both: "Both",
        rent: "Rent",
        market_research: "Market research",
        tax_incentives: "Tax incentives",
        unknown: "Exploring",
      } as Record<string, string>)[p.goal] ?? p.goal
    : null;

  const hasAny =
    goalLabel ||
    (p.locations && p.locations.length) ||
    budget ||
    bedbath ||
    (p.property?.types && p.property.types.length) ||
    (p.must_haves && p.must_haves.length) ||
    (p.nice_to_haves && p.nice_to_haves.length) ||
    (p.deal_breakers && p.deal_breakers.length) ||
    lifestyle ||
    investmentLine ||
    (p.freeform_notes && p.freeform_notes.trim());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Current preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet. Tell the assistant about your search to start filling this in.
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            <Row label="Goal" value={goalLabel} />
            <Row label="Locations" value={<Chips items={p.locations} />} />
            <Row label="Budget" value={budget} />
            <Row label="Property" value={bedbath || null} />
            <Row label="Types" value={<Chips items={p.property?.types} />} />
            <Row label="Must-haves" value={<Chips items={p.must_haves} />} />
            <Row label="Nice-to-haves" value={<Chips items={p.nice_to_haves} />} />
            <Row label="Deal breakers" value={<Chips items={p.deal_breakers} />} />
            <Row label="Lifestyle" value={lifestyle} />
            <Row label="Investment" value={investmentLine} />
            <Row label="Notes" value={p.freeform_notes ? <span className="whitespace-pre-wrap">{p.freeform_notes}</span> : null} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}