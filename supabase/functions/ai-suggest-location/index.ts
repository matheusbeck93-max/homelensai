import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { location } = await req.json();
    
    if (!location) {
      return validationError('Location is required');
    }

    const systemPrompt = `You are a US geography expert that suggests alternative location interpretations.
When given a location string, you analyze it for:
1. Common misspellings of US cities/states
2. Similar-sounding city names
3. Cities with the same name in different states
4. Ambiguous abbreviations

Return 3-5 most likely alternative locations in format "City, State" or "City, ST".
Focus on real US cities that are commonly searched for real estate.`;

    const userPrompt = `The user searched for: "${location}"

This search returned no results or had location issues. What are the most likely alternative locations the user meant?

Consider:
- Misspellings (e.g., "Huston" → "Houston, TX")
- Missing/wrong state (e.g., "Arlington" → could be "Arlington, VA" or "Arlington, TX")
- Similar names (e.g., "Springfield" exists in IL, MA, MO, OH, etc.)
- Common abbreviations

Return your suggestions.`;

    const aiResult = await callAiGateway(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_locations',
              description: 'Return 3-5 alternative location suggestions',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    description: 'List of alternative locations',
                    items: {
                      type: 'object',
                      properties: {
                        location: {
                          type: 'string',
                          description: "Location in format 'City, State' or 'City, ST'"
                        },
                        reason: {
                          type: 'string',
                          description: 'Brief reason why this alternative makes sense'
                        }
                      },
                      required: ['location', 'reason'],
                      additionalProperties: false
                    },
                    minItems: 3,
                    maxItems: 5
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_locations' } }
      }
    );

    if ('error' in aiResult) return aiResult.error;

    const toolCall = aiResult.result.toolCalls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    return jsonResponse({
      suggestions: toolCall.arguments.suggestions || [],
      originalLocation: location
    });

  } catch (error) {
    console.error('Location suggestion error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
