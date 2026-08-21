// services/stripe.js — everything that talks to the Stripe API and nothing
// else (no Beehiiv calls in this file — see orchestration/ for handlers that
// need both). Checkout session creation, webhook signature verification,
// Billing Portal, and the deferred Monthly→Annual upgrade flow.
import { respond, getBaseUrl } from '../utils/http.js';
import { getBearer, verifyJwt } from '../utils/jwt.js';
import { getHmacKey } from '../utils/crypto.js';
import { buildAssessmentBookingUrl } from '../utils/signedLink.js';
import { KV_PREFIX } from '../config/constants.js';

// ── Altitude: Stripe Checkout ─────────────────────────────────────────────────
// Skyfare production Stripe configuration (live mode) — STRIPE_SECRET_KEY and
// the STRIPE_*_PRICE_ID vars below belong to Skyfare's real production Stripe
// account (see worker.js's secrets doc comment). This is distinct from
// STRIPE_ASSESSMENT_SECRET_KEY further down in this file, which is a
// deliberately separate sandbox account used only by the Travel Strategy
// Call product.

export async function handleCheckout(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const rlKey = `${KV_PREFIX.RL_CHECKOUT}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 10) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  let email = '';
  let plan = 'monthly';
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
    // Additive — omitting `plan` (every existing caller today) keeps the
    // exact monthly behavior this function has always had.
    if (body.plan === 'annual') plan = 'annual';
  } catch {}

  const priceId = plan === 'annual' ? env.STRIPE_PRICE_ID_ANNUAL : env.STRIPE_PRICE_ID;
  if (plan === 'annual' && !priceId) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const baseUrl = getBaseUrl(request.headers.get('Origin') || '');
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${baseUrl}/pages/altitude-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pages/altitude.html`,
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

// ── KrisFlyer Guide: Stripe Checkout ──────────────────────────────────────────
// One-time purchase (mode: 'payment'), separate Price from Altitude's
// subscription. Shares /altitude/webhook — orchestration/stripeWebhook.js's
// handleStripeWebhook branches on session.mode to route here vs. the
// existing Altitude subscription handler.

export async function handleGuideCheckout(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_GUIDE_PRICE_ID) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const rlKey = `${KV_PREFIX.RL_GUIDE_CHECKOUT}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 10) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  let email = '';
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {}

  const origin  = request.headers.get('Origin') || '';
  const baseUrl = getBaseUrl(origin);
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': env.STRIPE_GUIDE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${baseUrl}/pages/krisflyer-guide.html?purchased=1`,
    cancel_url: `${baseUrl}/pages/krisflyer-guide.html`,
    // Webhooks have no browser Origin of their own -- carry it through Stripe
    // session metadata so handleGuideCheckoutComplete can pass it to
    // sendGuideMagicLink, letting a local test purchase's confirmation email
    // link back to localhost instead of always the production site.
    'metadata[origin]': origin,
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

// ── Travel Strategy Call: Stripe Checkout ─────────────────────────────────────
// One-time $99 purchase, same mode:'payment' shape as the Guide checkout above.
// metadata[product]='assessment' is how orchestration/stripeWebhook.js tells
// this apart from a Guide purchase once both land in the same
// checkout.session.completed / mode:'payment' branch.
//
// Uses its own STRIPE_ASSESSMENT_SECRET_KEY, NOT the shared STRIPE_SECRET_KEY
// -- this product is currently live under the "Klent sandbox" Stripe account
// (acct_1Tl1nJB9NfKSwBnU), a genuinely different account from whichever one
// issues STRIPE_SECRET_KEY for Altitude/Guide, not just a different mode on
// the same account. A Price ID from one account is invisible to another
// account's key, so this can't share STRIPE_SECRET_KEY. Swap this whole
// product over to the real account (new STRIPE_ASSESSMENT_PRICE_ID under
// that account, then point this back at STRIPE_SECRET_KEY) once out of testing.
// Unrelated to the Skyfare production Stripe configuration used by
// handleCheckout/handleGuideCheckout above — do not conflate the two.

export async function handleAssessmentCheckout(request, env, corsHeaders) {
  if (!env.STRIPE_ASSESSMENT_SECRET_KEY || !env.STRIPE_ASSESSMENT_PRICE_ID) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const rlKey = `${KV_PREFIX.RL_ASSESSMENT_CHECKOUT}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 10) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  let email = '';
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {}

  const origin  = request.headers.get('Origin') || '';
  const baseUrl = getBaseUrl(origin);
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': env.STRIPE_ASSESSMENT_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${baseUrl}/pages/assessment.html?purchased=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pages/assessment.html#priority`,
    'metadata[product]': 'assessment',
  });
  if (email) params.set('customer_email', email);

  let res;
  try {
    res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_ASSESSMENT_SECRET_KEY}`,
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

// Called by the success-page JS before it reveals the Cal.com/WhatsApp
// buttons -- the bare ?purchased=1 redirect flag is not proof of payment on
// its own (assessment-call-page.md §7.3), so this re-checks the session with
// Stripe directly rather than trusting the client.
export async function handleAssessmentVerify(request, env, corsHeaders) {
  if (!env.STRIPE_ASSESSMENT_SECRET_KEY) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id') || '';
  if (!sessionId) {
    return respond({ error: 'missing_session_id' }, 400, corsHeaders);
  }

  let res;
  try {
    res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${env.STRIPE_ASSESSMENT_SECRET_KEY}` },
    });
  } catch {
    return respond({ error: 'Could not reach Stripe.' }, 502, corsHeaders);
  }

  if (!res.ok) {
    return respond({ paid: false }, 200, corsHeaders);
  }

  const session = await res.json();
  const paid = session.payment_status === 'paid' && session.metadata?.product === 'assessment';
  if (!paid) {
    return respond({ paid: false }, 200, corsHeaders);
  }

  // Same signed link the confirmation email gets (see
  // orchestration/stripeWebhook.js's handleAssessmentCheckoutComplete) --
  // built fresh here too so the success page never has to know the real
  // Cal.com URL, only this verified, expiring redirect.
  const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
  const bookingUrl = email ? await buildAssessmentBookingUrl(email, env) : null;
  return respond({ paid: true, bookingUrl }, 200, corsHeaders);
}

// ── Stripe signature verification ─────────────────────────────────────────────

export async function verifyStripeSignature(body, signature, secret) {
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const { t: timestamp, v1 } = parts;
  if (!timestamp || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false; // 5-min replay window

  const payload = `${timestamp}.${body}`;
  const key     = await getHmacKey(secret, 'sign');
  const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex     = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(hex, v1);
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const left = enc.encode(a || '');
  const right = enc.encode(b || '');
  const len = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < len; i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

// Altitude Access now sells two plans (monthly + annual, same product,
// different billing interval) — this reads the real price off the
// subscription instead of assuming monthly, so both
// orchestration/stripeWebhook.js's handleCheckoutComplete and
// orchestration/session.js's handleActivate session_id fallback record
// purchases correctly. For any existing real monthly subscriber this still
// resolves to exactly {plan:'monthly', amount_cents:499} — same output as
// the old hardcoded values, just now derived instead of assumed.
export function derivePlanFromSubscription(sub) {
  const price = sub?.items?.data?.[0]?.price;
  const interval = price?.recurring?.interval;
  return {
    plan: interval === 'year' ? 'annual' : 'monthly',
    amount_cents: typeof price?.unit_amount === 'number' ? price.unit_amount : 499,
  };
}

// This Stripe account runs "flexible" billing mode (confirmed live via a
// temporary diagnostic route, 2026-07-24), which moved current_period_start/
// current_period_end OFF the Subscription object and onto each
// SubscriptionItem instead — a subscription can now hold items with
// different billing periods, so Stripe stopped exposing one at the top
// level. Every subscription in this codebase has exactly one item, so read
// it from there. Every caller that reads a period boundary off a raw Stripe
// subscription object (checkout completion, activation self-heal, the
// current_period_end self-heal, webhook updates, the upgrade schedule) MUST
// go through these two helpers, not `sub.current_period_end` directly —
// that field is silently undefined now, which is exactly what left every
// member record's current_period_end permanently blank until this fix.
export function getSubscriptionPeriodEnd(sub) {
  return sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end ?? null;
}
export function getSubscriptionPeriodStart(sub) {
  return sub?.items?.data?.[0]?.current_period_start ?? sub?.current_period_start ?? null;
}

// ── Altitude: Manage Membership (Stripe Billing Portal) ───────────────────────

export async function handleManagePortal(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY) return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);

  const rlKey = `${KV_PREFIX.RL_PORTAL}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 20) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const token = getBearer(request);
  if (!token) return respond({ error: 'Not authenticated.' }, 401, corsHeaders);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return respond({ error: 'Not authenticated.' }, 401, corsHeaders);

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${payload.sub}`);
  if (!raw) return respond({ error: 'No membership found for this account.' }, 404, corsHeaders);

  const member = JSON.parse(raw);
  if (!member.stripe_customer_id) {
    return respond({ error: 'No billing account found for this membership.' }, 404, corsHeaders);
  }

  const baseUrl = getBaseUrl(request.headers.get('Origin') || '');
  const params = new URLSearchParams({
    customer: member.stripe_customer_id,
    return_url: `${baseUrl}/pages/private-pages/altitude-access-portal.html`,
  });

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }).catch(() => null);

  if (!res || !res.ok) {
    const errText = res ? await res.text().catch(() => '') : '';
    console.error(`[handleManagePortal] failed status=${res ? res.status : 'network'} body=${errText.slice(0, 200)}`);
    return respond({ error: 'Could not open billing portal. Please try again.' }, 502, corsHeaders);
  }

  const session = await res.json();
  return respond({ url: session.url }, 200, corsHeaders);
}

// ── Altitude: Upgrade Monthly → Annual (deferred) ──────────────────────────────
// Confirmed decision 2026-07-24: do NOT charge or switch plans at click time.
// The member already paid for their current Monthly period, so nothing
// changes until that period naturally ends — only then does Stripe bill the
// real Annual amount and the Beehiiv tag flip. This is done via a Stripe
// Subscription Schedule (docs.stripe.com/billing/subscriptions/change-price
// → "Subscription schedules": the documented mechanism for a price change
// that takes effect at a future phase boundary): phase 1 keeps the existing
// Monthly price through current_period_end (what's already been paid for),
// phase 2 starts there on the Annual price with no proration (a real,
// non-partial renewal), then releases so the subscription continues billing
// annually as a normal (non-scheduled) subscription. The actual plan/tag
// switch happens later in orchestration/stripeWebhook.js's
// handleSubscriptionUpdated, once Stripe applies phase 2 and fires
// customer.subscription.updated.

export async function handleUpgradeToAnnual(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID_ANNUAL) {
    return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);
  }

  const rlKey = `${KV_PREFIX.RL_UPGRADE}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 10) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const token = getBearer(request);
  if (!token) return respond({ error: 'Not authenticated.' }, 401, corsHeaders);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return respond({ error: 'Not authenticated.' }, 401, corsHeaders);

  const email = payload.sub;
  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (!raw) return respond({ error: 'No membership found for this account.' }, 404, corsHeaders);

  const member = JSON.parse(raw);
  if (member.status !== 'active') {
    return respond({ error: 'Membership is not active.' }, 400, corsHeaders);
  }
  if (member.plan === 'annual') {
    return respond({ error: 'Already on the annual plan.' }, 400, corsHeaders);
  }
  if (member.plan !== 'monthly' || !member.stripe_subscription_id) {
    return respond({ error: 'This membership cannot be upgraded.' }, 400, corsHeaders);
  }
  if (member.pending_plan === 'annual') {
    return respond({ error: 'Your upgrade to Annual is already scheduled.' }, 400, corsHeaders);
  }
  if (!member.current_period_end) {
    return respond({ error: 'Could not determine your current billing period.' }, 400, corsHeaders);
  }

  // Fetch the subscription to get the existing line item's ID and current
  // phase start — required to build phase 1 exactly as Stripe already has it.
  const subRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  ).catch(() => null);
  if (!subRes || !subRes.ok) {
    return respond({ error: 'Could not look up subscription.' }, 502, corsHeaders);
  }
  const sub = await subRes.json();
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  if (!item || !priceId) {
    return respond({ error: 'Could not find subscription item to upgrade.' }, 502, corsHeaders);
  }

  // Bug found 2026-07-24: this account runs Stripe's "flexible" billing mode,
  // so sub.current_period_start/end are undefined at the top level (see
  // getSubscriptionPeriodStart/End above) — periodStart previously had NO
  // fallback at all, meaning phases[0][start_date] below was silently sent
  // as the literal string "undefined" on every upgrade attempt.
  const periodStart = getSubscriptionPeriodStart(sub);
  const periodEnd = getSubscriptionPeriodEnd(sub) || Math.floor(new Date(member.current_period_end).getTime() / 1000);
  if (!periodStart) {
    return respond({ error: 'Could not determine your current billing period.' }, 502, corsHeaders);
  }

  // Step 1: bring the existing subscription under schedule management.
  const scheduleRes = await fetch('https://api.stripe.com/v1/subscription_schedules', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ from_subscription: member.stripe_subscription_id }).toString(),
  }).catch(() => null);
  if (!scheduleRes || !scheduleRes.ok) {
    const errText = scheduleRes ? await scheduleRes.text().catch(() => '') : '';
    console.error(`[handleUpgradeToAnnual] schedule create failed status=${scheduleRes ? scheduleRes.status : 'network'} body=${errText.slice(0, 200)}`);
    return respond({ error: 'Could not schedule your upgrade. Please try again or contact support.' }, 502, corsHeaders);
  }
  const schedule = await scheduleRes.json();

  // Step 2: set the two phases — finish out what's already paid for on
  // Monthly, then one Annual iteration starting exactly at the boundary,
  // then release the schedule so billing continues normally.
  //
  // Bug found 2026-07-24 (via a live diagnostic call — real error text was
  // "Received unknown parameter: phases[iterations]"): phases[].iterations
  // is deprecated and rejected outright on this account's Stripe API
  // version (confirmed via Stripe's own docs: "We recommend you use
  // duration... Phase iterations is deprecated"). Every upgrade attempt was
  // failing at this exact step. Fixed by giving the annual phase an
  // explicit end_date one calendar year after it starts, same technique
  // already used for phase 0, instead of an iteration count.
  const annualPhaseEnd = new Date(periodEnd * 1000);
  annualPhaseEnd.setUTCFullYear(annualPhaseEnd.getUTCFullYear() + 1);
  const annualPhaseEndUnix = Math.floor(annualPhaseEnd.getTime() / 1000);

  const phaseParams = new URLSearchParams();
  phaseParams.set('end_behavior', 'release');
  phaseParams.set('phases[0][items][0][price]', priceId);
  phaseParams.set('phases[0][items][0][quantity]', '1');
  phaseParams.set('phases[0][start_date]', String(periodStart));
  phaseParams.set('phases[0][end_date]', String(periodEnd));
  phaseParams.set('phases[1][items][0][price]', env.STRIPE_PRICE_ID_ANNUAL);
  phaseParams.set('phases[1][items][0][quantity]', '1');
  phaseParams.set('phases[1][end_date]', String(annualPhaseEndUnix));
  phaseParams.set('phases[1][proration_behavior]', 'none');

  const updateRes = await fetch(`https://api.stripe.com/v1/subscription_schedules/${schedule.id}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: phaseParams.toString(),
  }).catch(() => null);

  if (!updateRes || !updateRes.ok) {
    const errText = updateRes ? await updateRes.text().catch(() => '') : '';
    console.error(`[handleUpgradeToAnnual] schedule phases failed status=${updateRes ? updateRes.status : 'network'} body=${errText.slice(0, 200)}`);
    return respond({ error: 'Could not schedule your upgrade. Please try again or contact support.' }, 502, corsHeaders);
  }

  // No charge and no plan/tag change yet — that happens later, in
  // orchestration/stripeWebhook.js's handleSubscriptionUpdated, once Stripe
  // actually applies phase 2.
  member.pending_plan = 'annual';
  member.upgrade_effective_at = member.current_period_end;
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member));

  return respond({ success: true, scheduled: true, effective_at: member.upgrade_effective_at }, 200, corsHeaders);
}
