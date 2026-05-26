interface Props {
  data: {
    headline: string;
    value?: string;
    explanation?: string;
  };
}

export function AnomalyCard({ data }: Props) {
  return (
    <div className="space-y-2">
      {data.value && (
        <div className="text-2xl font-semibold tracking-tight">{data.value}</div>
      )}
      <p className="text-sm font-medium">{data.headline}</p>
      {data.explanation && (
        <p className="text-xs text-muted-foreground leading-relaxed">{data.explanation}</p>
      )}
    </div>
  );
}