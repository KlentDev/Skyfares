// services/pdfPassword.js — deterministic PDF-open password derivation.
//
// No password is ever stored anywhere (no KV write, no D1 row) — it's
// re-derived on every request from an HMAC of stable inputs, using the same
// getHmacKey Web Crypto primitive utils/crypto.js already provides for JWTs.
// Same purchaser + same purchase => same password, every time, forever,
// without a database. A different PDF_PASSWORD_SECRET (e.g. after a secret
// rotation) invalidates every previously-issued password at once — that's
// intentional, matching how rotating JWT_SECRET already invalidates sessions.
import { getHmacKey } from '../utils/crypto.js';

// Crockford-style alphabet, ambiguous characters (I, L, O, U) removed so a
// human reading the password off an email/screen can't confuse 0/O or 1/I/L.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function bytesToReadableCode(bytes, length) {
  // Simple base-32-ish encoding: walk the bytes as one big bit buffer, take
  // 5 bits at a time. Not required to be a *standard* base32 (no padding,
  // no round-trip decoding needed) — this is a one-way display encoding.
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
    if (out.length >= length) break;
  }
  return out;
}

function formatPassword(code) {
  // "XXXX-XXXX-XXXX" — easy to read aloud/retype, still ~60 bits of entropy
  // from the underlying HMAC (plenty for discouraging casual sharing; this is
  // defense-in-depth, not a defense against a targeted attacker with the file).
  return code.match(/.{1,4}/g).join('-');
}

/**
 * Deliberately does NOT take chapter content/version as an input. Chapters get
 * edited often (typo fixes, new chapters shipping over time) — if the password
 * depended on content, every edit would silently change every customer's
 * password and generate "my password stopped working" tickets. A password
 * only ever changes via PDF_PASSWORD_SECRET rotation (the intentional mass-
 * invalidation mechanism), never via a content update.
 *
 * @param {string} email - purchaser email (lowercased by the caller)
 * @param {string} entitlementId - guide.stripe_session_id, or guide.recovered_at
 *   as a fallback for Beehiiv-recovered records (see guidePdf.js)
 * @param {string} guideId - e.g. 'krisflyer-guide' (config/constants.js GUIDE_ID)
 * @param {{PDF_PASSWORD_SECRET: string}} env
 * @returns {Promise<string>} formatted password, e.g. "7K2M-QX9P-4R3H"
 */
export async function deriveGuidePdfPassword(email, entitlementId, guideId, env) {
  if (!env.PDF_PASSWORD_SECRET) {
    throw new Error('PDF_PASSWORD_SECRET is not configured.');
  }
  const seed = `${email.toLowerCase()}:${entitlementId}:${guideId}`;
  const key = await getHmacKey(env.PDF_PASSWORD_SECRET, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(seed));
  const code = bytesToReadableCode(new Uint8Array(sig), 12);
  return formatPassword(code);
}
