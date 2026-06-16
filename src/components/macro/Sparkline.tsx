/**
 * Sparkline — tiny inline SVG sparkline for FRED-style time series.
 * Zero deps; safe in chat bubbles, briefs, and email-rendered HTML.
 *
 * Expects values sorted oldest -> newest. Uses currentColor so it
 * inherits theme tokens (steel-blue primary, etc.).
 */

import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Optional ARIA label, e.g. "30-yr mortgage rate, last 12 weeks". */
  label?: string;
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  className,
  label,
}: SparklineProps) {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length < 2) return null;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const step = clean.length > 1 ? width / (clean.length - 1) : 0;
  const points = clean
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('inline-block align-middle text-primary', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}