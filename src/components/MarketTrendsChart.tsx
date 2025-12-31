import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  Sparkles,
  ExternalLink,
  BarChart3,
  Home,
  Clock,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface TrendDataPoint {
  period: string;
  medianPrice: number | null;
  priceChange: number | null;
  inventory: number | null;
  daysOnMarket: number | null;
}

interface MarketTrendsData {
  location: string;
  trends: TrendDataPoint[];
  insights: string;
  outlook: "bullish" | "bearish" | "neutral";
  citations: string[];
  generatedAt: string;
}

interface MarketTrendsChartProps {
  location: string;
  className?: string;
}

const chartConfig = {
  medianPrice: {
    label: "Median Price",
    color: "hsl(var(--primary))",
  },
  inventory: {
    label: "Inventory",
    color: "hsl(var(--chart-2))",
  },
  daysOnMarket: {
    label: "Days on Market",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function MarketTrendsChart({ location, className }: MarketTrendsChartProps) {
  const [data, setData] = useState<MarketTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMetric, setActiveMetric] = useState<"price" | "inventory" | "dom">("price");

  const fetchTrends = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: response, error } = await supabase.functions.invoke("market-trends", {
        body: { location, force_refresh: forceRefresh },
      });

      if (error) throw error;
      setData(response);
    } catch (err) {
      console.error("Failed to fetch market trends:", err);
      toast.error("Failed to load market trends");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchTrends();
    }
  }, [location]);

  const handleRefresh = () => {
    toast.info("Fetching latest market data...");
    fetchTrends(true);
  };

  const getOutlookIcon = () => {
    if (!data) return <Minus className="w-4 h-4" />;
    switch (data.outlook) {
      case "bullish":
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-amber-500" />;
    }
  };

  const getOutlookColor = () => {
    if (!data) return "bg-muted text-muted-foreground";
    switch (data.outlook) {
      case "bullish":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "bearish":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    }
  };

  const formatPrice = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (loading) {
    return (
      <Card className={`p-4 md:p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-[200px] w-full mb-4" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={`p-4 md:p-6 ${className}`}>
        <p className="text-muted-foreground text-center py-8">
          Unable to load market trends for this location.
        </p>
      </Card>
    );
  }

  const chartData = data.trends.map((t) => ({
    period: t.period,
    medianPrice: t.medianPrice,
    inventory: t.inventory,
    daysOnMarket: t.daysOnMarket,
    priceChange: t.priceChange,
  }));

  const latestTrend = data.trends[data.trends.length - 1];
  const firstTrend = data.trends[0];
  const overallChange = latestTrend && firstTrend && latestTrend.medianPrice && firstTrend.medianPrice
    ? ((latestTrend.medianPrice - firstTrend.medianPrice) / firstTrend.medianPrice * 100).toFixed(1)
    : null;

  return (
    <Card className={`p-4 md:p-6 border-border/60 bg-background/80 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-base md:text-lg font-semibold">Market Trends</h3>
          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
            <Sparkles className="w-3 h-3" />
            AI-Powered
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs gap-1 ${getOutlookColor()}`}>
            {getOutlookIcon()}
            {data.outlook.charAt(0).toUpperCase() + data.outlook.slice(1)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <Button
          variant={activeMetric === "price" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveMetric("price")}
          className="text-xs gap-1.5 shrink-0"
        >
          <Home className="w-3.5 h-3.5" />
          Prices
        </Button>
        <Button
          variant={activeMetric === "inventory" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveMetric("inventory")}
          className="text-xs gap-1.5 shrink-0"
        >
          <Package className="w-3.5 h-3.5" />
          Inventory
        </Button>
        <Button
          variant={activeMetric === "dom" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveMetric("dom")}
          className="text-xs gap-1.5 shrink-0"
        >
          <Clock className="w-3.5 h-3.5" />
          Days on Market
        </Button>
      </div>

      {/* Chart */}
      <div className="h-[200px] md:h-[240px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientInventory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientDOM" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                if (activeMetric === "price") return formatPrice(value);
                return value.toLocaleString();
              }}
              className="text-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "medianPrice") return formatPrice(value as number);
                    if (name === "daysOnMarket") return `${value} days`;
                    return value?.toLocaleString();
                  }}
                />
              }
            />
            {activeMetric === "price" && (
              <>
                <Area
                  type="monotone"
                  dataKey="medianPrice"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#gradientPrice)"
                />
              </>
            )}
            {activeMetric === "inventory" && (
              <Area
                type="monotone"
                dataKey="inventory"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#gradientInventory)"
              />
            )}
            {activeMetric === "dom" && (
              <Area
                type="monotone"
                dataKey="daysOnMarket"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                fill="url(#gradientDOM)"
              />
            )}
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Stats Row */}
      {latestTrend && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Median Price</p>
            <p className="text-sm md:text-base font-semibold">
              {latestTrend.medianPrice ? formatPrice(latestTrend.medianPrice) : "N/A"}
            </p>
            {overallChange && (
              <p className={`text-[10px] ${parseFloat(overallChange) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {parseFloat(overallChange) >= 0 ? "+" : ""}{overallChange}% (6mo)
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Inventory</p>
            <p className="text-sm md:text-base font-semibold">
              {latestTrend.inventory?.toLocaleString() || "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground">active listings</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Days on Market</p>
            <p className="text-sm md:text-base font-semibold">
              {latestTrend.daysOnMarket || "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground">avg days</p>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI Market Insight
        </p>
        <p className="text-sm text-foreground">{data.insights}</p>
      </div>

      {/* Citations */}
      {data.citations && data.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.citations.slice(0, 3).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Source {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="mt-3 text-[10px] text-muted-foreground text-center">
        Data updated: {new Date(data.generatedAt).toLocaleDateString()}
      </p>
    </Card>
  );
}
