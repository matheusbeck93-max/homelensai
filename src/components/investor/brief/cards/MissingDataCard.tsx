import { AlertCircle } from 'lucide-react';
import { CardSourceFooter } from '../MetricWithSource';
import type { CardSources } from '@/lib/investorBrief/sources';

interface Props {
  data: { rows: Array<{ id: string; address: string; missing: string[] }> };
  sources?: CardSources;
}

export function MissingDataCard({ data, sources }: Props) {
  if (data.rows.length === 0) {
    return <p className="text-xs text-muted-foreground">All analyses look complete.</p>;
  }
  return (
    <div>
      <ul className="space-y-2 text-sm">
        {data.rows.slice(0, 4).map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-foreground/90">{r.address}</div>
              <div className="text-[11px] text-muted-foreground">Missing: {r.missing.join(', ')}</div>
            </div>
          </li>
        ))}
      </ul>
      <CardSourceFooter sources={sources} />
    </div>
  );
}
