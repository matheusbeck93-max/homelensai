# "Did You Mean?" Location Suggestions Feature

## Overview

This feature uses Lovable AI to suggest alternative locations when a property search fails or returns no results due to ambiguous or misspelled city names.

## How It Works

1. **Trigger**: When a search returns 0 results or fails with a location-related error
2. **Analysis**: The `ai-suggest-location` edge function uses Lovable AI (Gemini 2.5 Flash) to analyze the input
3. **Suggestions**: AI returns 3-5 alternative location interpretations
4. **Display**: Clickable location chips appear below the error message
5. **Action**: Clicking a suggestion re-triggers the search with the corrected location

## Use Cases Handled

### 1. Misspellings
- Input: "Huston, Texas" → Suggests: "Houston, TX"
- Input: "Miama" → Suggests: "Miami, FL"
- Input: "Sandiego" → Suggests: "San Diego, CA"

### 2. Missing State Information
- Input: "Arlington" → Suggests: "Arlington, VA" and "Arlington, TX"
- Input: "Portland" → Suggests: "Portland, OR" and "Portland, ME"
- Input: "Springfield" → Suggests: "Springfield, IL", "Springfield, MA", "Springfield, MO"

### 3. Ambiguous Names
- Input: "Cambridge" → Suggests: "Cambridge, MA" and "Cambridge, OH"
- Input: "Manhattan" → Suggests: "Manhattan, NY" and "Manhattan, KS"

### 4. Abbreviation Issues
- Input: "LA" → Suggests: "Los Angeles, CA" and "Lafayette, LA"
- Input: "KC" → Suggests: "Kansas City, MO" and "Kansas City, KS"

## Testing

### Test Cases

1. **Misspelling Test**:
   ```
   Search: "I'm looking for homes in Huston, Texas"
   Expected: Should show "Did you mean: Houston, TX?"
   ```

2. **Ambiguous City Test**:
   ```
   Search: "show me houses in Springfield"
   Expected: Should show multiple Springfield options (IL, MA, MO, etc.)
   ```

3. **Wrong State Test**:
   ```
   Search: "condos in Miami, California"
   Expected: Should suggest "Miami, FL"
   ```

4. **Incomplete Location Test**:
   ```
   Search: "3 bedroom homes in Portland"
   Expected: Should suggest "Portland, OR" and "Portland, ME"
   ```

5. **Typo Test**:
   ```
   Search: "properties in Sandiego"
   Expected: Should suggest "San Diego, CA"
   ```

## Technical Implementation

### Backend (Edge Function)

**File**: `supabase/functions/ai-suggest-location/index.ts`

- Uses Lovable AI Gateway at `https://ai.gateway.lovable.dev/v1/chat/completions`
- Model: `google/gemini-2.5-flash` (fast and cost-effective)
- Uses tool calling to extract structured suggestions
- Returns array of `{location: string, reason: string}` objects

### Frontend Integration

**File**: `src/pages/Index.tsx`

Key functions:
- `fetchLocationSuggestions(location)`: Calls the edge function
- `handleLocationSuggestionClick(location)`: Re-triggers search with selected location
- State: `locationSuggestions` array

### UI Components

Location suggestions appear as:
- Clickable chips with primary color styling
- Hover effect for better UX
- Tooltip showing the AI's reasoning (title attribute)
- Clear call-to-action text

## Error Handling

The feature gracefully handles:
- AI rate limits (429): Fails silently, no suggestions shown
- AI payment required (402): Fails silently
- Network errors: Logs to console, no UI disruption
- No suggestions: Suggestions section doesn't appear

## Configuration

**Supabase Config** (`supabase/config.toml`):
```toml
[functions.ai-suggest-location]
verify_jwt = false
```

**Environment**: Uses `LOVABLE_API_KEY` (auto-configured by Lovable Cloud)

## Performance

- **Response Time**: ~1-2 seconds for AI suggestion generation
- **Cost**: ~$0.001 per request (Gemini Flash pricing)
- **Rate Limits**: Subject to workspace Lovable AI rate limits
- **Caching**: Not implemented (fresh suggestions per search failure)

## Future Enhancements

Possible improvements:
1. **Client-side caching**: Cache suggestions for common misspellings
2. **Fuzzy matching**: Pre-filter obvious typos before calling AI
3. **Analytics**: Track which suggestions users click most
4. **Expand scope**: Include ZIP code suggestions, neighborhood names
5. **Multi-language**: Support for Spanish city names (Los Angeles, San Antonio)

## Related Files

- `supabase/functions/ai-suggest-location/index.ts` - Edge function
- `src/pages/Index.tsx` - Main integration
- `src/utils/propertySearchHelpers.ts` - Search parser
- `supabase/config.toml` - Function configuration
