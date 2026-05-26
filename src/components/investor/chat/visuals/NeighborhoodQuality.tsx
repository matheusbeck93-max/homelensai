import { ToolCardShell } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function NeighborhoodQuality({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-3">
        <div className="text-[11px] text-muted-foreground">
          {o.zip ? `ZIP ${o.zip} · ` : ''}{o.market}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Score label="Schools" value={o.schoolRating} suffix="/10" tone={(v: number) => v >= 7 ? 'emerald' : v >= 5 ? 'amber' : 'destructive'} />
          <Score label="Crime idx" value={o.crimeIndex} suffix="" tone={(v: number) => v <= 40 ? 'emerald' : v <= 65 ? 'amber' : 'destructive'} />
          <Score label="Walk score" value={o.walkScore} suffix="" tone={(v: number) => v >= 70 ? 'emerald' : v >= 40 ? 'amber' : 'destructive'} />
        </div>
        {o.summary && <p className="text-xs">{o.summary}</p>}
        {o.source && <div className="text-[10px] text-muted-foreground">Source: {o.source}</div>}
      </div>
    </ToolCardShell>
  );
}

function Score({ label, value, suffix, tone }: { label: string; value: number | null; suffix: string; tone: (v: number) => string }) {
  const t = value != null ? tone(value) : 'muted';
  const cls = t === 'emerald' ? 'text-emerald-600' : t === 'amber' ? 'text-amber-600' : t === 'destructive' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="rounded-md border p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value != null ? `${value}${suffix}` : '—'}</div>
    </div>
  );
}