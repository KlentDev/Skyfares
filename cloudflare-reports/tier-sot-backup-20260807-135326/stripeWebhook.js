// orchestration/stripeWebhook.js — the Stripe webhook dispatcher plus every
// handler that reacts to a webhook event by calling into BOTH Stripe-shaped
// data and Beehiiv state in the same function body. These can't live in a
// single services/*.js module — see krisflyer.md for the module-split design.
import { verifyStripeSignature, derivePlanFromSubscription, getSubscriptionPeriodEnd } from '../services/stripe.js';
import {
  syncBeehiivAltitudeAccess, removePlanTag, tagGuideBuyer, swapIntervalTag,
  enrollInAutomation, sendGuideMagicLink, tagTravelStrategyCallBuyer,
  sendAssessmentBookingEmail,
} from '../services/beehiiv.js';
import { grantGuideAltitudeBundle, activateDeferredGuideBundle } from './guideBundle.js';
import { buildAssessmentBookingUrl } from '../utils/signedLink.js';
import {
  KV_PREFIX, UPGRADED_ANNUAL_AUTOMATION_ID, GUIDE_CONFIRMATION_AUTOMATION_ID,
  RENEWED_MONTHLY_AUTOMATION_ID, RENEWED_ANNUAL_AUTOMATION_ID,
} from '../config/constants.js';

// ── Altitude: Stripe Webhook ──────────────────────────────────────────────────

export async function handleStripeWebhook(request, env, corsHeaders) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const body      = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';

  // Two possible signing secrets: STRIPE_WEBHOOK_SECRET (Altitude/Guide, the
  // real live Stripe account) and STRIPE_WEBHOOK_SECRET_ASSESSMENT (the
  // "Klent sandbox" account's own webhook endpoint, we_1U0DUnB9NfKSwBnU...,
  // used only while the Travel Strategy Call product is being tested there —
  // see services/stripe.js's handleAssessmentCheckout). Checking both here,
  // rather than a separate route, keeps this one webhook URL the single
  // source of truth both Stripe accounts already point at.
  let valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid && env.STRIPE_WEBHOOK_SECRET_ASSESSMENT) {
    valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET_ASSESSMENT);
  }
  if (!valid) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  if (event.id) {
    const eventKey = `${KV_PREFIX.STRIPE_EVENT}${event.id}`;
    if (await env.ALTITUDE_KV.get(eventKey)) {
      return new Response('ok', { status: 200 });
    }
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // Guide and Travel Strategy Call purchases are both one-time (mode:
      // 'payment'); Altitude stays 'subscription'. metadata.product tells the
      // two 'payment' products apart (set at session creation in
      // services/stripe.js's handleGuideCheckout / handleAssessmentCheckout).
      // Branching here keeps the existing Altitude/Guide paths untouched.
      if (event.data.object.mode === 'payment') {
        if (event.data.object.metadata?.product === 'assessment') {
          await handleAssessmentCheckoutComplete(event.data.object, env);
        } else {
          await handleGuideCheckoutComplete(event.data.object, env);
        }
      } else {
        await handleCheckoutComplete(event.data.object, env);
      }
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object, env);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object, env);
      break;
  }

  if (event.id) {
    await env.ALTITUDE_KV.put(`${KV_PREFIX.STRIPE_EVENT}${event.id}`, '1', { expirationTtl: 2592000 });
  }

  return new Response('ok', { status: 200 });
}

async function handleCheckoutComplete(session, env) {
  // Fetch full session to get subscription details
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}` +
      `?expand[]=subscription&expand[]=customer&expand[]=subscription.items.data.price`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) return;

  const full = await res.json();
  const email  = (full.customer_details?.email || full.customer_email || '').toLowerCase();
  const sub    = full.subscription;
  const custId = typeof full.customer === 'string' ? full.customer : full.customer?.id;

  if (!email) return;

  const { plan, amount_cents } = derivePlanFromSubscription(sub);

  // Captured before the record below overwrites it — used after tagging
  // succeeds to clean up a stale krisflyer-bundle tag (see below).
  const priorRaw  = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  const priorPlan = priorRaw ? JSON.parse(priorRaw).plan : null;

  const record = {
    email,
    stripe_customer_id:    custId || '',
    stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || '',
    stripe_session_id:     session.id,
    status:                'active',
    plan,
    amount_cents,
    currency:              'usd',
    joined_at:             new Date().toISOString(),
    current_period_end:    getSubscriptionPeriodEnd(sub)
      ? new Date(getSubscriptionPeriodEnd(sub) * 1000).toISOString()
      : '',
  };

  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));
  if (custId) await env.ALTITUDE_KV.put(`${KV_PREFIX.CUSTOMER}${custId}`, email);

  const sync = await syncBeehiivAltitudeAccess(email, env, {
    plan,
    stripeCustomerId: custId || '',
    active: true,
  }).catch(() => ({
    beehiiv_tagged: false,
    beehiiv_tier_synced: false,
    beehiiv_sync_error: 'sync_failed',
  }));

  const raw2 = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (raw2) {
    const rec2 = { ...JSON.parse(raw2), ...sync };
    await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(rec2));
  }

  if (sync.beehiiv_tagged) {
    // A former Guide-bundle recipient buying a real plan for the first time
    // now holds a real interval tag — the temporary krisflyer-bundle tag
    // (applied by orchestration/guideBundle.js's grantGuideAltitudeBundle) is
    // obsolete and would otherwise persist forever, misrepresenting them as
    // still on a free grant.
    if (priorPlan === 'guide_bundle') {
      await removePlanTag(email, 'guide_bundle', env).catch(() => {});
    }
  }
}

// ── KrisFlyer Guide: purchase fulfillment ─────────────────────────────────────
// Per krisflyer.md: Stripe is payment-only here — on completion this writes a
// KV access record, applies the `krisflyer` Beehiiv tag, grants the bundled
// 90-day Altitude Premium access the pricing card promises (see
// orchestration/guideBundle.js's grantGuideAltitudeBundle), and sends the
// buyer their magic-link access email (same mechanism handleMagicRequest
// uses). Deliberately does NOT touch orchestration/session.js's
// handleActivate — Guide buyers log in via the emailed magic link, not an
// instant activate-on-success-page step like Altitude has.

async function handleGuideCheckoutComplete(session, env) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}?expand[]=customer`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) return;

  const full  = await res.json();
  const email = (full.customer_details?.email || full.customer_email || '').toLowerCase();
  const custId = typeof full.customer === 'string' ? full.customer : full.customer?.id;

  if (!email) return;

  const record = {
    email,
    stripe_customer_id: custId || '',
    stripe_session_id:  session.id,
    status:              'active',
    amount_cents:        full.amount_total ?? 3999,
    currency:            full.currency || 'usd',
    purchased_at:        new Date().toISOString(),
  };

  await env.ALTITUDE_KV.put(`${KV_PREFIX.GUIDE}${email}`, JSON.stringify(record));

  await tagGuideBuyer(email, env).catch(() => {});
  await grantGuideAltitudeBundle(email, session.id, env).catch(() => {});

  // Stripe can redeliver the same webhook event (network blip, timeout,
  // etc.). The KV/tag writes above are naturally idempotent — tagGuideBuyer
  // just re-applies the same tag, and grantGuideAltitudeBundle short-circuits
  // once the premium tag already exists — but sending an email is not.
  // Guarded per-session (not per-email) so a genuinely separate second
  // purchase later still sends its own link.
  const magicSentKey = `${KV_PREFIX.GUIDE_MAGIC_SENT}${session.id}`;
  if (!(await env.ALTITUDE_KV.get(magicSentKey))) {
    await sendGuideMagicLink(email, env, full.metadata?.origin).catch(() => {});
    await env.ALTITUDE_KV.put(magicSentKey, '1', { expirationTtl: 604800 }); // 7 days — comfortably past Stripe's webhook retry window
  }

  // Purchase confirmation — previously segment_action-only (SEG_GUIDE), which
  // arrived up to 24h late once that segment moved to the daily-cron-only
  // tier. Now fired directly here, same guard shape as magicSentKey above.
  const confirmationSentKey = `${KV_PREFIX.GUIDE_CONFIRMATION_SENT}${session.id}`;
  if (!(await env.ALTITUDE_KV.get(confirmationSentKey))) {
    await enrollInAutomation(GUIDE_CONFIRMATION_AUTOMATION_ID, email, env).catch(() => {});
    await env.ALTITUDE_KV.put(confirmationSentKey, '1', { expirationTtl: 604800 });
  }
}

// ── Travel Strategy Call: purchase fulfillment ────────────────────────────────
// Payment-only fulfillment: tags the buyer in Beehiiv and sends the
// confirmation email (with their signed booking link) via direct automation
// enrollment. Deliberately NO Airtable write here -- per the required flow,
// Airtable only gets a record once the buyer actually books a slot on
// Cal.com (see orchestration/calcomWebhook.js's handleBookingCreated, the
// only place that writes to the Assessment Call Bookings table now).

async function handleAssessmentCheckoutComplete(session, env) {
  // Uses STRIPE_ASSESSMENT_SECRET_KEY, not the shared STRIPE_SECRET_KEY --
  // this session belongs to the "Klent sandbox" Stripe account, a different
  // account from whichever one issues STRIPE_SECRET_KEY (see
  // services/stripe.js's handleAssessmentCheckout).
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}?expand[]=customer`,
    { headers: { 'Authorization': `Bearer ${env.STRIPE_ASSESSMENT_SECRET_KEY}` } }
  );
  if (!res.ok) return;

  const full  = await res.json();
  const email = (full.customer_details?.email || full.customer_email || '').toLowerCase();
  if (!email) return;

  // Tag for CRM/segmentation, then send the confirmation email (with the
  // signed booking link) via direct automation enrollment -- reliable and
  // immediate, not dependent on segment recalculation timing.
  await tagTravelStrategyCallBuyer(email, env)
    .catch(err => console.error('[assessment-checkout-complete] Beehiiv tagging failed:', String(err).slice(0, 200)));

  // Guarded per-session, same shape as handleGuideCheckoutComplete's
  // magicSentKey/confirmationSentKey — this automation's lingering
  // segment_action trigger is being removed in Beehiiv (2026-08-06
  // email-automation-consolidation), making this direct call the sole
  // trigger, so Stripe webhook redelivery needs its own dedup guard now.
  // Only written once a send is actually attempted -- a bookingUrl build
  // failure leaves the key unset so a genuine webhook retry can try again,
  // same self-healing behavior this had before the guard was added.
  const confirmationSentKey = `${KV_PREFIX.ASSESSMENT_CONFIRMATION_SENT}${session.id}`;
  if (!(await env.ALTITUDE_KV.get(confirmationSentKey))) {
    const bookingUrl = await buildAssessmentBookingUrl(email, env).catch(() => null);
    if (bookingUrl) {
      await sendAssessmentBookingEmail(email, bookingUrl, env)
        .catch(err => console.error('[assessment-checkout-complete] Beehiiv confirmation email failed:', String(err).slice(0, 200)));
      await env.ALTITUDE_KV.put(confirmationSentKey, '1', { expirationTtl: 604800 });
    }
  }
}

async function handleSubscriptionDeleted(sub, env) {
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`${KV_PREFIX.CUSTOMER}${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (!raw) return;

  const record = JSON.parse(raw);
  const plan = record.plan;
  // Guards activateDeferredGuideBundle below: if this email has two Stripe
  // subscriptions (the pre-existing, known "no protection against a second
  // subscription" gap — see krisflyer.md), member:{email} only ever tracks
  // whichever one is "current". Cancelling the OTHER (non-current) one must
  // not activate a deferred bundle or touch the still-active real record.
  const wasCurrentSubscription = record.stripe_subscription_id === sub.id;
  if (!wasCurrentSubscription) return;

  record.status = 'cancelled';
  record.cancelled_at = new Date().toISOString();
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));

  const sync = await syncBeehiivAltitudeAccess(email, env, { plan, active: false }).catch(() => null);
  if (sync) {
    const raw2 = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
    if (raw2) {
      await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify({ ...JSON.parse(raw2), ...sync }));
    }
  }

  // If this member bought the KrisFlyer Guide while still on a real paid
  // plan, their 90-day bundle was deferred (see grantGuideAltitudeBundle) —
  // activate it now that their real membership has ended.
  await activateDeferredGuideBundle(email, env).catch(() => {});
}

async function handleSubscriptionUpdated(sub, env) {
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`${KV_PREFIX.CUSTOMER}${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (!raw) return;

  const record = JSON.parse(raw);
  record.status = sub.status === 'active' ? 'active' : sub.status;
  const periodEnd = getSubscriptionPeriodEnd(sub);
  if (periodEnd) {
    record.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  // Detects a plan change on this subscription (its price no longer matches
  // what we had on file) and swaps the tag/plan to match. This covers two
  // cases identically:
  //  1. The deferred Monthly→Annual upgrade (services/stripe.js's
  //     handleUpgradeToAnnual) actually taking effect — Stripe applies the
  //     schedule's second phase at current_period_end and fires this same
  //     event. This IS that flow's primary completion path, not a safety net.
  //  2. Any other out-of-band price swap on the subscription.
  // Only monthly<->annual is a real "plan" in this system.
  if (record.plan === 'monthly' || record.plan === 'annual') {
    const { plan: newPlan, amount_cents: newAmount } = derivePlanFromSubscription(sub);
    if (newPlan !== record.plan) {
      const oldPlan = record.plan;
      const wasScheduledUpgrade = record.pending_plan === newPlan;
      record.plan = newPlan;
      record.amount_cents = newAmount;
      delete record.pending_plan;
      delete record.upgrade_effective_at;
      await swapIntervalTag(email, oldPlan, newPlan, env).catch(() => {});
      if (wasScheduledUpgrade && newPlan === 'annual') {
        await enrollInAutomation(UPGRADED_ANNUAL_AUTOMATION_ID, email, env).catch(() => {});
      }
    }
  }

  if (record.plan === 'monthly' || record.plan === 'annual') {
    const active = record.status === 'active' || record.status === 'trialing' || record.status === 'past_due';
    const ended = ['canceled', 'cancelled', 'unpaid', 'incomplete_expired'].includes(record.status);
    if (active || ended) {
      const sync = await syncBeehiivAltitudeAccess(email, env, {
        plan: record.plan,
        stripeCustomerId: record.stripe_customer_id || '',
        active,
      }).catch(() => null);
      if (sync) Object.assign(record, sync);
    }
  }

  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));
}

// Fires on every successful invoice payment, including the very first one at
// checkout (billing_reason: 'subscription_create') — only react to actual
// renewals (billing_reason: 'subscription_cycle') so a brand-new signup
// doesn't also get a "your membership renewed" email on day one. current_
// period_end itself is already kept fresh by handleSubscriptionUpdated above
// (Stripe fires customer.subscription.updated around the same renewal
// event); this only handles the plan-specific Renewed email.
async function handleInvoicePaymentSucceeded(invoice, env) {
  if (invoice.billing_reason !== 'subscription_cycle') return;

  const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`${KV_PREFIX.CUSTOMER}${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (!raw) return;
  const member = JSON.parse(raw);

  const sync = await syncBeehiivAltitudeAccess(email, env, {
    plan: member.plan,
    stripeCustomerId: member.stripe_customer_id || '',
    active: true,
  }).catch(() => null);
  if (sync) {
    await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify({ ...member, ...sync }));
  }

  const automationId = member.plan === 'annual' ? RENEWED_ANNUAL_AUTOMATION_ID
    : member.plan === 'monthly' ? RENEWED_MONTHLY_AUTOMATION_ID
    : null;
  if (!automationId) return; // e.g. guide_bundle records never renew via Stripe

  await enrollInAutomation(automationId, email, env);
}

async function handleInvoicePaymentFailed(invoice, env) {
  const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!custId) return;

  const email = await env.ALTITUDE_KV.get(`${KV_PREFIX.CUSTOMER}${custId}`);
  if (!email) return;

  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (!raw) return;

  const member = JSON.parse(raw);
  if (member.plan !== 'monthly' && member.plan !== 'annual') return;

  member.status = 'past_due';
  member.payment_failed_at = new Date().toISOString();
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(member));
}
