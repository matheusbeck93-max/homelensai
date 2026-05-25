interface Props {
  data: { market: string };
}

export function SampleCard({ data }: Props) {
  return (
    <div className="text-sm space-y-2">
      <p className="text-muted-foreground">
        Once you save properties and analyses, cards like this will surface real signals from{' '}
        <span className="text-foreground font-medium">{data.market}</span> and your watchlist.
      </p>
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Example: <span className="text-foreground">3 ZIPs in {data.market}</span> showed
        above-average price cuts this week.
      </div>
    </div>
  );
}
