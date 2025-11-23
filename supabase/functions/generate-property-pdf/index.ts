import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property, analysis, neighborhoodSummary, priceFairness } = await req.json();

    console.log('Generating PDF for property:', property.id);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(value);
    };

    const formatDate = () => {
      return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Create new PDF document
    const doc = new jsPDF({
      unit: 'pt',
      format: 'letter'
    });

    let yPos = 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to add text with word wrap
    const addText = (text: string, fontSize: number, isBold: boolean = false, color: string = '#000000') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const rgb = hexToRgb(color);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach((line: string) => {
        if (yPos > 720) {
          doc.addPage();
          yPos = 60;
        }
        doc.text(line, margin, yPos);
        yPos += fontSize * 1.5;
      });
    };

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const addLine = () => {
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;
    };

    const addSpace = (height: number = 10) => {
      yPos += height;
    };

    // Header
    addText('Property Analysis Report', 24, true, '#1f2937');
    addText(formatDate(), 11, false, '#6b7280');
    addSpace(20);

    // Property Overview Section
    addText('Property Overview', 16, true, '#1f2937');
    addLine();

    // Address and Price
    addText(property.address, 18, true, '#1f2937');
    addText(`${property.city}, ${property.state} ${property.zip}`, 12, false, '#6b7280');
    addSpace(10);
    addText(formatCurrency(property.price), 22, true, '#16a34a');
    addSpace(15);

    // Property Details in Grid
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text('Bedrooms', margin, yPos);
    doc.text('Bathrooms', margin + contentWidth / 4, yPos);
    doc.text('Square Feet', margin + contentWidth / 2, yPos);
    doc.text('Price/Sqft', margin + (contentWidth * 3) / 4, yPos);
    yPos += 20;

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(property.beds.toString(), margin, yPos);
    doc.text(property.baths.toString(), margin + contentWidth / 4, yPos);
    doc.text(property.sqft.toLocaleString(), margin + contentWidth / 2, yPos);
    doc.text(formatCurrency(property.price / property.sqft), margin + (contentWidth * 3) / 4, yPos);
    yPos += 30;

    // Investment Analysis
    if (property.arv || property.rehab_cost || property.roi_percent) {
      addText('Investment Analysis', 16, true, '#1f2937');
      addLine();

      if (property.arv) {
        doc.setFontSize(11);
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text('After Repair Value (ARV)', margin, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(formatCurrency(property.arv), pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      }

      if (property.rehab_cost) {
        doc.setFontSize(11);
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text('Estimated Rehab Cost', margin, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(formatCurrency(property.rehab_cost), pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      }

      if (property.roi_percent) {
        doc.setFontSize(11);
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text('Estimated ROI', margin, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(`${property.roi_percent}%`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      }

      if (property.year_built) {
        doc.setFontSize(11);
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text('Year Built', margin, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(property.year_built.toString(), pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      }

      if (property.lot_size) {
        doc.setFontSize(11);
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text('Lot Size', margin, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(`${property.lot_size.toLocaleString()} sqft`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      }

      addSpace(20);
    }

    // Price Fairness Analysis
    if (priceFairness) {
      addText('Price Fairness Analysis', 16, true, '#1f2937');
      addLine();

      const fairnessColor = priceFairness.level === 'excellent' ? '#16a34a' : 
                           priceFairness.level === 'good' ? '#84cc16' :
                           priceFairness.level === 'fair' ? '#eab308' : '#ef4444';

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text('Rating', margin, yPos);
      yPos += 15;

      doc.setFontSize(14);
      const rgb = hexToRgb(fairnessColor);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFont('helvetica', 'bold');
      doc.text(priceFairness.level.toUpperCase(), margin, yPos);
      yPos += 25;

      addText(priceFairness.description, 10, false, '#374151');
      addSpace(10);

      doc.setFontSize(11);
      doc.setTextColor(75, 85, 99);
      doc.setFont('helvetica', 'normal');
      doc.text('Market Average Price/Sqft', margin, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(formatCurrency(priceFairness.marketAverage), pageWidth - margin, yPos, { align: 'right' });
      yPos += 20;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text('This Property Price/Sqft', margin, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(formatCurrency(priceFairness.pricePerSqft), pageWidth - margin, yPos, { align: 'right' });
      yPos += 20;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text('Difference from Market', margin, yPos);
      doc.setFont('helvetica', 'bold');
      const diffColor = priceFairness.percentDifference < 0 ? hexToRgb('#16a34a') : hexToRgb('#ef4444');
      doc.setTextColor(diffColor.r, diffColor.g, diffColor.b);
      doc.text(`${priceFairness.percentDifference > 0 ? '+' : ''}${priceFairness.percentDifference.toFixed(1)}%`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 30;
    }

    // AI Analysis
    if (analysis) {
      if (yPos > 600) {
        doc.addPage();
        yPos = 60;
      }
      addText('AI Investment Analysis', 16, true, '#1f2937');
      addLine();
      addText(analysis, 11, false, '#374151');
      addSpace(20);
    }

    // Neighborhood Personality
    if (neighborhoodSummary) {
      if (yPos > 600) {
        doc.addPage();
        yPos = 60;
      }
      addText('Neighborhood Personality', 16, true, '#1f2937');
      addLine();
      addText(neighborhoodSummary, 11, false, '#374151');
      addSpace(20);
    }

    // Footer on last page
    const pageCount = doc.internal.pages.length - 1;
    doc.setPage(pageCount);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    const footerText = 'This report was generated by HomeLens and is for informational purposes only. Data and analysis are subject to change.';
    const footerLines = doc.splitTextToSize(footerText, contentWidth);
    let footerY = 750;
    footerLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, footerY, { align: 'center' });
      footerY += 10;
    });

    // Generate PDF as array buffer
    const pdfOutput = doc.output('arraybuffer');

    console.log('PDF generated successfully');

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="property-${property.id}-report.pdf"`
      }
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
