import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, GraduationCap, Coffee, ShoppingBag, Trees, Bus, Shield, Maximize2 } from "lucide-react";
import { NeighborhoodInsights } from "@/types/neighborhood";
import { supabase } from "@/integrations/supabase/client";

interface PropertyMapProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  insights?: NeighborhoodInsights;
}

interface MarkerConfig {
  coordinates: [number, number];
  color: string;
  icon: string;
  title: string;
  description?: string;
}

export function PropertyMap({ address, city, state, zip, insights }: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Geocode the address to get coordinates
  const geocodeAddress = async (fullAddress: string): Promise<[number, number] | null> => {
    try {
      // Get Mapbox token from edge function for security
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
      
      if (tokenError || !tokenData?.token) {
        console.error("Failed to get Mapbox token:", tokenError);
        return null;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json?access_token=${tokenData.token}`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].center as [number, number];
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    return null;
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      // Get Mapbox token from edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
      
      if (tokenError || !tokenData?.token) {
        console.error("Failed to get Mapbox token:", tokenError);
        return;
      }

      mapboxgl.accessToken = tokenData.token;

      const fullAddress = `${address}, ${city}, ${state} ${zip}`;
      const coordinates = await geocodeAddress(fullAddress);

      if (!coordinates) {
        console.error("Could not geocode address");
        return;
      }

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: coordinates,
        zoom: 14,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-right"
      );

      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

      // Add main property marker
      const propertyMarker = document.createElement("div");
      propertyMarker.className = "property-marker";
      propertyMarker.style.width = "40px";
      propertyMarker.style.height = "40px";
      propertyMarker.style.borderRadius = "50%";
      propertyMarker.style.backgroundColor = "hsl(var(--primary))";
      propertyMarker.style.border = "3px solid white";
      propertyMarker.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      propertyMarker.style.display = "flex";
      propertyMarker.style.alignItems = "center";
      propertyMarker.style.justifyContent = "center";
      propertyMarker.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;

      new mapboxgl.Marker(propertyMarker)
        .setLngLat(coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">Property Location</h3>
              <p style="font-size: 12px;">${address}</p>
            </div>`
          )
        )
        .addTo(map.current);

      map.current.on("load", () => {
        setMapLoaded(true);

        // Add crime heat map layer if insights available
        if (insights && map.current) {
          addCrimeHeatMap(map.current, coordinates, insights.crimeData.crimeRate);
        }

        // Add markers for schools and amenities
        if (insights && map.current) {
          addNeighborhoodMarkers(map.current, coordinates, insights);
        }
      });
    };

    initializeMap();

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [address, city, state, zip]);

  const addCrimeHeatMap = (mapInstance: mapboxgl.Map, center: [number, number], crimeRate: number) => {
    // Create a circle layer to represent crime density
    // Lower crime rate = less intense (green), higher = more intense (red)
    const radius = crimeRate < 30 ? 800 : crimeRate < 50 ? 1200 : 1500;
    const opacity = Math.min(0.4, crimeRate / 100);

    mapInstance.addSource("crime-heat", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: center,
            },
            properties: {
              crimeRate,
            },
          },
        ],
      },
    });

    mapInstance.addLayer({
      id: "crime-heat-layer",
      type: "circle",
      source: "crime-heat",
      paint: {
        "circle-radius": radius,
        "circle-color": crimeRate < 30 ? "#10b981" : crimeRate < 50 ? "#f59e0b" : "#ef4444",
        "circle-opacity": opacity,
        "circle-blur": 1,
      },
    });
  };

  const addNeighborhoodMarkers = (
    mapInstance: mapboxgl.Map,
    propertyCoords: [number, number],
    insights: NeighborhoodInsights
  ) => {
    // Helper to offset coordinates slightly for nearby markers
    const offsetCoordinates = (coords: [number, number], distanceMiles: number, angleDegrees: number): [number, number] => {
      const earthRadius = 3959; // miles
      const lat1 = (coords[1] * Math.PI) / 180;
      const lon1 = (coords[0] * Math.PI) / 180;
      const bearing = (angleDegrees * Math.PI) / 180;
      const distRad = distanceMiles / earthRadius;

      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distRad) + Math.cos(lat1) * Math.sin(distRad) * Math.cos(bearing));
      const lon2 =
        lon1 +
        Math.atan2(
          Math.sin(bearing) * Math.sin(distRad) * Math.cos(lat1),
          Math.cos(distRad) - Math.sin(lat1) * Math.sin(lat2)
        );

      return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
    };

    // Add school markers
    insights.schools.forEach((school, idx) => {
      const angle = (idx * 120) + 30; // Spread around property
      const coords = offsetCoordinates(propertyCoords, school.distance, angle);

      const el = createMarkerElement("#9333ea", "🎓");
      new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h4 style="font-weight: bold;">${school.name}</h4>
              <p style="font-size: 12px; margin: 4px 0;">Rating: ${school.rating}/10</p>
              <p style="font-size: 11px; color: #666;">${school.distance.toFixed(1)} mi • ${school.grades}</p>
            </div>`
          )
        )
        .addTo(mapInstance);
    });

    // Add restaurant markers
    insights.amenities.restaurants.slice(0, 3).forEach((amenity, idx) => {
      const angle = (idx * 90) + 180;
      const coords = offsetCoordinates(propertyCoords, amenity.distance, angle);

      const el = createMarkerElement("#f59e0b", "☕");
      new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h4 style="font-weight: bold;">${amenity.name}</h4>
              <p style="font-size: 12px;">${amenity.type}</p>
              <p style="font-size: 11px; color: #666;">${amenity.distance.toFixed(1)} mi away</p>
            </div>`
          )
        )
        .addTo(mapInstance);
    });

    // Add park markers
    insights.amenities.parks.forEach((amenity, idx) => {
      const angle = (idx * 120) + 240;
      const coords = offsetCoordinates(propertyCoords, amenity.distance, angle);

      const el = createMarkerElement("#10b981", "🌳");
      new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h4 style="font-weight: bold;">${amenity.name}</h4>
              <p style="font-size: 12px;">${amenity.type}</p>
              <p style="font-size: 11px; color: #666;">${amenity.distance.toFixed(1)} mi away</p>
            </div>`
          )
        )
        .addTo(mapInstance);
    });

    // Add transit markers
    insights.amenities.transit.forEach((amenity, idx) => {
      const angle = (idx * 180) + 90;
      const coords = offsetCoordinates(propertyCoords, amenity.distance, angle);

      const el = createMarkerElement("#3b82f6", "🚌");
      new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h4 style="font-weight: bold;">${amenity.name}</h4>
              <p style="font-size: 12px;">${amenity.type}</p>
              <p style="font-size: 11px; color: #666;">${amenity.distance.toFixed(1)} mi away</p>
            </div>`
          )
        )
        .addTo(mapInstance);
    });
  };

  const createMarkerElement = (color: string, emoji: string): HTMLDivElement => {
    const el = document.createElement("div");
    el.style.width = "30px";
    el.style.height = "30px";
    el.style.borderRadius = "50%";
    el.style.backgroundColor = color;
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "16px";
    el.style.cursor = "pointer";
    el.textContent = emoji;
    return el;
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <div
          ref={mapContainer}
          className="w-full"
          style={{ height: isFullscreen ? "80vh" : "500px" }}
        />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg text-xs space-y-1.5">
          <div className="font-semibold mb-2 flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            Map Legend
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary border-2 border-white flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <span>Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-600 border-2 border-white flex items-center justify-center text-sm">
              🎓
            </div>
            <span>Schools</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-600 border-2 border-white flex items-center justify-center text-sm">
              ☕
            </div>
            <span>Dining</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-600 border-2 border-white flex items-center justify-center text-sm">
              🌳
            </div>
            <span>Parks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-sm">
              🚌
            </div>
            <span>Transit</span>
          </div>
          {insights && (
            <>
              <div className="border-t pt-1.5 mt-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="font-medium">Crime Heat Map</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      insights.crimeData.crimeRate < 30
                        ? "bg-green-600"
                        : insights.crimeData.crimeRate < 50
                        ? "bg-amber-600"
                        : "bg-red-600"
                    }`}
                  />
                  <span>{insights.crimeData.overallRating}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
