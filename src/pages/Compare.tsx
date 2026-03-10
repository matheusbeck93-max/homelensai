import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useComparison } from "@/contexts/ComparisonContext";
import { Navigation } from "@/components/Navigation";

import { DetailedComparisonView } from "@/components/comparison/DetailedComparisonView";

export default function Compare() {
  const navigate = useNavigate();
  const { selectedProperties, removeFromComparison } = useComparison();

  useEffect(() => {
    if (selectedProperties.length === 0) {
      navigate("/");
    }
  }, [selectedProperties.length, navigate]);

  if (selectedProperties.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <DetailedComparisonView
        properties={selectedProperties}
        onClose={() => navigate("/")}
        onRemove={removeFromComparison}
      />
      
    </div>
  );
}