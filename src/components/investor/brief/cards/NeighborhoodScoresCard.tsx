interface Row { name: string; schoolRating: number; crimeIndex: number; walkScore: number }
interface Data { market: string; rows: Row[] }

export function NeighborhoodScoresCard({ data }: { data: Data }) {
  return (
    <div className="space-y-1.5">
      {data.rows.slice(0, 4).map((r) => (
        <div key={r.name} className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5">
          <span className="font-medium">{r.name}</span>
          <span className="text-muted-foreground">
            Schools {r.schoolRating}/10 · Crime {r.crimeIndex} · Walk {r.walkScore}
          </span>
        </div>
      ))}
    </div>
  );
}