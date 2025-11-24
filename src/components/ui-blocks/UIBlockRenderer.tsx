import React from "react";
import { UIBlock } from "@/types/ui-blocks";
import { PropertyResultsCarousel } from "./PropertyResultsCarousel";
import { MortgageCalculator } from "./MortgageCalculator";
import { HomeLensInvestorCalculator } from "./HomeLensInvestorCalculator";
import { IndividualBuyingPowerCalculator } from "./IndividualBuyingPowerCalculator";

interface UIBlockRendererProps {
  block: UIBlock;
  onPropertyAnalyze?: (property: any) => void;
}

export const UIBlockRenderer: React.FC<UIBlockRendererProps> = ({ block, onPropertyAnalyze }) => {
  switch (block.type) {
    case "ui_block/property_results_carousel":
      return (
        <PropertyResultsCarousel
          title={block.title}
          properties={block.properties}
          onAnalyze={onPropertyAnalyze}
        />
      );

    case "ui_block/mortgage_calculator":
      return (
        <MortgageCalculator
          title={block.title}
          inputs={block.inputs}
        />
      );

    case "ui_block/homelens_investor":
      return (
        <HomeLensInvestorCalculator
          title={block.title}
          inputs={block.inputs}
          rentEstimate={block.rentEstimate}
        />
      );

    case "ui_block/individual_buying_power":
      return (
        <IndividualBuyingPowerCalculator
          title={block.title}
          inputs={block.inputs}
          scenarios={block.scenarios}
        />
      );

    default:
      console.warn("Unknown UI block type:", (block as any).type);
      return null;
  }
};
