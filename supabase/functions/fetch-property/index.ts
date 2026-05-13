import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('fetch-property');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { url } = await req.json();
    const FIRECRAWL_API_KEY = requireEnv('FIRECRAWL_API_KEY');
    
    if (!url) {
      return validationError('URL is required');
    }

    // Validate URL is a valid HTTP(S) URL
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return validationError('Please provide a valid HTTP or HTTPS URL');
      }
    } catch (e) {
      if (e instanceof TypeError) {
        return validationError('Please provide a valid URL');
      }
      throw e;
    }

    log.step('Fetching property data from URL');
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 5000
      })
    });
    
    if (!firecrawlResponse.ok) {
      log.error('Firecrawl error:', firecrawlResponse.status);
      throw new Error(`Firecrawl failed: ${firecrawlResponse.status}`);
    }
    
    const firecrawlData = await firecrawlResponse.json();
    log.step('Firecrawl response received');
    
    const html = firecrawlData.data?.html || firecrawlData.html || '';
    const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || '';
    
    if (!html && !markdown) {
      throw new Error('No content received from Firecrawl');
    }
    
    let propertyData: any = {};
    const content = html || markdown;
    
    // Extract price
    const priceMatch = content.match(/\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/);
    if (priceMatch) propertyData.price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
    
    // Extract beds/baths/sqft
    const bedsMatch = content.match(/(\d+)\s*(?:bed|bd|bedroom)s?\b/i);
    const bathsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)s?\b/i);
    const sqftMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)(?!\s*lot)/i);
    
    if (bedsMatch) propertyData.beds = parseInt(bedsMatch[1]);
    if (bathsMatch) propertyData.baths = parseFloat(bathsMatch[1]);
    if (sqftMatch) propertyData.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
    
    // Extract address
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const fullAddress = h1Match[1].trim();
      propertyData.address = fullAddress;
      const locationMatch = fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
      if (locationMatch) {
        propertyData.city = locationMatch[1].trim();
        propertyData.state = locationMatch[2];
        propertyData.zip = locationMatch[3] || '';
      }
    }
    
    // Extract year built and lot size
    const yearMatch = content.match(/(?:built|year built)[:\s]*(\d{4})/i);
    if (yearMatch) propertyData.yearBuilt = parseInt(yearMatch[1]);
    
    const lotMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)\s*lot/i);
    if (lotMatch) propertyData.lotSize = parseInt(lotMatch[1].replace(/,/g, ''));
    
    log.step('Extracted property data');
    
    // Set defaults for missing data
    propertyData.address = propertyData.address || 'Property Address';
    propertyData.city = propertyData.city || 'City';
    propertyData.state = propertyData.state || 'ST';
    propertyData.zip = propertyData.zip || '00000';
    propertyData.price = propertyData.price || 0;
    propertyData.beds = propertyData.beds || 3;
    propertyData.baths = propertyData.baths || 2;
    propertyData.sqft = propertyData.sqft || 1500;
    propertyData.yearBuilt = propertyData.yearBuilt || 2000;
    propertyData.lotSize = propertyData.lotSize || 5000;

    return jsonResponse({ propertyData });
  } catch (error) {
    log.error('Error:', error);
    return errorResponse('Unable to fetch property data.', 500);
  }
});
