/**
 * Fetch with timeout. Aborts the request if it exceeds the given milliseconds.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry a function with exponential backoff.
 * Only retries on transient errors (5xx, network errors).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error.name === 'TypeError' || // network error
        (error.status && error.status >= 500);

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 5000);
      console.log(`[retry] attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
