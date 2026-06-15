import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bell, BellOff, RefreshCw } from 'lucide-react';
import { OpenHousesFilterBar } from '@/components/openHouses/FilterBar';
import { OpenHouseCard } from '@/components/openHouses/OpenHouseCard';
import { OpenHouseMap } from '@/components/openHouses/OpenHouseMap';
import { useOpenHouseSearch } from '@/hooks/useOpenHouseSearch';
import { useOpenHouseAlerts } from '@/hooks/useOpenHouseAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import type { OpenHouseFilters } from '@/types/openHouses';

const DEFAULT_FILTERS: OpenHouseFilters = {
  country: 'US',
  state: null,
  city: null,
  dateFrom: null,
  dateTo: null,
  priceMin: null,
  priceMax: null,
};

export default function OpenHouses() {
  const [filters, setFilters] = useState<OpenHouseFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const { result, loading, error, search } = useOpenHouseSearch();
  const { alerts, create } = useOpenHouseAlerts();
  const { isFree } = useSubscription();

  const listings = result?.listings ?? [];

  const alreadySaved = useMemo(
    () =>
      alerts.some(
        (a) =>
          a.city?.toLowerCase() === filters.city?.toLowerCase() &&
          a.state?.toLowerCase() === filters.state?.toLowerCase(),
      ),
    [alerts, filters.city, filters.state],
  );

  const handleSearch = async () => {
    if (!filters.city || !filters.state) {
      toast({ title: 'Pick a city', description: 'Select a state and city to search.' });
      return;
    }
    try {
      await search(filters);
    } catch (e) {
      toast({
        title: 'Search failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = async () => {
    if (!filters.city || !filters.state) return;
    try {
      await search(filters, { bypassCache: true });
    } catch (e) {
      toast({
        title: 'Refresh failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAlert = async () => {
    if (isFree) {
      toast({
        title: 'Premium feature',
        description: 'Saved open-house alerts are a Buyer/Investor plan feature.',
      });
      return;
    }
    try {
      await create({ filters, frequency: 'weekly' });
      toast({ title: 'Alert saved', description: 'You\'ll get a weekly email digest.' });
    } catch (e) {
      toast({
        title: 'Could not save alert',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (listings.length && !selectedId) setSelectedId(listings[0].id);
  }, [listings, selectedId]);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-clip">
      <Helmet>
        <title>Open Houses Near You | HomeLens</title>
        <meta
          name="description"
          content="Find upcoming in-person open houses across the US and Canada. Filter by city, date, and price — set email alerts for your favorite markets."
        />
        <link rel="canonical" href="https://homelensais.com/open-houses" />
      </Helmet>

      <Navigation />

      <main className="flex-1 container mx-auto px-4 pt-24 pb-12 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Open Houses</h1>
          <p className="text-muted-foreground max-w-2xl">
            Discover in-person open houses across the US and Canada. Save searches and get an email
            digest the morning of each tour day.
          </p>
        </header>

        <OpenHousesFilterBar
          filters={filters}
          onChange={setFilters}
          onSubmit={handleSearch}
          loading={loading}
        />

        <p className="text-xs text-muted-foreground">
          Best-effort web search across Zillow, Redfin, and Realtor.com — verify each open house on the source page before driving over.
        </p>

        {result?.remainingQuota != null && isFree && (
          <p className="text-xs text-muted-foreground">
            Free plan: {result.remainingQuota} open-house search{result.remainingQuota === 1 ? '' : 'es'} remaining today.
          </p>
        )}

        {error && (
          <Card className="p-4 text-sm text-destructive border-destructive/40 bg-destructive/5">
            {error}
          </Card>
        )}

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2">
          <Button
            variant={mobileView === 'list' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setMobileView('list')}
          >
            List ({listings.length})
          </Button>
          <Button
            variant={mobileView === 'map' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setMobileView('map')}
          >
            Map
          </Button>
        </div>

        <div className="grid md:grid-cols-5 gap-6 min-h-[60vh]">
          {/* List */}
          <section className={`md:col-span-2 space-y-3 ${mobileView === 'map' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {loading ? 'Searching…' : `${listings.length} result${listings.length === 1 ? '' : 's'}`}
              </p>
              {listings.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="gap-2">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSaveAlert} disabled={alreadySaved} className="gap-2">
                    {alreadySaved ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    {alreadySaved ? 'Alert saved' : 'Save alert'}
                  </Button>
                </div>
              )}
            </div>

            {listings.length === 0 && !loading && (
              <Card className="p-6 text-sm text-muted-foreground text-center">
                Pick a city and date range above, then tap <strong>Find open houses</strong>.
              </Card>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {listings.map((l) => (
                <OpenHouseCard
                  key={l.id}
                  listing={l}
                  onClick={() => setSelectedId(l.id)}
                  selected={selectedId === l.id}
                />
              ))}
            </div>
          </section>

          {/* Map */}
          <section className={`md:col-span-3 ${mobileView === 'list' ? 'hidden md:block' : ''}`}>
            <OpenHouseMap listings={listings} selectedId={selectedId} onSelect={setSelectedId} />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
