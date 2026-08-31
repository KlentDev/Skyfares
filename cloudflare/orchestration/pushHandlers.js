// orchestration/pushHandlers.js — Web Push subscribe/unsubscribe/send. Lives
// in orchestration/, not services/, because it touches D1 (PUSH_DB), the
// Altitude JWT/entitlement check (verifyAltitudeRequest), and the webPush
// service in the same request — the same services-vs-orchestration split
// worker.js's header comment already documents for every other handler.
import { respond } from '../utils/http.js';
import { getBearer } from '../utils/jwt.js';
import { KV_PREFIX, PUSH_TOPICS } from '../config/constants.js';
import { verifyAltitudeRequest } from './session.js';
import { sendPushNotification } from '../services/webPush.js';

// Award Alerts / KrisFlyer Escapes / the premium newsletter are private
// Altitude content — the audience for these three types is hard-locked to
// 'altitude' here and cannot be widened by a caller-supplied `audience`,
// so a compromised or mistaken PUSH_ADMIN_TOKEN send can never leak private
// content to public-audience subscribers. Announcements/service updates
// have no such requirement and may target either or both audiences.
const ALTITUDE_ONLY_TYPES = ['award_alert', 'krisflyer_escape', 'premium_newsletter'];

function resolveAudience(type, requestedAudience) {
  if (ALTITUDE_ONLY_TYPES.includes(type)) return 'altitude';
  if (requestedAudience === 'altitude' || requestedAudience === 'public') return requestedAudience;
  return null; // no filter -> both audiences
}

// Local, unexported timing-safe compare — same 4-line shape as
// utils/signedLink.js's private timingSafeEqual, duplicated rather than
// imported so this file's addition doesn't require touching that one.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isValidRelativeUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

async function findRecipients(env, { audience, topics }) {
  const conditions = [];
  const binds = [];
  if (audience) { conditions.push('audience = ?'); binds.push(audience); }
  if (topics && topics.length) {
    const placeholders = topics.map(() => '?').join(',');
    conditions.push(`EXISTS (SELECT 1 FROM json_each(topics) WHERE value IN (${placeholders}))`);
    binds.push(...topics);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results } = await env.PUSH_DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions ${where}`
  ).bind(...binds).all();
  return results || [];
}

// ── GET /api/push/public-key ────────────────────────────────────────────────

export async function handlePushPublicKey(request, env, corsHeaders) {
  if (!env.VAPID_PUBLIC_KEY) return respond({ error: 'not_configured' }, 500, corsHeaders);
  return respond({ publicKey: env.VAPID_PUBLIC_KEY }, 200, corsHeaders);
}

// ── POST /api/push/subscribe ────────────────────────────────────────────────

export async function handlePushSubscribe(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_PUSH_SUBSCRIBE}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 20) return respond({ error: 'rate_limited' }, 429, corsHeaders);
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  const endpoint = String(body.endpoint || '');
  const keys = body.keys || {};
  const p256dh = String(keys.p256dh || '');
  const authKey = String(keys.auth || '');
  const topics = Array.isArray(body.topics) ? body.topics.filter((t) => PUSH_TOPICS.includes(t)) : [];
  const userAgent = String(body.userAgent || request.headers.get('User-Agent') || '').slice(0, 300);

  if (!endpoint.startsWith('https://') || !p256dh || !authKey) {
    return respond({ error: 'invalid_subscription' }, 400, corsHeaders);
  }

  // audience is always server-derived from a verified JWT, never trusted
  // from the client — this is what stops a public visitor from marking
  // their own subscription 'altitude' and receiving member-only content.
  let audience = 'public';
  let email = null;
  const entitlement = await verifyAltitudeRequest(request, env).catch(() => ({ ok: false }));
  if (entitlement.ok) { audience = 'altitude'; email = entitlement.email; }

  const now = new Date().toISOString();
  await env.PUSH_DB.prepare(
    `INSERT INTO push_subscriptions (id, email, endpoint, p256dh, auth, audience, topics, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       email = excluded.email,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       audience = excluded.audience,
       topics = excluded.topics,
       user_agent = excluded.user_agent,
       updated_at = excluded.updated_at`
  ).bind(
    crypto.randomUUID(), email, endpoint, p256dh, authKey, audience, JSON.stringify(topics), userAgent, now, now
  ).run();

  return respond({ ok: true, audience }, 200, corsHeaders);
}

// ── POST /api/push/unsubscribe ──────────────────────────────────────────────

export async function handlePushUnsubscribe(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_PUSH_UNSUBSCRIBE}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 20) return respond({ error: 'rate_limited' }, 429, corsHeaders);
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  const endpoint = String(body.endpoint || '');
  if (!endpoint) return respond({ error: 'missing_endpoint' }, 400, corsHeaders);

  const result = await env.PUSH_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
  if (!result.meta || !result.meta.changes) {
    return respond({ error: 'not_found' }, 404, corsHeaders);
  }
  return respond({ ok: true }, 200, corsHeaders);
}

// ── Broadcast core (shared by the HTTP endpoint and the content-publish cron
// poll — see orchestration/cron.js's notifyPublishedAltitudeContent) ─────────
// Fire condition: Draft -> Published, exactly once — the dedupeKey guard
// below is what makes any caller safe to invoke repeatedly for the same
// record/publication without ever double-delivering.

export async function sendPushBroadcast(env, { title, body, url, type, dedupeKey, audience, topics }) {
  const dedupeStoreKey = dedupeKey ? `${KV_PREFIX.PUSH_SENT}${dedupeKey}` : null;
  if (dedupeStoreKey && await env.ALTITUDE_KV.get(dedupeStoreKey)) {
    return { sent: 0, failed: 0, removed: 0, skipped: true, reason: 'duplicate' };
  }

  const resolvedAudience = resolveAudience(type, audience === 'public' || audience === 'altitude' ? audience : null);
  const recipients = await findRecipients(env, { audience: resolvedAudience, topics: topics || [] });

  const payload = { title, body, url, type };
  let sent = 0;
  let failed = 0;
  const goneIds = [];
  for (const sub of recipients) {
    const result = await sendPushNotification(sub, payload, env).catch(() => ({ ok: false, gone: false }));
    if (result.ok) {
      sent++;
    } else {
      failed++;
      if (result.gone) goneIds.push(sub.id);
    }
  }

  if (goneIds.length) {
    const placeholders = goneIds.map(() => '?').join(',');
    await env.PUSH_DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`)
      .bind(...goneIds).run().catch(() => {});
  }

  // Written only after every send in this call has completed — the
  // check-before-work/write-on-success/TTL idiom already used for
  // GUIDE_MAGIC_SENT/WELCOME_SENT elsewhere in this codebase.
  if (dedupeStoreKey) {
    await env.ALTITUDE_KV.put(dedupeStoreKey, '1', { expirationTtl: 90 * 24 * 3600 });
  }

  return { sent, failed, removed: goneIds.length };
}

// ── POST /api/push/send ─────────────────────────────────────────────────────
// Trusted-caller only (PUSH_ADMIN_TOKEN) — a thin HTTP wrapper around
// sendPushBroadcast above. The internal caller (the content-publish cron
// poll) calls sendPushBroadcast directly instead, skipping this token check
// entirely since it never leaves the Worker.

export async function handlePushSend(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_PUSH_SEND}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  // Still rate-limited even though it's token-gated — same idiom the
  // cloudflare-reports Worker uses for its own token-protected /debug/run.
  if (rlCount >= 30) return respond({ error: 'rate_limited' }, 429, corsHeaders);
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  if (!env.PUSH_ADMIN_TOKEN) return respond({ error: 'not_configured' }, 500, corsHeaders);
  const token = getBearer(request);
  if (!token || !timingSafeEqual(token, env.PUSH_ADMIN_TOKEN)) {
    return respond({ error: 'unauthorized' }, 401, corsHeaders);
  }

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  const title = String(body.title || '').trim().slice(0, 100);
  const text = String(body.body || '').trim().slice(0, 300);
  const url = String(body.url || '');
  const type = String(body.type || '');
  const dedupeKey = body.dedupeKey ? String(body.dedupeKey).slice(0, 200) : null;
  const requestedAudience = body.audience === 'public' || body.audience === 'altitude' ? body.audience : null;
  const topics = Array.isArray(body.topics) ? body.topics.filter((t) => PUSH_TOPICS.includes(t)) : [];

  if (!title || !text) return respond({ error: 'missing_title_or_body' }, 400, corsHeaders);
  if (!PUSH_TOPICS.includes(type)) return respond({ error: 'invalid_type' }, 400, corsHeaders);
  if (!isValidRelativeUrl(url)) return respond({ error: 'invalid_url' }, 400, corsHeaders);

  const result = await sendPushBroadcast(env, { title, body: text, url, type, dedupeKey, audience: requestedAudience, topics });
  return respond(result, 200, corsHeaders);
}
