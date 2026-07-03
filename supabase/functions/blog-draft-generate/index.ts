import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUserProfile } from '../_shared/auth.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await getAuthenticatedUserProfile(req);
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!auth.profile?.is_staff) {
      return new Response(JSON.stringify({ error: 'Forbidden — staff only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: 'draft' | 'improve' | 'title' | 'excerpt' = body.action || 'draft';
    const topic: string = (body.topic || body.text || '').toString().slice(0, 4000);
    const tone: string = (body.tone || 'professional, clear, data-informed').toString().slice(0, 200);
    const length: string = (body.length || 'medium').toString();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Missing topic/text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemBase = `You are a senior editor for HomeLens, a US real estate decision platform. You write for buyers and small investors. Scope is strictly US residential real estate (market trends, mortgage rates, taxes, neighborhoods, investment strategy, regulation). Refuse off-topic requests. Cite institutions (FRED, BLS, Census, NAR) when you reference data. Never invent specific statistics — if you don't know a number, describe the trend qualitatively.`;

    let userPrompt = '';
    let asJson = false;

    if (action === 'draft') {
      asJson = true;
      const lengthHint =
        length === 'short' ? '400-600 words' : length === 'long' ? '1200-1800 words' : '700-1000 words';
      userPrompt = `Write a blog post about: ${topic}

Tone: ${tone}
Length: ${lengthHint}

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{
  "title": "string (60 chars max, no clickbait)",
  "excerpt": "string (150-160 chars, plain text)",
  "category": "string (one of: Market Trends, Mortgage & Rates, Buying Guide, Investing, Neighborhoods, Policy & Regulation)",
  "tags": ["string", "..."] (3-6 short lowercase tags),
  "body_html": "string (the post body as semantic HTML — use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a href>. No <html>/<body>/<head>. No <h1> — the title is the page H1.)",
  "seo_title": "string (max 60 chars)",
  "seo_description": "string (max 160 chars)"
}`;
    } else if (action === 'improve') {
      userPrompt = `Improve the following blog passage. Keep the same meaning and approximate length. Tighten language, fix flow, and keep US real estate context. Return ONLY the improved HTML (use <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <a href>). No commentary.\n\n---\n${topic}`;
    } else if (action === 'title') {
      userPrompt = `Suggest 5 SEO-friendly blog titles (<=60 chars each) for a US real estate post about: ${topic}. Return them as a numbered list, no other commentary.`;
    } else if (action === 'excerpt') {
      userPrompt = `Write a 150-160 character meta description / excerpt for a US real estate blog post about: ${topic}. Return ONLY the excerpt text, no quotes.`;
    }

    const result = await callAiGateway(
      [
        { role: 'system', content: systemBase },
        { role: 'user', content: userPrompt },
      ],
      { model: 'google/gemini-2.5-flash', temperature: 0.7, max_tokens: 4000 },
    );

    if ('error' in result) return result.error;

    const text = result.result.message.trim();

    if (asJson) {
      // Strip code fences if model added any
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        return new Response(JSON.stringify({ draft: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'AI returned invalid JSON', raw: text.slice(0, 500) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[blog-draft-generate] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})(req)));