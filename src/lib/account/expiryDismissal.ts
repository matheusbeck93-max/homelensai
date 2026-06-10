/**
 * Once-per-day dismissal helper for the credit-expiry banner.
 * Stored as `homelens:credit_expiry_dismissed:<yyyy-mm-dd>` in localStorage.
 * Auto-resets at the next calendar day (in the user's local timezone).
 */
const PREFIX = "homelens:credit_expiry_dismissed:";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${PREFIX}${y}-${m}-${day}`;
}

export function isExpiryDismissedToday(): boolean {
  try {
    return window.localStorage.getItem(todayKey()) === "1";
  } catch {
    return false;
  }
}

export function dismissExpiryToday(): void {
  try {
    // Clear yesterday's key(s) so storage doesn't accumulate.
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
    window.localStorage.setItem(todayKey(), "1");
  } catch {
    /* ignore */
  }
}