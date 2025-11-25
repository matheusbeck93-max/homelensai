import * as Sentry from "@sentry/react";

export function initSentry() {
  // Only initialize in production
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      environment: import.meta.env.MODE,
      
      beforeSend(event, hint) {
        // Filter out development errors
        if (window.location.hostname === 'localhost') {
          return null;
        }
        return event;
      },
    });
  }
}

// Custom error tracking helpers
export function trackRateLimitError(endpoint: string, retryAfter: number) {
  Sentry.captureException(new Error(`Rate limit exceeded on ${endpoint}`), {
    tags: {
      error_type: 'rate_limit',
      endpoint,
    },
    extra: {
      retryAfter,
      timestamp: new Date().toISOString(),
    },
    level: 'warning',
  });
}

export function trackApiError(
  endpoint: string,
  statusCode: number,
  errorMessage: string,
  context?: Record<string, any>
) {
  Sentry.captureException(new Error(`API Error: ${endpoint} - ${errorMessage}`), {
    tags: {
      error_type: 'api_failure',
      endpoint,
      status_code: statusCode,
    },
    extra: {
      errorMessage,
      timestamp: new Date().toISOString(),
      ...context,
    },
    level: statusCode >= 500 ? 'error' : 'warning',
  });
}

export function trackValidationError(
  endpoint: string,
  validationErrors: any[]
) {
  Sentry.captureException(new Error(`Validation Error: ${endpoint}`), {
    tags: {
      error_type: 'validation',
      endpoint,
    },
    extra: {
      validationErrors,
      timestamp: new Date().toISOString(),
    },
    level: 'info',
  });
}

export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}
