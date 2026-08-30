// services/webPush.js — Web Push delivery (RFC 8291 message encryption + RFC
// 8292 VAPID) via @pushforge/builder, a zero-dependency library built for
// edge runtimes (Cloudflare Workers included) that uses only the Web Crypto
// API. Deliberately NOT the classic 'web-push' npm package: that library
// sends its request through Node's `https` client, which is not a reliable
// fit for Workers — every other crypto primitive in this codebase
// (utils/crypto.js, utils/jwt.js) already avoids Node's `crypto`/`http`
// modules for the same reason, so this keeps the same convention.
import { buildPushHTTPRequest } from '@pushforge/builder';

// VAPID_PRIVATE_KEY is stored as a JSON-stringified JWK secret — see the
// plan's Setup Instructions: `npx @pushforge/builder vapid` outputs the
// private key already in this exact {kty,crv,x,y,d} shape.
function getPrivateJwk(env) {
  if (!env.VAPID_PRIVATE_KEY) throw new Error('VAPID_PRIVATE_KEY is not configured.');
  return JSON.parse(env.VAPID_PRIVATE_KEY);
}

/**
 * Sends one Web Push notification to a single subscription.
 * @param {{endpoint:string, p256dh:string, auth:string}} subscription
 * @param {{title:string, body:string, url:string, type:string}} payload
 * @returns {Promise<{ok:boolean, status:number, gone:boolean}>} `gone` means
 *   the push service reported the subscription as dead (404/410) — the
 *   caller should delete the row.
 */
export async function sendPushNotification(subscription, payload, env) {
  if (!env.VAPID_SUBJECT) throw new Error('VAPID_SUBJECT is not configured.');

  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: getPrivateJwk(env),
    subscription: {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    message: {
      payload,
      adminContact: env.VAPID_SUBJECT,
      // 24h TTL — long enough to reach a briefly-offline device, short
      // enough that a stale Award Alert never surfaces days later.
      options: { ttl: 24 * 3600, urgency: 'normal' },
    },
  });

  const res = await fetch(endpoint, { method: 'POST', headers, body }).catch(() => null);
  if (!res) return { ok: false, status: 0, gone: false };

  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
