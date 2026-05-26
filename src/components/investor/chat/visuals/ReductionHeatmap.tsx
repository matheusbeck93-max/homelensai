import { ToolCardShell } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function ReductionHeatmap({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const rows: any[] = o.rows ?? [];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      {o.note && <div className="text-xs text-muted-foreground">{o.note}</div>}
      {!rows.length && !o.note && (
        <div className="text-xs text-muted-foreground">No reduction data.</div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `auto repeat(${rows[0]?.weeks?.length ?? 0}, minmax(20px, 1fr))` }}>
            {rows.map((row: any) => (
              <>
                <div key={`${row.zip}-label`} className="p-1 text-[10px] text-muted-foreground">{row.zip}</div>
                {(row.weeks ?? []).map((w: number, i: number) => (
                  <div
                    key={`${row.zip}-${i}`}
                    className="h-5 m-0.5 rounded"
                    style={{ background: `hsl(var(--primary) / ${Math.min(1, (w ?? 0) / Math.max(1, o.maxIntensity ?? 1))})` }}
                    title={`${w} reductions`}
                  />
                ))}
              </>
            ))}
          </div>
        </div>
      )}
    </ToolCardShell>
  );
}