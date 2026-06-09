import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { enforceFeature } from '../_shared/tierGate.ts';

const log = createLogger('generate-property-pdf');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const gate = await enforceFeature(req, 'PDF_EXPORT');
    if (!gate.ok) return gate.error;

    const { property, analysis, neighborhoodSummary, priceFairness } = await req.json();

    log.step('Generating PDF for property', { id: property.id });

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
    };

    const formatDate = () => {
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    let yPos = 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    };

    const addText = (text: string, fontSize: number, isBold: boolean = false, color: string = '#000000') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const rgb = hexToRgb(color);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach((line: string) => {
        if (yPos > 720) { doc.addPage(); yPos = 60; }
        doc.text(line, margin, yPos);
        yPos += fontSize * 1.5;
      });
    };

    const addLine = () => {
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;
    };

    const addSpace = (height: number = 10) => { yPos += height; };

    // Header
    addText('Property Analysis Report', 24, true, '#1f2937');
    addText(formatDate(), 11, false, '#6b7280');
    addSpace(20);

    // Property Overview
    addText('Property Overview', 16, true, '#1f2937');
    addLine();
    addText(property.address, 18, true, '#1f2937');
    addText(`${property.city}, ${property.state} ${property.zip}`, 12, false, '#6b7280');
    addSpace(10);
    addText(formatCurrency(property.price), 22, true, '#16a34a');
    addSpace(15);

    // Property Details Grid
    doc.setFontSize(10); doc.setTextColor(107, 114, 128);
    doc.text('Bedrooms', margin, yPos);
    doc.text('Bathrooms', margin + contentWidth / 4, yPos);
    doc.text('Square Feet', margin + contentWidth / 2, yPos);
    doc.text('Price/Sqft', margin + (contentWidth * 3) / 4, yPos);
    yPos += 20;

    doc.setFontSize(14); doc.setTextColor(31, 41, 55); doc.setFont('helvetica', 'bold');
    doc.text(property.beds.toString(), margin, yPos);
    doc.text(property.baths.toString(), margin + contentWidth / 4, yPos);
    doc.text(property.sqft.toLocaleString(), margin + contentWidth / 2, yPos);
    doc.text(formatCurrency(property.price / property.sqft), margin + (contentWidth * 3) / 4, yPos);
    yPos += 30;

    // Investment Analysis
    if (property.arv || property.rehab_cost || property.roi_percent) {
      addText('Investment Analysis', 16, true, '#1f2937');
      addLine();
      const addRow = (label: string, value: string, color = '#1f2937') => {
        doc.setFontSize(11); doc.setTextColor(75, 85, 99); doc.setFont('helvetica', 'normal');
        doc.text(label, margin, yPos);
        doc.setFont('helvetica', 'bold');
        const rgb = hexToRgb(color);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.text(value, pageWidth - margin, yPos, { align: 'right' });
        yPos += 20;
      };
      if (property.arv) addRow('After Repair Value (ARV)', formatCurrency(property.arv));
      if (property.rehab_cost) addRow('Estimated Rehab Cost', formatCurrency(property.rehab_cost));
      if (property.roi_percent) addRow('Estimated ROI', `${property.roi_percent}%`, '#16a34a');
      if (property.year_built) addRow('Year Built', property.year_built.toString());
      if (property.lot_size) addRow('Lot Size', `${property.lot_size.toLocaleString()} sqft`);
      addSpace(20);
    }

    // Price Fairness
    if (priceFairness) {
      addText('Price Fairness Analysis', 16, true, '#1f2937');
      addLine();
      const fairnessColor = priceFairness.level === 'excellent' ? '#16a34a' : priceFairness.level === 'good' ? '#84cc16' : priceFairness.level === 'fair' ? '#eab308' : '#ef4444';
      doc.setFontSize(10); doc.setTextColor(107, 114, 128); doc.setFont('helvetica', 'normal');
      doc.text('Rating', margin, yPos); yPos += 15;
      doc.setFontSize(14); const rgb = hexToRgb(fairnessColor);
      doc.setTextColor(rgb.r, rgb.g, rgb.b); doc.setFont('helvetica', 'bold');
      doc.text(priceFairness.level.toUpperCase(), margin, yPos); yPos += 25;
      addText(priceFairness.description, 10, false, '#374151');
      addSpace(10);

      doc.setFontSize(11); doc.setTextColor(75, 85, 99); doc.setFont('helvetica', 'normal');
      doc.text('Market Average Price/Sqft', margin, yPos);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55);
      doc.text(formatCurrency(priceFairness.marketAverage), pageWidth - margin, yPos, { align: 'right' }); yPos += 20;

      doc.setFont('helvetica', 'normal'); doc.setTextColor(75, 85, 99);
      doc.text('This Property Price/Sqft', margin, yPos);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 41, 55);
      doc.text(formatCurrency(priceFairness.pricePerSqft), pageWidth - margin, yPos, { align: 'right' }); yPos += 20;

      doc.setFont('helvetica', 'normal'); doc.setTextColor(75, 85, 99);
      doc.text('Difference from Market', margin, yPos);
      doc.setFont('helvetica', 'bold');
      const diffColor = priceFairness.percentDifference < 0 ? hexToRgb('#16a34a') : hexToRgb('#ef4444');
      doc.setTextColor(diffColor.r, diffColor.g, diffColor.b);
      doc.text(`${priceFairness.percentDifference > 0 ? '+' : ''}${priceFairness.percentDifference.toFixed(1)}%`, pageWidth - margin, yPos, { align: 'right' }); yPos += 30;
    }

    // AI Analysis
    if (analysis) {
      if (yPos > 600) { doc.addPage(); yPos = 60; }
      addText('AI Investment Analysis', 16, true, '#1f2937');
      addLine();
      addText(analysis, 11, false, '#374151');
      addSpace(20);
    }

    // Neighborhood
    if (neighborhoodSummary) {
      if (yPos > 600) { doc.addPage(); yPos = 60; }
      addText('Neighborhood Personality', 16, true, '#1f2937');
      addLine();
      addText(neighborhoodSummary, 11, false, '#374151');
      addSpace(20);
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    doc.setPage(pageCount);
    doc.setFontSize(8); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'italic');
    const footerText = 'This report was generated by HomeLens and is for informational purposes only. Data and analysis are subject to change.';
    const footerLines = doc.splitTextToSize(footerText, contentWidth);
    let footerY = 750;
    footerLines.forEach((line: string) => { doc.text(line, pageWidth / 2, footerY, { align: 'center' }); footerY += 10; });

    const pdfOutput = doc.output('arraybuffer');
    log.step('PDF generated successfully');

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="property-${property.id}-report.pdf"`
      }
    });

  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
