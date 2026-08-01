// utils/crypto.js — pure Web Crypto primitives (base64url encoding + HMAC key
// import). Uses the runtime-global Web Crypto API (crypto.subtle,
// crypto.getRandomValues) with zero imports, exactly as before the 2026-07-24
// module split — do not import Node's `crypto` module here, that would pull
// in nodejs_compat unnecessarily.

export function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function b64urlStr(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// Reused by both utils/jwt.js (sign/verify) AND services/stripe.js's
// verifyStripeSignature (webhook HMAC verification) — genuinely cross-concern
// at the primitive level, which is why this lives in its own utils/crypto.js
// rather than inside utils/jwt.js.
export async function getHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}
