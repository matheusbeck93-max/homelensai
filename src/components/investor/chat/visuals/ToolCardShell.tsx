import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  anchor: string;
  status: 'running' | 'done' | 'error';
  error?: string;
  children?: ReactNode;
  id?: string;
}

export function ToolCardShell({ anchor, status, error, children, id }: Props) {
  return (
    <Card id={id} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {anchor}
        </div>
        <div className={cn('text-[10px] flex items-center gap-1',
          status === 'running' && 'text-muted-foreground',
          status === 'done' && 'text-emerald-600',
          status === 'error' && 'text-destructive',
        )}>
          {status === 'running' && <><Loader2 className="h-3 w-3 animate-spin" /> Running</>}
          {status === 'done' && <><CheckCircle2 className="h-3 w-3" /> Done</>}
          {status === 'error' && <><AlertCircle className="h-3 w-3" /> Error</>}
        </div>
      </div>
      {status === 'error' ? (
        <div className="text-xs text-destructive">{error ?? 'Tool failed'}</div>
      ) : status === 'running' ? (
        <div className="h-16 rounded bg-muted/40 animate-pulse" />
      ) : (
        children
      )}
    </Card>
  );
}

const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const usd = (n?: number | null) => (n == null || Number.isNaN(n) ? '—' : fmtUSD.format(n));
export const pct = (n?: number | null, digits = 1) =>
  n == null || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`;
export const num = (n?: number | null) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US'));