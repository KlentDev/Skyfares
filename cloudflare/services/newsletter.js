// services/newsletter.js — post reads served from Beehiiv's posts API,
// deliberately kept separate from services/beehiiv.js (which owns
// subscriber tag/segment/automation MUTATION). This module only ever reads
// posts and reasons about premium-gating; it never writes Beehiiv state.
import { respond } from '../utils/http.js';
import { getBearer, verifyJwt } from '../utils/jwt.js';
import { PUB_BASE_URL, KV_PREFIX, PINNED_POST_ID } from '../config/constants.js';
import { resolveBeehiivAltitudeAccess, beehiivSyncMetadata } from './beehiiv.js';

// ── Newsletter: Get Posts ──────────────────────────────────────────────────────

// Premium-by-default: every post is treated as premium (gated on the Skyfare
// website) UNLESS it is explicitly marked free. This means new posts require
// zero extra steps to gate correctly — the safe default locks them.
//
// Free post signals (checked first — any one makes the post free):
//   • Content tag "altitude-free" or "altitude free" (hyphen or space, any case)
//   • Beehiiv Web Audience = "free" AND explicitly opted out via KV override
//     (override:premium:{slug} = "false")
//
// Premium overrides (if somehow a post should be forced free by default logic
// but the KV override = "true", that takes priority — handled in callers via
// getPremiumOverride which returns null when absent).
//
// The net result:
//   - No tags, no override → premium  (safe default for new posts)
//   - altitude-free tag  → free       (public/teaser content)
//   - audience=premium OR altitude-premium tag OR content diff → premium
//   - KV override:premium:{slug}=false → free  (manual escape hatch)
//
// Beehiiv's `authors` field shape isn't consistently documented (array of
// name strings vs. array of {name} objects) — normalize either into a flat
// array of display names so the frontend never has to guess.
export function normalizeAuthors(authors) {
  if (!Array.isArray(authors)) return [];
  return authors
    .map(a => (typeof a === 'string' ? a : (a && (a.name || a.display_name)) || ''))
    .filter(Boolean);
}

// Used identically by handleGetPosts (archive listing) and handleGetPost
// (detail page) so the badge and the gate can never disagree.
export function isPostPremium(audience, freeHtml, premiumHtml, contentTags) {
  // Explicit free override — altitude-free tag wins over everything
  if (Array.isArray(contentTags) && contentTags.some(t =>
    t.toLowerCase().replace(/[-\s]+/g, '') === 'altitudefree'
  )) return false;

  // Explicit premium signals
  if (audience === 'premium') return true;
  if (Array.isArray(contentTags) && contentTags.some(t =>
    t.toLowerCase().replace(/[-\s]+/g, '') === 'altitudepremium'
  )) return true;
  if (freeHtml && premiumHtml && freeHtml !== premiumHtml) return true;

  // Default: premium. New posts with no tags are gated automatically.
  return true;
}

// Manual override, keyed by slug, set via `wrangler kv key put` (no HTTP route
// -- this is applied directly by Claude on request, not self-service). Exists
// because this account's actual workflow -- picking an email-recipient segment
// on Beehiiv's Audience screen -- is write-only in Beehiiv's API: confirmed via
// Beehiiv's own docs that `recipients` (which holds segment/tier targeting) is
// accepted on Create Post but never returned by Get Post, and no webhook or
// update endpoint exposes it either. Nothing reachable from this Worker can
// ever detect that workflow after the fact, so for posts where it's used, the
// override is the only reliable signal. Takes priority over isPostPremium()
// when present; absence (null) means "no override, use the computed value".
export async function getPremiumOverride(env, slug) {
  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.OVERRIDE_PREMIUM}${slug}`).catch(() => null);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

// Beehiiv's `status=confirmed` filter means "no longer a draft" — it returns
// BOTH scheduled-for-future posts AND already-published ones, with no
// server-side time gate. Without this check, scheduling a post makes it
// immediately live on the site days before its actual scheduled_at, even
// though the email itself (sent by Beehiiv independently of this Worker)
// correctly waits. `publish_date` (unix seconds) is only set once a post has
// actually gone out; while still scheduled, only `scheduled_at` exists.
function isPostLive(p) {
  if (p.publish_date) return p.publish_date * 1000 <= Date.now();
  if (p.scheduled_at) return new Date(p.scheduled_at).getTime() <= Date.now();
  return true;
}

// A post can be tagged "free" overall (isPostPremium() → false, altitude-free
// wins) while still carrying Beehiiv's own mid-article "paywall break" node
// partway through its free content — the free reader gets a real preview,
// then a members-only continuation. Detected from the SAME free content
// string already being fetched to compute is_premium, so this costs zero
// extra Beehiiv API calls.
//
// The marker differs per rendering (confirmed live, 2026-09-03, against
// this account's actual `free_web_content`/`free_email_content` output —
// do not "simplify" this back down without re-checking real data):
//   - free_web_content (used by handleGetPosts/mapPost below): the block is
//     plain inline-styled <div>/<h2>/<a> with NO class or id at all. Its
//     only reliable fingerprints are Beehiiv's own asset path for the
//     paywall logo (/uploads/paywall/image/...) and the CTA link's fixed
//     target (…beehiiv.com/upgrade).
//   - free_email_content (used by handleGetPost, single-post detail):
//     Beehiiv wraps the same block in <tbody class="email-paywall-break-body">.
//   - editor_html (not fetched by this Worker, kept here in case a future
//     caller starts using it): uses class="node-paywallBreak".
function hasPaywallBreak(html) {
  if (!html) return false;
  return /\/uploads\/paywall\//i.test(html)
    || /beehiiv\.com\/upgrade["']/i.test(html)
    || /node-paywallBreak|email-paywall-break-body/i.test(html);
}

// Shared by handleGetPosts's list mapping and its pinned-post fallback fetch
// below, so both ever produce exactly the same post shape.
async function mapPost(p, env) {
  const slug = p.slug || '';
  const contentTags = (p.content_tags || [])
    .map(t => (typeof t === 'string' ? t : t.display || t.slug || ''))
    .filter(Boolean);
  const freeWebHtml = p.content && p.content.free && p.content.free.web;
  const computed = isPostPremium(
    p.audience,
    freeWebHtml,
    p.content && p.content.premium && p.content.premium.web,
    contentTags
  );
  const override = await getPremiumOverride(env, slug);
  return {
    id:            p.id || '',
    title:         p.title || '',
    subtitle:      p.subtitle || '',
    slug,
    url:           p.url || (slug ? `${PUB_BASE_URL}/p/${slug}` : ''),
    thumbnail_url: p.thumbnail_url || '',
    published_at:  p.publish_date
      ? new Date(p.publish_date * 1000).toISOString()
      : (p.scheduled_at || p.created_at || ''),
    content_tags:  contentTags,
    authors: normalizeAuthors(p.authors),
    is_premium: override !== null ? override : computed,
    has_paywall_break: hasPaywallBreak(freeWebHtml),
  };
}

// PINNED_POST_ID ("Welcome to Skyfare") is the OLDEST published post, so
// once Beehiiv has more than `limit` confirmed posts it ages out of the
// recency-ordered page handleGetPosts fetches below and isPinnedPost() on
// the frontend has nothing to pin -- fetched directly by ID as a fallback
// only when that's happened (i.e. essentially never on a fresh publication,
// routinely once the archive grows past one page).
async function fetchPinnedPostFallback(env) {
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts/${PINNED_POST_ID}` +
        `?expand[]=free_web_content&expand[]=premium_web_content`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
    if (!res.ok) return null;
    const raw = await res.json();
    const p = raw.data || raw;
    if (!p || (p.status !== 'confirmed' && p.status !== 'published') || !isPostLive(p)) return null;
    return await mapPost(p, env);
  } catch { return null; }
}

// No caching here on purpose — this account publishes and expects the new
// post live immediately, not after a TTL window (a 1hr-then-5min cache TTL
// here previously hid a freshly published post for several minutes). Every
// request fetches live from Beehiiv. `Cache-Control: no-store` matches that:
// don't let browsers/intermediaries cache this response either.
export async function handleGetPosts(env, corsHeaders) {
  let res;
  try {
    res = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts` +
        `?status=confirmed&order_by=created_at&direction=desc&limit=20` +
        `&expand[]=free_web_content&expand[]=premium_web_content`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
  } catch { return respond({ error: 'Gateway error' }, 502, corsHeaders); }

  if (!res.ok) return respond({ error: 'Beehiiv API error' }, res.status, corsHeaders);

  const raw   = await res.json();
  const items = raw.data || raw.posts || [];

  const posts = (await Promise.all(
    items
      .filter(p => (p.status === 'confirmed' || p.status === 'published') && isPostLive(p))
      .map(p => mapPost(p, env))
  ))
    // Beehiiv's order_by=created_at sorts by draft-creation time, not actual
    // publish time -- a post drafted earlier but published later would land
    // in the wrong slot. Re-sort by the real publish timestamp so posts[0]
    // (what the homepage banner renders) is always the true latest issue.
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  if (!posts.some(p => p.id === PINNED_POST_ID)) {
    const pinned = await fetchPinnedPostFallback(env);
    // Appended at the end, not spliced to the front -- it's genuinely the
    // oldest issue, so this keeps `posts` in true chronological order. The
    // frontend's withPinnedFirst() is what actually moves it to position #1.
    if (pinned) posts.push(pinned);
  }

  return respond({ posts }, 200, { ...corsHeaders, 'Cache-Control': 'no-store' });
}

// ── Newsletter: Get Single Post ────────────────────────────────────────────────

export async function handleGetPost(slug, request, env, corsHeaders) {
  // Check if requester is an authenticated Altitude member
  const token = getBearer(request);
  let isMember = false;
  if (token && env.JWT_SECRET) {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (payload && payload.typ === 'altitude') {
      const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.MEMBER}${payload.sub}`).catch(() => null);
      let member = null;
      if (raw) {
        try { member = JSON.parse(raw); } catch {}
      }
      const decision = await resolveBeehiivAltitudeAccess(payload.sub, env, { member, repair: true });
      isMember = decision.granted === true;
      if (member && decision.sync) {
        await env.ALTITUDE_KV.put(`${KV_PREFIX.MEMBER}${payload.sub}`, JSON.stringify({ ...member, ...decision.sync })).catch(() => {});
      } else if (member && decision.entitlements && decision.reason === 'altitude_tier') {
        await env.ALTITUDE_KV.put(
          `${KV_PREFIX.MEMBER}${payload.sub}`,
          JSON.stringify({ ...member, ...beehiivSyncMetadata(decision.entitlements, { tierSynced: true }) })
        ).catch(() => {});
      }
    }
  }

  // No caching here either, for the same reason as handleGetPosts — fetch
  // live from Beehiiv on every request so edits/publishes show immediately.
  let postMeta = null;
  try {
    const listRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts` +
        `?status=confirmed&order_by=created_at&direction=desc&limit=50`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData.data || listData.posts || [];
      postMeta = items.find(p => p.slug === slug && isPostLive(p)) || null;
    }
  } catch {}

  if (!postMeta) return respond({ error: 'Post not found' }, 404, corsHeaders);

  // Fetch HTML content — pull both free and premium renderings so members
  // actually receive Beehiiv's premium content, not just the free/teaser HTML
  let freeHtml = '', premiumHtml = '';
  try {
    const contentRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUB_ID}/posts/${postMeta.id}` +
        `?expand[]=free_email_content&expand[]=premium_email_content`,
      { headers: { 'Authorization': `Bearer ${env.BEEHIIV_API_KEY}` } }
    );
    if (contentRes.ok) {
      const d = await contentRes.json();
      const p = d.data || d;
      freeHtml    = (p.content && p.content.free && typeof p.content.free.email === 'string')
        ? p.content.free.email : '';
      premiumHtml = (p.content && p.content.premium && typeof p.content.premium.email === 'string')
        ? p.content.premium.email : '';
    }
  } catch {}

  const tags    = (postMeta.content_tags || [])
    .map(t => (typeof t === 'string' ? t : t.display || t.slug || ''))
    .filter(Boolean);
  const computedPremium = isPostPremium(postMeta.audience, freeHtml, premiumHtml, tags);
  const override        = await getPremiumOverride(env, slug);
  const premium         = override !== null ? override : computedPremium;
  const cleaned        = cleanHtml((premium && isMember) ? (premiumHtml || freeHtml) : freeHtml);
  const previewSource  = cleanHtml(freeHtml);

  const post = {
    id:            postMeta.id || '',
    title:         postMeta.title || '',
    subtitle:      postMeta.subtitle || '',
    slug:          postMeta.slug || '',
    url:           postMeta.url || (postMeta.slug ? `${PUB_BASE_URL}/p/${postMeta.slug}` : ''),
    thumbnail_url: postMeta.thumbnail_url || '',
    published_at:  postMeta.publish_date
      ? new Date(postMeta.publish_date * 1000).toISOString()
      : (postMeta.scheduled_at || postMeta.created_at || ''),
    content_tags:  tags,
    authors: normalizeAuthors(postMeta.authors),
    is_premium:    premium,
    // Members always get full content; non-members get preview for premium posts
    content_html:  (!premium || isMember) ? cleaned : null,
    preview_html:  premium && !isMember   ? extractPreview(previewSource) : null,
    has_paywall_break: hasPaywallBreak(freeHtml),
  };

  return respond({ post }, 200, { ...corsHeaders, 'Cache-Control': 'no-store' });
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/ xmlns="[^"]*"/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/ data-node-hash="[^"]*"/g, '')
    .trim();
}

function extractPreview(html) {
  if (!html) return '';
  const matches = [];
  const re = /<p([^>]*)>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null && matches.length < 3) {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text.length > 20) matches.push('<p' + m[1] + '>' + m[2] + '</p>');
  }
  return matches.join('\n');
}
