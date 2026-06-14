import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import type { OpenHouseListing } from '@/types/openHouses';

interface Props {
  listings: OpenHouseListing[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function OpenHouseMap({ listings, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // Fetch Mapbox token from secrets-aware edge function (existing helper).
  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke('get-mapbox-token').then(({ data }) => {
      if (!cancelled && data?.token) setToken(data.token as string);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !container.current || map.current) return;
    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-98.5, 39.5],
      zoom: 3,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, [token]);

  // Sync markers when listings change.
  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const pts: [number, number][] = [];
    for (const l of listings) {
      if (l.lat == null || l.lng == null) continue;
      const el = document.createElement('div');
      el.style.cssText =
        'width:28px;height:28px;border-radius:50%;background:#6B8DB5;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;';
      el.textContent = '$';
      if (l.id === selectedId) {
        el.style.background = '#2C3E55';
        el.style.transform = 'scale(1.15)';
      }
      const marker = new mapboxgl.Marker(el)
        .setLngLat([l.lng, l.lat])
        .addTo(map.current!);
      el.addEventListener('click', () => onSelect?.(l.id));
      markers.current.push(marker);
      pts.push([l.lng, l.lat]);
    }

    if (pts.length === 1) {
      map.current.flyTo({ center: pts[0], zoom: 13 });
    } else if (pts.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      pts.forEach((p) => bounds.extend(p));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
    }
  }, [listings, selectedId, onSelect]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border">
      <div ref={container} className="absolute inset-0" />
      {!token && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}
