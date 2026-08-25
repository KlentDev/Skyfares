// services/beehiiv.js — everything that talks to the Beehiiv API and nothing
// else (never writes/reasons about the Stripe-shaped member: record itself —
// that lifecycle logic stays in orchestration/, see orchestration/guideBundle.js
// for why grantGuideAltitudeBundle/activateDeferredGuideBundle live there
// instead of here). Tags, segments, automations, subscriber lookups, and the
// two plain-newsletter-subscribe routes (handleWaitlist, handleSubscribe).
import { respond, getBaseUrl } from '../utils/http.js';
import { generateMagicToken } from '../utils/jwt.js';
import {
  MAGIC_LINK_AUTOMATION_ID, MAGIC_LINK_CF_NAME, GUIDE_MAGIC_LINK_AUTOMATION_ID,
  WELCOME_MONTHLY_AUTOMATION_ID, WELCOME_ANNUAL_AUTOMATION_ID, GUIDE_CONFIRMATION_AUTOMATION_ID,
  GUIDE_TAG_NAME, INTERVAL_TAG_IDS, GUIDE_BUNDLE_TAG_NAME, GUIDE_BUNDLE_TAG_ID,
  TRAVEL_STRAT_CALL_TAG_NAME,
  SEG_FREE, SEG_PRELAUNCH, SEG_GUIDE, SEG_MONTHLY, SEG_ANNUAL, SEG_TRAVEL_STRAT_CALL,
  KV_PREFIX,
  GUIDE_PDF_EMAIL_AUTOMATION_ID, GUIDE_PDF_DOWNLOAD_URL_CF_NAME, GUIDE_PDF_PASSWORD_CF_NAME,
  TRAVEL_STRAT_CALL_AUTOMATION_ID, TRAVEL_STRAT_CALL_BOOKING_URL_CF_NAME,
} from '../config/constants.js';

function beehiivHeaders(env) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.BEEHIIV_API_KEY}`,
  };
}

// Guardrail for known non-customer/test/internal emails that were accidentally
// re-created by paid-access reconciliation. Keep this narrow: it only blocks
// paid Altitude tier/tag writes, not normal free newsletter subscription.
const PAID_SYNC_SUPPRESSED_EMAILS = new Set([
  'klentmicko@gmail.com',
  'klentklent091222@gmail.com',
  'klent@skyfareconsulting.com',
  'gabb@skyfareconsulting.com',
]);

function isPaidSyncSuppressed(email) {
  return PAID_SYNC_SUPPRESSED_EMAILS.has((email || '').trim().toLowerCase());
}

function getAltitudeTierConfig(env) {
  const id = (env.BEEHIIV_ALTITUDE_TIER_ID || '').trim();
  const name = (env.BEEHIIV_ALTITUDE_TIER_NAME || '').trim();
  return { id, name, configured: !!(id || name) };
}

function emptyBeehiivEntitlements() {
  return {
    found: false,
    subscriber_active: false,
    subscription_id: '',
    subscription_tier: '',
    premium_tier_ids: [],
    premium_tier_names: [],
    tags: [],
    guide: false,
    altitude_tier: false,
    altitude_monthly: false,
    altitude_annual: false,
    guide_bundle: false,
    dev_mode: false,
  };
}

async function findBeehiivSubscription(email, env, { expand = [] } = {}) {
  const expanded = expand.map(e => `&expand[]=${encodeURIComponent(e)}`).join('');
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}${expanded}&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  );
  if (!res.ok) throw new Error('beehiiv lookup failed');
  const data = await res.json();
  return (data.data || data.subscriptions || [])[0] || null;
}

async function ensureBeehiivSubscription(email, env, { stripeCustomerId = '', utmSource = 'altitude_payment' } = {}) {
  const headers = beehiivHeaders(env);
  const payload = {
    email,
    reactivate_existing: true,
    send_welcome_email: false,
    double_opt_override: 'disabled',
    utm_source: utmSource,
    utm_medium: 'stripe',
  };
  if (stripeCustomerId) payload.stripe_customer_id = stripeCustomerId;

  const subRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
    { method: 'POST', headers, body: JSON.stringify(payload) }
  );
  if (!subRes.ok) {
    const errText = await subRes.text().catch(() => '');
    throw new Error(`beehiiv subscribe failed status=${subRes.status} body=${errText.slice(0, 200)}`);
  }

  const subData = await subRes.json();
  const subId = subData.data?.id;
  if (!subId) throw new Error('beehiiv subscribe returned no id');
  return subId;
}

function tierMatchesConfig(tier, tierConfig) {
  const id = (tier.id || '').toString();
  const name = (tier.name || '').toString().toLowerCase();
  return !!(
    (tierConfig.id && id === tierConfig.id) ||
    (tierConfig.name && name === tierConfig.name.toLowerCase())
  );
}

async function updateBeehiivSubscription(subId, payload, env) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}`,
    { method: 'PUT', headers: beehiivHeaders(env), body: JSON.stringify(payload) }
  ).catch(() => null);
  if (!res || !res.ok) {
    const errText = res ? await res.text().catch(() => '') : '';
    console.error(`[beehiiv-subscription-update] failed status=${res ? res.status : 'network'} body=${errText.slice(0, 200)}`);
    return false;
  }
  return true;
}

export async function assignBeehiivAltitudeTier(email, env, { stripeCustomerId = '' } = {}) {
  if (isPaidSyncSuppressed(email)) {
    console.warn(`[beehiiv-tier] suppressed paid tier sync for ${email}`);
    return false;
  }

  const tierConfig = getAltitudeTierConfig(env);
  if (!tierConfig.configured) {
    console.error(`[beehiiv-tier] BEEHIIV_ALTITUDE_TIER_ID or BEEHIIV_ALTITUDE_TIER_NAME not configured for ${email}`);
    return false;
  }

  let sub = await findBeehiivSubscription(email, env, { expand: ['subscription_premium_tiers'] }).catch(() => null);
  if (!sub?.id) {
    const subId = await ensureBeehiivSubscription(email, env, { stripeCustomerId }).catch(err => {
      console.error(`[beehiiv-tier] ensure subscription failed for ${email}: ${String(err.message || err).slice(0, 200)}`);
      return null;
    });
    if (!subId) return false;
    sub = { id: subId, subscription_premium_tiers: [] };
  }

  const currentTiers = sub.subscription_premium_tiers || [];
  if (currentTiers.some(t => tierMatchesConfig(t, tierConfig))) return true;

  const payload = { tier: 'premium' };
  if (stripeCustomerId) payload.stripe_customer_id = stripeCustomerId;
  if (tierConfig.id) {
    const ids = currentTiers.map(t => t.id).filter(Boolean);
    payload.premium_tier_ids = Array.from(new Set([...ids, tierConfig.id]));
  } else {
    const names = currentTiers.map(t => t.name).filter(Boolean);
    payload.premium_tiers = Array.from(new Set([...names, tierConfig.name]));
  }

  if (!(await updateBeehiivSubscription(sub.id, payload, env))) return false;
  return verifyBeehiivAltitudeTier(email, env);
}

export async function clearBeehiivAltitudeTier(email, env) {
  const tierConfig = getAltitudeTierConfig(env);
  if (!tierConfig.configured) return false;

  const sub = await findBeehiivSubscription(email, env, { expand: ['subscription_premium_tiers'] }).catch(() => null);
  if (!sub?.id) return false;

  const currentTiers = sub.subscription_premium_tiers || [];
  if (!currentTiers.some(t => tierMatchesConfig(t, tierConfig))) return true;

  const remaining = currentTiers.filter(t => !tierMatchesConfig(t, tierConfig));
  let payload;
  if (remaining.length) {
    const remainingIds = remaining.map(t => t.id).filter(Boolean);
    payload = remainingIds.length === remaining.length
      ? { tier: 'premium', premium_tier_ids: remainingIds }
      : { tier: 'premium', premium_tiers: remaining.map(t => t.name).filter(Boolean) };
  } else {
    payload = { tier: 'free', premium_tier_ids: [] };
  }

  if (!(await updateBeehiivSubscription(sub.id, payload, env))) return false;
  return !(await verifyBeehiivAltitudeTier(email, env).catch(() => true));
}

export async function verifyBeehiivAltitudeTier(email, env) {
  const entitlements = await getBeehiivEntitlements(email, env);
  return !!(entitlements.found && entitlements.subscriber_active && entitlements.altitude_tier);
}

export function beehiivSyncMetadata(entitlements, { tagged = null, tierSynced = null, error = '' } = {}) {
  const tierVerified = tierSynced == null ? !!entitlements.altitude_tier : !!tierSynced;
  const now = new Date().toISOString();
  return {
    beehiiv_tagged: tagged == null
      ? !!(entitlements.altitude_monthly || entitlements.altitude_annual || entitlements.guide_bundle)
      : !!tagged,
    beehiiv_subscription_id: entitlements.subscription_id || '',
    beehiiv_tier_synced: tierVerified,
    beehiiv_tier_ids: entitlements.premium_tier_ids || [],
    beehiiv_tier_names: entitlements.premium_tier_names || [],
    beehiiv_tags: entitlements.tags || [],
    beehiiv_synced_at: now,
    beehiiv_tier_verified_at: tierVerified ? now : '',
    beehiiv_sync_error: error,
  };
}

export async function syncBeehiivAltitudeAccess(email, env, { plan, stripeCustomerId = '', active = true } = {}) {
  if (active && isPaidSyncSuppressed(email)) {
    console.warn(`[beehiiv-sync] suppressed paid Altitude sync for ${email}`);
    const entitlements = await getBeehiivEntitlements(email, env).catch(() => emptyBeehiivEntitlements());
    return beehiivSyncMetadata(entitlements, {
      tagged: false,
      tierSynced: false,
      error: 'paid_sync_suppressed',
    });
  }

  if (!active) {
    const tierSynced = await clearBeehiivAltitudeTier(email, env).catch(() => false);
    if (plan) await removePlanTag(email, plan, env).catch(() => {});
    const entitlements = await getBeehiivEntitlements(email, env).catch(() => emptyBeehiivEntitlements());
    return beehiivSyncMetadata(entitlements, { tierSynced, error: tierSynced ? '' : 'tier_clear_failed' });
  }

  let tagged = false;
  if (plan === 'monthly' || plan === 'annual') {
    tagged = await setupBeehiivMember(email, env, plan, { stripeCustomerId }).catch(() => false);
  } else if (plan === 'guide_bundle') {
    tagged = await tagGuideBundle(email, env).catch(() => false);
  }

  const tierSynced = await assignBeehiivAltitudeTier(email, env, { stripeCustomerId }).catch(() => false);
  const entitlements = await getBeehiivEntitlements(email, env).catch(() => emptyBeehiivEntitlements());
  return beehiivSyncMetadata(entitlements, {
    tagged,
    tierSynced,
    error: tierSynced ? '' : 'tier_sync_failed',
  });
}

// ── Beehiiv premium check (tier is source of truth) ───────────────────────────

// "Premium" means holding the Altitude Premium Tier. Tags are plan/product
// metadata only; they can help repair the tier when KV still shows an active
// Stripe-backed member, but they no longer grant access by themselves.
export async function checkBeehiivPremium(email, env) {
  const entitlements = await getBeehiivEntitlements(email, env);
  if (!entitlements.found || !entitlements.subscriber_active) return false;
  return !!entitlements.altitude_tier;
}

export function getTaggedAltitudePlan(entitlements) {
  if (!entitlements || !entitlements.subscriber_active) return '';
  if (entitlements.altitude_annual) return 'annual';
  if (entitlements.altitude_monthly) return 'monthly';
  if (entitlements.guide_bundle) return 'guide_bundle';
  return '';
}

export function getActiveCachedAltitudePlan(member) {
  if (!member || member.status !== 'active') return '';
  const plan = member.plan || '';
  if (plan === 'monthly' || plan === 'annual') return plan;
  if (plan === 'guide_bundle') {
    if (!member.current_period_end) return '';
    if (new Date(member.current_period_end).getTime() <= Date.now()) return '';
    return plan;
  }
  return '';
}

export function hasRecentBeehiivTierCache(member, maxAgeMs = 86_400_000) {
  if (!member || member.beehiiv_tier_synced !== true) return false;
  if (!getActiveCachedAltitudePlan(member)) return false;
  const verifiedAt = member.beehiiv_tier_verified_at || member.beehiiv_synced_at || '';
  const verifiedMs = verifiedAt ? new Date(verifiedAt).getTime() : 0;
  return Number.isFinite(verifiedMs) && verifiedMs > 0 && Date.now() - verifiedMs <= maxAgeMs;
}

export async function resolveBeehiivAltitudeAccess(email, env, { member = null, repair = true } = {}) {
  let entitlements;
  try {
    entitlements = await getBeehiivEntitlements(email, env);
  } catch (err) {
    if (hasRecentBeehiivTierCache(member)) {
      return { granted: true, reason: 'recent_tier_cache', entitlements: null, sync: null };
    }
    return { granted: false, reason: 'beehiiv_unavailable', entitlements: null, sync: null };
  }

  // Manual dev-mode override -- see the `dev_mode` field on
  // getBeehiivEntitlements() above for what gates this and why it's safe to
  // check unconditionally first: the tag is never applied by any code path,
  // only by a human in the Beehiiv dashboard. Grants lifetime access (no
  // monthly/annual expiry, no Stripe/billing record) for as long as the tag
  // stays on the subscriber.
  if (entitlements.found && entitlements.dev_mode) {
    console.warn(`[dev-mode] granting Altitude access via dev-mode tag for ${email} -- no Stripe/billing record backs this`);
    return { granted: true, reason: 'dev_mode_tag', entitlements, sync: null };
  }

  if (entitlements.found && entitlements.subscriber_active && entitlements.altitude_tier) {
    return { granted: true, reason: 'altitude_tier', entitlements, sync: null };
  }

  const taggedPlan = getTaggedAltitudePlan(entitlements);
  const cachedPlan = getActiveCachedAltitudePlan(member);
  if (repair && taggedPlan && cachedPlan) {
    const plan = cachedPlan === 'guide_bundle' ? 'guide_bundle' : cachedPlan;
    const sync = await syncBeehiivAltitudeAccess(email, env, {
      plan,
      stripeCustomerId: member.stripe_customer_id || '',
      active: true,
    }).catch(() => null);

    if (sync && sync.beehiiv_tier_synced) {
      const repaired = await getBeehiivEntitlements(email, env).catch(() => entitlements);
      return { granted: true, reason: 'tier_repaired_from_tag', entitlements: repaired, sync };
    }
    return { granted: false, reason: 'tier_repair_failed', entitlements, sync };
  }

  return { granted: false, reason: taggedPlan ? 'tag_without_active_member' : 'tier_missing', entitlements, sync: null };
}

export async function getBeehiivEntitlements(email, env) {
  if (!email) {
    return emptyBeehiivEntitlements();
  }

  const sub = await findBeehiivSubscription(email, env, { expand: ['tags', 'subscription_premium_tiers'] });
  if (!sub) {
    return emptyBeehiivEntitlements();
  }

  const subscriberActive = !sub.status || sub.status === 'active' || sub.status === 'validating';
  const tags = (sub.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || t.id || '')).toString().toLowerCase()
  );
  const premiumTiers = sub.subscription_premium_tiers || [];
  const tierIds = premiumTiers.map(t => (t.id || '').toString()).filter(Boolean);
  const tierNames = premiumTiers.map(t => (t.name || '').toString()).filter(Boolean);
  const tierConfig = getAltitudeTierConfig(env);
  const altitudeTier = subscriberActive && tierConfig.configured && premiumTiers.some(t => tierMatchesConfig(t, tierConfig));

  return {
    found: true,
    subscriber_active: subscriberActive,
    subscription_id: sub.id || '',
    subscription_tier: sub.subscription_tier || '',
    premium_tier_ids: tierIds,
    premium_tier_names: tierNames,
    tags,
    guide: subscriberActive && tags.includes(GUIDE_TAG_NAME),
    altitude_tier: altitudeTier,
    altitude_monthly: subscriberActive && (
      tags.includes('altitude monthly') || tags.includes(INTERVAL_TAG_IDS.monthly.toLowerCase())
    ),
    altitude_annual: subscriberActive && (
      tags.includes('altitude annual') || tags.includes(INTERVAL_TAG_IDS.annual.toLowerCase())
    ),
    guide_bundle: subscriberActive && (
      tags.includes(GUIDE_BUNDLE_TAG_NAME) || tags.includes(GUIDE_BUNDLE_TAG_ID.toLowerCase())
    ),
    // Manual-only escape hatch for internal/dev testing -- this tag is never
    // applied by any code path in this codebase (Stripe webhook, Beehiiv
    // sync, cron reconciliation, or otherwise), only by a human directly in
    // the Beehiiv dashboard. See resolveBeehiivAltitudeAccess() below for
    // where this grants lifetime Altitude access with no Stripe/billing
    // record behind it. The "Dev Mode Only" Beehiiv segment
    // (seg_ff319f60-8a60-4e21-8dc5-a32c1b084c3b) always shows who currently
    // holds this tag.
    dev_mode: subscriberActive && tags.includes('dev-mode'),
  };
}

// ── Altitude: Pre-Launch Waitlist ──────────────────────────────────────────────

// Deliberately NOT a parallel of setupBeehiivMember's tag cascade — a pre-launch
// signup is a plain Free subscriber, nothing more. There is no "waitlist" tag,
// segment, or automation to enroll into here; the only thing that marks someone
// as a pre-launch signup is utm_campaign, a native Beehiiv attribute captured
// automatically on subscribe. The "Pre-Launch Subscribers" segment (Beehiiv UI)
// filters on utm_campaign = 'altitude_prelaunch' — no subscriber-side plumbing
// needed here beyond setting that default.
export async function handleWaitlist(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_WAITLIST}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 10) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'Invalid request.' }, 400, corsHeaders); }

  // Honeypot — silently accept so bots get no signal. Worth having here
  // (unlike the plain subscribe route below) since this route is specifically
  // the one advertised on Instagram/TikTok bio links.
  if (body['bot-field']) return respond({ success: true }, 200, corsHeaders);

  const email     = (body.email || '').trim().toLowerCase();
  const firstName = (body.first_name || '').toString().trim().slice(0, 80);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'Please enter a valid email address.' }, 400, corsHeaders);
  }

  // Already a paying member — don't re-subscribe, just tell the frontend so it
  // can show "you already have access" instead of the generic success state.
  const isPremium = await checkBeehiivPremium(email, env).catch(() => null);
  if (isPremium === true) {
    await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });
    return respond({ success: true, already_premium: true }, 200, corsHeaders);
  }

  // Same plain Beehiiv subscribe the newsletter route uses below — utm_source/
  // medium stay visitor-supplied (or fall back to generic defaults) for
  // channel-level analytics, but utm_campaign always defaults to
  // 'altitude_prelaunch' so every signup through this endpoint is captured by
  // the segment regardless of which platform (if any) the visitor arrived from.
  // Note: on a 409 (existing subscriber), Beehiiv does not retroactively update
  // utm_campaign on the existing record — an existing free subscriber clicking
  // this form again simply won't newly match the segment, which is fine, they
  // already receive the newsletter and will hear about launch through it.
  const beehiivPayload = {
    email,
    reactivate_existing: true,
    send_welcome_email: false,
    double_opt_override: 'disabled',
    utm_source:   (body.utm_source   || 'website').toString().trim().slice(0, 100),
    utm_medium:   (body.utm_medium   || 'organic').toString().trim().slice(0, 100),
    utm_campaign: (body.utm_campaign || 'altitude_prelaunch').toString().trim().slice(0, 100),
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

  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  if (beehiivRes.status === 201 || beehiivRes.status === 200) {
    // Kick off segment sync so the new subscriber lands in Free + Pre-Launch
    // Subscribers promptly, which is what lets the pre-launch welcome
    // automation (segment_action trigger) fire without a long delay.
    triggerSegmentRecalculation(env).catch(() => {});
    return respond({ success: true }, 200, corsHeaders);
  }
  // 409 (already subscribed to the newsletter) is expected here, not an error.
  if (beehiivRes.status === 409) {
    return respond({ success: true }, 200, corsHeaders);
  }
  return respond({ error: 'Something went wrong. Please try again.' }, 500, corsHeaders);
}

// ── Newsletter: plain subscribe (root POST /) ─────────────────────────────────
// Extracted from the router's fetch() body during the 2026-07-24 module split
// (it used to be inlined directly there, the one route with no named handler
// function) — functionally a near-duplicate of handleWaitlist above, just
// without the waitlist-specific utm_campaign default or premium-member check.

export async function handleSubscribe(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return respond({ error: 'Method Not Allowed' }, 405, corsHeaders);
  }

  const subRlKey = `${KV_PREFIX.RL_SUBSCRIBE}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  const subRlCount = parseInt((await env.ALTITUDE_KV.get(subRlKey)) || '0', 10);
  if (subRlCount >= 15) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  let email, firstName;
  try {
    const body = await request.json();
    // Honeypot — silently accept so bots get no signal. No-op today since no
    // form on the site sends bot-field to this route yet; matches the same
    // convention already used by handleWaitlist and the Airtable routes.
    if (body['bot-field']) return respond({ success: true }, 200, corsHeaders);
    email = (body.email || '').trim().toLowerCase();
    firstName = (body.first_name || '').toString().trim().slice(0, 80);
  } catch {
    return respond({ error: 'Invalid request.' }, 400, corsHeaders);
  }

  // Count every real (non-honeypot) attempt once here, regardless of outcome.
  await env.ALTITUDE_KV.put(subRlKey, String(subRlCount + 1), { expirationTtl: 3600 });

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
    // Kick off segment sync in background so new subscriber appears in Free segment immediately
    triggerSegmentRecalculation(env).catch(() => {});
    return respond({ success: true }, 200, corsHeaders);
  }
  if (beehiivRes.status === 409) {
    return respond({ error: 'already_subscribed' }, 409, corsHeaders);
  }
  return respond({ error: 'Something went wrong. Please try again.' }, 500, corsHeaders);
}

// ── Beehiiv helpers ───────────────────────────────────────────────────────────

// Applies the Altitude Premium Tier plus plan-specific tag. The tier is the
// primary website access signal; the tag stays as fallback/segmentation.
// planTag ('monthly' | 'annual') is required: every real caller
// (orchestration/stripeWebhook.js's handleCheckoutComplete,
// orchestration/session.js's handleActivate session_id fallback) always
// derives one via services/stripe.js's derivePlanFromSubscription. There is
// no more universal "premium" tag to fall back to applying when planTag is
// omitted, so a caller without a real billed plan must NOT call this
// function — the Guide's 90-day bundle grant applies GUIDE_BUNDLE_TAG_NAME
// directly instead (see orchestration/guideBundle.js / tagGuideBundle below).
export async function setupBeehiivMember(email, env, planTag, { stripeCustomerId = '' } = {}) {
  if (isPaidSyncSuppressed(email)) {
    console.warn(`[setupBeehiivMember] suppressed paid member sync for ${email}`);
    return false;
  }

  const tagName = planTag === 'annual' ? 'altitude annual' : planTag === 'monthly' ? 'altitude monthly' : null;
  if (!tagName) {
    console.error(`[setupBeehiivMember] called without a valid planTag ('monthly'|'annual') for ${email}`);
    return false;
  }

  const headers = beehiivHeaders(env);

  // ── Step 1: Subscribe (or reactivate) ──────────────────────────────────────
  const subscribePayload = {
    email,
    reactivate_existing: true,
    send_welcome_email: false,
    double_opt_override: 'disabled',
    utm_source: 'altitude_payment',
    utm_medium: 'stripe',
  };
  if (stripeCustomerId) subscribePayload.stripe_customer_id = stripeCustomerId;

  const subRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(subscribePayload),
    }
  );

  if (!subRes.ok) {
    const errText = await subRes.text().catch(() => '');
    console.error(`[setupBeehiivMember] subscribe failed status=${subRes.status} body=${errText}`);
    return false;
  }
  const subData = await subRes.json();
  const subId   = subData.data?.id;
  if (!subId) {
    console.error(`[setupBeehiivMember] subscribe returned no id — data=${JSON.stringify(subData).slice(0, 200)}`);
    return false;
  }

  const tierSynced = await assignBeehiivAltitudeTier(email, env, { stripeCustomerId }).catch(() => false);
  if (!tierSynced) {
    console.error(`[setupBeehiivMember] altitude tier sync failed for ${email}`);
  }

  // ── Step 2: Idempotency check — already tagged with this interval? ─────────
  // Lets a caller safely retry after a partial earlier failure (see
  // handleActivate's beehiiv_tagged === false retry) without double-applying
  // the tag or re-sending the plan-specific Welcome email. A Guide-bundle
  // recipient buying a real plan for the first time naturally falls through
  // here — they hold krisflyer-bundle, not an interval tag, yet.
  const tagCheckRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (tagCheckRes && tagCheckRes.ok) {
    const tagData = await tagCheckRes.json();
    const existingSub = (tagData.data || tagData.subscriptions || [])[0];
    const currentTags = (existingSub?.tags || []).map(t =>
      (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
    );
    if (currentTags.includes(tagName)) return true;
  }

  // ── Step 3: Apply the interval tag directly — the same proven REST call
  // applyIntervalTag/tagGuideBuyer already use. No automation-enrollment
  // indirection needed now that there's no universal tag left to apply. ──────
  await applyIntervalTag(subId, planTag, headers, env);

  // ── Step 4: Verify, then recalc segments + enroll in the plan-specific
  // Welcome automation. ──────────────────────────────────────────────────────
  if (await verifyIntervalTag(email, planTag, env)) {
    await triggerSegmentRecalculation(env);
    await enrollWelcomeAutomationOnce(email, env, planTag).catch(() => {});
    return true;
  }

  console.error(`[setupBeehiivMember] tag verification failed for ${email} (${tagName})`);
  return false;
}

// Applies the altitude-monthly/altitude-annual tag — the primary tagging
// mechanism now that there's no universal premium tag layered underneath it
// (see setupBeehiivMember). Success/failure is judged by the caller's
// subsequent verifyIntervalTag check, not by this function's own return
// value (it still has none).
export async function applyIntervalTag(subId, planTag, headers, env) {
  const tagName = planTag === 'annual' ? 'altitude annual' : 'altitude monthly';
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
    { method: 'POST', headers, body: JSON.stringify({ tags: [tagName] }) }
  ).catch(() => null);
  if (!res || !res.ok) {
    const errText = res ? await res.text().catch(() => '') : '';
    console.error(`[applyIntervalTag] failed status=${res ? res.status : 'network'} body=${errText.slice(0, 200)}`);
  }
}

// Beehiiv's recalculate endpoint silently no-ops if the request includes a
// body or a Content-Type header (returns 204 but never advances the
// segment's last_processed_at). Confirmed 2026-07-06 via a live A/B test:
// a bare PUT with only the Authorization header genuinely triggers
// recalculation (last_processed_at advances within seconds, reproduced
// across all 3 segments). Do not add a body or Content-Type back here.
// `all: true` (daily cron only, see worker.js's scheduled()) recalculates
// every segment, including SEG_GUIDE/SEG_MONTHLY/SEG_ANNUAL -- those three
// no longer get the real-time recalculation every other call site here
// triggers inline (signup, tagging, etc.), so the daily sweep is now their
// only path to staying fresh. Every other caller keeps the default
// active-only set, since those events already recalculate the segment that
// actually changed the moment it happens -- no need to also touch the three
// paused ones on every signup/tag.
export async function triggerSegmentRecalculation(env, { all = false } = {}) {
  const activeSegments = [SEG_FREE, SEG_PRELAUNCH, SEG_TRAVEL_STRAT_CALL];
  const pausedSegments = [SEG_GUIDE, SEG_MONTHLY, SEG_ANNUAL];
  const segments = all ? [...activeSegments, ...pausedSegments] : activeSegments;

  await Promise.all(segments.map(async segId => {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/segments/${segId}/recalculate`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` },
      }
    ).catch(err => { console.error(`[seg-resync:${segId}] network error: ${err.message}`); return null; });

    if (!res) return;
    if (res.ok) {
      console.log(`[seg-resync:${segId}] recalculation triggered`);
    } else {
      const txt = await res.text().catch(() => '');
      console.error(`[seg-resync:${segId}] failed status=${res.status} body=${txt.slice(0, 200)}`);
    }
  }));
}

// Re-queries the subscription and confirms the specific plan tag just
// applied by applyIntervalTag is actually present — guards against a false
// "200 OK" that didn't actually apply the tag (mirrors verifyGuideTag's
// same pattern for the krisflyer tag).
export async function verifyIntervalTag(email, planTag, env) {
  const tagName = planTag === 'annual' ? 'altitude annual' : 'altitude monthly';
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json();
  const sub  = (data.data || data.subscriptions || [])[0];
  const tags = (sub?.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
  );
  return tags.includes(tagName);
}

export async function enrollInAutomation(automationId, email, env) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${automationId}/journeys`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` },
      body: JSON.stringify({ email }),
    }
  ).catch(() => null);
  return !!(res && res.ok);
}

// planTag must be 'monthly' or 'annual' — the sole callers are
// setupBeehiivMember's two plan-specific paths. There is no generic
// fallback: the old universal Welcome automation this used to fall back to
// (WELCOME_AUTOMATION_ID) was deleted in Beehiiv, and nothing needs a
// plan-less Welcome anymore — see tagGuideBundle below, which no longer
// calls this function at all for the no-activationAutomationId case.
export async function enrollWelcomeAutomation(email, env, planTag) {
  const automationId = planTag === 'monthly' ? WELCOME_MONTHLY_AUTOMATION_ID
    : planTag === 'annual' ? WELCOME_ANNUAL_AUTOMATION_ID
    : null;
  if (!automationId) {
    console.error(`[welcome] enrollWelcomeAutomation called without a valid planTag ('monthly'|'annual') for ${email}`);
    return;
  }
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${automationId}/journeys`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` },
      body: JSON.stringify({ email }),
    }
  ).catch(() => null);
  if (res && res.ok) console.log(`[welcome] enrolled ${email}${planTag ? ` (${planTag})` : ''}`);
  return !!(res && res.ok);
}

async function enrollWelcomeAutomationOnce(email, env, planTag) {
  const key = `${KV_PREFIX.WELCOME_SENT}${planTag}:${email}`;
  if (await env.ALTITUDE_KV.get(key)) return false;
  const sent = await enrollWelcomeAutomation(email, env, planTag);
  if (sent) {
    await env.ALTITUDE_KV.put(key, '1', { expirationTtl: 604800 });
  }
  return sent;
}

// Removes whichever plan tag (altitude-monthly / altitude-annual /
// krisflyer-bundle) matches `plan`. Called on cancellation (a former
// subscriber who later resubscribes on a *different* interval shouldn't end
// up tagged with both at once — that would put them in both the Monthly and
// Annual segments simultaneously) and on Guide-bundle expiry.
export async function removePlanTag(email, plan, env) {
  const tagId = plan === 'guide_bundle' ? GUIDE_BUNDLE_TAG_ID : INTERVAL_TAG_IDS[plan];
  if (!tagId) return; // unset/unknown plan — nothing to remove

  const findRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (!findRes || !findRes.ok) return;
  const findData = await findRes.json();
  const sub = (findData.data || [])[0];
  if (!sub?.id) return;

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${sub.id}/tags/${tagId}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => {});
}

// Swaps the altitude-monthly/altitude-annual tag when an existing member's
// plan changes (the Upgrade-to-Annual flow, or
// orchestration/stripeWebhook.js's handleSubscriptionUpdated safety net).
// Deliberately does NOT enroll in any Welcome automation — this is an
// existing member changing plans, not a first-time signup, so "You're in!
// Welcome to Altitude" would be the wrong email to send.
export async function swapIntervalTag(email, oldPlan, newPlan, env) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };
  const findRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (findRes && findRes.ok) {
    const findData = await findRes.json();
    const sub = (findData.data || [])[0];
    if (sub?.id) {
      await applyIntervalTag(sub.id, newPlan, headers, env).catch(() => {});
    }
  }
  await removePlanTag(email, oldPlan, env).catch(() => {});
  await assignBeehiivAltitudeTier(email, env).catch(() => false);
  await triggerSegmentRecalculation(env).catch(() => {});
}

// ── KrisFlyer Guide: Beehiiv tagging ──────────────────────────────────────────

// Mirrors tagGuideBundle but applies GUIDE_TAG_NAME instead of
// GUIDE_BUNDLE_TAG_NAME — the permanent "bought the Guide" tag.
export async function tagGuideBuyer(email, env) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };

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
        utm_source: 'guide_payment',
        utm_medium: 'stripe',
      }),
    }
  );
  if (!subRes.ok) return false;
  const subData = await subRes.json();
  const subId = subData.data?.id;
  if (!subId) return false;

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
    { method: 'POST', headers, body: JSON.stringify({ tags: [GUIDE_TAG_NAME] }) }
  ).catch(() => null);

  // Re-query and trigger a segment recalc on success — same verify-then-recalc
  // pattern setupBeehiivMember uses for the Altitude tag, so the "KrisFlyer
  // Guide Subscribers" segment (seg_fd7d552b…) updates promptly instead of
  // waiting for Beehiiv's own periodic pass, and a false "200 OK" that didn't
  // actually apply the tag isn't reported as success.
  if (await verifyGuideTag(email, env)) {
    await triggerSegmentRecalculation(env);
    return true;
  }
  return false;
}

// Mirrors verifyIntervalTag but checks for the `krisflyer` tag — kept as a
// separate function (not a shared/parametrized one) so the existing,
// live Altitude tag-verification path is never touched.
export async function verifyGuideTag(email, env) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json();
  const sub  = (data.data || data.subscriptions || [])[0];
  const tags = (sub?.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
  );
  return tags.includes(GUIDE_TAG_NAME);
}

// ── Travel Strategy Call: Beehiiv tagging ─────────────────────────────────────

// Mirrors tagGuideBuyer but applies TRAVEL_STRAT_CALL_TAG_NAME -- called from
// orchestration/stripeWebhook.js's handleAssessmentCheckoutComplete once the
// $99 Stripe session is confirmed paid. Feeds the "Travel Strategy Call
// Buyers" segment (seg_bd786e3e…), which triggers the (currently draft)
// confirmation-email automation once published.
export async function tagTravelStrategyCallBuyer(email, env) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };

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
        utm_source: 'assessment_payment',
        utm_medium: 'stripe',
      }),
    }
  );
  if (!subRes.ok) return false;
  const subData = await subRes.json();
  const subId = subData.data?.id;
  if (!subId) return false;

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
    { method: 'POST', headers, body: JSON.stringify({ tags: [TRAVEL_STRAT_CALL_TAG_NAME] }) }
  ).catch(() => null);

  if (await verifyTravelStratCallTag(email, env)) {
    await triggerSegmentRecalculation(env);
    return true;
  }
  return false;
}

// Mirrors verifyGuideTag but checks for the `travel-strat-call` tag.
export async function verifyTravelStratCallTag(email, env) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json();
  const sub  = (data.data || data.subscriptions || [])[0];
  const tags = (sub?.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
  );
  return tags.includes(TRAVEL_STRAT_CALL_TAG_NAME);
}

// Mirrors tagGuideBuyer but applies GUIDE_BUNDLE_TAG_NAME instead of
// GUIDE_TAG_NAME. `activationAutomationId` is additive: omitted (the
// standalone-grant path, orchestration/guideBundle.js's
// grantGuideAltitudeBundle) tags/recalculates only and sends no email of its
// own — the bonus 90-day access is mentioned in the Purchase Confirmation
// email every Guide buyer already gets (see handleGuideCheckoutComplete),
// not a separate automation; passed (the deferred-activation path,
// activateDeferredGuideBundle) sends that dedicated automation, since
// "Welcome to Altitude" would read oddly to someone reactivating after their
// real membership just ended.
export async function tagGuideBundle(email, env, activationAutomationId) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };

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
      }),
    }
  );
  if (!subRes.ok) return false;
  const subData = await subRes.json();
  const subId = subData.data?.id;
  if (!subId) return false;

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
    { method: 'POST', headers, body: JSON.stringify({ tags: [GUIDE_BUNDLE_TAG_NAME] }) }
  ).catch(() => null);

  if (await verifyGuideBundleTag(email, env)) {
    await assignBeehiivAltitudeTier(email, env).catch(() => false);
    await triggerSegmentRecalculation(env);
    if (activationAutomationId) {
      await enrollInAutomation(activationAutomationId, email, env).catch(() => {});
    }
    return true;
  }
  return false;
}

// Mirrors verifyGuideTag but checks for the krisflyer-bundle tag.
export async function verifyGuideBundleTag(email, env) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions` +
      `?email=${encodeURIComponent(email)}&expand[]=tags&limit=1`,
    { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
  ).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json();
  const sub  = (data.data || data.subscriptions || [])[0];
  const tags = (sub?.tags || []).map(t =>
    (typeof t === 'string' ? t : (t.name || '')).toLowerCase()
  );
  return tags.includes(GUIDE_BUNDLE_TAG_NAME);
}

// ── Magic link (Guide + on-demand Member Access) ──────────────────────────────
// Note: sendStarterMagicLink (the fresh-Altitude-checkout variant) lives in
// orchestration/session.js instead of here, tightly coupled to
// handleActivate's request/Origin handling — see that file's header comment.

// Sends the magic link for a fresh KrisFlyer Guide purchase — called from
// orchestration/stripeWebhook.js's handleGuideCheckoutComplete. Same KV
// magic:{token} + MAGIC_LINK_CF_NAME mechanism handleMagicRequest uses,
// duplicated (not refactored out) so the existing Altitude magic-request
// path is left completely untouched. No request Origin header exists here
// (this runs from the Stripe webhook, not a browser) — `origin` is instead
// the browser Origin captured at checkout-creation time and threaded through
// via the Stripe session's metadata (see handleGuideCheckout/
// handleGuideCheckoutComplete), so local test purchases still get a
// localhost link while real purchases fall through getBaseUrl's default to
// the production site. Enrolls in GUIDE_MAGIC_LINK_AUTOMATION_ID (its own
// dedicated automation) rather than MAGIC_LINK_AUTOMATION_ID — the token/CF
// mechanism is shared/automation-agnostic, only the notification email differs.
export async function sendGuideMagicLink(email, env, origin) {
  const token    = generateMagicToken();
  const baseUrl  = getBaseUrl(origin || '');
  const magicUrl = `${baseUrl}/pages/private-pages/kf-guide-access-portal.html?magic=${token}`;
  await env.ALTITUDE_KV.put(
    `${KV_PREFIX.MAGIC}${token}`,
    JSON.stringify({ email, exp: Date.now() + 3_600_000 }),
    { expirationTtl: 3600 }
  );

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };
  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: false,
        double_opt_override: 'disabled',
        custom_fields: [{ name: MAGIC_LINK_CF_NAME, value: magicUrl }],
      }),
    }
  ).catch(() => {});

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${GUIDE_MAGIC_LINK_AUTOMATION_ID}/journeys`,
    { method: 'POST', headers, body: JSON.stringify({ email }) }
  ).catch(() => {});
}

// Guide PDF delivery ("Send to My Email") — same two-call shape as
// sendGuideMagicLink (write a custom field, then trigger the automation that
// emails it), just two custom fields instead of one: the signed R2 download
// link and the derived password, so the automation's template can place them
// separately in the email body (per the confirmed design — no attachment,
// since Beehiiv can't send one). GUIDE_PDF_EMAIL_AUTOMATION_ID must be filled
// in (config/constants.js) after that automation is created in the Beehiiv
// dashboard — this is a no-op until then, matching the documented pattern for
// still-draft automations elsewhere in this file (see WELCOME_MONTHLY/ANNUAL).
export async function sendGuidePdfDeliveryEmail(email, downloadUrl, password, env) {
  if (!GUIDE_PDF_EMAIL_AUTOMATION_ID) {
    console.error('[guide-pdf-email] GUIDE_PDF_EMAIL_AUTOMATION_ID not configured — skipping send');
    return false;
  }
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };

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
        custom_fields: [
          { name: GUIDE_PDF_DOWNLOAD_URL_CF_NAME, value: downloadUrl },
          { name: GUIDE_PDF_PASSWORD_CF_NAME, value: password },
        ],
      }),
    }
  ).catch(() => null);
  if (!subRes || !subRes.ok) return false;

  const journeyRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${GUIDE_PDF_EMAIL_AUTOMATION_ID}/journeys`,
    { method: 'POST', headers, body: JSON.stringify({ email }) }
  ).catch(() => null);
  return !!(journeyRes && journeyRes.ok);
}

// Travel Strategy Call confirmation email -- same two-call shape as
// sendGuidePdfDeliveryEmail directly above (write the signed booking-link
// custom field, then POST the automation's /journeys endpoint to enroll and
// send immediately). Deliberately NOT left to fire purely off the
// travel-strat-call tag's segment_action trigger (see tagTravelStrategyCallBuyer)
// -- segment recalculation has its own latency (up to the next cron pass, see
// orchestration/cron.js), and this confirmation email is time-sensitive.
// The tag+segment still exist for CRM/reporting; this is the reliable send path.
export async function sendAssessmentBookingEmail(email, bookingUrl, env) {
  if (!TRAVEL_STRAT_CALL_AUTOMATION_ID) {
    console.error('[assessment-booking-email] TRAVEL_STRAT_CALL_AUTOMATION_ID not configured — skipping send');
    return false;
  }
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };

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
        custom_fields: [{ name: TRAVEL_STRAT_CALL_BOOKING_URL_CF_NAME, value: bookingUrl }],
      }),
    }
  ).catch(() => null);
  if (!subRes || !subRes.ok) return false;

  const journeyRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${TRAVEL_STRAT_CALL_AUTOMATION_ID}/journeys`,
    { method: 'POST', headers, body: JSON.stringify({ email }) }
  ).catch(() => null);
  return !!(journeyRes && journeyRes.ok);
}

export async function handleMagicRequest(request, env, corsHeaders) {
  let email, product;
  try {
    const body = await request.json();
    email   = (body.email || '').trim().toLowerCase();
    product = body.product === 'guide' ? 'guide' : 'altitude';
  } catch { return respond({ error: 'Invalid request.' }, 400, corsHeaders); }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'Please enter a valid email address.' }, 400, corsHeaders);
  }

  // Rate limit: max 3 magic link requests per email per 10 minutes
  const rlKey = `${KV_PREFIX.RL_MAGIC}${email}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 3) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  // Two independent, strictly-scoped checks — deliberately NOT an either/or
  // (that was tried, then reverted: a Guide-only owner requesting through the
  // Altitude modal or vice versa is a confusing product-copy mismatch, and an
  // Altitude member with no Guide purchase has no legitimate reason to read
  // the Guide). `product` comes from which modal the request originated from
  // — components/magic-modal.html sends 'altitude', components/magic-modal-
  // krisflyer.html sends 'guide'.
  let granted = false;
  if (product === 'guide') {
    granted = !!(await env.ALTITUDE_KV.get(`${KV_PREFIX.GUIDE}${email}`));
    if (!granted) {
      return respond({ error: 'No KrisFlyer Guide access found for this email.' }, 404, corsHeaders);
    }
  } else {
    const kvRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`).catch(() => null);
    let member = null;
    if (kvRaw) {
      try { member = JSON.parse(kvRaw); } catch {}
    }

    const decision = await resolveBeehiivAltitudeAccess(email, env, { member, repair: true });
    granted = decision.granted === true;
    if (member && decision.sync) {
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify({ ...member, ...decision.sync })).catch(() => {});
    } else if (member && decision.reason === 'altitude_tier' && decision.entitlements) {
      Object.assign(member, beehiivSyncMetadata(decision.entitlements, { tierSynced: true }));
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member)).catch(() => {});
    }
    if (!granted) {
      return respond({ error: 'No active Altitude membership found for this email.' }, 404, corsHeaders);
    }
  }

  const destPage     = product === 'guide' ? 'private-pages/kf-guide-access-portal.html' : 'private-pages/altitude-access-portal.html';
  const automationId = product === 'guide' ? GUIDE_MAGIC_LINK_AUTOMATION_ID : MAGIC_LINK_AUTOMATION_ID;

  // Generate token — use local origin so the link works during local dev
  const token    = generateMagicToken();
  const baseUrl  = getBaseUrl(request.headers.get('Origin') || '');
  const magicUrl = `${baseUrl}/pages/${destPage}?magic=${token}`;
  await env.ALTITUDE_KV.put(
    `${KV_PREFIX.MAGIC}${token}`,
    JSON.stringify({ email, exp: Date.now() + 3_600_000 }),
    { expirationTtl: 3600 }
  );

  // Write magic link URL into the subscriber's custom field then enroll in automation
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` };
  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/subscriptions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: false,
        double_opt_override: 'disabled',
        custom_fields: [{ name: MAGIC_LINK_CF_NAME, value: magicUrl }],
      }),
    }
  ).catch(() => {});

  await fetch(
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${automationId}/journeys`,
    { method: 'POST', headers, body: JSON.stringify({ email }) }
  ).catch(() => {});

  // Increment rate-limit counter
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 600 });

  return respond({ sent: true }, 200, corsHeaders);
}
