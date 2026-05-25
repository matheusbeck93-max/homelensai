import { Fragment } from 'react';

interface Props {
  data: { market: string; rows: string[]; cols: string[]; values: number[][] };
}

export function HeatmapCard({ data }: Props) {
  return (
    <div className="text-xs">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `auto repeat(${data.cols.length}, 1fr)` }}
      >
        <div />
        {data.cols.map((c) => (
          <div key={c} className="text-center text-[10px] text-muted-foreground">
            {c}
          </div>
        ))}
        {data.rows.map((zip, r) => (
          <Fragment key={zip}>
            <div className="text-[10px] text-muted-foreground pr-1 self-center">
              {zip}
            </div>
            {data.values[r].map((v, c) => (
              <div
                key={`${zip}-${c}`}
                className="aspect-square rounded-sm"
                style={{ backgroundColor: `hsl(var(--primary) / ${0.15 + v * 0.7})` }}
                title={`${zip} · ${data.cols[c]}: ${(v * 100).toFixed(0)}%`}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
