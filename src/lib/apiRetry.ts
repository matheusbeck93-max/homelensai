/**
 * Retry utility with exponential backoff for API calls
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === finalConfig.maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.initialDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelayMs
      );
      
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}
