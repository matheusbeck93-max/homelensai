import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { HomeLensListing } from "@/types/ui-blocks";
import { supabase } from "@/integrations/supabase/client";

interface PropertyGridMapProps {
  properties: HomeLensListing[];
  onPropertyClick?: (property: HomeLensListing) => void;
}

export function PropertyGridMap({ properties, onPropertyClick }: PropertyGridMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || properties.length === 0) return;

    const initializeMap = async () => {
      try {
        // Get Mapbox token from edge function
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        
        if (tokenError || !tokenData?.token) {
          console.error("Failed to get Mapbox token:", tokenError);
          return;
        }

        mapboxgl.accessToken = tokenData.token;

        // Calculate center from properties with coordinates
        const validProperties = properties.filter(p => p.lat && p.lng);
        if (validProperties.length === 0) {
          console.warn("No properties with coordinates");
          return;
        }

        const avgLat = validProperties.reduce((sum, p) => sum + (p.lat || 0), 0) / validProperties.length;
        const avgLng = validProperties.reduce((sum, p) => sum + (p.lng || 0), 0) / validProperties.length;

        // Initialize map
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [avgLng, avgLat],
          zoom: 11,
        });

        // Add navigation controls
        map.current.addControl(
          new mapboxgl.NavigationControl({
            visualizePitch: true,
          }),
          "top-right"
        );

        map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

        // Add markers for each property
        map.current.on("load", () => {
          validProperties.forEach((property) => {
            if (!property.lat || !property.lng || !map.current) return;

            const el = document.createElement("div");
            el.className = "property-marker";
            el.style.width = "32px";
            el.style.height = "32px";
            el.style.borderRadius = "50%";
            el.style.backgroundColor = "hsl(var(--primary))";
            el.style.border = "2px solid white";
            el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.style.cursor = "pointer";
            el.style.fontSize = "14px";
            el.style.fontWeight = "bold";
            el.style.color = "white";
            el.textContent = property.price 
              ? `$${Math.round(property.price / 1000)}k`
              : "?";

            const marker = new mapboxgl.Marker(el)
              .setLngLat([property.lng, property.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(
                  `<div style="padding: 8px; min-width: 200px;">
                    ${property.photoUrl ? `<img src="${property.photoUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />` : ''}
                    <h4 style="font-weight: bold; margin-bottom: 4px;">${property.price ? `$${property.price.toLocaleString()}` : 'Price N/A'}</h4>
                    <p style="font-size: 12px; margin-bottom: 4px;">${property.address}</p>
                    <p style="font-size: 11px; color: #666;">${property.beds || '?'} beds • ${property.baths || '?'} baths • ${property.sqft ? `${property.sqft.toLocaleString()} sqft` : 'Size N/A'}</p>
                  </div>`
                )
              )
              .addTo(map.current);

            if (onPropertyClick) {
              el.addEventListener('click', () => {
                onPropertyClick(property);
              });
            }

            markers.current.push(marker);
          });

          // Fit bounds to show all properties
          if (validProperties.length > 1) {
            const bounds = new mapboxgl.LngLatBounds();
            validProperties.forEach(p => {
              if (p.lat && p.lng) {
                bounds.extend([p.lng, p.lat]);
              }
            });
            map.current?.fitBounds(bounds, { padding: 50 });
          }
        });
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [properties]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
