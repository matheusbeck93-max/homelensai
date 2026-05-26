/**
 * Normalize a freeform location string into "City, ST" format.
 * Examples:
 *   "  las vegas , nv  " -> "Las Vegas, NV"
 *   "saint augustine, fl" -> "Saint Augustine, FL"
 *   "Tampa,fl" -> "Tampa, FL"
 */
export function normalizeLocation(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  // Find the LAST comma — city can have commas in rare cases (neighborhood, city, ST)
  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma < 0) return titleCase(trimmed);
  const head = trimmed.slice(0, lastComma).trim();
  const tail = trimmed.slice(lastComma + 1).trim();
  const city = titleCase(head);
  const state = tail.length === 2 ? tail.toUpperCase() : titleCase(tail);
  return `${city}, ${state}`;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) =>
      w
        .split('-')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
        .join('-'),
    )
    .join(' ');
}

/**
 * Validate "City, ST" or "Neighborhood, City, ST".
 * City names may include spaces, hyphens, apostrophes and periods.
 * State must be either a 2-letter code or full state name.
 */
export function isValidLocation(s: string): boolean {
  return /^[\p{L}\s.'-]+(?:,\s*[\p{L}\s.'-]+)*,\s*([A-Z]{2}|[\p{L}][\p{L}\s]+)$/u.test(
    s.trim(),
  );
}

/** Case-insensitive dedupe preserving order. */
export function dedupeLocations(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}