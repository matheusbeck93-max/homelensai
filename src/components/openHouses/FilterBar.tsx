import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { US_STATES } from '@/data/usStatesCities';
import { CA_PROVINCES } from '@/data/caProvincesCities';
import type { OpenHouseFilters, OpenHouseCountry } from '@/types/openHouses';
import { Search } from 'lucide-react';

interface FilterBarProps {
  filters: OpenHouseFilters;
  onChange: (next: OpenHouseFilters) => void;
  onSubmit: () => void;
  loading?: boolean;
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const DATE_CHIPS: Array<{ label: string; from: string; to: string }> = [
  { label: 'Today', from: todayISO(0), to: todayISO(0) },
  {
    label: 'This weekend',
    from: (() => {
      const d = new Date();
      const day = d.getDay(); // 0 Sun..6 Sat
      const sat = (6 - day + 7) % 7;
      d.setDate(d.getDate() + sat);
      return d.toISOString().slice(0, 10);
    })(),
    to: (() => {
      const d = new Date();
      const day = d.getDay();
      const sun = (7 - day) % 7;
      d.setDate(d.getDate() + sun);
      return d.toISOString().slice(0, 10);
    })(),
  },
  { label: 'Next 7 days', from: todayISO(0), to: todayISO(7) },
];

export function OpenHousesFilterBar({ filters, onChange, onSubmit, loading }: FilterBarProps) {
  const regions = filters.country === 'US' ? US_STATES : CA_PROVINCES;
  const selectedRegion = regions.find((r) => r.code === filters.state);
  const cityOptions = selectedRegion?.cities ?? [];

  const dateLabel = useMemo(() => {
    if (!filters.dateFrom) return 'Any date';
    if (filters.dateFrom === filters.dateTo) return filters.dateFrom;
    return `${filters.dateFrom} → ${filters.dateTo ?? '?'}`;
  }, [filters.dateFrom, filters.dateTo]);

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      {/* Country toggle */}
      <div className="flex items-center gap-2">
        {(['US', 'CA'] as OpenHouseCountry[]).map((c) => (
          <Button
            key={c}
            variant={filters.country === c ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ ...filters, country: c, state: null, city: null })}
          >
            {c === 'US' ? 'United States' : 'Canada'}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* State / Province */}
        <Select
          value={filters.state ?? ''}
          onValueChange={(v) => onChange({ ...filters, state: v || null, city: null })}
        >
          <SelectTrigger>
            <SelectValue placeholder={filters.country === 'US' ? 'State' : 'Province'} />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City */}
        <Select
          value={filters.city ?? ''}
          onValueChange={(v) => onChange({ ...filters, city: v || null })}
          disabled={cityOptions.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={cityOptions.length ? 'City' : 'Pick a state first'} />
          </SelectTrigger>
          <SelectContent>
            {cityOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price min/max */}
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Min price"
          value={filters.priceMin ?? ''}
          onChange={(e) =>
            onChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : null })
          }
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Max price"
          value={filters.priceMax ?? ''}
          onChange={(e) =>
            onChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : null })
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_CHIPS.map((chip) => {
          const active = filters.dateFrom === chip.from && filters.dateTo === chip.to;
          return (
            <Button
              key={chip.label}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...filters, dateFrom: chip.from, dateTo: chip.to })}
            >
              {chip.label}
            </Button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-1">{dateLabel}</span>
        <div className="flex-1" />
        <Button onClick={onSubmit} disabled={loading || !filters.city} className="gap-2">
          <Search className="h-4 w-4" />
          {loading ? 'Searching…' : 'Find open houses'}
        </Button>
      </div>
    </div>
  );
}
