// utils/signedLink.js — HMAC-signed, expiring links for the one-time R2
// download the "Send to My Email" flow's Beehiiv email points at. No JWT
// here on purpose: an email recipient has no browser session/localStorage,
// so this link's only protection is the signature + expiry, not auth.
// Reuses the same getHmacKey/b64url primitives utils/jwt.js already uses for
// JWTs — separate secret (PDF_LINK_SECRET) so a JWT_SECRET rotation doesn't
// silently invalidate in-flight download links and vice versa.
import { b64url, getHmacKey } from './crypto.js';
import { WORKER_BASE_URL } from '../config/constants.js';

async function sign(key, exp, env) {
  // Without this guard, a missing secret would silently sign every link with
  // an HMAC key derived from the literal string "undefined" (TextEncoder
  // stringifies its input) — a fixed, guessable key, not a missing-config
  // error. Fail loudly instead, matching pdfPassword.js's equivalent check.
  if (!env.PDF_LINK_SECRET) {
    throw new Error('PDF_LINK_SECRET is not configured.');
  }
  const hmacKey = await getHmacKey(env.PDF_LINK_SECRET, 'sign');
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${key}:${exp}`));
  return b64url(sig);
}

/** @returns {Promise<{key: string, exp: number, sig: string}>} */
export async function signGuidePdfLink(objectKey, ttlSeconds, env) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await sign(objectKey, exp, env);
  return { key: objectKey, exp, sig };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** @returns {Promise<boolean>} */
export async function verifyGuidePdfLink(objectKey, exp, sig, env) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Math.floor(Date.now() / 1000) > expNum) return false;
  const expected = await sign(objectKey, expNum, env);
  return timingSafeEqual(expected, sig);
}

// ── Travel Strategy Call: signed booking-redirect link ────────────────────────
// Same shape as the guide-PDF link above (HMAC + expiry, no session/auth --
// an email recipient has none), separate secret (ASSESSMENT_LINK_SECRET) for
// the same reason PDF_LINK_SECRET is its own secret: rotating one shouldn't
// silently invalidate the other's in-flight links. Keyed on the paying
// email (lowercased) rather than an opaque object key, since there's no R2
// object here -- just proof that *this* email is the one that paid, checked
// by orchestration/assessmentBooking.js's handleAssessmentBookingRedirect
// before it 302s to the real Cal.com URL.
async function signBooking(email, exp, env) {
  if (!env.ASSESSMENT_LINK_SECRET) {
    throw new Error('ASSESSMENT_LINK_SECRET is not configured.');
  }
  const hmacKey = await getHmacKey(env.ASSESSMENT_LINK_SECRET, 'sign');
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`booking:${email}:${exp}`));
  return b64url(sig);
}

/** @returns {Promise<{email: string, exp: number, sig: string}>} */
export async function signAssessmentBookingLink(email, ttlSeconds, env) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await signBooking(email, exp, env);
  return { email, exp, sig };
}

/** @returns {Promise<boolean>} */
export async function verifyAssessmentBookingLink(email, exp, sig, env) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Math.floor(Date.now() / 1000) > expNum) return false;
  const expected = await signBooking(email, expNum, env);
  return timingSafeEqual(expected, sig);
}

// Full absolute URL, ready to drop into an email or the success-page JSON --
// 30-day TTL matches the pricing page's own "$99 credited back within 30
// days" window, so the link naturally expires alongside the offer it's for.
export async function buildAssessmentBookingUrl(email, env) {
  const { exp, sig } = await signAssessmentBookingLink(email, 30 * 24 * 3600, env);
  const params = new URLSearchParams({ email, exp: String(exp), sig });
  return `${WORKER_BASE_URL}/assessment/book?${params.toString()}`;
}
