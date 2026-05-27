import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Home } from 'lucide-react';
import { PROPERTY_TYPE_LABELS } from '@/lib/myProperties/types';
import type { OwnedPropertyWithMetrics } from '@/hooks/useOwnedProperties';

function fmtMoney(n: number, compact = true): string {
  if (!Number.isFinite(n)) return '$0';
  const absN = Math.abs(n);
  if (compact && absN >= 1_000_000) return `${n < 0 ? '-' : ''}$${(absN / 1_000_000).toFixed(2)}M`;
  if (compact && absN >= 1_000) return `${n < 0 ? '-' : ''}$${Math.round(absN / 1_000)}k`;
  return `${n < 0 ? '-' : ''}$${Math.round(absN).toLocaleString()}`;
}

interface Props {
  property: OwnedPropertyWithMetrics;
  onClick?: () => void;
}

export function OwnedPropertyCard({ property, onClick }: Props) {
  const { metrics } = property;
  const cashFlowLabel = property.is_primary_residence
    ? 'Owner-occupied'
    : property.is_rented
      ? `${fmtMoney(metrics.monthlyCashFlow, false)}/mo`
      : 'Not rented';
  return (
    <Card
      onClick={onClick}
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow border-border/60"
    >
      <div className="relative aspect-[16/10] bg-muted">
        {property.primary_photo_url ? (
          <img
            src={property.primary_photo_url}
            alt={property.address_line1}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Home className="h-10 w-10" />
          </div>
        )}
        {metrics.activeAlertsCount > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-amber-500/95 hover:bg-amber-500 text-white border-0 inline-flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {metrics.activeAlertsCount}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div>
          <div className="font-medium truncate">{property.address_line1}</div>
          <div className="text-xs text-muted-foreground truncate">
            {property.city}, {property.state} · {PROPERTY_TYPE_LABELS[property.property_type]}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground">Value</div>
            <div className="font-semibold">{fmtMoney(metrics.currentValue)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Equity</div>
            <div className="font-semibold">{fmtMoney(metrics.equity)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] text-muted-foreground">Cash flow</div>
            <div
              className={
                property.is_rented && metrics.monthlyCashFlow < 0
                  ? 'font-medium text-destructive'
                  : property.is_rented && metrics.monthlyCashFlow > 0
                    ? 'font-medium text-emerald-600'
                    : 'font-medium text-foreground'
              }
            >
              {cashFlowLabel}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}