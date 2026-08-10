// services/calcom.js — signature verification for inbound Cal.com webhooks.
// Cal.com signs each webhook payload with the signing secret configured on
// the webhook subscription (Cal.com dashboard: Settings -> Developer ->
// Webhooks), sent as a plain hex HMAC-SHA256 of the raw request body in the
// X-Cal-Signature-256 header -- no timestamp/replay-window component like
// Stripe's scheme, so this is a straight compare, not a port of
// verifyStripeSignature (services/stripe.js).
import { getHmacKey } from '../utils/crypto.js';

export async function verifyCalcomSignature(body, signature, secret) {
  if (!signature) return false;

  const key = await getHmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}
