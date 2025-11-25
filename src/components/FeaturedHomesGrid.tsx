import { useState } from 'react';
import { HomeLensListing } from '@/types/ui-blocks';
import { FeaturedPropertyCard } from './FeaturedPropertyCard';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { PropertyGridMap } from './PropertyGridMap';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';

interface FeaturedHomesGridProps {
  title?: string;
  subtitle?: string;
  listings: HomeLensListing[];
  isLoading: boolean;
  error?: string | null;
  hasMore?: boolean;
  onSetArea?: () => void;
  onLoadMore?: () => void;
  onAnalyze?: (property: HomeLensListing) => void;
}

export function FeaturedHomesGrid({
  title = "Featured Homes",
  subtitle = "Handpicked properties in popular markets",
  listings,
  isLoading,
  error,
  hasMore = false,
  onSetArea,
  onLoadMore,
  onAnalyze
}: FeaturedHomesGridProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  return (
    <section id="featured-homes" className="w-full max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {onSetArea && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSetArea}
            >
              Set your area
            </Button>
          )}
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'list' | 'map')}>
            <ToggleGroupItem value="list">List</ToggleGroupItem>
            <ToggleGroupItem value="map">Map</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            We're having trouble loading featured homes. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && listings.length === 0 ? (
        <div className="grid gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 && !error ? (
        <div className="text-center py-12 text-muted-foreground">
          No featured homes available right now in this area.
        </div>
      ) : viewMode === 'list' ? (
        <>
          <div className="grid gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((property) => (
              <FeaturedPropertyCard
                key={property.id}
                property={property}
                onAnalyze={onAnalyze}
              />
            ))}
          </div>
          {hasMore && onLoadMore && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Show more homes'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="h-[600px] rounded-lg overflow-hidden border">
          <PropertyGridMap
            properties={listings}
            onPropertyClick={(property) => {
              if (onAnalyze) {
                onAnalyze(property);
              }
            }}
          />
        </div>
      )}
    </section>
  );
}
