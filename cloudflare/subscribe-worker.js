/**
 * Skyfare Altitude — Cloudflare Worker
 *
 * Routes:
 *   POST /                         — subscribe email to newsletter
 *   GET  /newsletter/posts         — latest published posts (cached 1 hr)
 *   GET  /newsletter/post?slug=    — single post with content (cached 15 min)
 *   POST /altitude/checkout        — create Stripe Checkout session
 *   POST /altitude/webhook         — Stripe webhook handler
 *   POST /altitude/activate        — issue JWT for member access
 *   GET  /altitude/verify          — verify JWT
 *
 * Required secrets (wrangler secret put):
 *   BEEHIIV_API_KEY   STRIPE_SECRET_KEY   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_ID   JWT_SECRET
 *
 * KV binding: ALTITUDE_KV
 */

const ALLOWED_ORIGINS = [
  'https://skyfareconsulting.com',
  'https://www.skyfareconsulting.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
];

const PUB_BASE_URL    = 'https://skyfarealtitude.beehiiv.com';
const SITE_URL        = 'https://skyfareconsulting.com';
const BEEHIIV_TAG_ID  = '4ee8818b-9eeb-46b5-a34b-bca21c8f06e3'; // altitude premium tag

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Stripe webhook — skip CORS origin check (Stripe servers, not browser)
    if (request.method === 'POST' && url.pathname === '/altitude/webhook') {
      return handleStripeWebhook(request, env, corsHeaders);
    }

    // Standard CORS check for all other routes
    if (origin && !isAllowed) {
      return respond({ error: 'Forbidden' }, 403, corsHeaders);
    }

    // ── Altitude Access routes ─────────────────────────────────────────────

    if (request.method === 'POST' && url.pathname === '/altitude/checkout') {
      return handleCheckout(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/activate') {
      return handleActivate(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/altitude/verify') {
      return handleVerify(request, env, corsHeaders);
    }

    // ── Newsletter routes ──────────────────────────────────────────────────

    if (request.method === 'GET' && url.pathname === '/newsletter/posts') {
      return handleGetPosts(env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/newsletter/post') {
      const slug = url.searchParams.get('slug');
      if (!slug) return respond({ error: 'Missing slug parameter' }, 400, corsHeaders);
      return handleGetPost(slug, request, env, corsHeaders);
    }

    // ── Subscribe ──────────────────────────────────────────────────────────

    if (request.method !== 'POST') {
      return respond({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    let email, firstName;
    try {
      const body = await request.json();
      email = (body.email || '').trim().toLowerCase();
      firstName = (body.first_name || '').toString().trim().slice(0, 80);
    } catch {
      return respond({ error: 'Invalid request.' }, 400, corsHeaders);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: 'Please enter a valid email address.' }, 400, corsHeaders);
    }

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

    let beehiivRes;
    try {
      beehiivRes = await fetch(
        `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` },
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

// ── Altitude: Stripe Checkout ─────────────────────────────────────────────────

async function handleCheckout(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  let email = '';
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {}

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${SITE_URL}/pages/altitude-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/pages/altitude.html`,
    allow_promotion_codes: 'true',
  });
  if (email) params.set('customer_email', email);

  let res;
  try {
    res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch {
    return respond({ error: 'Could not reach Stripe.' }, 502, corsHeaders);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return respond({ error: err.error?.message || 'Stripe error.' }, res.status, corsHeaders);
  }

  const session = await res.json();
  return respond({ url: session.url }, 200, corsHeaders);
}

// ── Altitude: Stripe Webhook ──────────────────────────────────────────────────

async function handleStripeWebhook(request, env, corsHeaders) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const body      = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';

  const valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
  }

  return new Response('ok', { status: 200 });
}

async function handleCheckoutComplete(session, env) {
  // Fetch full session to get subscription details
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}?expand[]=subscription&expand[]=customer`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) return;

  const full = await res.json();
  const email  = (full.customer_details?.email || full.customer_email || '').toLowerCase();
  const sub    = full.subscription;
  const custId = typeof full.customer === 'string' ? full.customer : full.customer?.id;

  if (!email) return;

  const record = {
    email,
    stripe_customer_id:    custId || '',
    stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || '',
    stripe_session_id:     session.id,
    status:                'active',
    plan:                  'monthly',
    amount_cents:          499,
    currency:              'usd',
    joined_at:             new Date().toISOString(),
    current_period_end:    sub?.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : '',
  };

  await env.ALTITUDE_KV.put(`member:${email}`, JSON.stringify(record));
  if (custId) await env.ALTITUDE_KV.put(`customer:${custId}`, email);

  // Setup in Beehiiv; record whether the tag was applied so we can retry later.
  const tagged = await setupBeehiivMember(email, env).catch(() => false);
  if (!tagged) {
    const raw2 = await env.ALTITUDE_KV.get(`member:${email}`);
    if (raw2) {
      const rec2 = JSON.parse(raw2);
      rec2.beehiiv_tagged = false;
      await env.ALTITUDE_KV.put(`member:${email}`, JSON.stringify(rec2));
    }
  } else {
    const raw2 = await env.ALTITUDE_KV.get(`member:${email}`);
    if (raw2) {
      const rec2 = JSON.parse(raw2);
      rec2.beehiiv_tagged = true;
      await env.ALTITUDE_KV.put(`member:${email}`, JSON.stringify(rec2));
    }
  }
}

async function handleSubscriptionDeleted(sub, env) {
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`customer:${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`member:${email}`);
  if (!raw) return;

  const record = JSON.parse(raw);
  record.status = 'cancelled';
  record.cancelled_at = new Date().toISOString();
  await env.ALTITUDE_KV.put(`member:${email}`, JSON.stringify(record));

  // Remove altitude-premium tag in Beehiiv (best-effort)
  await removeBeehiivTag(email, env).catch(() => {});
}

async function handleSubscriptionUpdated(sub, env) {
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`customer:${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`member:${email}`);
  if (!raw) return;

  const record = JSON.parse(raw);
  record.status = sub.status === 'active' ? 'active' : sub.status;
  if (sub.current_period_end) {
    record.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
  }
  await env.ALTITUDE_KV.put(`member:${email}`, JSON.stringify(record));
}

// ── Altitude: Activate (issue JWT) ────────────────────────────────────────────

async function handleActivate(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return respond({ error: 'Invalid request.' }, 400, corsHeaders); }

  const sessionId = (body.session_id || '').trim();
  const email     = (body.email     || '').trim().toLowerCase();

  if (!sessionId && !email) {
    return respond({ error: 'Provide session_id or email.' }, 400, corsHeaders);
  }

  // Rate limit on the email path only (session_id path is Stripe-verified).
  // Only FAILED lookups increment the counter — successful logins never block.
  const rlKey = !sessionId
    ? `rl:${request.headers.get('CF-Connecting-IP') || 'unknown'}`
    : null;
  if (rlKey) {
    const count = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
    if (count >= 20) {
      return respond({ error: 'Too many attempts. Please try again in a few minutes.' }, 429, corsHeaders);
    }
  }

  let memberEmail = email;

  // Session ID path — verify payment with Stripe and write member record if needed
  if (sessionId) {
    if (!env.STRIPE_SECRET_KEY) return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription&expand[]=customer`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
    ).catch(() => null);

    if (!res || !res.ok) return respond({ error: 'Could not verify payment.' }, 400, corsHeaders);

    const sess = await res.json();
    if (sess.payment_status !== 'paid') {
      return respond({ error: 'Payment not completed.' }, 402, corsHeaders);
    }

    memberEmail = (sess.customer_details?.email || sess.customer_email || '').toLowerCase();
    if (!memberEmail) return respond({ error: 'No email on session.' }, 400, corsHeaders);

    // Write member record if webhook hasn't arrived yet
    const existing = await env.ALTITUDE_KV.get(`member:${memberEmail}`);
    if (!existing) {
      const custId = typeof sess.customer === 'string' ? sess.customer : sess.customer?.id;
      const sub    = sess.subscription;
      const record = {
        email: memberEmail,
        stripe_customer_id:     custId || '',
        stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || '',
        stripe_session_id:      sessionId,
        status:                 'active',
        plan:                   'monthly',
        amount_cents:           499,
        currency:               'usd',
        joined_at:              new Date().toISOString(),
        current_period_end:     sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString() : '',
      };
      await env.ALTITUDE_KV.put(`member:${memberEmail}`, JSON.stringify(record));
      if (custId) await env.ALTITUDE_KV.put(`customer:${custId}`, memberEmail);
      await setupBeehiivMember(memberEmail, env).catch(() => {});
    }
  }

  // ── Authorize ──────────────────────────────────────────────────────────────
  // Source of truth for premium access is the Beehiiv "altitude premium" tag.
  // KV is a fast cache + a fallback for the brief window right after payment
  // before the tag has propagated in Beehiiv.
  let authorized = false;

  // 1) Beehiiv tag check (authoritative)
  const beehiivPremium = await checkBeehiivPremium(memberEmail, env).catch(() => null);
  if (beehiivPremium === true) {
    authorized = true;
    // Refresh KV cache so /verify stays fast on subsequent page loads
    const existing = await env.ALTITUDE_KV.get(`member:${memberEmail}`);
    if (!existing) {
      await env.ALTITUDE_KV.put(`member:${memberEmail}`, JSON.stringify({
        email: memberEmail,
        status: 'active',
        plan: 'monthly',
        amount_cents: 499,
        currency: 'usd',
        source: 'beehiiv_tag',
        joined_at: new Date().toISOString(),
      }));
    } else {
      const rec = JSON.parse(existing);
      if (rec.status !== 'active') { rec.status = 'active'; await env.ALTITUDE_KV.put(`member:${memberEmail}`, JSON.stringify(rec)); }
    }
  }

  // 2) Fallback to KV (covers tag-propagation lag right after a fresh payment)
  if (!authorized) {
    const raw = await env.ALTITUDE_KV.get(`member:${memberEmail}`);
    if (raw) {
      const member = JSON.parse(raw);
      if (member.status === 'active') authorized = true;
    }
  }

  if (!authorized) {
    // Only count failed lookups against the rate limit (successes are never penalised)
    if (rlKey) {
      const c = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
      await env.ALTITUDE_KV.put(rlKey, String(c + 1), { expirationTtl: 600 });
    }
    return respond({ error: 'No active Altitude membership found for this email.' }, 404, corsHeaders);
  }

  // Background: if previous Beehiiv tagging failed, retry now (non-blocking)
  const kvRaw = await env.ALTITUDE_KV.get(`member:${memberEmail}`);
  if (kvRaw) {
    const kvRec = JSON.parse(kvRaw);
    if (kvRec.beehiiv_tagged === false) {
      setupBeehiivMember(memberEmail, env).then(async tagged => {
        kvRec.beehiiv_tagged = tagged;
        await env.ALTITUDE_KV.put(`member:${memberEmail}`, JSON.stringify(kvRec));
      }).catch(() => {});
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { sub: memberEmail, typ: 'altitude', iat: now, exp: now + 86400 }, // 24 hours
    env.JWT_SECRET
  );

  return respond({ token, email: memberEmail }, 200, corsHeaders);
}

// ── Beehiiv premium check (source of truth) ───────────────────────────────────

async function checkBeehiivPremium(email, env) {
  if (!email) return false;
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  );
  if (!res.ok) throw new Error('beehiiv lookup failed');

  const data = await res.json();
  const sub  = (data.data || data.subscriptions || [])[0];
  if (!sub) return false;
  if (sub.status && sub.status !== 'active' && sub.status !== 'validating') return false;

  // Tags may come back as strings or objects depending on expand shape
  const tags = (sub.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || t.id || '')).toString().toLowerCase()
  );
  return tags.includes('altitude premium') || tags.includes(BEEHIIV_TAG_ID.toLowerCase());
}

// ── Altitude: Verify JWT ──────────────────────────────────────────────────────

async function handleVerify(request, env, corsHeaders) {
  const token = getBearer(request);
  if (!token) return respond({ valid: false }, 401, corsHeaders);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return respond({ valid: false }, 401, corsHeaders);

  // Also confirm member is still active in KV
  const raw = await env.ALTITUDE_KV.get(`member:${payload.sub}`);
  if (!raw) return respond({ valid: false }, 401, corsHeaders);

  const member = JSON.parse(raw);
  if (member.status !== 'active') return respond({ valid: false, status: member.status }, 403, corsHeaders);

  return respond({ valid: true, email: payload.sub, member }, 200, corsHeaders);
}

// ── Newsletter: Get Posts ──────────────────────────────────────────────────────

async function handleGetPosts(env, corsHeaders) {
  let res;
  try {
    res = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts` +
        `?status=confirmed&order_by=created_at&direction=desc&limit=20`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
  } catch { return respond({ error: 'Gateway error' }, 502, corsHeaders); }

  if (!res.ok) return respond({ error: 'Beehiiv API error' }, res.status, corsHeaders);

  const raw   = await res.json();
  const items = raw.data || raw.posts || [];

  const posts = items
    .filter(p => p.status === 'confirmed' || p.status === 'published')
    .map(p => ({
      id:            p.id || '',
      title:         p.title || '',
      subtitle:      p.subtitle || '',
      slug:          p.slug || '',
      url:           p.url || (p.slug ? `${PUB_BASE_URL}/p/${p.slug}` : ''),
      thumbnail_url: p.thumbnail_url || '',
      published_at:  p.publish_date
        ? new Date(p.publish_date * 1000).toISOString()
        : (p.scheduled_at || p.created_at || ''),
      content_tags: (p.content_tags || [])
        .map(t => (typeof t === 'string' ? t : t.display || t.slug || ''))
        .filter(Boolean),
    }));

  return respond({ posts }, 200, {
    ...corsHeaders,
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  });
}

// ── Newsletter: Get Single Post ────────────────────────────────────────────────

async function handleGetPost(slug, request, env, corsHeaders) {
  // Check if requester is an authenticated Altitude member
  const token = getBearer(request);
  let isMember = false;
  if (token && env.JWT_SECRET) {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (payload && payload.typ === 'altitude') {
      const raw = await env.ALTITUDE_KV.get(`member:${payload.sub}`).catch(() => null);
      if (raw) {
        const member = JSON.parse(raw);
        isMember = member.status === 'active';
      }
    }
  }

  // Find post by slug
  let postMeta = null;
  try {
    const listRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts` +
        `?status=confirmed&order_by=created_at&direction=desc&limit=50`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData.data || listData.posts || [];
      postMeta = items.find(p => p.slug === slug) || null;
    }
  } catch {}

  if (!postMeta) return respond({ error: 'Post not found' }, 404, corsHeaders);

  // Fetch HTML content
  let contentHtml = '';
  try {
    const contentRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts/${postMeta.id}?expand[]=free_email_content`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
    if (contentRes.ok) {
      const d = await contentRes.json();
      const p = d.data || d;
      contentHtml = (p.content && p.content.free && typeof p.content.free.email === 'string')
        ? p.content.free.email : '';
    }
  } catch {}

  const tags    = (postMeta.content_tags || [])
    .map(t => (typeof t === 'string' ? t : t.display || t.slug || ''))
    .filter(Boolean);
  const premium = tags.includes('altitude-premium');
  const cleaned = cleanHtml(contentHtml);

  const post = {
    id:            postMeta.id || '',
    title:         postMeta.title || '',
    subtitle:      postMeta.subtitle || '',
    slug:          postMeta.slug || '',
    thumbnail_url: postMeta.thumbnail_url || '',
    published_at:  postMeta.publish_date
      ? new Date(postMeta.publish_date * 1000).toISOString()
      : (postMeta.scheduled_at || postMeta.created_at || ''),
    content_tags:  tags,
    is_premium:    premium,
    // Members always get full content; non-members get preview for premium posts
    content_html:  (!premium || isMember) ? cleaned : null,
    preview_html:  premium && !isMember   ? extractPreview(cleaned) : null,
  };

  return respond({ post }, 200, {
    ...corsHeaders,
    'Cache-Control': 'public, max-age=900, s-maxage=900',
  });
}

// ── Beehiiv helpers ───────────────────────────────────────────────────────────

async function setupBeehiivMember(email, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.BEEHIIV_API_KEY}`,
  };

  // Step 1 — Subscribe (or reactivate) and attempt to include the tag inline.
  //   Some Beehiiv plan levels accept tags[] in the creation body; if so, one call does both.
  const subRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: false,
        double_opt_override: 'disabled',
        utm_source: 'altitude_payment',
        utm_medium: 'stripe',
        tags: [{ name: 'altitude premium' }],   // inline tag attempt
      }),
    }
  );

  if (!subRes.ok) return false;
  const subData = await subRes.json();
  const subId   = subData.data?.id;
  if (!subId) return false;

  // Verify the tag landed from the inline attempt before trying separate calls
  const verifyRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);

  if (verifyRes && verifyRes.ok) {
    const vd  = await verifyRes.json();
    const sub = (vd.data || vd.subscriptions || [])[0];
    const existingTags = (sub?.tags || []).map(t =>
      (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
    );
    if (existingTags.includes('altitude premium')) return true; // inline worked
  }

  // Step 2 — Inline didn't apply the tag; try explicit separate calls.

  // Pattern A: PATCH with string-array tags (matches how Beehiiv returns them)
  const tagA = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}`,
    { method: 'PATCH', headers, body: JSON.stringify({ tags: ['altitude premium'] }) }
  ).catch(() => null);
  if (tagA && tagA.ok) {
    // Quick check to confirm it applied
    const chkA = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
        `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    ).catch(() => null);
    if (chkA && chkA.ok) {
      const cd  = await chkA.json();
      const cs  = (cd.data || cd.subscriptions || [])[0];
      const ct  = (cs?.tags || []).map(t => (typeof t === 'string' ? t : (t.name || '')).toLowerCase());
      if (ct.includes('altitude premium')) return true;
    }
  }

  // Pattern B: PATCH with object-array tags
  const tagB = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}`,
    { method: 'PATCH', headers, body: JSON.stringify({ tags: [{ name: 'altitude premium' }] }) }
  ).catch(() => null);
  if (tagB && tagB.ok) return true;

  // Pattern C: PATCH with publication_subscriber_tags (older field name)
  const tagC = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}`,
    { method: 'PATCH', headers, body: JSON.stringify({ publication_subscriber_tags: [{ id: BEEHIIV_TAG_ID }] }) }
  ).catch(() => null);
  if (tagC && tagC.ok) return true;

  // Pattern D: POST to subscriber-specific tags endpoint
  const tagD = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
    { method: 'POST', headers, body: JSON.stringify({ tags: [{ name: 'altitude premium' }] }) }
  ).catch(() => null);
  if (tagD && tagD.ok) return true;

  return false; // all patterns failed — caller stores this so we can retry on next login
}

async function removeBeehiivTag(email, env) {
  // Find subscriber by email
  const findRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  );
  if (!findRes.ok) return;
  const findData = await findRes.json();
  const sub = (findData.data || [])[0];
  if (!sub?.id) return;

  // Remove the altitude-premium tag
  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${sub.id}/tags/${BEEHIIV_TAG_ID}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` },
    }
  );
}

// ── JWT helpers (Web Crypto API — no external library needed) ─────────────────

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlStr(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function getHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

async function signJwt(payload, secret) {
  const data = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' +
               b64urlStr(JSON.stringify(payload));
  const key  = await getHmacKey(secret, 'sign');
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + b64url(sig);
}

async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const data    = h + '.' + p;
    const key     = await getHmacKey(secret, 'verify');
    const sigBytes = b64urlDecode(s);
    const valid   = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function getBearer(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// ── Stripe signature verification ─────────────────────────────────────────────

async function verifyStripeSignature(body, signature, secret) {
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const { t: timestamp, v1 } = parts;
  if (!timestamp || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false; // 5-min replay window

  const payload = `${timestamp}.${body}`;
  const key     = await getHmacKey(secret, 'sign');
  const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex     = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/ xmlns="[^"]*"/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/ data-node-hash="[^"]*"/g, '')
    .trim();
}

function extractPreview(html) {
  if (!html) return '';
  const matches = [];
  const re = /<p([^>]*)>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null && matches.length < 3) {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text.length > 20) matches.push('<p' + m[1] + '>' + m[2] + '</p>');
  }
  return matches.join('\n');
}

// ── Utility ───────────────────────────────────────────────────────────────────

function respond(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
