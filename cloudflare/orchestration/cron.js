// orchestration/cron.js — the daily cron jobs (which paginate every member:
// KV record and call into services/beehiiv.js per member) plus the more
// frequent content-publish poll below.
import { enrollInAutomation, syncBeehiivAltitudeAccess } from '../services/beehiiv.js';
import { fetchPublishedAltitudeContent } from '../services/airtable.js';
import { sendPushBroadcast } from './pushHandlers.js';
import {
  KV_PREFIX, RENEWAL_7D_AUTOMATION_ID, RENEWAL_3D_AUTOMATION_ID, RENEWAL_1D_AUTOMATION_ID,
} from '../config/constants.js';

// ── Renewal reminders (called by daily cron) ──────────────────────────────────

export async function runRenewalReminders(env) {
  const now        = Date.now();
  const ONE_DAY_MS = 86_400_000;

  // Paginate through all member:* KV keys
  const keys = [];
  let cursor = undefined;
  do {
    const opts = { prefix: KV_PREFIX.MEMBER, limit: 100 };
    if (cursor) opts.cursor = cursor;
    const page = await env.ALTITUDE_KV.list(opts).catch(() => null);
    if (!page) break;
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  for (const key of keys) {
    const raw = await env.ALTITUDE_KV.get(key.name).catch(() => null);
    if (!raw) continue;

    let member;
    try { member = JSON.parse(raw); } catch { continue; }

    // guide_bundle records never had a real charge and never will — this
    // 7d/3d/1d messaging is specifically about an upcoming renewal *charge*,
    // which would be misleading here. They're handled solely by
    // expireGuideBundles below.
    if (member.status !== 'active' || !member.current_period_end || !member.email) continue;
    if (member.plan === 'guide_bundle') continue;

    const renewalMs  = new Date(member.current_period_end).getTime();
    const daysUntil  = Math.ceil((renewalMs - now) / ONE_DAY_MS);
    const email      = member.email;
    let updated = false;

    if (daysUntil === 7 && !member.reminder_7d_sent) {
      if (await enrollInAutomation(RENEWAL_7D_AUTOMATION_ID, email, env)) {
        member.reminder_7d_sent = true; updated = true;
        console.log(`[renewal-cron] 7d reminder → ${email}`);
      }
    }
    if (daysUntil === 3 && !member.reminder_3d_sent) {
      if (await enrollInAutomation(RENEWAL_3D_AUTOMATION_ID, email, env)) {
        member.reminder_3d_sent = true; updated = true;
        console.log(`[renewal-cron] 3d reminder → ${email}`);
      }
    }
    if (daysUntil === 1 && !member.reminder_1d_sent) {
      if (await enrollInAutomation(RENEWAL_1D_AUTOMATION_ID, email, env)) {
        member.reminder_1d_sent = true; updated = true;
        console.log(`[renewal-cron] 1d reminder → ${email}`);
      }
    }

    // After renewal has processed, reset flags for the next cycle
    if (daysUntil <= 0 && daysUntil > -3 && (member.reminder_7d_sent || member.reminder_3d_sent || member.reminder_1d_sent)) {
      member.reminder_7d_sent = false;
      member.reminder_3d_sent = false;
      member.reminder_1d_sent = false;
      updated = true;
      console.log(`[renewal-cron] flags reset for next cycle → ${email}`);
    }

    if (updated) await env.ALTITUDE_KV.put(key.name, JSON.stringify(member));
  }
}

// Guide-bundled 90-day Altitude access (see orchestration/guideBundle.js's
// grantGuideAltitudeBundle) has no real Stripe subscription behind it, so
// nothing else ever downgrades it — unlike real subscribers, who get
// cancelled via Stripe's own customer.subscription.deleted webhook
// (orchestration/stripeWebhook.js's handleSubscriptionDeleted). Runs daily
// alongside the renewal-reminder cron; only ever touches plan:'guide_bundle'
// records, so real subscribers are never affected.
export async function expireGuideBundles(env) {
  const now  = Date.now();
  const keys = [];
  let cursor = undefined;
  do {
    const opts = { prefix: KV_PREFIX.MEMBER, limit: 100 };
    if (cursor) opts.cursor = cursor;
    const page = await env.ALTITUDE_KV.list(opts).catch(() => null);
    if (!page) break;
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  for (const key of keys) {
    const raw = await env.ALTITUDE_KV.get(key.name).catch(() => null);
    if (!raw) continue;

    let member;
    try { member = JSON.parse(raw); } catch { continue; }

    if (member.plan !== 'guide_bundle' || member.status !== 'active') continue;
    if (!member.current_period_end || new Date(member.current_period_end).getTime() > now) continue;

    member.status = 'cancelled';
    member.cancelled_at = new Date().toISOString();
    await env.ALTITUDE_KV.put(key.name, JSON.stringify(member));
    await syncBeehiivAltitudeAccess(member.email, env, { plan: 'guide_bundle', active: false }).catch(() => {});
    console.log(`[guide-bundle-expiry] expired ${member.email}`);
  }
}

export async function reconcileBeehiivAccess(env) {
  const keys = [];
  let cursor = undefined;
  do {
    const opts = { prefix: KV_PREFIX.MEMBER, limit: 100 };
    if (cursor) opts.cursor = cursor;
    const page = await env.ALTITUDE_KV.list(opts).catch(() => null);
    if (!page) break;
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  for (const key of keys) {
    const raw = await env.ALTITUDE_KV.get(key.name).catch(() => null);
    if (!raw) continue;

    let member;
    try { member = JSON.parse(raw); } catch { continue; }
    if (!member.email) continue;
    if (!['monthly', 'annual', 'guide_bundle'].includes(member.plan)) continue;

    const active = ['active', 'trialing', 'past_due'].includes(member.status) && (
      !member.current_period_end || new Date(member.current_period_end).getTime() > Date.now()
    );
    const sync = await syncBeehiivAltitudeAccess(member.email, env, {
      plan: member.plan,
      stripeCustomerId: member.stripe_customer_id || '',
      active,
    }).catch(() => null);
    if (sync) {
      await env.ALTITUDE_KV.put(key.name, JSON.stringify({ ...member, ...sync })).catch(() => {});
    }
  }
}

// ── Push subscription audience reconciliation (called by daily cron) ─────────
// A push_subscriptions row's `audience` is set to 'altitude' once, at
// subscribe time (see orchestration/pushHandlers.js's handlePushSubscribe) —
// it is never re-checked on every send, since that would mean an extra KV
// read per subscriber on every broadcast. Instead this sweep runs once a
// day, alongside reconcileBeehiivAccess above, and closes the gap the same
// way that function does: re-check each 'altitude' subscription's member
// entitlement (same member:<email> KV lookup + active-status check
// reconcileBeehiivAccess already uses inline) and remove the row once
// membership has lapsed, so a former member's device stops receiving
// Altitude-only content (Award Alerts, KrisFlyer Escapes, premium
// newsletter) the day after their access actually ends.
export async function reconcilePushSubscriptionAudience(env) {
  if (!env.PUSH_DB) return; // feature not yet provisioned in this environment

  const { results } = await env.PUSH_DB.prepare(
    "SELECT id, email FROM push_subscriptions WHERE audience = 'altitude' AND email IS NOT NULL"
  ).all().catch(() => ({ results: [] }));

  const staleIds = [];
  for (const row of (results || [])) {
    const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${row.email}`).catch(() => null);
    let member = null;
    if (raw) { try { member = JSON.parse(raw); } catch {} }

    const active = !!member && ['active', 'trialing', 'past_due'].includes(member.status) && (
      !member.current_period_end || new Date(member.current_period_end).getTime() > Date.now()
    );

    if (!active) staleIds.push(row.id);
  }

  if (staleIds.length) {
    const placeholders = staleIds.map(() => '?').join(',');
    await env.PUSH_DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`)
      .bind(...staleIds).run().catch(() => {});
    console.log(`[push-audience-cron] removed ${staleIds.length} lapsed-member push subscription(s)`);
  }
}

// ── Altitude content publish notifications (called by the 10-minute cron) ──
// Fires a push the first time each Award Alerts / KrisFlyer Escapes record is
// seen Status="Published" -- a state check ("is this Published and not yet
// notified"), not a literal Draft->Published edit-history diff, so a record
// created directly as Published also notifies on the poll that first sees
// it. sendPushBroadcast's own dedupeKey guard (keyed on content type +
// Airtable record ID) is what actually prevents a re-poll of an
// already-notified record from sending twice -- this function does no
// tracking of its own beyond "loop over currently-Published records".
const CONTENT_PUBLISH_TYPES = [
  { contentType: 'award-alerts', pushType: 'award_alert', url: '/pages/private-pages/altitude-access/award-alerts.html' },
  { contentType: 'krisflyer-escapes', pushType: 'krisflyer_escape', url: '/pages/private-pages/altitude-access/krisflyer-escapes.html' },
];

export async function notifyPublishedAltitudeContent(env) {
  for (const { contentType, pushType, url } of CONTENT_PUBLISH_TYPES) {
    let records;
    try {
      records = await fetchPublishedAltitudeContent(env, contentType);
    } catch (err) {
      console.error(`[content-publish-cron] ${contentType} fetch failed:`, err.message);
      continue;
    }

    for (const record of records) {
      const result = await sendPushBroadcast(env, {
        title: String(record.title || '').slice(0, 100),
        body: String(record.shortDescription || '').slice(0, 300),
        url,
        type: pushType,
        dedupeKey: `${contentType}:${record.id}`,
        audience: 'altitude',
        topics: [],
      }).catch((err) => {
        console.error(`[content-publish-cron] send failed for ${contentType}:${record.id}:`, err.message);
        return null;
      });

      if (result && !result.skipped && result.sent) {
        console.log(`[content-publish-cron] notified ${result.sent} subscriber(s) for ${contentType}:${record.id}`);
      }
    }
  }
}
