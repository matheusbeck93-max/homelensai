interface Row {
  address?: string;
  score?: number | null;
  price?: number | null;
}

interface Props {
  data: { rows?: Row[]; count?: number; cities?: string[] };
}

export function RankedListCard({ data }: Props) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        {data.cities && data.cities.length > 0 ? data.cities.join(' · ') : 'No items to rank yet.'}
      </div>
    );
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.slice(0, 5).map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-2 min-w-0">
          <span className="truncate text-foreground/90">
            <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
            {r.address ?? '—'}
          </span>
          {r.score != null && (
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {r.score}/100
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
