/**
 * Reusable API Caching Utility
 * Provides localStorage-based caching with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

interface CacheOptions {
  ttlMs: number; // Time-to-live in milliseconds
  keyPrefix?: string;
}

/**
 * Get cached data from localStorage
 */
export function getCachedData<T>(
  cacheKey: string,
  options: CacheOptions
): CacheEntry<T> | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    return entry;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Check if cached data is still valid
 */
export function isCacheValid<T>(
  entry: CacheEntry<T> | null,
  ttlMs: number
): boolean {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < ttlMs;
}

/**
 * Set cached data in localStorage
 */
export function setCachedData<T>(
  cacheKey: string,
  data: T
): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      key: cacheKey,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    console.warn('Cache write error:', error);
  }
}

/**
 * Clear cached data
 */
export function clearCachedData(cacheKey: string): void {
  try {
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Clear all cached data with a specific prefix
 */
export function clearCachedDataByPrefix(prefix: string): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Cache clear by prefix error:', error);
  }
}
