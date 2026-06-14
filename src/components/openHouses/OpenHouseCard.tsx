import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import type { OpenHouseListing } from '@/types/openHouses';

function formatOpenHouseLabel(listing: OpenHouseListing): string {
  if (listing.openHouses.length === 0) return 'Open house — time TBD';
  const next = [...listing.openHouses].sort((a, b) => a.start.localeCompare(b.start))[0];
  const start = new Date(next.start);
  const end = new Date(next.end);
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return `${day} · ${t(start)}–${t(end)}`;
}

interface Props {
  listing: OpenHouseListing;
  onClick?: () => void;
  selected?: boolean;
}

export function OpenHouseCard({ listing, onClick, selected }: Props) {
  return (
    <Card
      onClick={onClick}
      className={`overflow-hidden cursor-pointer transition-all hover:shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex gap-3 p-3">
        <div className="h-24 w-32 shrink-0 rounded-md bg-muted overflow-hidden">
          {listing.photo ? (
            <img
              src={listing.photo}
              alt={listing.address}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <MapPin className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Badge variant="secondary" className="mb-1 gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            {formatOpenHouseLabel(listing)}
          </Badge>
          <p className="font-bold text-lg text-foreground">${listing.price.toLocaleString('en-US')}</p>
          <p className="text-sm text-foreground line-clamp-1">{listing.address}</p>
          <p className="text-xs text-muted-foreground">
            {listing.city}, {listing.state} · {listing.beds} bd · {listing.baths} ba
            {listing.sqft ? ` · ${listing.sqft.toLocaleString('en-US')} sqft` : ''}
          </p>
          {listing.listingUrl ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs gap-1"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                Listing on {listing.source}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
