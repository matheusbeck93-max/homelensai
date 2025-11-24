import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DataFreshnessProps {
  sources: {
    name: string;
    lastUpdated?: Date | string | null;
    type?: "real-time" | "daily" | "weekly" | "monthly";
  }[];
  className?: string;
}

export function DataFreshness({ sources, className = "" }: DataFreshnessProps) {
  const getFreshnessColor = (type?: string) => {
    switch (type) {
      case "real-time":
        return "text-emerald-500";
      case "daily":
        return "text-green-500";
      case "weekly":
        return "text-yellow-500";
      case "monthly":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getFreshnessLabel = (type?: string) => {
    switch (type) {
      case "real-time":
        return "Live";
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Periodic";
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-muted-foreground ${className}`}>
      <Clock className="h-3 w-3" />
      <span className="font-medium">Data sources:</span>
      {sources.map((source, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span>{source.name}</span>
          {source.type && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getFreshnessColor(source.type)} bg-current/10`}>
              {getFreshnessLabel(source.type)}
            </span>
          )}
          {source.lastUpdated && (
            <span className="text-[10px]">
              ({formatDistanceToNow(new Date(source.lastUpdated), { addSuffix: true })})
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
