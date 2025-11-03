import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, ChevronUp, FileText, AlertTriangle, Clock } from "lucide-react";

interface DataSource {
  field: string;
  value: string | number;
  source: "user-input" | "estimated" | "calculated" | "market-data";
  confidence: "high" | "medium" | "low";
  lastUpdated?: string;
  methodology?: string;
}

interface DataCitationsProps {
  dataSources: DataSource[];
}

export function DataCitations({ dataSources }: DataCitationsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "user-input":
        return <Badge variant="default">User Provided</Badge>;
      case "market-data":
        return <Badge variant="secondary">Market Data</Badge>;
      case "calculated":
        return <Badge variant="outline">Calculated</Badge>;
      case "estimated":
        return <Badge variant="outline" className="border-amber-500 text-amber-700">Estimated</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100">High Confidence</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">Medium Confidence</Badge>;
      case "low":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100">Low Confidence</Badge>;
      default:
        return null;
    }
  };

  const formatValue = (value: string | number) => {
    if (typeof value === "number") {
      if (value > 1000) {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value);
      }
      return value.toFixed(2);
    }
    return value;
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">Data Sources & Methodology</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              See how we calculated this analysis and where the data comes from
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Disclaimer */}
            <Alert className="bg-amber-100 dark:bg-amber-950/30 border-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <strong>Important Disclaimer:</strong> All estimates and calculations are for informational 
                purposes only. Property values, rental income, and ROI projections are estimates based on 
                available data and market trends. Always verify with licensed professionals including 
                real estate agents, appraisers, and financial advisors before making investment decisions.
              </AlertDescription>
            </Alert>

            {/* Data Sources Table */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Data Point Breakdown
              </h3>
              <div className="space-y-2">
                {dataSources.map((source, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white dark:bg-gray-950 rounded-lg border space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{source.field}</p>
                          {getSourceBadge(source.source)}
                        </div>
                        <p className="text-lg font-bold text-primary">
                          {formatValue(source.value)}
                        </p>
                      </div>
                      {getConfidenceBadge(source.confidence)}
                    </div>

                    {source.methodology && (
                      <p className="text-xs text-muted-foreground border-t pt-2">
                        <strong>Methodology:</strong> {source.methodology}
                      </p>
                    )}

                    {source.lastUpdated && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last updated: {source.lastUpdated}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculation Methods */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Common Calculation Methods</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="p-2 bg-white dark:bg-gray-950 rounded border">
                  <p className="font-medium mb-1">Monthly Payment (P&I)</p>
                  <p>Formula: M = P[r(1+r)^n]/[(1+r)^n-1]</p>
                  <p>Where P = loan amount, r = monthly rate, n = number of payments</p>
                </div>
                <div className="p-2 bg-white dark:bg-gray-950 rounded border">
                  <p className="font-medium mb-1">Cap Rate</p>
                  <p>Formula: (Net Operating Income / Property Value) × 100</p>
                  <p>Measures annual return on investment property</p>
                </div>
                <div className="p-2 bg-white dark:bg-gray-950 rounded border">
                  <p className="font-medium mb-1">1% Rule (Rentability)</p>
                  <p>Formula: (Monthly Rent / Purchase Price) × 100</p>
                  <p>Quick test: 1% or higher indicates good rental potential</p>
                </div>
                <div className="p-2 bg-white dark:bg-gray-950 rounded border">
                  <p className="font-medium mb-1">70% Rule (Flip Analysis)</p>
                  <p>Formula: Max Offer = (ARV × 0.70) - Rehab Costs</p>
                  <p>Conservative estimate for fix-and-flip purchases</p>
                </div>
              </div>
            </div>

            {/* Data Update Frequency */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Update Schedule:</strong>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Market rates: Updated weekly from national lenders</li>
                  <li>Property values: Based on recent comps within 1 mile</li>
                  <li>Rental estimates: Based on 1% rule + local market data</li>
                  <li>Tax rates: Based on county assessment data</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Verification Recommendation */}
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <AlertDescription className="text-sm">
                <strong>📋 Recommended Verifications:</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Get pre-approved by a lender for accurate rate and payment</li>
                  <li>Order professional appraisal for true property value</li>
                  <li>Review actual tax bills and HOA documents</li>
                  <li>Research 3+ rental comps for accurate income estimates</li>
                  <li>Consult with a real estate attorney before closing</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
