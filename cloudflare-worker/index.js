/**
 * Cloudflare Worker — Gemini 1.5 Flash API Proxy
 *
 * Deployment:
 *   1. Create a Cloudflare Worker at https://dash.cloudflare.com/
 *   2. Paste this entire file as the Worker script
 *   3. Add secret: wrangler secret put GEMINI_API_KEY
 *   4. Set ALLOWED_ORIGIN to your PWA's domain in the env vars
 *      (or use '*' for development)
 *   5. Deploy: wrangler deploy
 *
 * Worker URL will be: https://adhd-tracker-ai.YOUR_SUBDOMAIN.workers.dev
 * Set this as VITE_GEMINI_PROXY_URL in your .env file.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ── CORS Headers ──────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = self.ALLOWED_ORIGIN || '*';
  const allowedOrigin = (allowed === '*') ? origin || '*' : (origin === allowed ? origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ── Rate limiting via KV (optional, requires KV binding named RATE_LIMIT) ─
async function checkRateLimit(clientIp) {
  if (!self.RATE_LIMIT) return true; // Skip if KV not configured
  const key = `rl:${clientIp}`;
  const count = parseInt((await self.RATE_LIMIT.get(key)) || '0');
  if (count >= 50) return false; // 50 requests/hour per IP
  await self.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3600 });
  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only allow POST to /api/gemini
    const url = new URL(request.url);
    if (url.pathname !== '/api/gemini') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(clientIp);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً یک ساعت صبر کنید.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const { systemPrompt, userPrompt, temperature = 0.7, maxTokens = 2048 } = body;

    if (!userPrompt) {
      return new Response(JSON.stringify({ error: 'userPrompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Get API key from environment secret
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in Worker' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Build Gemini request
    const geminiPayload = {
      system_instruction: systemPrompt ? {
        parts: [{ text: systemPrompt }],
      } : undefined,
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'text/plain',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    // Call Gemini
    let geminiResp;
    try {
      geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `خطا در اتصال به Gemini: ${err.message}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return new Response(JSON.stringify({ error: `Gemini error ${geminiResp.status}: ${errText}` }), {
        status: geminiResp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const geminiData = await geminiResp.json();

    // Extract text from response
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin),
      },
    });
  },
};
