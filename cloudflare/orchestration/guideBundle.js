// orchestration/guideBundle.js — owns the KrisFlyer Guide's 90-day "free
// Altitude bundle" grant/defer/activate lifecycle. Lives in orchestration/,
// not services/beehiiv.js, despite neither function calling Stripe directly:
// both read/write the canonical Stripe-shaped member: record (checking
// stripe_subscription_id, plan, prior customer id) — putting them in
// services/beehiiv.js would break that module's honest "only talks to
// Beehiiv" contract. Reading/writing/reasoning about member: is the dividing
// line, not "does it call fetch() to stripe.com."
import { checkBeehiivPremium, tagGuideBundle } from '../services/beehiiv.js';
import { KV_PREFIX, GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID } from '../config/constants.js';

// Grants the "90 days of Altitude Premium included, free" bundle the Guide's
// pricing card promises (pages/krisflyer-guide.html), OR defers it if the
// buyer already has a real Monthly/Annual subscription — see
// activateDeferredGuideBundle below, which activates the deferred grant once
// that real subscription ends. This is a plain grant that silently expires
// after 90 days (see orchestration/cron.js's expireGuideBundles) — no saved
// payment method, no Stripe Subscription object, no auto-charge. Never
// overwrites a real paying subscriber's member:{email} record while their
// subscription is active — checkBeehiivPremium (the same authoritative check
// orchestration/session.js's handleActivate uses) is checked first, so
// someone who already has real Altitude access keeps their real
// stripe_subscription_id and current_period_end untouched; their bundle is
// deferred instead of lost.
export async function grantGuideAltitudeBundle(email, sessionId, env) {
  // Fail toward *not* granting or deferring on an inconclusive check (network
  // error, etc.) — only an explicit true/false proceeds. Missing a free
  // bundle occasionally is a minor, recoverable miss; incorrectly overwriting
  // a real subscriber's record is not.
  const alreadyPremium = await checkBeehiivPremium(email, env).catch(() => null);

  if (alreadyPremium === true) {
    const existingRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    // stripe_subscription_id truthy check matters: handleActivate's self-heal
    // fallback can write plan:'monthly' with NO stripe_subscription_id for
    // someone who actually only holds krisflyer-bundle — without this check,
    // that mislabeling would wrongly defer a second purchase instead of
    // correctly no-op'ing ("already mid-bundle, nothing to defer").
    if (existing && existing.status === 'active' && existing.stripe_subscription_id &&
        (existing.plan === 'monthly' || existing.plan === 'annual')) {
      // No expirationTtl — unlike every other key in this file, this must
      // survive indefinitely until activateDeferredGuideBundle consumes it.
      await env.ALTITUDE_KV.put(`${KV_PREFIX.GUIDE_BUNDLE_PENDING}${email}`, JSON.stringify({
        session_id: sessionId,
        purchased_at: new Date().toISOString(),
      }));
      // Tag immediately even though the free 90 days themselves don't start
      // yet — the Beehiiv tag reflects "bought the bundle," not "the bundle's
      // active window has started," so segments/marketing see this buyer
      // right away. The member: KV record (the actual access grant) still
      // isn't touched here on purpose — activateDeferredGuideBundle writes
      // that once the real Monthly/Annual subscription actually ends.
      await tagGuideBundle(email, env).catch(() => {});
    }
    return;
  }
  if (alreadyPremium !== false) return; // network error — do nothing, as above

  const existingRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  if (existingRaw) {
    const existing = JSON.parse(existingRaw);
    if (existing.status === 'active') return; // e.g. an already-active bundle
  }

  const now = Date.now();
  const record = {
    email,
    stripe_customer_id:     '', // no billing account behind this grant — see services/stripe.js's handleManagePortal
    stripe_subscription_id: '', // no real Stripe subscription behind this grant
    stripe_session_id:      sessionId,
    status:                 'active',
    plan:                   'guide_bundle',
    amount_cents:           0,
    currency:               'usd',
    joined_at:              new Date(now).toISOString(),
    current_period_end:     new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));

  // Applies the krisflyer-bundle tag directly via REST (mirrors
  // tagGuideBuyer's proven subscribe → tag → verify → recalc pattern) rather
  // than routing through setupBeehiivMember, which now exclusively handles
  // the paid monthly/annual interval tags and requires a real planTag — a
  // free 90-day grant is neither monthly nor annual billing.
  await tagGuideBundle(email, env).catch(() => {});
}

// Activates a Guide bundle that was deferred because the buyer already had a
// real Monthly/Annual subscription at purchase time (see
// grantGuideAltitudeBundle above). Called from
// orchestration/stripeWebhook.js's handleSubscriptionDeleted, gated on the
// cancelled subscription being the one member:{email} currently tracks (see
// that call site's wasCurrentSubscription comment). Overwrites
// member:{email} — same "one current record per email" pattern the rest of
// this Worker already uses — since the real subscription that just ended is
// no longer the current access state for this email. Preserves the prior
// record's stripe_customer_id (unlike a standalone bundle grant, one
// genuinely exists here) so a former member can still reach the Stripe
// billing portal for historical invoices during their 90-day grace window.
export async function activateDeferredGuideBundle(email, env) {
  const pendingRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.GUIDE_BUNDLE_PENDING}${email}`);
  if (!pendingRaw) return;

  let pending;
  try { pending = JSON.parse(pendingRaw); } catch { pending = {}; }

  const priorRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${email}`);
  const priorCustomerId = priorRaw ? (JSON.parse(priorRaw).stripe_customer_id || '') : '';

  const now = Date.now();
  const record = {
    email,
    stripe_customer_id:     priorCustomerId,
    stripe_subscription_id: '', // no real Stripe subscription behind this grant
    stripe_session_id:      pending.session_id || '',
    status:                 'active',
    plan:                   'guide_bundle',
    amount_cents:           0,
    currency:               'usd',
    joined_at:              new Date(now).toISOString(),
    current_period_end:     new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${email}`, JSON.stringify(record));
  await env.ALTITUDE_KV.delete(`${KV_PREFIX.GUIDE_BUNDLE_PENDING}${email}`);

  await tagGuideBundle(email, env, GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID).catch(() => {});
}
