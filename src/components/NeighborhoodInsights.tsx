import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  Shield, 
  Footprints, 
  MapPin, 
  Star,
  Users,
  DollarSign,
  Home,
  TrendingUp,
  Bus,
  ShoppingBag,
  Coffee,
  Trees,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Clock
} from "lucide-react";
import { NeighborhoodInsights as NeighborhoodInsightsType } from "@/types/neighborhood";
import { formatDistanceToNow } from "date-fns";

interface NeighborhoodInsightsProps {
  insights: NeighborhoodInsightsType;
  isLoading?: boolean;
  onRefresh?: () => void;
  source?: 'perplexity' | 'fallback';
}

export function NeighborhoodInsights({ insights, isLoading, onRefresh, source }: NeighborhoodInsightsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCrimeColor = (rate: number) => {
    if (rate < 20) return "bg-green-600";
    if (rate < 35) return "bg-yellow-600";
    return "bg-red-600";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Neighborhood Insights
              {source === 'perplexity' && (
                <Badge variant="secondary" className="ml-2 gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI-Powered
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              Comprehensive data about this area including schools, safety, walkability, and amenities
              {insights.lastUpdated && (
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(insights.lastUpdated), { addSuffix: true })}
                </span>
              )}
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* AI Summary */}
        {insights.aiSummary && (
          <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">AI Summary</h4>
                <p className="text-sm text-muted-foreground">{insights.aiSummary}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="schools" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="walkability">Walk Score</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
          </TabsList>

          {/* Schools Tab */}
          <TabsContent value="schools" className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <GraduationCap className="h-5 w-5" />
              <span className="text-sm">Nearby schools and ratings (10-point scale)</span>
            </div>
            {insights.schools.map((school, idx) => (
              <Card key={idx} className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{school.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {school.type} • {school.grades}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-bold">{school.rating}/10</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {school.distance.toFixed(1)} mi away
                      </p>
                    </div>
                  </div>
                  <Progress value={school.rating * 10} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Shield className="h-5 w-5" />
              <span className="text-sm">Crime statistics and safety ratings</span>
            </div>
            <div className="grid gap-4">
              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold mb-1">Overall Safety Rating</h4>
                      <Badge className={getCrimeColor(insights.crimeData.crimeRate)}>
                        {insights.crimeData.overallRating}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {insights.crimeData.crimeRate.toFixed(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">crime index</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {insights.crimeData.comparison}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Violent Crime</span>
                        <span className="font-medium">
                          {insights.crimeData.categories.violent.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={insights.crimeData.categories.violent} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Property Crime</span>
                        <span className="font-medium">
                          {insights.crimeData.categories.property.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={insights.crimeData.categories.property} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Other</span>
                        <span className="font-medium">
                          {insights.crimeData.categories.other.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={insights.crimeData.categories.other} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Walkability Tab */}
          <TabsContent value="walkability" className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Footprints className="h-5 w-5" />
              <span className="text-sm">Walkability, transit, and bike-friendliness scores</span>
            </div>
            <div className="grid gap-4">
              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold mb-1">Walk Score</h4>
                      <p className="text-sm text-muted-foreground">
                        {insights.walkScore.description}
                      </p>
                    </div>
                    <div className={`text-3xl font-bold ${getScoreColor(insights.walkScore.score)}`}>
                      {insights.walkScore.score}
                    </div>
                  </div>
                  <Progress value={insights.walkScore.score} className="h-2 mb-6" />

                  {insights.walkScore.transitScore && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bus className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Transit Score</span>
                        </div>
                        <div className={`font-semibold ${getScoreColor(insights.walkScore.transitScore)}`}>
                          {insights.walkScore.transitScore}
                        </div>
                      </div>
                      <Progress value={insights.walkScore.transitScore} className="h-1.5" />
                    </div>
                  )}

                  {insights.walkScore.bikeScore && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Bike Score</span>
                        <div className={`font-semibold ${getScoreColor(insights.walkScore.bikeScore)}`}>
                          {insights.walkScore.bikeScore}
                        </div>
                      </div>
                      <Progress value={insights.walkScore.bikeScore} className="h-1.5" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Amenities Tab */}
          <TabsContent value="amenities" className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <ShoppingBag className="h-5 w-5" />
              <span className="text-sm">Nearby restaurants, parks, shopping, and transit</span>
            </div>
            
            {/* Restaurants */}
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Coffee className="h-4 w-4" />
                Dining & Cafes
              </h4>
              <div className="space-y-2">
                {insights.amenities.restaurants.map((amenity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{amenity.name}</p>
                      <p className="text-xs text-muted-foreground">{amenity.type}</p>
                    </div>
                    <div className="text-right">
                      {amenity.rating && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <Star className="h-3 w-3 fill-current" />
                          <span>{amenity.rating}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{amenity.distance.toFixed(1)} mi</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parks */}
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Trees className="h-4 w-4" />
                Parks & Recreation
              </h4>
              <div className="space-y-2">
                {insights.amenities.parks.map((amenity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{amenity.name}</p>
                      <p className="text-xs text-muted-foreground">{amenity.type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{amenity.distance.toFixed(1)} mi</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping */}
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4" />
                Shopping & Services
              </h4>
              <div className="space-y-2">
                {insights.amenities.shopping.map((amenity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{amenity.name}</p>
                      <p className="text-xs text-muted-foreground">{amenity.type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{amenity.distance.toFixed(1)} mi</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transit */}
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Bus className="h-4 w-4" />
                Public Transit
              </h4>
              <div className="space-y-2">
                {insights.amenities.transit.map((amenity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{amenity.name}</p>
                      <p className="text-xs text-muted-foreground">{amenity.type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{amenity.distance.toFixed(1)} mi</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Demographics Tab */}
          <TabsContent value="demographics" className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Users className="h-5 w-5" />
              <span className="text-sm">Population, income, and housing statistics</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Population</p>
                      <p className="text-2xl font-bold">
                        {insights.demographics?.population ? insights.demographics.population.toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Median Income</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(insights.demographics.medianIncome)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Median Age</p>
                      <p className="text-2xl font-bold">
                        {insights.demographics.medianAge}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Home className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Homeownership</p>
                      <p className="text-2xl font-bold">
                        {insights.demographics.homeownershipRate}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Citations */}
        {insights.citations && insights.citations.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Sources
            </h4>
            <div className="flex flex-wrap gap-2">
              {insights.citations.slice(0, 5).map((citation, idx) => (
                <a
                  key={idx}
                  href={citation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate max-w-[200px]"
                >
                  {new URL(citation).hostname}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
