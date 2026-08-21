/**
 * Skyfare Altitude — Cloudflare Worker
 *
 * Entry point only — routing (fetch) + cron dispatch (scheduled). Every route
 * handler lives in services/ (single-concern: Stripe, Beehiiv, Airtable,
 * newsletter reads) or orchestration/ (handlers that call more than one of
 * those in a single request — see krisflyer.md for the 2026-07-24 module
 * split that replaced the single subscribe-worker.js this file used to be).
 *
 * Routes:
 *   POST /                         — subscribe email to newsletter
 *   GET  /newsletter/posts         — latest published posts (live, no cache)
 *   GET  /newsletter/post?slug=    — single post with content (live, no cache)
 *   POST /altitude/checkout        — create Stripe Checkout session
 *   POST /altitude/webhook         — Stripe webhook handler (checkout.session.completed,
 *                                    customer.subscription.deleted/updated,
 *                                    invoice.payment_succeeded — renewal-only, see
 *                                    orchestration/stripeWebhook.js's handleInvoicePaymentSucceeded)
 *   POST /altitude/activate        — verify a fresh Stripe checkout (session_id) and fulfil
 *                                    it (KV + Beehiiv tag), then email a magic link instead
 *                                    of auto-logging in (see orchestration/session.js's
 *                                    sendStarterMagicLink). The email-only path still issues
 *                                    a JWT directly, but is unused by any current frontend.
 *   GET  /altitude/verify          — verify JWT (also reports Guide access; optional
 *                                    ?target=guide|altitude returns a product-specific
 *                                    entitlement decision for private portal navigation)
 *   POST /altitude/magic-request   — request a magic login link (Altitude or Guide)
 *   POST /altitude/magic-verify    — verify a magic link token, issue JWT
 *   POST /altitude/portal          — Stripe Billing Portal session for an existing member
 *   POST /altitude/upgrade         — upgrade an active Monthly member to Annual in place
 *                                    (modifies the existing Stripe subscription, no new
 *                                    Checkout Session — see services/stripe.js's handleUpgradeToAnnual)
 *   POST /altitude/waitlist        — join the pre-launch Altitude waitlist
 *   GET  /altitude/content/*       — authenticated Airtable CMS content for private
 *                                    Altitude pages; requires Altitude JWT
 *   POST /guide/checkout           — create Stripe Checkout session for the KrisFlyer Guide
 *                                    (one-time purchase; webhook shares /altitude/webhook,
 *                                    branched by session.mode — see handleGuideCheckoutComplete)
 *   POST /guide/pdf/download       — generate a personalised, password-protected guide PDF
 *                                    and stream it to an entitled, authenticated buyer
 *                                    (see services/guidePdf.js, orchestration/guidePdfHandlers.js)
 *   POST /guide/pdf/email          — same, but emailed via a signed short-lived R2 link
 *                                    + Beehiiv automation instead of streamed directly
 *   GET  /guide/pdf/fetch          — the signed link above; no auth header, protected only
 *                                    by an HMAC-signed expiring token (utils/signedLink.js)
 *   GET  /guide/chapters           — published chapters for the on-site chapter reader
 *                                    (see orchestration/guideChaptersHandler.js)
 *   POST /assessment/checkout      — create Stripe Checkout session for the Travel Strategy Call
 *                                    (one-time $99 purchase; webhook shares /altitude/webhook,
 *                                    branched by metadata.product — see handleAssessmentCheckoutComplete)
 *   GET  /assessment/verify        — server-side check that a Stripe session_id was actually paid,
 *                                    before the success page reveals the Cal.com/WhatsApp buttons.
 *                                    Also returns a signed /assessment/book booking link (see below).
 *   GET  /assessment/book          — signed, expiring (30-day) booking-redirect link mailed in the
 *                                    confirmation email and shown on the success page; verifies the
 *                                    signature then 302s to the real Cal.com URL (never exposed
 *                                    unsigned) — see orchestration/assessmentBooking.js
 *   POST /calcom/webhook           — Cal.com webhook handler (BOOKING_CREATED — flips the matching
 *                                    Airtable booking row to 'Booked', see orchestration/calcomWebhook.js)
 *   POST /airtable/testimonial     — submit a testimonial (Approved=false by default)
 *   GET  /airtable/testimonials    — approved testimonials. ?scope=featured&limit=N (homepage, default 3,
 *                                    no pagination) or default/?scope=all&limit=N&offset=... (archive,
 *                                    default page size 9, paginated via the returned `offset` token)
 *
 * Required secrets (wrangler secret put):
 *   BEEHIIV_API_KEY
 *
 *   -- Skyfare production Stripe configuration (live mode) --
 *   Main Altitude Access + KrisFlyer Guide Stripe account. Live values are
 *   set only via `wrangler secret put` from cloudflare/, never committed —
 *   see services/stripe.js and orchestration/stripeWebhook.js for usage.
 *   STRIPE_SECRET_KEY        — live secret key, Skyfare's production Stripe account
 *   STRIPE_WEBHOOK_SECRET    — live signing secret for this account's /altitude/webhook endpoint
 *   STRIPE_PRICE_ID          — Altitude Access, monthly (default plan)
 *   STRIPE_PRICE_ID_ANNUAL   — Altitude Access, annual (POST /altitude/checkout {plan:'annual'})
 *   STRIPE_GUIDE_PRICE_ID
 *
 *   JWT_SECRET
 *
 *   -- Travel Strategy Call: separate sandbox Stripe account (unrelated to
 *   the Skyfare production configuration above) --
 *   STRIPE_ASSESSMENT_PRICE_ID  — Travel Strategy Call, one-time $99, under the "Klent sandbox"
 *                              Stripe account (acct_1Tl1nJB9NfKSwBnU) while this product is being tested
 *   STRIPE_ASSESSMENT_SECRET_KEY — secret key for that same sandbox account. Deliberately separate
 *                              from STRIPE_SECRET_KEY (a different Stripe account, not just a different
 *                              mode) -- see services/stripe.js's handleAssessmentCheckout. Swap this
 *                              whole product to the real account and back to STRIPE_SECRET_KEY once
 *                              testing is done.
 *   STRIPE_WEBHOOK_SECRET_ASSESSMENT — signing secret for the sandbox account's own webhook
 *                              endpoint (we_1U0DUnB9NfKSwBnU..., points at this same /altitude/webhook
 *                              URL) -- checked alongside STRIPE_WEBHOOK_SECRET in handleStripeWebhook
 *                              so both Stripe accounts' events verify correctly
 *   ASSESSMENT_LINK_SECRET   — HMAC key for signed, expiring /assessment/book booking-redirect links
 *   CALCOM_API_KEY           — not currently called by any handler (webhook-only integration so far),
 *                              stored for a future pass that queries the Cal.com API directly
 *   CALCOM_WEBHOOK_SECRET    — signing secret set on the Cal.com webhook subscription (dashboard:
 *                              Settings -> Developer -> Webhooks), verifies X-Cal-Signature-256
 *   PDF_PASSWORD_SECRET     — HMAC key for deterministic guide-PDF password derivation
 *   PDF_LINK_SECRET         — HMAC key for signed /guide/pdf/fetch download links
 *   AIRTABLE_API_KEY   AIRTABLE_TABLE_ASSESSMENT_BOOKINGS
 *   AIRTABLE_TABLE_ALTITUDE_SUBSCRIBERS — paid Monthly/Annual subscriber mirror
 *
 * KV binding: ALTITUDE_KV
 * R2 binding: GUIDE_PDF_BUCKET (temporary guide-PDF storage for the email flow)
 * D1 binding: AUDIT_DB (guide_pdf_audit_log — see migrations/0001_guide_pdf_audit_log.sql)
 * Browser Rendering binding: BROWSER (Puppeteer, guide PDF generation)
 */
import { ALLOWED_ORIGINS } from './config/constants.js';
import { respond } from './utils/http.js';

import {
  handleCheckout, handleGuideCheckout, handleManagePortal, handleUpgradeToAnnual,
  handleAssessmentCheckout, handleAssessmentVerify,
} from './services/stripe.js';
import { handleWaitlist, handleMagicRequest, handleSubscribe, triggerSegmentRecalculation } from './services/beehiiv.js';
import { handleGetPosts, handleGetPost } from './services/newsletter.js';
import {
  handleFlightApplication, handlePostTestimonial,
  handleGetTestimonials, handleGetTestimonialScores, handleGetAltitudeContent,
} from './services/airtable.js';
import { handleContactInquiry } from './orchestration/contactInquiry.js';

import { handleStripeWebhook } from './orchestration/stripeWebhook.js';
import { handleCalcomWebhook } from './orchestration/calcomWebhook.js';
import { handleAssessmentBookingRedirect } from './orchestration/assessmentBooking.js';
import { handleActivate, handleVerify, handleMagicVerify } from './orchestration/session.js';
import { handleGuidePdfDownload, handleGuidePdfEmail, handleGuidePdfFetch } from './orchestration/guidePdfHandlers.js';
import { handleGetGuideChapters } from './orchestration/guideChaptersHandler.js';
import { runRenewalReminders, expireGuideBundles, reconcileBeehiivAccess } from './orchestration/cron.js';

export default {
  // Single daily cron: 0 1 * * * (01:00 UTC / 09:00 SGT) -- recalculation +
  // renewal reminders. The old every-minute-then-every-5-minutes cron was
  // dropped entirely on 2026-08-04: every event that actually changes a
  // segment (signup, tagging) already triggers its own real-time
  // recalculation inline (see services/beehiiv.js's call sites), so a
  // separate frequent sweep was pure redundant Beehiiv API traffic. This
  // daily run is now the only periodic one, and passes `{ all: true }` so it
  // also covers SEG_GUIDE/SEG_MONTHLY/SEG_ANNUAL, which no longer get
  // real-time recalculation (see triggerSegmentRecalculation's own comment).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      triggerSegmentRecalculation(env, { all: true }),
      runRenewalReminders(env),
      expireGuideBundles(env),
      reconcileBeehiivAccess(env),
    ]));
  },

  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Stripe webhook — skip CORS origin check (Stripe servers, not browser)
    if (request.method === 'POST' && url.pathname === '/altitude/webhook') {
      return handleStripeWebhook(request, env, corsHeaders);
    }

    // Cal.com webhook — same reasoning, Cal.com's servers have no browser Origin
    if (request.method === 'POST' && url.pathname === '/calcom/webhook') {
      return handleCalcomWebhook(request, env, corsHeaders);
    }

    // Standard CORS check for all other routes
    if (origin && !isAllowed) {
      return respond({ error: 'Forbidden' }, 403, corsHeaders);
    }

    // ── Altitude Access routes ─────────────────────────────────────────────

    if (request.method === 'POST' && url.pathname === '/altitude/checkout') {
      return handleCheckout(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/activate') {
      return handleActivate(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/magic-request') {
      return handleMagicRequest(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/magic-verify') {
      return handleMagicVerify(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/altitude/verify') {
      return handleVerify(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/portal') {
      return handleManagePortal(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/upgrade') {
      return handleUpgradeToAnnual(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/altitude/waitlist') {
      return handleWaitlist(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/altitude/content/award-alerts') {
      return handleGetAltitudeContent(request, env, corsHeaders, 'award-alerts');
    }

    if (request.method === 'GET' && url.pathname === '/altitude/content/routing-strategies') {
      return handleGetAltitudeContent(request, env, corsHeaders, 'routing-strategies');
    }

    if (request.method === 'GET' && url.pathname === '/altitude/content/krisflyer-escapes') {
      return handleGetAltitudeContent(request, env, corsHeaders, 'krisflyer-escapes');
    }

    // ── KrisFlyer Guide routes ──────────────────────────────────────────────

    if (request.method === 'POST' && url.pathname === '/guide/checkout') {
      return handleGuideCheckout(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/guide/pdf/download') {
      return handleGuidePdfDownload(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/guide/pdf/email') {
      return handleGuidePdfEmail(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/guide/pdf/fetch') {
      return handleGuidePdfFetch(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/guide/chapters') {
      return handleGetGuideChapters(request, env, corsHeaders);
    }

    // ── Travel Strategy Call routes ─────────────────────────────────────────

    if (request.method === 'POST' && url.pathname === '/assessment/checkout') {
      return handleAssessmentCheckout(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/assessment/verify') {
      return handleAssessmentVerify(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/assessment/book') {
      return handleAssessmentBookingRedirect(request, env);
    }

    // ── Newsletter routes ──────────────────────────────────────────────────

    if (request.method === 'GET' && url.pathname === '/newsletter/posts') {
      return handleGetPosts(env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/newsletter/post') {
      const slug = url.searchParams.get('slug');
      if (!slug) return respond({ error: 'Missing slug parameter' }, 400, corsHeaders);
      return handleGetPost(slug, request, env, corsHeaders);
    }

    // ── Airtable CRM routes ────────────────────────────────────────────────

    if (request.method === 'POST' && url.pathname === '/airtable/flight-application') {
      return handleFlightApplication(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/airtable/contact') {
      return handleContactInquiry(request, env, corsHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/airtable/testimonial') {
      return handlePostTestimonial(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/airtable/testimonials') {
      return handleGetTestimonials(request, env, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/airtable/testimonial-scores') {
      return handleGetTestimonialScores(request, env, corsHeaders);
    }

    // ── Subscribe ──────────────────────────────────────────────────────────

    return handleSubscribe(request, env, corsHeaders);
  },
};
