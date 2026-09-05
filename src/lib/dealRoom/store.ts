/**
 * Deal Room persistence.
 *
 * v1 persists rooms in localStorage under the browser profile. This keeps the
 * feature shippable without a schema change; rooms survive reloads and can be
 * re-opened by id. Signed-in users can still push the analysis into
 * `saved_analyses` with the existing Save control.
 */
import type { DealRoom } from "./types";

const KEY = "homelens.dealRooms.v1";
const MAX_ROOMS = 40;

function readAll(): DealRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DealRoom[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rooms: DealRoom[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rooms.slice(0, MAX_ROOMS)));
  } catch {
    /* quota / private mode — the room still works for this session */
  }
}

export function listDealRooms(): DealRoom[] {
  return readAll();
}

export function getDealRoom(id: string): DealRoom | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function findRoomByUrl(url: string): DealRoom | null {
  const normalized = url.trim();
  return readAll().find((r) => r.listingUrl === normalized) ?? null;
}

export function saveDealRoom(room: DealRoom): DealRoom {
  const next = { ...room, updatedAt: new Date().toISOString() };
  const rest = readAll().filter((r) => r.id !== next.id);
  writeAll([next, ...rest]);
  return next;
}

export function newRoomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}
