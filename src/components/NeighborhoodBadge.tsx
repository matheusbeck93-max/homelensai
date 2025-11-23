import { Badge } from "@/components/ui/badge";
import { Footprints, Shield, GraduationCap } from "lucide-react";

interface NeighborhoodBadgeProps {
  type: "walkability" | "safety" | "schools";
  score: number;
  compact?: boolean;
}

export function NeighborhoodBadge({ type, score, compact = false }: NeighborhoodBadgeProps) {
  const getConfig = () => {
    switch (type) {
      case "walkability":
        return {
          icon: Footprints,
          label: "Walk Score",
          color: score >= 70 ? "bg-green-600" : score >= 50 ? "bg-yellow-600" : "bg-red-600",
        };
      case "safety":
        return {
          icon: Shield,
          label: "Safety",
          color: score >= 70 ? "bg-green-600" : score >= 50 ? "bg-yellow-600" : "bg-red-600",
        };
      case "schools":
        return {
          icon: GraduationCap,
          label: "Schools",
          color: score >= 8 ? "bg-green-600" : score >= 6 ? "bg-yellow-600" : "bg-red-600",
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  if (compact) {
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        <span>{score}</span>
      </Badge>
    );
  }

  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2 py-1`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs">{config.label}: {score}</span>
    </Badge>
  );
}
