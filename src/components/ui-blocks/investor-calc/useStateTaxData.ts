import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FALLBACK_TAX_RATES, TaxDataResult } from './types';

export function useStateTaxData(stateCode: string, onRateUpdate: (rate: number) => void) {
  const [loading, setLoading] = useState(false);
  const [taxSource, setTaxSource] = useState<{ source: string; updatedAt: string } | null>(null);
  const prevState = useRef('');

  useEffect(() => {
    if (!stateCode || stateCode === prevState.current) return;
    prevState.current = stateCode;

    // Step 1: Immediate fallback
    const fallback = FALLBACK_TAX_RATES[stateCode];
    if (fallback !== undefined) {
      onRateUpdate(fallback);
    }

    // Step 2: Background fetch
    setLoading(true);
    setTaxSource(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    supabase.functions.invoke('get-state-tax-data', {
      body: { state: stateCode },
    }).then(({ data, error }) => {
      clearTimeout(timeout);
      setLoading(false);
      if (error || !data) return; // silently keep fallback
      const result = data as TaxDataResult;
      if (result.rate && result.rate > 0) {
        onRateUpdate(result.rate);
        setTaxSource({ source: result.source, updatedAt: result.updatedAt });
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
    };
  }, [stateCode]);

  return { loading, taxSource };
}
