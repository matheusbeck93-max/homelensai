import type { BudgetAffordabilityResult } from '@/lib/investorBrief/budgetAffordability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  data: BudgetAffordabilityResult;
}

export function AffordableListingsView({ data }: Props) {
  const sorted = [...data.perMarket].sort(
    (a, b) => b.affordabilityPct - a.affordabilityPct,
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Budget · ${Math.round(data.budgetMax).toLocaleString()}
            {data.budgetMin ? ` (min $${Math.round(data.budgetMin).toLocaleString()})` : ''}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pulled from your saved preferences. Edit your budget anytime in Preferences.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sorted.map((m) => (
              <div key={m.market} className="border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span>{m.market}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(m.affordabilityPct * 100)}% of listings · median $
                    {m.medianListPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.listingsAffordable.toLocaleString()} of {m.totalListings.toLocaleString()}{' '}
                  active listings within budget.{' '}
                  {m.headroomPct >= 0
                    ? `You have ${Math.round(m.headroomPct * 100)}% headroom over median.`
                    : `You are ${Math.round(Math.abs(m.headroomPct) * 100)}% below median; expect tighter selection.`}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}