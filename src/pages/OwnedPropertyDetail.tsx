import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home, Pencil, AlertCircle, RefreshCw } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOwnedProperty } from '@/hooks/useOwnedProperty';
import { EditValuationDialog } from '@/components/investor/my-properties/EditValuationDialog';
import { AlertsPanel } from '@/components/investor/my-properties/AlertsPanel';
import { PropertyChat } from '@/components/investor/my-properties/PropertyChat';
import { PropertyDocuments } from '@/components/investor/my-properties/PropertyDocuments';
import { TaxExportButton } from '@/components/investor/my-properties/TaxExportButton';
import { PROPERTY_TYPE_LABELS } from '@/lib/myProperties/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackOwnedPropertyEvent } from '@/lib/myProperties/telemetry';
import { TierGate } from '@/components/subscription/TierGate';
import { useSubscription } from '@/hooks/useSubscription';

function fmtMoney(n: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  if (!Number.isFinite(n)) return '$0';
  const { compact = false, sign = false } = opts;
  const sgn = n < 0 ? '-' : sign && n > 0 ? '+' : '';
  const abs = Math.abs(n);
  if (compact && abs >= 1_000_000) return `${sgn}$${(abs / 1_000_000).toFixed(2)}M`;
  if (compact && abs >= 1_000) return `${sgn}$${Math.round(abs / 1_000)}k`;
  return `${sgn}$${Math.round(abs).toLocaleString()}`;
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function OwnedPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, reload } = useOwnedProperty(id);
  const [editValOpen, setEditValOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { loading: subLoading } = useSubscription();

  useEffect(() => {
    if (id) trackOwnedPropertyEvent('owned_property_viewed', { property_id: id });
  }, [id]);

  async function handleRefreshValue() {
    if (!id) return;
    setRefreshing(true);
    const { data: res, error } = await supabase.functions.invoke('property-valuation', {
      body: { property_id: id },
    });
    setRefreshing(false);
    if (error) {
      toast.error(error.message ?? 'Could not refresh valuation');
      return;
    }
    if ((res as any)?.error) {
      toast.error((res as any).message ?? (res as any).error);
      return;
    }
    if ((res as any)?.skipped) {
      toast.info((res as any).reason);
      return;
    }
    toast.success('Valuation refreshed');
    reload();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-6xl space-y-6">
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-2"
                onClick={() => navigate('/investor/properties')}
              >
                <ArrowLeft className="h-4 w-4" /> My properties
              </Button>
            </div>
            {subLoading ? (
              <Card className="h-96 animate-pulse bg-muted/30" />
            ) : (
            <TierGate
              feature="INVESTOR_CALCULATOR"
              featureName="Property Details"
              description="Track equity, refi opportunities, rental income, alerts and tax exports for this property — included with the Investor plan."
            >
            {loading || !data ? (
              <Card className="h-96 animate-pulse bg-muted/30" />
            ) : (
              <>
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-32 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {data.property.primary_photo_url ? (
                        <img
                          src={data.property.primary_photo_url}
                          alt={data.property.address_line1}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Home className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {data.property.address_line1}
                      </h1>
                      <div className="text-sm text-muted-foreground mt-1">
                        {data.property.city}, {data.property.state} {data.property.zip} ·{' '}
                        {PROPERTY_TYPE_LABELS[data.property.property_type]}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {data.property.is_primary_residence && (
                          <Badge variant="secondary">Primary residence</Badge>
                        )}
                        {data.property.is_rented && <Badge variant="secondary">Rented</Badge>}
                        {!data.property.has_mortgage && (
                          <Badge variant="outline">Owned outright</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {data.property.is_rented && (
                    <div className="flex items-center gap-2">
                      <TaxExportButton />
                    </div>
                  )}
                </header>

                {id && (
                  <AlertsPanel
                    propertyId={id}
                    alerts={data.alerts as any}
                    onChanged={reload}
                  />
                )}

                {/* Stat strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Current value</div>
                      <div className="text-xl font-semibold mt-1">
                        {fmtMoney(data.metrics.currentValue, { compact: true })}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => setEditValOpen(true)}
                          className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={handleRefreshValue}
                          disabled={refreshing}
                          className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                          {refreshing ? 'Refreshing…' : 'Refresh'}
                        </button>
                      </div>
                      {data.property.current_value_source && (
                        <div className="text-[10px] text-muted-foreground mt-1 capitalize">
                          {data.property.current_value_source.replace(/_/g, ' ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Equity</div>
                      <div className="text-xl font-semibold mt-1">
                        {fmtMoney(data.metrics.equity, { compact: true })}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {fmtPct(data.metrics.equityPct)} of value
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Monthly cash flow</div>
                      <div
                        className={`text-xl font-semibold mt-1 ${
                          data.property.is_rented && data.metrics.monthlyCashFlow < 0
                            ? 'text-destructive'
                            : data.property.is_rented && data.metrics.monthlyCashFlow > 0
                              ? 'text-emerald-600'
                              : ''
                        }`}
                      >
                        {data.property.is_rented
                          ? fmtMoney(data.metrics.monthlyCashFlow, { sign: true })
                          : '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {data.property.is_rented ? 'After PITI + expenses' : 'Not rented'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Cap rate</div>
                      <div className="text-xl font-semibold mt-1">
                        {fmtPct(data.metrics.capRate)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">NOI / value</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="overview">
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="acquisition">Acquisition &amp; loan</TabsTrigger>
                    <TabsTrigger value="rental">Rental</TabsTrigger>
                    <TabsTrigger value="improvements">Improvements</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="chat">Ask AI</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Returns since purchase</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Stat label="Appreciation" value={fmtMoney(data.metrics.returns.appreciation, { sign: true, compact: true })} />
                        <Stat label="Loan paydown" value={fmtMoney(data.metrics.returns.principalPaydown, { compact: true })} />
                        <Stat label="Cash flow" value={fmtMoney(data.metrics.returns.cashFlow, { sign: true, compact: true })} />
                        <Stat
                          label="Total return"
                          value={fmtMoney(data.metrics.returns.total, { sign: true, compact: true })}
                          accent
                        />
                        <Stat label="Cash invested" value={fmtMoney(data.metrics.returns.cashInvested, { compact: true })} />
                        <Stat label="Total ROI on cash" value={fmtPct(data.metrics.returns.totalROI)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Property facts</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Stat label="Beds" value={data.property.beds ?? '—'} />
                        <Stat label="Baths" value={data.property.baths ?? '—'} />
                        <Stat label="Sqft" value={data.property.sqft?.toLocaleString() ?? '—'} />
                        <Stat label="Year built" value={data.property.year_built ?? '—'} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="acquisition" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Acquisition</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <Stat label="Purchase price" value={fmtMoney(data.property.purchase_price, { compact: true })} />
                        <Stat label="Purchase date" value={fmtDate(data.property.purchase_date)} />
                        <Stat label="Down payment" value={fmtMoney(Number(data.property.down_payment ?? 0), { compact: true })} />
                        <Stat label="Closing costs" value={fmtMoney(Number(data.property.closing_costs ?? 0), { compact: true })} />
                      </CardContent>
                    </Card>
                    {data.property.has_mortgage ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Loan</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <Stat label="Original principal" value={fmtMoney(Number(data.property.loan_original_principal ?? 0), { compact: true })} />
                          <Stat label="Rate (APR)" value={data.property.loan_rate_apr != null ? `${(Number(data.property.loan_rate_apr) * 100).toFixed(3)}%` : '—'} />
                          <Stat label="Term" value={data.property.loan_term_years ? `${data.property.loan_term_years} yrs` : '—'} />
                          <Stat label="Start date" value={fmtDate(data.property.loan_start_date)} />
                          <Stat label="Current balance" value={fmtMoney(data.metrics.loanBalance, { compact: true })} accent />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="p-4 text-sm text-muted-foreground">
                          Owned outright — no mortgage.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="rental" className="space-y-4 mt-4">
                    {data.property.is_rented && data.rental ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Rental details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <Stat label="Monthly rent" value={fmtMoney(Number(data.rental.monthly_rent ?? 0))} />
                          <Stat label="Property tax / yr" value={fmtMoney(Number(data.rental.property_tax_yearly ?? 0))} />
                          <Stat label="Insurance / yr" value={fmtMoney(Number(data.rental.insurance_yearly ?? 0))} />
                          <Stat label="HOA / mo" value={fmtMoney(Number(data.rental.hoa_monthly ?? 0))} />
                          <Stat label="Maintenance" value={fmtPct(Number(data.rental.maintenance_pct_of_rent ?? 0.08))} />
                          <Stat label="Management" value={fmtPct(Number(data.rental.management_pct_of_rent ?? 0.08))} />
                          <Stat label="Vacancy" value={fmtPct(Number(data.rental.vacancy_pct ?? 0.05))} />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-center text-sm text-muted-foreground">
                          {data.property.is_primary_residence
                            ? 'This is your primary residence — not currently rented.'
                            : 'Not currently rented. Add rental details to track cash flow.'}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="improvements" className="mt-4">
                    {data.improvements.length === 0 ? (
                      <EmptyState text="No improvements logged yet." />
                    ) : (
                      <Card>
                        <CardContent className="p-0 divide-y">
                          {data.improvements.map((imp) => (
                            <div key={imp.id} className="flex justify-between p-4 text-sm">
                              <div>
                                <div className="font-medium">{imp.description}</div>
                                <div className="text-xs text-muted-foreground">
                                  {fmtDate(imp.improvement_date)}
                                  {imp.category ? ` · ${imp.category}` : ''}
                                </div>
                              </div>
                              <div className="font-semibold">{fmtMoney(Number(imp.cost))}</div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="events" className="mt-4">
                    {data.events.length === 0 ? (
                      <EmptyState text="No timeline events yet." />
                    ) : (
                      <Card>
                        <CardContent className="p-0 divide-y">
                          {data.events.map((ev) => (
                            <div key={ev.id} className="flex justify-between p-4 text-sm">
                              <div>
                                <div className="font-medium capitalize">
                                  {ev.event_type.replace(/_/g, ' ')}
                                </div>
                                {ev.note && (
                                  <div className="text-xs text-muted-foreground">{ev.note}</div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {fmtDate(ev.event_date)}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    {id && (
                      <PropertyDocuments
                        propertyId={id}
                        documents={data.documents}
                        onChanged={reload}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="chat" className="mt-4">
                    {id && <PropertyChat propertyId={id} />}
                  </TabsContent>
                </Tabs>

                <EditValuationDialog
                  open={editValOpen}
                  onOpenChange={setEditValOpen}
                  property={data.property}
                  onSaved={() => reload()}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-semibold ${accent ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <AlertCircle className="h-5 w-5 opacity-50" />
        {text}
      </CardContent>
    </Card>
  );
}