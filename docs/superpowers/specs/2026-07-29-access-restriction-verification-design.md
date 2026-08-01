# Access Restriction and Cross-Portal Verification Design

Date: 2026-07-29

## Objective

Redesign the private portal access model so protected content is never granted
only because a user is logged in. Every protected destination must verify the
authenticated user's entitlement before rendering or navigating.

The user experience should feel like a SaaS membership platform: secure,
transparent, premium, reusable, and easy to understand.

## Current Architecture Reviewed

Relevant pages:

- `pages/private-pages/altitude-access-portal.html`
- `pages/private-pages/kf-guide-access-portal.html`
- `pages/private-pages/header-private.html`
- `components/modal-verify-access.html`

Relevant frontend scripts:

- `js/private-layout.js`
- `js/altitude-portal.js`
- `js/kf-guide-portal.js`
- `js/index-pricing.js`
- `js/altitude.js`
- `js/krisflyer-guide.js`
- `js/magic-modal.js`

Relevant Worker modules:

- `cloudflare/worker.js`
- `cloudflare/orchestration/session.js`
- `cloudflare/orchestration/stripeWebhook.js`
- `cloudflare/orchestration/guideBundle.js`
- `cloudflare/orchestration/cron.js`
- `cloudflare/services/beehiiv.js`
- `cloudflare/services/stripe.js`
- `cloudflare/services/newsletter.js`
- `cloudflare/config/constants.js`

Current findings:

- The private header currently uses plain anchor links for `Altitude` and
  `Guide`, so cross-portal navigation happens before product entitlement is
  verified.
- Both private portals share `localStorage.altitude_jwt`.
- Magic links are already implemented and are only needed for public-to-private
  login. Private-to-private verification should use the existing JWT, not a new
  magic link.
- `/altitude/verify` currently verifies a JWT and returns Altitude validity plus
  additive Guide ownership.
- Guide access currently depends on `guide:{email}` KV.
- Altitude access currently depends on `member:{email}` KV.
- Beehiiv tags exist for marketing segmentation and recovery, but should not be
  treated as the primary runtime entitlement engine.
- Stripe checkout and webhook fulfillment already write entitlement records into
  KV and apply Beehiiv tags.
- Guide bundle lifecycle already exists in KV with `plan: "guide_bundle"` and
  `current_period_end`, plus a daily expiry cron.

## Ownership Boundary

Cloudflare KV is the canonical entitlement store.

Beehiiv is for:

- Email segmentation
- Newsletter delivery
- Subscriber tagging
- Marketing automation
- Analytics

Stripe is for:

- Payments
- Subscription billing
- Checkout sessions
- Billing portal
- Webhook payment events

The Cloudflare Worker is the synchronization and policy layer between Stripe,
Beehiiv, KV, and the browser.

The browser must never call Beehiiv directly. The browser calls the Worker. The
Worker checks KV first and only reconciles with Beehiiv when KV is missing,
stale, expired, or contradictory.

## Recommended Architecture

`GET /altitude/verify` already checks both `member:{email}` and `guide:{email}`
KV in one call (`handleVerify` in `cloudflare/orchestration/session.js`) and
already reconciles against Beehiiv via `checkBeehiivPremium`
(`cloudflare/services/beehiiv.js`). Rather than adding a parallel
`/entitlements/verify` endpoint that duplicates that KV/Beehiiv reconciliation
logic, extend the existing route with an optional `target` selector:

```text
GET /altitude/verify?target=guide|altitude
Authorization: Bearer <jwt>
```

`target` is optional. Omitted, the response shape is unchanged from today
(back-compat with the existing callers in `js/altitude-portal.js` and
`js/kf-guide-portal.js`, which only need plain validity). When `target` is
present, the response additionally includes `granted`, `reason`, `message`,
and `purchase_options`, computed from the same KV-then-Beehiiv reconciliation
`handleVerify` already performs internally — not a second implementation.

High-level flow:

```text
Private portal click
-> verification modal opens
-> modal calls GET /altitude/verify?target=<guide|altitude>
-> Worker verifies JWT
-> Worker checks KV canonical entitlement
-> if KV is valid, return granted
-> if KV is missing/stale/expired/contradictory, reconcile safely
-> Worker normalizes KV when possible
-> return granted or denied with a clear reason
```

Example response (with `target` set):

```json
{
  "authenticated": true,
  "email": "user@email.com",
  "target": "altitude",
  "granted": false,
  "reason": "bundle_expired",
  "message": "Your complimentary Altitude membership has expired.",
  "purchase_options": ["monthly", "annual"]
}
```

## Entitlement Rules

### KrisFlyer Guide

Target: `guide`

Grant access when:

- `guide:{email}` exists in KV.
- The record has `status: "active"`.

If KV is missing:

- The Worker checks Beehiiv for a qualifying Guide tag.
- Qualifying marketing signals are the current live Guide tag names/constants,
  including the permanent Guide buyer tag and any valid KrisFlyer Bundle signal.
- If a safe Guide ownership signal exists, normalize `guide:{email}` into KV and
  grant access.

Guide ownership is permanent unless the KV record is explicitly inactive.

### Altitude

Target: `altitude`

Grant access when `member:{email}` exists in KV, has `status: "active"`, and
matches one of:

- `plan: "monthly"` with valid access.
- `plan: "annual"` with valid access.
- `plan: "guide_bundle"` with `current_period_end` still in the future.

For Stripe-backed monthly or annual plans:

- Trust KV unless `status !== "active"`, the record is missing, or the record is
  internally contradictory.
- If `current_period_end` is present and in the past, deny or reconcile based on
  the Stripe/webhook state already stored in KV. Do not silently grant expired
  access.

For Guide bundle access:

- Trust KV only while `current_period_end` is in the future.
- If expired, immediately mark the KV record cancelled and deny access with
  `reason: "bundle_expired"`.
- Removing the Beehiiv bundle tag can happen in the same request or as a
  non-blocking cleanup, matching the existing cron behavior.

If KV is missing or stale:

- Reconcile against Beehiiv only as a recovery path.
- Qualifying Beehiiv signals include Altitude Monthly, Altitude Annual, and
  KrisFlyer Bundle.
- A Beehiiv bundle tag alone must not grant Altitude access unless the Worker
  can safely reconstruct or find valid activation and expiration dates.

## Known Implementation Notes

- `components/modal-verify-access.html` already exists as a file but is
  currently a 0-byte empty stub, not a partially-built component. The modal
  markup needs to be authored from scratch, not just wired up.
- The JWT payload's `guide` claim is inconsistent across login paths:
  `/altitude/magic-verify` sets `guide: guideActive`, but `/altitude/activate`'s
  direct-issue path does not include a `guide` claim at all
  (`cloudflare/orchestration/session.js`). This is harmless as long as the
  Security Notes rule below is followed (Worker always re-checks KV rather
  than trusting the JWT for entitlement) — but don't take a shortcut and read
  `guide` off the JWT anywhere in this feature, since it won't be present for
  every session.

## Frontend Behavior

Add shared modal behavior using:

- `components/modal-verify-access.html`
- a new small script, `js/modal-verify-access.js`
- `js/private-layout.js` as the private-header wiring point

Header behavior:

- The current portal remains active.
- Cross-portal protected destinations appear locked or verification-required.
- Clicking a protected cross-portal destination does not navigate immediately.
- The click opens the verification modal.
- The modal calls `GET /altitude/verify?target=<destination>`.
- If access is granted, the modal closes and navigates to the destination.
- If access is denied, the modal remains open and shows the reason plus purchase
  options.

Guide destination from Altitude:

- Required entitlement: KrisFlyer Guide ownership.
- Valid KV: `guide:{email}` active.
- Purchase CTA: KrisFlyer Guide checkout.

Altitude destination from Guide:

- Required entitlement: active Altitude membership.
- Valid KV: monthly, annual, or unexpired Guide bundle.
- Purchase CTAs: Monthly and Annual checkout.

## Modal UX

Default state:

```text
Logged in as:
user@email.com

To continue, we'll verify whether this account includes access to
KrisFlyer Guide.

[Verify Access]
[Purchase KrisFlyer Guide]
```

Denied Guide state:

```text
You do not currently own the KrisFlyer Guide.

Purchase the guide below to unlock permanent access.

[Purchase KrisFlyer Guide]
```

Denied Altitude state:

```text
No active Altitude membership was found for this account.

Choose a plan below to unlock the member archive and travel intelligence
dashboard.

[Monthly]
[Annual]
```

Expired bundle state:

```text
Your complimentary Altitude membership has expired.

You can continue your membership by choosing one of the plans below.

[Monthly]
[Annual]
```

The copy should be direct, trustworthy, and product-specific. It should avoid
implying the user is wrong or that access failed mysteriously.

## Pricing and Purchase Reuse

Do not duplicate business logic.

Existing purchase endpoints must continue to be used:

- `POST /altitude/checkout` with `{ "plan": "monthly" }`
- `POST /altitude/checkout` with `{ "plan": "annual" }`
- `POST /guide/checkout`

The current checkout behavior in `js/index-pricing.js`, `js/altitude.js`, and
`js/krisflyer-guide.js` should be consolidated into a small shared purchase
helper unless doing so would expand the implementation beyond the modal and
portal access flow.

Pricing UI can reuse the existing style language and markup patterns from
`index.html`, but literal reuse of inline homepage card HTML may require
extracting a shared pricing component. The first implementation pass should
prefer a focused modal-specific pricing subset if full extraction adds too much
risk.

## Direct URL Protection

Header interception improves UX but is not security.

Each destination page must still verify entitlement on load:

- `altitude-access-portal.html` must verify Altitude access before rendering.
- `kf-guide-access-portal.html` must verify Guide access before rendering.

The Guide portal must not depend on `/altitude/verify` returning HTTP 200,
because a permanent Guide owner can have no active Altitude membership after a
bundle expires. The `target`-aware `/altitude/verify` response should be used
by both direct page load and cross-portal modal verification where possible.

## Edge Cases

Handle these explicitly:

- Expired JWT: deny with `reason: "session_expired"` and instruct the user to
  request a new login link from the public product page.
- Missing JWT: deny with `reason: "not_authenticated"`.
- Invalid or stale magic link: unchanged public-to-private flow; this redesign
  does not add magic links to private-to-private navigation.
- Active Altitude monthly or annual with missing Beehiiv tag: allow from KV and
  optionally re-sync Beehiiv in the background.
- Beehiiv tag present but KV missing: recover only when enough data exists to
  safely normalize the entitlement into KV.
- Beehiiv bundle tag present but no activation/expiration dates: deny Altitude
  access and show a support-oriented message.
- Guide owner with expired bundle: Guide remains allowed; Altitude is denied
  with expired-bundle copy.
- Multiple qualifying tags: strongest access wins. Paid monthly or annual beats
  temporary bundle access.
- Monthly-to-Annual pending upgrade: current monthly access remains valid until
  the current period ends; the Altitude portal can continue showing pending
  annual state.
- Network failure during modal verification: modal stays open and shows a
  retryable error.
- Race after purchase: Stripe webhook remains the main fulfillment path; any
  post-checkout activation or self-heal path must avoid granting the wrong
  product.

## Security Notes

- Authorization decisions must be made by the Worker, never by frontend state.
- Frontend lock badges are UX hints only.
- The JWT proves identity/session only. It does not prove product entitlement.
- Entitlement must be checked against KV for every protected destination.
- Beehiiv should never be required for every navigation.
- Beehiiv reconciliation should fail closed when dates or product identity are
  ambiguous.

## Testing Plan

Worker tests or manual Worker route checks:

- JWT missing.
- JWT expired.
- Target missing or invalid.
- Guide active in KV grants Guide.
- Guide missing in KV and recoverable from Beehiiv normalizes KV.
- Altitude monthly active grants Altitude.
- Altitude annual active grants Altitude.
- Altitude bundle active grants Altitude with expiration metadata.
- Altitude bundle expired denies and marks KV cancelled.
- Guide owner with expired bundle grants Guide and denies Altitude.
- Beehiiv bundle tag without KV dates denies Altitude.
- Multiple entitlements return the strongest access.

Frontend checks:

- Altitude portal clicking Guide opens modal, verifies, then navigates on grant.
- Guide portal clicking Altitude opens modal, verifies, then navigates on grant.
- Denied Guide shows Guide purchase CTA.
- Denied Altitude shows Monthly and Annual CTAs.
- Expired bundle shows specific expired-bundle copy and Monthly/Annual CTAs.
- Direct URL entry remains protected.
- Modal handles network failure, retry, Escape/close, and mobile layout.

## Out of Scope

- Replacing the magic-link login flow.
- Changing Stripe products or prices.
- Rebuilding the entire pricing section.
- Moving newsletter delivery out of Beehiiv.
- Adding a new database beyond Cloudflare KV.
- Creating a full account settings system.
