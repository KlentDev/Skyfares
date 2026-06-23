/**
 * Skyfare Altitude — Beehiiv Subscription Proxy
 * Cloudflare Worker (ES Module format)
 *
 * Required environment variables (set in Cloudflare dashboard → Worker → Settings → Variables):
 *   BEEHIIV_API_KEY  — your Beehiiv API key  (Settings → API in Beehiiv dashboard)
 *   BEEHIIV_PUB_ID   — pub_0be395f6-cacb-4ba9-b8a5-04c69ea44bf1
 */

const ALLOWED_ORIGINS = [
  'https://skyfareconsulting.com',
  'https://www.skyfareconsulting.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight MUST be handled before the origin gate — the browser needs
    // CORS headers on the OPTIONS response to decide whether to send the POST.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Block non-allowed origins (CORS headers included so browser can read the error)
    if (origin && !isAllowed) {
      return respond({ error: 'Forbidden' }, 403, corsHeaders);
    }

    if (request.method !== 'POST') {
      return respond({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    // Parse body
    let email, firstName;
    try {
      const body = await request.json();
      email = (body.email || '').trim().toLowerCase();
      firstName = (body.first_name || '').toString().trim().slice(0, 80); // optional
    } catch {
      return respond({ error: 'Invalid request.' }, 400, corsHeaders);
    }

    // Server-side validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: 'Please enter a valid email address.' }, 400, corsHeaders);
    }

    // Build Beehiiv payload. Welcome email is handled by the "Welcome to
    // Skyfare Altitude" signup automation, so send_welcome_email stays false
    // to avoid a double send. Single opt-in (double_opt_override disabled).
    const beehiivPayload = {
      email,
      reactivate_existing: true,
      send_welcome_email: false,
      double_opt_override: 'disabled',
      utm_source: 'website',
      utm_medium: 'organic',
    };
    if (firstName) {
      beehiivPayload.custom_fields = [{ name: 'first_name', value: firstName }];
    }

    // Forward to Beehiiv API
    let beehiivRes;
    try {
      beehiivRes = await fetch(
        `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.BEEHIIV_API_KEY}`,
          },
          body: JSON.stringify(beehiivPayload),
        }
      );
    } catch {
      return respond({ error: 'Could not reach Beehiiv. Please try again.' }, 502, corsHeaders);
    }

    if (beehiivRes.status === 201 || beehiivRes.status === 200) {
      return respond({ success: true }, 200, corsHeaders);
    }

    if (beehiivRes.status === 409) {
      return respond({ error: 'already_subscribed' }, 409, corsHeaders);
    }

    return respond({ error: 'Something went wrong. Please try again.' }, 500, corsHeaders);
  },
};

function respond(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
