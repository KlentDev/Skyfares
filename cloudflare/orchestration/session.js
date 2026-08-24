// orchestration/session.js — the member-facing session lifecycle: activating
// a fresh checkout (Stripe verify + Beehiiv fulfil + magic-link send, all in
// one function), verifying an existing JWT, and consuming a magic-link token.
// handleActivate calls both Stripe and Beehiiv APIs in one body — the
// textbook cross-cutting case this orchestration/ layer exists for.
import { respond, getBaseUrl } from '../utils/http.js';
import { getBearer, verifyJwt, signJwt, generateMagicToken } from '../utils/jwt.js';
import { derivePlanFromSubscription, getSubscriptionPeriodEnd } from '../services/stripe.js';
import {
  syncBeehiivAltitudeAccess, resolveBeehiivAltitudeAccess, triggerSegmentRecalculation,
  getBeehiivEntitlements, beehiivSyncMetadata,
} from '../services/beehiiv.js';
import { KV_PREFIX, MAGIC_LINK_CF_NAME, STARTER_MAGIC_LINK_AUTOMATION_ID } from '../config/constants.js';

// Sends the magic link for a brand-new Altitude Monthly/Annual subscriber
// right after checkout — called from handleActivate's session_id path below
// in place of issuing a JWT, so a fresh subscriber logs in by clicking the
// email exactly like every other member, instead of being auto-logged-in.
// Mirrors services/beehiiv.js's handleMagicRequest send block (same
// magic:{token} KV entry, same MAGIC_LINK_CF_NAME custom field, same
// /pages/private-pages/altitude-access-portal.html?magic= destination), but
// enrolls in STARTER_MAGIC_LINK_AUTOMATION_ID instead of
// MAGIC_LINK_AUTOMATION_ID. Kept here rather than services/beehiiv.js since
// it's tightly coupled to this file's request/Origin handling and only ever
// called from handleActivate.
async function sendStarterMagicLink(email, env, origin) {
  const token    = generateMagicToken();
  const baseUrl  = getBaseUrl(origin || '');
  const magicUrl = `${baseUrl}/pages/private-pages/altitude-access-portal.html?magic=${token}`;
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
    `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/automations/${STARTER_MAGIC_LINK_AUTOMATION_ID}/journeys`,
    { method: 'POST', headers, body: JSON.stringify({ email }) }
  ).catch(() => {});
}

// ── Altitude: Activate (verify payment + fulfill; issue JWT only for the
//    legacy email-only path — see isFreshCheckout below) ───────────────────

export async function handleActivate(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return respond({ error: 'Invalid request.' }, 400, corsHeaders); }

  const sessionId = (body.session_id || '').trim();
  const email     = (body.email     || '').trim().toLowerCase();

  if (!sessionId && !email) {
    return respond({ error: 'Provide session_id or email.' }, 400, corsHeaders);
  }

  // A fresh Stripe checkout must NOT auto-log the subscriber in — they get
  // emailed a magic link instead (sendStarterMagicLink above) and log in by
  // clicking it, same as every other member. Only the email-only path
  // (currently unused by any frontend — kept for API completeness) still
  // issues a JWT directly.
  const isFreshCheckout = !!sessionId;

  // Rate limit on the email path only (session_id path is Stripe-verified).
  // Only FAILED lookups increment the counter — successful logins never block.
  const rlKey = !sessionId
    ? `${KV_PREFIX.RL_ACTIVATE}${request.headers.get('CF-Connecting-IP') || 'unknown'}`
    : null;
  if (rlKey) {
    const count = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
    if (count >= 20) {
      return respond({ error: 'rate_limited' }, 429, corsHeaders);
    }
  }

  let memberEmail = email;

  // Session ID path — verify payment with Stripe and write member record if needed
  if (sessionId) {
    if (!env.STRIPE_SECRET_KEY) return respond({ error: 'Stripe not configured.' }, 503, corsHeaders);

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}` +
        `?expand[]=subscription&expand[]=customer&expand[]=subscription.items.data.price`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
    ).catch(() => null);

    if (!res || !res.ok) return respond({ error: 'Could not verify payment.' }, 400, corsHeaders);

    const sess = await res.json();
    if (sess.payment_status !== 'paid') {
      return respond({ error: 'Payment not completed.' }, 402, corsHeaders);
    }
    // This endpoint activates Altitude subscription access only. Since the
    // KrisFlyer Guide's one-time-payment sessions (mode: 'payment') also come
    // from this same Stripe account and can also reach payment_status:'paid',
    // without this check a Guide buyer could submit their own session_id here
    // and be granted free Altitude access. Guide buyers activate via their
    // emailed magic link instead (see orchestration/stripeWebhook.js's
    // handleGuideCheckoutComplete), never here.
    if (sess.mode !== 'subscription') {
      return respond({ error: 'This session is not an Altitude subscription.' }, 400, corsHeaders);
    }

    memberEmail = (sess.customer_details?.email || sess.customer_email || '').toLowerCase();
    if (!memberEmail) return respond({ error: 'No email on session.' }, 400, corsHeaders);

    // Write member record if webhook hasn't arrived yet
    const existing = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${memberEmail}`);
    if (!existing) {
      const custId = typeof sess.customer === 'string' ? sess.customer : sess.customer?.id;
      const sub    = sess.subscription;
      const { plan, amount_cents } = derivePlanFromSubscription(sub);
      const record = {
        email: memberEmail,
        stripe_customer_id:     custId || '',
        stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || '',
        stripe_session_id:      sessionId,
        status:                 'active',
        plan,
        amount_cents,
        currency:               'usd',
        joined_at:              new Date().toISOString(),
        current_period_end:     getSubscriptionPeriodEnd(sub)
          ? new Date(getSubscriptionPeriodEnd(sub) * 1000).toISOString() : '',
      };
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${memberEmail}`, JSON.stringify(record));
      if (custId) await env.ALTITUDE_KV.put(`${KV_PREFIX.CUSTOMER}${custId}`, memberEmail);
      const sync = await syncBeehiivAltitudeAccess(memberEmail, env, {
        plan,
        stripeCustomerId: custId || '',
        active: true,
      }).catch(() => null);
      if (sync) {
        await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${memberEmail}`, JSON.stringify({ ...record, ...sync }));
      }
    }

    // Always recalculate both segments when a subscriber hits the success page.
    // This fires from the user's own browser — independent of webhook timing —
    // so it is the most reliable real-time trigger we have.
    triggerSegmentRecalculation(env).catch(() => {});
  }

  // ── Authorize ──────────────────────────────────────────────────────────────
  // Source of truth for website premium access is Beehiiv Premium Tier. Tags
  // only help repair the tier when KV still shows an active paid member; KV is
  // otherwise a cache and short outage fallback for recently verified tiers.
  let authorized = false;

  const existing = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${memberEmail}`).catch(() => null);
  let kvRec = null;
  if (existing) {
    try { kvRec = JSON.parse(existing); } catch {}
  }

  const decision = await resolveBeehiivAltitudeAccess(memberEmail, env, { member: kvRec, repair: true });
  if (decision.granted === true) {
    authorized = true;
    const tierMeta = decision.entitlements
      ? beehiivSyncMetadata(decision.entitlements, { tierSynced: true })
      : {};
    if (!kvRec) {
      const ent = decision.entitlements || {};
      const plan = ent.altitude_annual ? 'annual' : ent.altitude_monthly ? 'monthly' : 'monthly';
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${memberEmail}`, JSON.stringify({
        email: memberEmail,
        status: 'active',
        plan,
        amount_cents: plan === 'annual' ? 3999 : 499,
        currency: 'usd',
        source: decision.reason || 'beehiiv_tier',
        joined_at: new Date().toISOString(),
        ...tierMeta,
      }));
    } else {
      const update = decision.sync || tierMeta;
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${memberEmail}`, JSON.stringify({ ...kvRec, ...update }));
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
  const kvRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${memberEmail}`);
  if (kvRaw) {
    const kvRec = JSON.parse(kvRaw);
    if (kvRec.beehiiv_tagged === false || kvRec.beehiiv_tier_synced === false) {
      syncBeehiivAltitudeAccess(memberEmail, env, {
        plan: kvRec.plan,
        stripeCustomerId: kvRec.stripe_customer_id || '',
        active: true,
      }).then(async sync => {
        Object.assign(kvRec, sync);
        await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${memberEmail}`, JSON.stringify(kvRec));
      }).catch(() => {});
    }
  }

  if (isFreshCheckout) {
    await sendStarterMagicLink(memberEmail, env, request.headers.get('Origin') || '').catch(() => {});
    return respond({ success: true, magic_link_sent: true, email: memberEmail }, 200, corsHeaders);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { sub: memberEmail, typ: 'altitude', iat: now, exp: now + 86400 }, // 24 hours
    env.JWT_SECRET
  );

  return respond({ token, email: memberEmail }, 200, corsHeaders);
}

// ── Altitude: Verify JWT ──────────────────────────────────────────────────────

export async function handleVerify(request, env, corsHeaders) {
  const url = new URL(request.url);
  const requestedTarget = url.searchParams.get('target') || '';
  if (requestedTarget && !['guide', 'altitude'].includes(requestedTarget)) {
    return respond({
      authenticated: false,
      email: '',
      target: requestedTarget,
      granted: false,
      reason: 'invalid_target',
      message: 'Invalid access target.',
      purchase_options: [],
    }, 400, corsHeaders);
  }
  const target = requestedTarget;
  const token = getBearer(request);
  if (!token) {
    return target
      ? respond(entitlementDenied(target, '', 'not_authenticated'), 401, corsHeaders)
      : respond({ valid: false }, 401, corsHeaders);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return target
      ? respond(entitlementDenied(target, '', 'session_expired'), 401, corsHeaders)
      : respond({ valid: false }, 401, corsHeaders);
  }

  // Guide access is independent of Altitude membership — looked up alongside
  // it so one shared JWT can report both (krisflyer.md §3). Purely additive:
  // every existing status code and the `valid` flag below stay keyed to
  // Altitude membership only, exactly as before.
  const guideRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.GUIDE}${payload.sub}`);
  let guide = guideRaw ? JSON.parse(guideRaw) : null;
  const guideActive = !!guide && guide.status === 'active';

  // Also confirm member is still active in KV
  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${payload.sub}`);
  if (!raw) {
    if (target) {
      const decision = await verifyTargetEntitlement(target, payload.sub, null, guide, env);
      return respond({ valid: targetValid(target, decision), guide: decision.guide || guideActive, ...decision }, 200, corsHeaders);
    }
    return respond({ valid: false, guide: guideActive }, 401, corsHeaders);
  }

  let member = JSON.parse(raw);
  if (member.status !== 'active') {
    if (target) {
      const decision = await verifyTargetEntitlement(target, payload.sub, member, guide, env);
      return respond({ valid: targetValid(target, decision), status: member.status, guide: decision.guide || guideActive, ...decision }, 200, corsHeaders);
    }
    return respond({ valid: false, status: member.status, guide: guideActive }, 403, corsHeaders);
  }

  // Self-heal: some records predate current_period_end being reliably
  // written at checkout (and, until 2026-07-24, ALL records — this account
  // runs Stripe's "flexible" billing mode, which moved current_period_end
  // off the top-level Subscription object entirely, see
  // services/stripe.js's getSubscriptionPeriodEnd) and carry a real
  // stripe_subscription_id but a blank current_period_end. Backfill it from
  // Stripe here so the membership card's "days remaining" always has
  // something to compute from. Runs at most once per record (the write
  // below makes this a no-op on every later /verify).
  if (!member.current_period_end && member.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
    ).catch(() => null);
    if (subRes && subRes.ok) {
      const sub = await subRes.json();
      const periodEnd = getSubscriptionPeriodEnd(sub);
      if (periodEnd) {
        member.current_period_end = new Date(periodEnd * 1000).toISOString();
        await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${payload.sub}`, JSON.stringify(member));
      }
    }
  }

  if (target) {
    const decision = await verifyTargetEntitlement(target, payload.sub, member, guide, env);
    return respond({ valid: targetValid(target, decision), email: payload.sub, member, guide: decision.guide || guideActive, ...decision }, 200, corsHeaders);
  }

  return respond({ valid: true, email: payload.sub, member, guide: guideActive }, 200, corsHeaders);
}

export async function verifyAltitudeRequest(request, env) {
  const token = getBearer(request);
  if (!token) {
    return { ok: false, status: 401, data: entitlementDenied('altitude', '', 'not_authenticated') };
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) {
    return { ok: false, status: 401, data: entitlementDenied('altitude', '', 'session_expired') };
  }

  let member = null;
  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${payload.sub}`).catch(() => null);
  if (raw) {
    try { member = JSON.parse(raw); } catch {}
  }

  const decision = await verifyAltitudeEntitlement(payload.sub, member, env);
  if (targetValid('altitude', decision)) {
    return { ok: true, status: 200, email: payload.sub, member, data: decision };
  }

  return { ok: false, status: 403, data: decision };
}

function targetValid(target, decision) {
  if (target === 'guide') return !!decision.granted;
  return decision.altitude_valid != null ? !!decision.altitude_valid : !!decision.granted;
}

async function verifyTargetEntitlement(target, email, member, guide, env) {
  if (target === 'guide') return verifyGuideEntitlement(email, guide, env);
  return verifyAltitudeEntitlement(email, member, env);
}

async function verifyGuideEntitlement(email, guide, env) {
  if (guide && guide.status === 'active') {
    return {
      authenticated: true,
      email,
      target: 'guide',
      granted: true,
      reason: 'guide_active',
      message: 'KrisFlyer Guide access verified.',
      purchase_options: [],
      guide: true,
      entitlement: {
        product: 'guide',
        plan: 'guide',
        status: 'active',
        source: guide.source || 'kv',
      },
    };
  }

  const beehiiv = await getBeehiivEntitlements(email, env).catch(() => null);
  if (beehiiv && (beehiiv.guide || beehiiv.guide_bundle)) {
    const record = {
      email,
      status: 'active',
      source: beehiiv.guide ? 'beehiiv_guide_tag' : 'beehiiv_bundle_tag',
      recovered_at: new Date().toISOString(),
    };
    await env.ALTITUDE_KV.put(`${KV_PREFIX.GUIDE}${email}`, JSON.stringify(record));
    return {
      authenticated: true,
      email,
      target: 'guide',
      granted: true,
      reason: 'guide_recovered',
      message: 'KrisFlyer Guide access verified.',
      purchase_options: [],
      guide: true,
      entitlement: {
        product: 'guide',
        plan: 'guide',
        status: 'active',
        source: record.source,
      },
    };
  }

  return entitlementDenied('guide', email, 'guide_not_owned');
}

async function verifyAltitudeEntitlement(email, member, env) {
  const normalized = member ? await normalizeAltitudeMember(email, member, env) : null;
  const decision = await resolveBeehiivAltitudeAccess(email, env, { member, repair: true });

  if (decision.granted) {
    if (member && normalized && normalized.granted) {
      const tierMeta = decision.entitlements
        ? beehiivSyncMetadata(decision.entitlements, { tierSynced: true })
        : {};
      Object.assign(member, decision.sync || tierMeta);
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member)).catch(() => {});
      return altitudeGranted(email, member, decision.reason || 'altitude_tier');
    }

    const ent = decision.entitlements || {};
    const tierPlan = ent.altitude_annual ? 'annual' : ent.altitude_monthly ? 'monthly' : 'monthly';
    return recoverBeehiivAltitude(email, tierPlan, env, decision.reason || 'beehiiv_tier');
  }

  if (normalized && normalized.reason !== 'altitude_missing') return normalized;
  return normalized || entitlementDenied('altitude', email, 'altitude_missing');
}

async function normalizeAltitudeMember(email, member, env) {
  if (!member) return entitlementDenied('altitude', email, 'altitude_missing');
  if (member.status !== 'active') return entitlementDenied('altitude', email, 'altitude_inactive', member);

  const plan = member.plan || '';
  if (plan === 'guide_bundle') return normalizeGuideBundleMember(email, member, env);
  if (plan === 'monthly' || plan === 'annual') return normalizePaidAltitudeMember(email, member, env);

  return entitlementDenied('altitude', email, 'altitude_unknown_plan', member);
}

async function normalizePaidAltitudeMember(email, member, env) {
  if (isFutureDate(member.current_period_end) || !member.current_period_end) {
    return altitudeGranted(email, member, member.current_period_end ? 'altitude_active' : 'altitude_active_no_period');
  }

  if (member.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
    const refreshed = await refreshStripeMember(email, member, env).catch(() => null);
    if (refreshed && refreshed.status === 'active' &&
        (!refreshed.current_period_end || isFutureDate(refreshed.current_period_end))) {
      return altitudeGranted(email, refreshed, 'altitude_refreshed');
    }
    if (refreshed) {
      return entitlementDenied('altitude', email, 'altitude_expired', refreshed);
    }
  }

  return entitlementDenied('altitude', email, 'altitude_expired', member);
}

async function normalizeGuideBundleMember(email, member, env) {
  if (!member.current_period_end) return entitlementDenied('altitude', email, 'bundle_missing_dates', member);
  if (isFutureDate(member.current_period_end)) return altitudeGranted(email, member, 'bundle_active');

  member.status = 'cancelled';
  member.cancelled_at = new Date().toISOString();
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member));
  await syncBeehiivAltitudeAccess(email, env, { plan: 'guide_bundle', active: false }).catch(() => {});
  return entitlementDenied('altitude', email, 'bundle_expired', member);
}

async function refreshStripeMember(email, member, env) {
  const subRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  ).catch(() => null);
  if (!subRes || !subRes.ok) return null;

  const sub = await subRes.json();
  const { plan, amount_cents } = derivePlanFromSubscription(sub);
  const periodEnd = getSubscriptionPeriodEnd(sub);
  member.status = sub.status === 'active' ? 'active' : sub.status;
  member.plan = plan;
  member.amount_cents = amount_cents;
  if (periodEnd) member.current_period_end = new Date(periodEnd * 1000).toISOString();
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member));
  return member;
}

async function recoverBeehiivAltitude(email, plan, env, source = 'beehiiv_tier') {
  const record = {
    email,
    stripe_customer_id: '',
    stripe_subscription_id: '',
    stripe_session_id: '',
    status: 'active',
    plan,
    amount_cents: plan === 'annual' ? 3999 : 499,
    currency: 'usd',
    source,
    recovered_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
  };
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));
  return altitudeGranted(email, record, 'altitude_recovered');
}

function altitudeGranted(email, member, reason) {
  const plan = member.plan || 'altitude';
  const days = daysRemaining(member.current_period_end);
  return {
    authenticated: true,
    email,
    target: 'altitude',
    granted: true,
    altitude_valid: true,
    reason,
    message: plan === 'guide_bundle'
      ? 'Your complimentary Altitude access is active.'
      : 'Altitude access verified.',
    purchase_options: [],
    expires_at: member.current_period_end || '',
    days_remaining: days,
    member,
    entitlement: {
      product: 'altitude',
      plan,
      status: member.status || 'active',
      source: member.source || 'kv',
      expires_at: member.current_period_end || '',
    },
  };
}

function entitlementDenied(target, email, reason, member) {
  const messages = {
    not_authenticated: 'Please sign in again to verify access.',
    session_expired: 'Your session has expired. Please request a new login link from the product page.',
    guide_not_owned: 'You do not currently own the KrisFlyer Guide.',
    altitude_missing: 'No active Altitude membership was found for this account.',
    altitude_inactive: 'This Altitude membership is not currently active.',
    altitude_expired: 'This Altitude membership appears to have expired.',
    altitude_unknown_plan: 'We could not verify this Altitude membership. Please contact support.',
    bundle_expired: 'Your complimentary Altitude membership has expired.',
    bundle_missing_dates: 'We found a KrisFlyer Bundle signal, but could not verify its active dates. Please contact support.',
  };

  return {
    authenticated: reason !== 'not_authenticated' && reason !== 'session_expired',
    email,
    target,
    granted: false,
    altitude_valid: target === 'altitude' ? false : undefined,
    reason,
    message: messages[reason] || 'Access could not be verified.',
    purchase_options: target === 'guide' ? ['guide'] : ['monthly', 'annual'],
    expires_at: member && member.current_period_end ? member.current_period_end : '',
    days_remaining: member && member.current_period_end ? daysRemaining(member.current_period_end) : null,
  };
}

function isFutureDate(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

function daysRemaining(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
}

// ── Magic link: verify ─────────────────────────────────────────────────────────

export async function handleMagicVerify(request, env, corsHeaders) {
  const rlKey = `${KV_PREFIX.RL_MAGIC_VERIFY}${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  async function rateLimitedFailure(data, status) {
    const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
    if (rlCount >= 10) {
      return respond({ error: 'rate_limited' }, 429, corsHeaders);
    }
    await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 600 });
    return respond(data, status, corsHeaders);
  }

  let token;
  try {
    const body = await request.json();
    token = (body.token || '').trim();
  } catch { return rateLimitedFailure({ error: 'Invalid request.' }, 400); }

  if (!token) return rateLimitedFailure({ error: 'Missing token.' }, 400);

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MAGIC}${token}`);
  if (!raw) return rateLimitedFailure({ error: 'This link has expired or has already been used.' }, 404);

  let record;
  try { record = JSON.parse(raw); } catch { return rateLimitedFailure({ error: 'Invalid token.' }, 400); }

  if (Date.now() > record.exp) {
    return rateLimitedFailure({ error: 'This link has expired. Please request a new one.' }, 410);
  }

  // Guide claim is additive — existing sub/typ/iat/exp fields are unchanged,
  // so this token still verifies identically for the Altitude-only path.
  const guideRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.GUIDE}${record.email}`);
  const guide = guideRaw ? JSON.parse(guideRaw) : null;
  const guideActive = !!guide && guide.status === 'active';

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    { sub: record.email, typ: 'altitude', guide: guideActive, iat: now, exp: now + 86400 },
    env.JWT_SECRET
  );

  // Do not delete the magic token after a successful verification. Mail
  // clients, security scanners, and preview browsers can execute the portal
  // page before the member's real click; burning the token on first use makes
  // those normal email behaviors look like an expired link. The KV TTL and
  // record.exp above still limit the bearer link to one hour.
  return respond({ token: jwt, email: record.email }, 200, corsHeaders);
}
