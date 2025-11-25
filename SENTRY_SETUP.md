# Sentry Error Monitoring Setup

HomeLens is now integrated with Sentry for production error monitoring. This tracks:
- 429 rate limit errors
- API failures (4xx, 5xx)
- Component crashes caught by ErrorBoundary
- Validation errors

## Setup Instructions

### 1. Create a Sentry Account

1. Go to https://sentry.io/ and sign up for free
2. Create a new project and select "React" as the platform
3. Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

### 2. Configure Your Environment

Add your Sentry DSN as a secret in Lovable Cloud:

1. Go to your project settings in Lovable
2. Navigate to Secrets/Environment Variables
3. Add: `VITE_SENTRY_DSN` with your DSN value

**Note:** Sentry only initializes in production builds, not during development.

### 3. Test Your Setup

After deploying to production:

1. Open your production app
2. Trigger an error (e.g., make 31 searches in 60 seconds to hit rate limit)
3. Check Sentry dashboard to see the error logged

## What Gets Tracked?

### Rate Limit Errors (429)
- Endpoint: `search-listings` or `enrich-property`
- Tags: `error_type: rate_limit`, `endpoint: <name>`
- Extra data: `retryAfter`, `timestamp`

### API Failures
- Any 4xx/5xx response from edge functions
- Tags: `error_type: api_failure`, `endpoint: <name>`, `status_code: <code>`
- Extra data: `errorMessage`, `timestamp`, request context

### Validation Errors (400)
- Invalid input parameters
- Tags: `error_type: validation`, `endpoint: <name>`
- Extra data: `validationErrors`, `timestamp`

### Component Crashes
- Any unhandled React component error
- Tags: `error_type: component_crash`
- Extra data: React `componentStack`

## Session Replay

Sentry is configured to capture:
- 10% of all user sessions
- 100% of sessions with errors

This helps you visually reproduce user issues.

## Performance Monitoring

- 10% of transactions are sampled for performance tracking
- Helps identify slow API calls and render bottlenecks

## Privacy & Data

- Only errors and session metadata are sent to Sentry
- No sensitive user data (passwords, tokens) is transmitted
- Errors from `localhost` are filtered out automatically

## Sentry Dashboard Features

- **Issues**: View all tracked errors grouped by type
- **Performance**: API response times and page load metrics
- **Session Replay**: Watch video replays of user sessions with errors
- **Releases**: Track errors by deployment version
- **Alerts**: Get notified when error rates spike

## Best Practices

1. **Set User Context**: When users sign in, set their context:
   ```typescript
   import { setUserContext } from '@/lib/sentry';
   setUserContext(user.id, user.email);
   ```

2. **Clear Context on Logout**:
   ```typescript
   import { clearUserContext } from '@/lib/sentry';
   clearUserContext();
   ```

3. **Monitor Alerts**: Set up Sentry alerts for:
   - New error types
   - Spike in error rate (>10 errors/min)
   - Critical component crashes

4. **Review Weekly**: Check Sentry dashboard weekly to identify patterns

## Cost

Sentry offers a generous free tier:
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 session replays/month

This should be sufficient for most small-to-medium applications.

## Troubleshooting

### Sentry Not Logging Errors

1. Verify `VITE_SENTRY_DSN` is set correctly
2. Check that you're testing in **production mode** (not dev)
3. Open browser console and look for Sentry initialization logs
4. Verify DSN is valid in Sentry dashboard

### Too Many Events

If you hit your quota, adjust sampling rates in `src/lib/sentry.ts`:
- Lower `tracesSampleRate` (default: 0.1)
- Lower `replaysSessionSampleRate` (default: 0.1)

## Support

For Sentry-specific issues, visit:
- Docs: https://docs.sentry.io/
- Support: https://sentry.io/support/
