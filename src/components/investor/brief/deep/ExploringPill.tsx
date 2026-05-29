import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionFilters } from '@/contexts/InvestorBriefContext';

interface Props {
  filters: SessionFilters;
  onReset: () => void;
}

function fmtUsd(n?: number) {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function ExploringPill({ filters, onReset }: Props) {
  const parts: string[] = [];
  if (filters.marketsReplace?.length) {
    parts.push(`markets: ${filters.marketsReplace.join(', ')}`);
  } else if (filters.marketsAdd?.length) {
    parts.push(`+ ${filters.marketsAdd.join(', ')}`);
  }
  if (filters.budgetOverride?.max != null)
    parts.push(`budget max ${fmtUsd(filters.budgetOverride.max)}`);
  if (filters.budgetOverride?.min != null)
    parts.push(`budget min ${fmtUsd(filters.budgetOverride.min)}`);
  if (filters.capRateOverride != null)
    parts.push(`cap ≥ ${(filters.capRateOverride * 100).toFixed(1)}%`);
  if (filters.beds != null) parts.push(`${filters.beds}+ bd`);
  if (filters.baths != null) parts.push(`${filters.baths}+ ba`);

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
      <span className="font-medium text-primary">Exploring:</span>
      <span className="text-foreground truncate">{parts.join(' · ')}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 ml-auto gap-1 text-xs"
        onClick={onReset}
      >
        <X className="h-3 w-3" /> Reset
      </Button>
    </div>
  );
}