// orchestration/cron.js — the two daily cron jobs, both of which paginate
// every member: KV record and call into services/beehiiv.js per member.
import { enrollInAutomation, removePlanTag } from '../services/beehiiv.js';
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
    await removePlanTag(member.email, 'guide_bundle', env).catch(() => {});
    console.log(`[guide-bundle-expiry] expired ${member.email}`);
  }
}
