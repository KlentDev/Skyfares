// utils/jwt.js — JWT sign/verify (Web Crypto API — no external library
// needed) + the magic-link token generator, which shares the same
// crypto.getRandomValues primitive family.
import { b64url, b64urlStr, b64urlDecode, getHmacKey } from './crypto.js';

export async function signJwt(payload, secret) {
  const data = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' +
               b64urlStr(JSON.stringify(payload));
  const key  = await getHmacKey(secret, 'sign');
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + b64url(sig);
}

export async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const data    = h + '.' + p;
    const key     = await getHmacKey(secret, 'verify');
    const sigBytes = b64urlDecode(s);
    const valid   = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function getBearer(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function generateMagicToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map(n => n.toString(16).padStart(2, '0')).join('');
}
