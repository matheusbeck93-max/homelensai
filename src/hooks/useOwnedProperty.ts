import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedProperty } from '@/lib/myProperties/types';
import {
  computeEquity,
  computeAppreciation,
  computeMonthlyCashFlow,
  computeCapRate,
  computeReturnsDecomposition,
  computeCurrentLoanBalance,
  type RentalDetail,
} from '@/lib/myProperties/computeMetrics';

export interface OwnedPropertyDetailData {
  property: OwnedProperty;
  rental: RentalDetail | null;
  photos: Array<{ id: string; url: string; caption: string | null; ordinal: number }>;
  improvements: Array<{
    id: string;
    description: string;
    cost: number;
    improvement_date: string;
    category: string | null;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    event_date: string;
    note: string | null;
    details: any;
  }>;
  valuations: Array<{
    id: string;
    value: number;
    source: string;
    observed_at: string;
    confidence_low: number | null;
    confidence_high: number | null;
    note: string | null;
  }>;
  alerts: Array<{
    id: string;
    alert_type: string;
    severity: string;
    title: string;
    description: string;
    status: string;
    surfaced_at: string;
  }>;
  documents: Array<{
    id: string;
    document_type: string;
    filename: string;
    storage_path: string;
    uploaded_at: string;
    size_bytes: number | null;
    mime_type: string | null;
    note: string | null;
  }>;
  metrics: {
    currentValue: number;
    loanBalance: number;
    equity: number;
    equityPct: number;
    appreciation: number;
    appreciationPct: number;
    monthlyCashFlow: number;
    capRate: number | null;
    returns: ReturnType<typeof computeReturnsDecomposition>;
  };
}

export function useOwnedProperty(propertyId: string | undefined) {
  const [data, setData] = useState<OwnedPropertyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    const { data: prop, error: e1 } = await (supabase as any)
      .from('investor_owned_properties')
      .select('*')
      .eq('id', propertyId)
      .maybeSingle();
    if (e1 || !prop) {
      setError(e1?.message ?? 'Property not found');
      setLoading(false);
      return;
    }
    // Resolve signed URL for private-bucket cover image (stored as raw path)
    if (prop.primary_photo_url && !/^https?:\/\//i.test(prop.primary_photo_url)) {
      const { data: signed } = await (supabase as any).storage
        .from('owned-property-photos')
        .createSignedUrl(prop.primary_photo_url, 60 * 60);
      if (signed?.signedUrl) prop.primary_photo_url = signed.signedUrl;
    }
    const [rental, photos, improvements, events, valuations, alerts, documents] =
      await Promise.all([
        (supabase as any)
          .from('investor_owned_property_rental')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle(),
        (supabase as any)
          .from('investor_owned_property_photos')
          .select('*')
          .eq('property_id', propertyId)
          .order('ordinal'),
        (supabase as any)
          .from('investor_owned_property_improvements')
          .select('*')
          .eq('property_id', propertyId)
          .order('improvement_date', { ascending: false }),
        (supabase as any)
          .from('investor_owned_property_events')
          .select('*')
          .eq('property_id', propertyId)
          .order('event_date', { ascending: false }),
        (supabase as any)
          .from('investor_owned_property_valuations')
          .select('*')
          .eq('property_id', propertyId)
          .order('observed_at', { ascending: false })
          .limit(20),
        (supabase as any)
          .from('investor_owned_property_alerts')
          .select('*')
          .eq('property_id', propertyId)
          .eq('status', 'active')
          .order('surfaced_at', { ascending: false }),
        (supabase as any)
          .from('investor_owned_property_documents')
          .select('*')
          .eq('property_id', propertyId)
          .order('uploaded_at', { ascending: false }),
      ]);

    const rentalRow = rental.data ?? null;
    const eq = computeEquity(prop);
    const app = computeAppreciation(prop);

    setData({
      property: prop,
      rental: rentalRow,
      photos: photos.data ?? [],
      improvements: improvements.data ?? [],
      events: events.data ?? [],
      valuations: valuations.data ?? [],
      alerts: alerts.data ?? [],
      documents: documents.data ?? [],
      metrics: {
        currentValue: eq.currentValue,
        loanBalance: computeCurrentLoanBalance(prop),
        equity: eq.equity,
        equityPct: eq.equityPct,
        appreciation: app.absolute,
        appreciationPct: app.pct,
        monthlyCashFlow: computeMonthlyCashFlow(prop, rentalRow),
        capRate: computeCapRate(prop, rentalRow),
        returns: computeReturnsDecomposition(prop, rentalRow),
      },
    });
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}