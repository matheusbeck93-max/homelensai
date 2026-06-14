/**
 * Convert open-house listings to UIBlock PropertyCard payloads consumed
 * by the chat renderer in the web app and the Chrome extension popup.
 */

import type { OpenHouseListing } from './types.ts';

export interface UiBlockCard {
  type: 'property_card';
  id: string;
  address: string;
  cityState: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number | null;
  photo?: string | null;
  listingUrl: string;
  openHouseLabel: string;
  source: string;
}

function formatOpenHouseLabel(events: OpenHouseListing['openHouses']): string {
  if (events.length === 0) return 'Open house';
  const next = [...events].sort((a, b) => a.start.localeCompare(b.start))[0];
  const start = new Date(next.start);
  const end = new Date(next.end);
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return `Open ${day} ${t(start)}–${t(end)}`;
}

export function formatListingsAsCards(listings: OpenHouseListing[]): UiBlockCard[] {
  return listings.map((l) => ({
    type: 'property_card',
    id: l.id,
    address: l.address,
    cityState: `${l.city}, ${l.state}`,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft ?? null,
    photo: l.photo ?? null,
    listingUrl: l.listingUrl,
    openHouseLabel: formatOpenHouseLabel(l.openHouses),
    source: l.source,
  }));
}
