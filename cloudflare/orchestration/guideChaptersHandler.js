// orchestration/guideChaptersHandler.js — GET /guide/chapters, the on-site
// chapter reader's data source. Separate from orchestration/guidePdfHandlers.js
// on purpose: this is a different concern (reading online) from PDF
// generation/delivery, even though both share the same live-entitlement gate.
import { respond } from '../utils/http.js';
import { getBearer, verifyJwt } from '../utils/jwt.js';
import { KV_PREFIX } from '../config/constants.js';
import { getActiveGuideEntitlement } from '../services/guidePdf.js';
import { getPublishedChapters } from '../services/guideChapters.js';

const CHAPTERS_LIMIT_PER_HOUR = 30;

export async function handleGetGuideChapters(request, env, corsHeaders) {
  const token = getBearer(request);
  if (!token) return respond({ error: 'Not authenticated.' }, 401, corsHeaders);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || typeof payload.sub !== 'string' || !payload.sub.includes('@')) {
    return respond({ error: 'Invalid or expired session.' }, 401, corsHeaders);
  }
  const email = payload.sub.toLowerCase();

  const rlKey = `${KV_PREFIX.RL_GUIDE_CHAPTERS}${email}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= CHAPTERS_LIMIT_PER_HOUR) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // Same live KV re-check as the PDF routes — never trust the JWT's `guide`
  // claim alone.
  const guide = await getActiveGuideEntitlement(email, env);
  if (!guide) {
    return respond({ error: 'No active KrisFlyer Guide access found for this account.' }, 403, corsHeaders);
  }

  try {
    const { chapters } = await getPublishedChapters(env);
    return respond({ chapters }, 200, corsHeaders);
  } catch (err) {
    console.error('[guide-chapters] fetch failed:', String(err).slice(0, 200));
    return respond({ error: 'Could not load chapters right now. Please try again shortly.' }, 502, corsHeaders);
  }
}
