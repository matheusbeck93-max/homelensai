/**
 * Unified Rate Limiting Utility (Client-Side)
 * Consolidates rate limiting logic into a single source of truth
 * Used by featured homes, property search, and other API-heavy features
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  storageKey: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  resetIn: number; // milliseconds until reset
}

/**
 * Check if a request is within rate limits
 * Uses localStorage for client-side rate limiting
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, storageKey } = config;
  const now = Date.now();

  try {
    // Get current rate limit entry
    const stored = localStorage.getItem(storageKey);
    let entry: RateLimitEntry | null = null;

    if (stored) {
      entry = JSON.parse(stored);
    }

    // Clean up if reset time has passed
    if (entry && now > entry.resetTime) {
      entry = null;
      localStorage.removeItem(storageKey);
    }

    // No existing entry - first request
    if (!entry) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      localStorage.setItem(storageKey, JSON.stringify(newEntry));
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: newEntry.resetTime,
        resetIn: windowMs,
      };
    }

    // Check if rate limit exceeded
    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        resetIn: entry.resetTime - now,
      };
    }

    // Increment count
    entry.count++;
    localStorage.setItem(storageKey, JSON.stringify(entry));

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime,
      resetIn: entry.resetTime - now,
    };
  } catch (error) {
    console.warn('Rate limit check error:', error);
    // On error, allow the request but return conservative limits
    return {
      allowed: true,
      remaining: 0,
      resetTime: now + windowMs,
      resetIn: windowMs,
    };
  }
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Rate limit reset error:', error);
  }
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, storageKey } = config;
  const now = Date.now();

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        resetIn: windowMs,
      };
    }

    const entry: RateLimitEntry = JSON.parse(stored);

    // Check if reset time has passed
    if (now > entry.resetTime) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        resetIn: windowMs,
      };
    }

    return {
      allowed: entry.count < maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
      resetIn: entry.resetTime - now,
    };
  } catch (error) {
    console.warn('Rate limit status check error:', error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowMs,
      resetIn: windowMs,
    };
  }
}
