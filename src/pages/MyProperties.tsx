import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Filter } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOwnedProperties } from '@/hooks/useOwnedProperties';
import { PortfolioRollup } from '@/components/investor/my-properties/PortfolioRollup';
import { OwnedPropertyCard } from '@/components/investor/my-properties/OwnedPropertyCard';
import { AddPropertyDialog } from '@/components/investor/my-properties/AddPropertyDialog';
import { LegacyUpgradeModal } from '@/components/upgrade/LegacyUpgradeModal';

type FilterKey = 'all' | 'rented' | 'owner_occupied';
type SortKey = 'updated' | 'equity' | 'cashFlow' | 'purchase';

export default function MyProperties() {
  const navigate = useNavigate();
  const { properties, rollup, loading, reload } = useOwnedProperties();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = properties;
    if (filter === 'rented') list = list.filter((p) => p.is_rented);
    if (filter === 'owner_occupied') list = list.filter((p) => p.is_primary_residence);
    const sorted = [...list];
    if (sort === 'equity') sorted.sort((a, b) => b.metrics.equity - a.metrics.equity);
    else if (sort === 'cashFlow')
      sorted.sort((a, b) => b.metrics.monthlyCashFlow - a.metrics.monthlyCashFlow);
    else if (sort === 'purchase')
      sorted.sort((a, b) => (b.purchase_date > a.purchase_date ? 1 : -1));
    return sorted;
  }, [properties, filter, sort]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-6xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">My properties</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Track equity, cash flow, and strategic opportunities across what you own.
                </p>
              </div>
              <Button onClick={() => setAddOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Add property
              </Button>
            </header>

            {properties.length > 0 && <PortfolioRollup rollup={rollup} />}

            {properties.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" /> Filter
                </div>
                <Select value={filter} onValueChange={(v: FilterKey) => setFilter(v)}>
                  <SelectTrigger className="h-8 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="owner_occupied">Owner-occupied</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground ml-2">Sort</div>
                <Select value={sort} onValueChange={(v: SortKey) => setSort(v)}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Recently updated</SelectItem>
                    <SelectItem value="equity">Most equity</SelectItem>
                    <SelectItem value="cashFlow">Best cash flow</SelectItem>
                    <SelectItem value="purchase">Most recent purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="h-72 animate-pulse bg-muted/30" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-10 text-center border-dashed">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
                <h2 className="mt-3 text-lg font-medium">
                  {properties.length === 0 ? 'No properties yet' : 'Nothing matches this filter'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {properties.length === 0
                    ? 'Add your first property to track equity, cash flow, and strategic alerts in one place.'
                    : 'Try changing the filter to see other properties.'}
                </p>
                {properties.length === 0 && (
                  <Button className="mt-4 gap-1" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add property
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <OwnedPropertyCard
                    key={p.id}
                    property={p}
                    onClick={() => navigate(`/investor/properties/${p.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <AddPropertyDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => reload()} />
      <LegacyUpgradeModal surface="my_properties" />
    </div>
  );
}