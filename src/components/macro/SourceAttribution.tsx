/**
 * SourceAttribution — small "per FRED, updated Jun 12" footer used on
 * macro/demographic/labor numbers across chat, briefs, and emails.
 * Source attribution is part of the product's differentiation; every
 * primary-source number should ship with one of these.
 */

import { cn } from '@/lib/utils';

interface SourceAttributionProps {
  source: string;
  asOf?: string | null;
  className?: string;
}

function formatAsOf(asOf: string | null | undefined): string | null {
  if (!asOf) return null;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return asOf;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SourceAttribution({ source, asOf, className }: SourceAttributionProps) {
  const formatted = formatAsOf(asOf);
  return (
    <span
      className={cn(
        'text-[11px] text-muted-foreground italic leading-tight',
        className,
      )}
    >
      Source: {source}
      {formatted ? ` · updated ${formatted}` : ''}
    </span>
  );
}