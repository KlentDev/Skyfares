// config/constants.js — every automation/tag/segment ID, cross-concern URL, and
// KV key prefix used across the Worker. Centralized here (moved out of
// subscribe-worker.js during the 2026-07-24 module split) so nothing is a
// hand-typed literal repeated across files — see krisflyer.md for the split.

// ── Beehiiv automation IDs ────────────────────────────────────────────────────

export const WELCOME_AUTOMATION_ID      = 'aut_ed8a12c4-3661-4226-9c93-21e43ffa5e3e';
export const MAGIC_LINK_AUTOMATION_ID   = 'aut_765b1f46-64b1-48fb-be4c-ac75386a949a';
export const MAGIC_LINK_CF_NAME         = 'magic_link_url'; // custom field that holds the one-time URL

// Sent right after a fresh Altitude Monthly/Annual Stripe subscription
// completes, via sendStarterMagicLink() — in place of the old auto-login
// (see orchestration/session.js's handleActivate). Deliberately a separate
// automation from MAGIC_LINK_AUTOMATION_ID, which stays scoped to on-demand
// "Member Access" requests; both read the same MAGIC_LINK_CF_NAME custom
// field, just via different automations/copy.
export const STARTER_MAGIC_LINK_AUTOMATION_ID = 'aut_7f86ca72-14cb-4af3-9b26-9e7275f20114';

// Sent right after a KrisFlyer Guide purchase, via sendGuideMagicLink() —
// previously shared MAGIC_LINK_AUTOMATION_ID with on-demand Member Access
// requests (same token/CF mechanism, different landing page, same email).
// Now its own automation, same pattern as STARTER_MAGIC_LINK_AUTOMATION_ID.
export const GUIDE_MAGIC_LINK_AUTOMATION_ID = 'aut_783ff7b2-e472-400c-aafd-180274e45a34';

// Renewal reminder automations — enrolled by the daily cron, not by user actions
export const RENEWAL_7D_AUTOMATION_ID   = 'aut_6f675263-fec5-436d-894a-91d5c168feaf';
export const RENEWAL_3D_AUTOMATION_ID   = 'aut_2093dcea-c91e-4a81-baae-a3b27cf8d671';
export const RENEWAL_1D_AUTOMATION_ID   = 'aut_eb704a34-24c3-4094-b446-b4eeaf3337ac';

// Plan-specific Welcome/Renewed automations (see krisflyer.md "Related Beehiiv
// work" section) — still `draft` in Beehiiv as of this writing. Confirmed
// (2026-07-22, via the automation's own staging-workspace config): each
// Welcome automation's only trigger is segment_action on its matching
// SEG_MONTHLY/SEG_ANNUAL segment, not an api trigger — so the direct
// journeys-endpoint call in enrollWelcomeAutomation is a harmless no-op
// today. Real enrollment happens automatically once applyIntervalTag +
// triggerSegmentRecalculation land the subscriber in that segment. The
// direct call is kept anyway for forward-compatibility in case that changes.
export const WELCOME_MONTHLY_AUTOMATION_ID = 'aut_d710e39c-a8a6-434f-8393-8bcfd44174f0';
export const WELCOME_ANNUAL_AUTOMATION_ID  = 'aut_5dbf5c22-70dc-4e68-ac8d-7acde5a0033a';
export const RENEWED_MONTHLY_AUTOMATION_ID = 'aut_a9bab9b2-39b6-4cf8-8a5d-f9ce378acce6';
export const RENEWED_ANNUAL_AUTOMATION_ID  = 'aut_2b5db0e5-e23d-4358-aa45-a23708a352c1';

// Sent when a Guide buyer's deferred 90-day bundle activates (see
// orchestration/guideBundle.js's activateDeferredGuideBundle) — a former
// Monthly/Annual member whose real subscription just ended. Deliberately NOT
// the generic Welcome automation: that copy ("You're in! Welcome to
// Altitude") would read confusingly to someone who was already a member and
// just cancelled. Still `draft` in Beehiiv as of this writing — needs a
// manual publish before it sends.
export const GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID = 'aut_88e0a2b5-f8d3-48e0-ae71-b27f26fcdad7';

// Sent when a scheduled Monthly→Annual upgrade actually takes effect (see
// services/stripe.js's handleUpgradeToAnnual + orchestration/stripeWebhook.js's
// handleSubscriptionUpdated) — fires at the real phase-boundary switch, not
// at click time, since nothing has actually changed for the member until
// then. Deliberately a dedicated automation, not RENEWED_ANNUAL_AUTOMATION_ID
// (that's for existing Annual members renewing, this is a one-time "you just
// became Annual" congratulations).
export const UPGRADED_ANNUAL_AUTOMATION_ID = 'aut_2c9e00f8-3e2f-4fbc-bc2c-224bdef7df75';

// ── Beehiiv tags & segments ───────────────────────────────────────────────────

// altitude monthly / altitude annual are the sole subscriber tags that mean
// "has paid Altitude access" — see services/beehiiv.js's checkBeehiivPremium.
// The old universal "altitude premium" tag (and the automation that applied
// it) has been retired in favor of these plan-specific tags plus
// GUIDE_BUNDLE_TAG_NAME.
export const GUIDE_TAG_NAME  = 'krisflyer'; // permanent "bought the KrisFlyer Guide" tag (see krisflyer.md) — never removed
export const INTERVAL_TAG_IDS = { monthly: 'eab046f1-f103-4e7a-8568-63c5f036e13f', annual: '2df373f0-50ae-416d-9001-97e955a14393' }; // altitude monthly / altitude annual tags
export const GUIDE_BUNDLE_TAG_NAME = 'krisflyer bundle'; // temporary tag for the Guide's 90-day free Altitude bundle (see orchestration/guideBundle.js) — distinct from GUIDE_TAG_NAME, which is permanent
export const GUIDE_BUNDLE_TAG_ID   = 'e1e9ccfe-bee9-4786-bf7f-2e20bb94a2da';

// Permanent "paid for a Travel Strategy Call" tag, applied in
// handleAssessmentCheckoutComplete (orchestration/stripeWebhook.js) — never
// removed, mirrors GUIDE_TAG_NAME's pattern. Feeds SEG_TRAVEL_STRAT_CALL below,
// which triggers TRAVEL_STRAT_CALL_AUTOMATION_ID (still draft in Beehiiv as of
// this writing — needs a manual publish before it actually sends).
export const TRAVEL_STRAT_CALL_TAG_NAME = 'travel-strat-call';
export const TRAVEL_STRAT_CALL_TAG_ID   = 'e1da42a0-f5fc-4fb0-b742-b83249c350cb';

// "Altitude Premium Subscribers" (formerly SEG_PREMIUM, seg_6b2bf91a...) is retired — it was
// always just the union of Monthly + Annual, both of which are already recalculated below.
export const SEG_FREE      = 'seg_f4472be3-fe20-4ed6-b761-367041d6a522';
export const SEG_PRELAUNCH = 'seg_3b2edb32-94a4-43b8-af13-1668923ffa95'; // Pre-Launch Subscribers (utm_campaign=altitude_prelaunch)
export const SEG_GUIDE      = 'seg_fd7d552b-eb91-4536-a7f7-ca7665c95782'; // KrisFlyer Guide Subscribers (where: subscriber_tag = krisflyer)
export const SEG_MONTHLY    = 'seg_66838dd3-207a-41f0-a93b-94743e005dc1'; // Altitude Monthly Subscribers (where: altitude-monthly)
export const SEG_ANNUAL     = 'seg_56c30f35-abc9-44bd-9c29-f40a9dbc1491'; // Altitude Annual Subscribers (where: altitude-annual)
export const SEG_TRAVEL_STRAT_CALL = 'seg_bd786e3e-07a3-420f-95c1-8360b912dd9d'; // Travel Strategy Call Buyers (where: subscriber_tag = travel-strat-call)

// ── Cross-concern URLs ────────────────────────────────────────────────────────

export const ALLOWED_ORIGINS = [
  'https://skyfareconsulting.com',
  'https://www.skyfareconsulting.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
];

export const PUB_BASE_URL = 'https://skyfarealtitude.beehiiv.com';
export const SITE_URL     = 'https://skyfareconsulting.com';
export const WORKER_BASE_URL = 'https://skyfares-altitude.klent-5fa.workers.dev'; // this Worker's own public URL -- needed for links embedded in emails, which have no request Origin to derive a base URL from (see utils/http.js's getBaseUrl)
export const CALCOM_BOOKING_URL = 'https://cal.com/klentmicko/travel-strategy-call'; // real destination /assessment/book redirects to after verifying a signed booking link (orchestration/assessmentBooking.js)

// ── Airtable ───────────────────────────────────────────────────────────────────

// Maps a Cabin Compare IATA route code to the exact Airtable "Route"
// choice-name string, so ?route= lookups can filter by the same code
// js/cabin-compare.js already keys its DATA object on.
export const ROUTE_LABELS = {
  LHR: 'London (LHR)', CDG: 'Paris (CDG)', FRA: 'Frankfurt (FRA)', ZRH: 'Zurich (ZRH)',
  AMS: 'Amsterdam (AMS)', FCO: 'Rome (FCO)', MXP: 'Milan (MXP)', IST: 'Istanbul (IST)', BCN: 'Barcelona (BCN)',
  JFK: 'New York JFK (JFK)', EWR: 'New York Newark (EWR)', LAX: 'Los Angeles (LAX)', SFO: 'San Francisco (SFO)', SEA: 'Seattle (SEA)',
  SYD: 'Sydney (SYD)', MEL: 'Melbourne (MEL)', BNE: 'Brisbane (BNE)', PER: 'Perth (PER)', AKL: 'Auckland (AKL)',
  NRT: 'Tokyo Narita (NRT)', HND: 'Tokyo Haneda (HND)', ICN: 'Seoul (ICN)', HKG: 'Hong Kong (HKG)', TPE: 'Taipei (TPE)', PVG: 'Shanghai (PVG)', PEK: 'Beijing (PEK)',
  DEL: 'Delhi (DEL)', BOM: 'Mumbai (BOM)', CMB: 'Colombo (CMB)',
  BKK: 'Bangkok (BKK)', CGK: 'Jakarta (CGK)', DPS: 'Bali (DPS)', MNL: 'Manila (MNL)', SGN: 'Ho Chi Minh City (SGN)', HAN: 'Hanoi (HAN)', KUL: 'Kuala Lumpur (KUL)',
  DXB: 'Dubai (DXB)', DOH: 'Doha (DOH)', JNB: 'Johannesburg (JNB)',
};

// ── KV key prefixes ────────────────────────────────────────────────────────────
// Previously scattered as hand-typed string literals across subscribe-worker.js
// (a real duplication risk — MEMBER alone was touched by 3+ call sites).
// Centralized here during the 2026-07-24 module split; values are UNCHANGED
// from what was already live, including RL_ACTIVATE's pre-existing bare 'rl:'
// naming inconsistency (every other rate-limit prefix is '<name>-rl:') — not
// renamed here to keep this split a pure reorganization, not a behavior change.
export const KV_PREFIX = {
  MEMBER: 'member:',
  CUSTOMER: 'customer:',
  GUIDE: 'guide:',
  MAGIC: 'magic:',
  GUIDE_BUNDLE_PENDING: 'guide-bundle-pending:',
  OVERRIDE_PREMIUM: 'override:premium:',
  GUIDE_MAGIC_SENT: 'guide-magic-sent:',
  // Set once a Cal.com booking is confirmed for this email (see
  // orchestration/calcomWebhook.js); checked by
  // orchestration/assessmentBooking.js's handleAssessmentBookingRedirect to
  // stop the same emailed booking link from being reused for a second
  // booking -- gated on a real confirmed booking, not on the link being
  // merely clicked/pre-fetched (see that file's own comment on why).
  ASSESSMENT_BOOKED: 'assessment-booked:',
  RL_SUBSCRIBE: 'subscribe-rl:',
  RL_CHECKOUT: 'checkout-rl:',
  RL_GUIDE_CHECKOUT: 'guide-checkout-rl:',
  RL_ASSESSMENT_CHECKOUT: 'assessment-checkout-rl:',
  RL_CALCOM_WEBHOOK: 'calcom-webhook-rl:',
  RL_ACTIVATE: 'rl:',
  RL_PORTAL: 'portal-rl:',
  RL_UPGRADE: 'upgrade-rl:',
  RL_WAITLIST: 'waitlist-rl:',
  RL_MAGIC: 'magic-rl:',
  RL_MAGIC_VERIFY: 'magic-verify-rl:',
  RL_AIRTABLE_FLIGHT: 'airtable-flight-rl:',
  RL_AIRTABLE_CONTACT: 'airtable-contact-rl:',
  RL_AIRTABLE_TESTIMONIAL: 'airtable-testimonial-rl:',
  RL_GUIDE_PDF_DOWNLOAD: 'guide-pdf-download-rl:',
  RL_GUIDE_PDF_EMAIL: 'guide-pdf-email-rl:',
  RL_GUIDE_PDF_FETCH: 'guide-pdf-fetch-rl:',
  RL_GUIDE_CHAPTERS: 'guide-chapters-rl:',
  // Not a rate-limit counter like the RL_* keys above -- a "did this email
  // already get a confirmed send in the last 24h" marker, written only on
  // success (see orchestration/guidePdfHandlers.js's handleGuidePdfEmail).
  // Modeled on GUIDE_MAGIC_SENT's same check-before-work/write-on-success/TTL
  // pattern above.
  GUIDE_PDF_EMAIL_SENT: 'guide-pdf-email-sent:',
};

// ── KrisFlyer Guide: secure PDF delivery ──────────────────────────────────────
// See cloudflare/services/guidePdf.js. GUIDE_ID identifies the product for
// password derivation + audit logging (a future second private guide would
// get its own ID, not a new secret/pipeline). GUIDE_VERSION here is NOT the
// content version (see services/guideContent.js's own `version` field, which
// feeds into password derivation) — it's unused today, kept only as the
// documented seam if a guide-level version independent of content is ever
// needed.
export const GUIDE_ID = 'krisflyer-guide';

// Beehiiv automation + custom fields for the "Send to My Email" flow — created
// manually in the Beehiiv dashboard (same mechanism as MAGIC_LINK_AUTOMATION_ID
// / MAGIC_LINK_CF_NAME above), not something this codebase can provision.
export const GUIDE_PDF_EMAIL_AUTOMATION_ID = 'aut_40014528-4e1f-4a2e-9056-9ad9ea81cfbd'; // "KrisFlyer Guide — PDF Delivery" — still draft in Beehiiv, needs publishing (see krisflyer.md)
export const GUIDE_PDF_DOWNLOAD_URL_CF_NAME = 'guide_pdf_download_url';
export const GUIDE_PDF_PASSWORD_CF_NAME = 'guide_pdf_password';

// Travel Strategy Call: same custom-field + direct-journeys-enrollment
// pattern as the Guide PDF delivery above (see services/beehiiv.js's
// sendAssessmentBookingEmail) -- reliable, immediate send, not dependent on
// segment recalculation timing. Automation still `draft` in Beehiiv as of
// this writing, needs review + a manual publish before it actually sends
// (same documented pattern as every other still-draft automation here).
export const TRAVEL_STRAT_CALL_AUTOMATION_ID = 'aut_14deb6a2-ecd5-4215-be91-5dbed471c971'; // "Travel Strategy Call - Booking Confirmation" (payment received) -- replaces the earlier "Travel Strategy Call — Confirmation" automation (aut_6e0d402d...), deleted manually in Beehiiv
export const TRAVEL_STRAT_CALL_BOOKING_URL_CF_NAME = 'travel_strategy_call_booking_url';

// Booking-confirmed notifications (customer + admin) are handled from
// Airtable now, not a second Beehiiv automation -- see trav-start-call.md.
// The "Travel Strategy Call — Booking Confirmed" automation and its
// travel_strategy_call_slot_time custom field this repo briefly wired up
// still exist in Beehiiv (no delete API for either) but are unreferenced
// here and should be deleted manually in the dashboard.
