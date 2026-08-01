// orchestration/guidePdfHandlers.js — the three routes behind "Download
// Guide" / "Send to My Email" on the KrisFlyer Guide private portal. Lives in
// orchestration/ (not services/) because it calls more than one concern in a
// single request — KV entitlement, Puppeteer/PDF generation, R2, and Beehiiv
// — matching this file's own module-split convention (see krisflyer.md).
import { respond } from '../utils/http.js';
import { getBearer, verifyJwt } from '../utils/jwt.js';
import { signGuidePdfLink, verifyGuidePdfLink } from '../utils/signedLink.js';
import { logGuidePdfRequest } from '../utils/auditLog.js';
import { KV_PREFIX, GUIDE_ID } from '../config/constants.js';
import { getActiveGuideEntitlement, getEntitlementId, generateGuidePdf } from '../services/guidePdf.js';
import { sendGuidePdfDeliveryEmail } from '../services/beehiiv.js';

const DOWNLOAD_LIMIT_PER_HOUR = 10;
const EMAIL_LIMIT_PER_HOUR = 3;
const FETCH_LIMIT_PER_HOUR = 30; // per IP — defense-in-depth only, the token itself is unguessable
const LINK_TTL_SECONDS = 24 * 60 * 60;

async function checkRateLimit(prefix, key, limit, env) {
  const rlKey = `${prefix}${key}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= limit) return false;
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });
  return true;
}

/** Shared auth + entitlement gate for the two authenticated POST routes. */
async function authenticateAndAuthorize(request, env) {
  const token = getBearer(request);
  if (!token) return { errorStatus: 401, errorMessage: 'Not authenticated.' };

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || typeof payload.sub !== 'string' || !payload.sub.includes('@')) {
    return { errorStatus: 401, errorMessage: 'Invalid or expired session.' };
  }
  const email = payload.sub.toLowerCase();

  const guide = await getActiveGuideEntitlement(email, env);
  if (!guide) {
    return { email, denied: true };
  }
  return { email, guide };
}

export async function handleGuidePdfDownload(request, env, corsHeaders) {
  const auth = await authenticateAndAuthorize(request, env);
  if (auth.errorStatus) return respond({ error: auth.errorMessage }, auth.errorStatus, corsHeaders);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (auth.denied) {
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId: null, method: 'download', status: 'denied', reason: 'no_active_guide_entitlement', ip }, env).catch(() => {});
    return respond({ error: 'No active KrisFlyer Guide access found for this account.' }, 403, corsHeaders);
  }

  const allowed = await checkRateLimit(KV_PREFIX.RL_GUIDE_PDF_DOWNLOAD, auth.email, DOWNLOAD_LIMIT_PER_HOUR, env);
  if (!allowed) return respond({ error: 'rate_limited' }, 429, corsHeaders);

  const entitlementId = getEntitlementId(auth.guide);
  try {
    const { pdfBytes, password } = await generateGuidePdf(auth.email, auth.guide, env);
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'download', status: 'success', ip }, env).catch(() => {});

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="krisflyer-guide.pdf"',
        'X-Guide-Pdf-Password': password,
        'Access-Control-Expose-Headers': 'X-Guide-Pdf-Password',
      },
    });
  } catch (err) {
    console.error('[guide-pdf-download] generation failed:', String(err).slice(0, 200));
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'download', status: 'error', reason: String(err).slice(0, 200), ip }, env).catch(() => {});
    return respond({ error: 'Could not generate the guide right now. Please try again shortly.' }, 502, corsHeaders);
  }
}

export async function handleGuidePdfEmail(request, env, corsHeaders) {
  const auth = await authenticateAndAuthorize(request, env);
  if (auth.errorStatus) return respond({ error: auth.errorMessage }, auth.errorStatus, corsHeaders);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (auth.denied) {
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId: null, method: 'email', status: 'denied', reason: 'no_active_guide_entitlement', ip }, env).catch(() => {});
    return respond({ error: 'No active KrisFlyer Guide access found for this account.' }, 403, corsHeaders);
  }

  const allowed = await checkRateLimit(KV_PREFIX.RL_GUIDE_PDF_EMAIL, auth.email, EMAIL_LIMIT_PER_HOUR, env);
  if (!allowed) return respond({ error: 'rate_limited' }, 429, corsHeaders);

  const entitlementId = getEntitlementId(auth.guide);

  // Distinct from the hourly counter above: this only ever gets set on a
  // *confirmed* successful send (below), so a genuinely failed first attempt
  // never wrongly locks someone out of retrying for a day. 409, not 429 --
  // "you already have this" is a different condition from "you're going too
  // fast," and giving it its own status code lets the frontend branch
  // without parsing every 429 body.
  const sentKey = `${KV_PREFIX.GUIDE_PDF_EMAIL_SENT}${auth.email}`;
  if (await env.ALTITUDE_KV.get(sentKey)) {
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'email', status: 'denied', reason: 'already_sent_within_24h', ip }, env).catch(() => {});
    return respond({
      error: 'already_sent',
      message: 'You already downloaded the guide! Please check your email for access. If something is wrong or you have other concerns, contact us.',
    }, 409, corsHeaders);
  }

  if (!env.GUIDE_PDF_BUCKET) {
    return respond({ error: 'Email delivery is not configured yet.' }, 503, corsHeaders);
  }

  try {
    const { pdfBytes, password } = await generateGuidePdf(auth.email, auth.guide, env);

    const objectKey = `guide-pdf/${crypto.randomUUID()}.pdf`;
    await env.GUIDE_PDF_BUCKET.put(objectKey, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const { key, exp, sig } = await signGuidePdfLink(objectKey, LINK_TTL_SECONDS, env);
    const downloadUrl = `${new URL(request.url).origin}/guide/pdf/fetch?key=${encodeURIComponent(key)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;

    const sent = await sendGuidePdfDeliveryEmail(auth.email, downloadUrl, password, env);
    if (!sent) {
      await env.GUIDE_PDF_BUCKET.delete(objectKey).catch(() => {});
      await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'email', status: 'error', reason: 'beehiiv_send_failed', ip }, env).catch(() => {});
      return respond({ error: 'Could not send the email right now. Please try again shortly.' }, 502, corsHeaders);
    }

    await env.ALTITUDE_KV.put(sentKey, '1', { expirationTtl: 86400 });
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'email', status: 'success', ip }, env).catch(() => {});
    return respond({ ok: true, message: 'Check your inbox — your guide and its password are on the way.' }, 200, corsHeaders);
  } catch (err) {
    console.error('[guide-pdf-email] failed:', String(err).slice(0, 200));
    await logGuidePdfRequest({ email: auth.email, guideId: GUIDE_ID, entitlementId, method: 'email', status: 'error', reason: String(err).slice(0, 200), ip }, env).catch(() => {});
    return respond({ error: 'Could not generate the guide right now. Please try again shortly.' }, 502, corsHeaders);
  }
}

// The link an email recipient actually clicks. No JWT/Authorization header —
// protected purely by the signed, expiring token (see utils/signedLink.js).
//
// Deliberately NOT delete-on-first-fetch: corporate/Gmail email-security
// scanners (Microsoft Defender for Office 365 Safe Links, Proofpoint,
// Mimecast, Google's link-scanning proxy, etc.) routinely pre-fetch every
// URL in an inbound email to scan it for malware, before the real recipient
// ever clicks it. A one-time-use link that dies on first GET would get
// silently burned by that scan, and the actual purchaser would land on a
// "this link has already been used" error on their very first real click.
// Cleanup instead relies solely on the bucket's 24h object-lifecycle rule —
// a wider window than strict one-time-use, but this whole feature is
// explicitly defense-in-depth against casual sharing, not DRM, so a link
// that's reusable for a bounded 24h is an acceptable trade for "the
// legitimate buyer's first click always works."
export async function handleGuidePdfFetch(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const exp = url.searchParams.get('exp');
  const sig = url.searchParams.get('sig');
  if (!key || !exp || !sig) {
    return respond({ error: 'Invalid link.' }, 400, corsHeaders);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(KV_PREFIX.RL_GUIDE_PDF_FETCH, ip, FETCH_LIMIT_PER_HOUR, env);
  if (!allowed) return respond({ error: 'rate_limited' }, 429, corsHeaders);

  if (!env.GUIDE_PDF_BUCKET) {
    return respond({ error: 'This link is not available right now.' }, 503, corsHeaders);
  }

  try {
    const valid = await verifyGuidePdfLink(key, exp, sig, env);
    if (!valid) {
      return respond({ error: 'This link is invalid or has expired.' }, 410, corsHeaders);
    }

    const object = await env.GUIDE_PDF_BUCKET.get(key);
    if (!object) {
      return respond({ error: 'This link has expired.' }, 404, corsHeaders);
    }

    return new Response(object.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="krisflyer-guide.pdf"',
      },
    });
  } catch (err) {
    console.error('[guide-pdf-fetch] failed:', String(err).slice(0, 200));
    return respond({ error: 'This link is not available right now.' }, 500, corsHeaders);
  }
}
