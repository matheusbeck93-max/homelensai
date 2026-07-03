import { useEffect, useState } from "react";
import { SeoCanonical } from "@/components/seo/SeoCanonical";
import { useNavigate } from "react-router-dom";
import { useComparison } from "@/contexts/ComparisonContext";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierGate } from "@/components/subscription/TierGate";

export default function Compare() {
  const navigate = useNavigate();
  const { selectedProperties, removeFromComparison, clearComparison } = useComparison();

  useEffect(() => {
    if (selectedProperties.length === 0) {
      navigate("/");
    }
  }, [selectedProperties.length, navigate]);

  if (selectedProperties.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
      <SeoCanonical />
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardHeader>
              <CardTitle>No Properties Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Select properties to compare them side by side.</p>
              <Button onClick={() => navigate("/")}>Browse Properties</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-4xl font-bold mb-2">Compare Properties ({selectedProperties.length})</h1>
          </div>
          <Button variant="outline" onClick={clearComparison}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
        
        <TierGate
          feature="PROPERTY_COMPARISON"
          featureName="Property Comparison"
          description="Compare properties side by side with full AI-powered insights. Available on Buyer and Investor plans."
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                showProLockedBadges={false}
              />
            ))}
          </div>
        </TierGate>
      </main>
    </div>
  );
}