import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { calculatePriceFairness } from "@/lib/pricingUtils";

interface PropertyPDFExportProps {
  property: any;
  analysis?: string;
  neighborhoodPersonality?: string;
  comparableProperties?: any[];
}

export function PropertyPDFExport({ 
  property, 
  analysis, 
  neighborhoodPersonality,
  comparableProperties 
}: PropertyPDFExportProps) {
  const [generating, setGenerating] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { toast } = useToast();
  const { hasAccess } = useSubscription();

  const hasPDFExportAccess = hasAccess('EXCEL_WORKFLOW');

  const handleExportPDF = async () => {
    if (!hasPDFExportAccess) {
      setUpgradeModalOpen(true);
      return;
    }

    setGenerating(true);
    try {
      // Fetch comparable properties for price fairness
      let priceFairness = null;
      let fetchedComparables = comparableProperties;
      
      if (!fetchedComparables) {
        const { data: comparables } = await supabase
          .from('properties')
          .select('price, sqft')
          .eq('city', property.city)
          .eq('state', property.state)
          .gte('beds', property.beds - 1)
          .lte('beds', property.beds + 1)
          .neq('id', property.id)
          .limit(10);
        
        fetchedComparables = comparables || [];
      }

      if (fetchedComparables && fetchedComparables.length > 0) {
        priceFairness = calculatePriceFairness(property, fetchedComparables);
      }

      const { data, error } = await supabase.functions.invoke('generate-property-pdf', {
        body: {
          property,
          analysis,
          neighborhoodSummary: neighborhoodPersonality,
          priceFairness
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;

      // Convert response to blob and download
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `property-${property.id}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Generated",
        description: "Your property report has been downloaded",
      });

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export failed",
        description: error.message || "Could not generate PDF report",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleExportPDF}
        disabled={generating}
        variant="outline"
        size="lg"
        className="w-full"
      >
        {!hasPDFExportAccess ? (
          <>
            <Lock className="mr-2 h-5 w-5" />
            Export PDF Report (Pro)
          </>
        ) : generating ? (
          <>
            <FileDown className="mr-2 h-5 w-5 animate-pulse" />
            Generating PDF...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-5 w-5" />
            Export PDF Report
          </>
        )}
      </Button>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="PDF Export - Professional Property Reports"
      />
    </>
  );
}
