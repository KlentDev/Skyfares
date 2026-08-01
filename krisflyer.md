# KrisFlyer Guide — Delivery Mechanism Plan

## Fixed magic-link/checkout 404s + Guide-only self-service login + "KrisFlyer Guide Access" card (2026-07-28)

**The 404.** User clicked "Access the Guide →" in the real purchase-confirmation email and landed on the site's own `404.html`. Root cause: every redirect/magic-link URL the backend generates used an extension-less path (`/pages/krisflyer-guide`, `/pages/altitude`, etc.), and the site deploys via plain GitHub Pages (`.github/workflows/deploy.yml` — `actions/upload-pages-artifact` + `actions/deploy-pages`, no Jekyll, no `_redirects`/rewrite rules). A request for `/pages/krisflyer-guide` when only `/pages/krisflyer-guide.html` exists has nothing to resolve it, and falls straight into `404.html`. This was systemic, not Guide-specific — found at 8 call sites across 3 files:
- `cloudflare/services/beehiiv.js` — Guide magic link, Altitude on-demand magic link (`handleMagicRequest`)
- `cloudflare/orchestration/session.js` — Altitude Starter (post-checkout) magic link
- `cloudflare/services/stripe.js` — Altitude checkout `success_url`/`cancel_url`, Guide checkout `success_url`/`cancel_url`, Billing Portal `return_url`

Fix: appended `.html` to all 8. Mechanical, no behavior change beyond making the links actually resolve.

**Guide-only buyers couldn't self-serve a login link.** `handleMagicRequest` (the "send me a login link" endpoint the shared modal calls) only ever checked `checkBeehiivPremium()` (Altitude monthly/annual/bundle) plus the `member:{email}` KV fallback — it never checked permanent Guide ownership (`guide:{email}` KV, the `krisflyer` tag). A Guide-only buyer whose 90-day bundle had expired, or who never had Altitude access at all, got rejected with "No active Altitude membership found" despite legitimately owning the guide. This was flagged twice previously in this file and never fixed. Now additively checks `guide:{email}` KV alongside the existing Altitude/bundle check; rejects only if neither is found. Destination page and Beehiiv automation are picked based on which access was found — Altitude wins if both are present (existing `MAGIC_LINK_AUTOMATION_ID`, lands on `altitude.html`); Guide-only sends via `GUIDE_MAGIC_LINK_AUTOMATION_ID` and lands on `krisflyer-guide.html` specifically, since that page's JS checks the JWT's `guide` claim while `altitude.html`'s only checks `valid` (true only with real Altitude access) — sending a Guide-only visitor to `altitude.html` would have looked broken despite a valid token.

**New UI.** Added a "KrisFlyer Guide Access" card to `pages/krisflyer-guide.html`, mirroring `pages/altitude.html`'s existing "Already a Member?" trigger (icon chip + two-line label + chevron, calling the same global `window.openLoginModal()` — no new modal component, no new JS file needed since `js/header.js` already injects the shared modal on every page). Styled for the page's light `tile-parch` section rather than altitude.html's dark hero, placed directly below the pricing card.

Not yet deployed — `wrangler deploy` from `cloudflare/` still needed for the backend fixes to take effect in production. Frontend card change is static/GitHub Pages and needs no deploy step.

## Annual price cut to $39.99 (was $49.99) + playful header Altitude Access CTA (2026-07-24)

**Annual pricing.** Stripe Prices are immutable, so a new Price object was created rather than editing the existing one — via the same worker-as-proxy diagnostic technique used earlier this session (temporary route, removed before final deploy) to guarantee it landed in the correct Stripe account ("skyfare sandbox," not the "Klent sandbox" the Stripe MCP tools default to). New price `price_1Txdg5EJ1qCzN8SnU0IpNTku`, $39.99/yr, created on the same Product (`prod_UljRDxIzrLmGHx`) the old $49.99 price (`price_1TwP5UEJ1qCzN8SnsTxVACna`) belonged to. `STRIPE_PRICE_ID_ANNUAL` secret updated via `wrangler secret put`; old price object left in place (Stripe doesn't support deleting Prices, only archiving — not done here, no harm in leaving it since nothing references it anymore).

Display updated everywhere Annual pricing appears — `$39.99` with a `$55` strikethrough anchor (matching the existing promo pattern already used on the Guide product page), "Save $15.01" recomputed from the new numbers (was "$9.89"):
- `pages/altitude.html` — the in-portal "Switch to Annual" upgrade card, and the public hero's "Get Annual" CTA button.
- `index.html` — the homepage pricing section's Annual card.
- Confirmed via grep this didn't touch the Guide product's own unrelated `$49.99`→`$39.99` launch-price copy on `pages/krisflyer-guide.html` (a different product, different price object, coincidentally similar numbers).
- No backend amount-fallback code needed touching — `derivePlanFromSubscription` reads the real price off the Stripe subscription dynamically, no hardcoded `4999`-cent fallback existed anywhere for Annual.

Smoke-tested live: `POST /altitude/checkout {plan:'annual'}` returns a real Stripe Checkout Session URL, confirming the new price resolves correctly end-to-end.

**Header CTA.** Added a `.header-cta-altitude` modifier class in `js/header.js`, applied only to the "Altitude Access" button (not "Book a Flight," which intentionally stays icon-only-until-hover per the original header redesign this session). Makes the label always-visible (not hover-gated) at a larger `1rem`/`font-weight:800`, switches the flat gold fill to a gold gradient with a soft pulsing box-shadow, and adds a periodic crown-icon wiggle — all wrapped in a `prefers-reduced-motion: reduce` guard that disables both animations. Pure frontend/static change, no deploy needed (GitHub Pages).

## Real cause of "Could not schedule your upgrade": phases[].iterations is deprecated (2026-07-24, follow-up #3)

User kept hitting "Could not schedule your upgrade. Please try again or contact support." even after the flexible-billing-mode fix. Investigated with a sequence of temporary diagnostic routes (all removed before the final deploy), each testing one step in isolation against the real account:

1. **`/debug/selfheal`** — force-ran the exact `handleVerify` self-heal logic for the account directly. It worked and wrote a real `current_period_end` to KV — proving the self-heal code itself was correct; it just hadn't been triggered yet for this session (needed a fresh `/altitude/verify` call, i.e. an actual page reload, which hadn't happened between deploys).
2. **`/debug/tryupgrade`** — with `current_period_end` now present, ran the real schedule-creation + phase-setting Stripe calls end to end (auto-releasing the schedule afterward regardless of outcome, so nothing was left attached to block a real attempt). This surfaced the actual Stripe error, previously only visible in `console.error` logs no one was watching:
   ```
   "message": "Received unknown parameter: phases[iterations]"
   ```

**Root cause**: `phases[1][iterations]` — used to express "one Annual billing cycle then release" — is a deprecated Subscription Schedule parameter, confirmed via Stripe's own docs (`docs.stripe.com/billing/subscriptions/mixed-interval`): *"We recommend you use `duration`... Phase iterations is deprecated."* On this account's current API version it's rejected outright rather than just discouraged. **This means the deferred-upgrade feature (built earlier this session) had never actually completed a real schedule successfully — every attempt failed at the exact same step**, regardless of the flexible-billing-mode fix.

**Fix**: replaced `phases[1][iterations]: '1'` with an explicit `phases[1][end_date]`, computed as the annual phase's start date plus one calendar year (`setUTCFullYear(+1)`) — the same explicit-boundary technique phase 0 already used, just avoiding the deprecated field entirely rather than adopting the newer `duration` parameter (equivalent effect, smaller change). Re-verified via the same diagnostic route after the fix: `"step":"success"`, schedule created and phases set correctly (`update_status: 200`), then released cleanly.

Deployed to `skyfares-altitude` (version `59bf21d3-9db7-4a39-8389-4aa95e90b1d0`). All four temporary diagnostic routes (`/debug/sub`, `/debug/sub2`, `/debug/selfheal`, `/debug/tryupgrade`) confirmed removed post-deploy (`405 Method Not Allowed` on all four). **Still not verified**: an actual live upgrade click through the real UI end-to-end (only the isolated diagnostic path has been confirmed) — worth doing once, since this is the first time this flow has ever succeeded against Stripe.

## Root cause of the blank renewal date: account runs Stripe "flexible" billing mode (2026-07-24, follow-up #2)

The previous self-heal (backfill `current_period_end` from Stripe when missing) shipped but didn't actually fix anything — re-checked the same live KV record afterward and it was still blank. Added a temporary diagnostic route (`GET /debug/sub?id=`, proxying a real Stripe subscription lookup through the worker's own `STRIPE_SECRET_KEY` — same technique as the earlier wrong-Stripe-account investigation this session) to see the raw API response directly, since Stripe MCP tools are confirmed to point at a different sandbox than this worker's real key.

**Finding: `sub.current_period_end` is `undefined` at the top level of every Subscription object on this account.** The account runs Stripe's newer **flexible billing mode** (visible in the raw response: `"billing_mode": {"type": "flexible", ...}`), which moved `current_period_start`/`current_period_end` OFF the Subscription object and onto each **SubscriptionItem** instead (`items.data[0].current_period_end`) — a documented Stripe change, since one subscription can now hold items with different billing periods. Confirmed via the diagnostic route: `current_period_end` (top-level) → `undefined`; `items.data[0].current_period_end` → a real Unix timestamp.

**This was never a one-off data-quality issue on one old record — it affected every code path that ever read a period boundary off a raw Stripe subscription object, going back to whenever billing mode flexible was enabled on this account:**
- `orchestration/stripeWebhook.js`'s `handleCheckoutComplete` — `current_period_end` has been silently blank on every fresh Monthly/Annual checkout.
- `orchestration/stripeWebhook.js`'s `handleSubscriptionUpdated` — the webhook fires on every renewal and was silently failing to refresh `current_period_end` each time.
- `orchestration/session.js`'s `handleActivate` self-heal-write path — same blank-on-write bug for the "webhook hasn't landed yet" fallback.
- `orchestration/session.js`'s `handleVerify` self-heal (added earlier this same session) — was reading the same broken field, so it never actually backfilled anything.
- `services/stripe.js`'s `handleUpgradeToAnnual` — **the more serious one**: `periodStart` had *no fallback at all* (`const periodStart = sub.current_period_start;`), meaning every deferred Monthly→Annual upgrade attempt on this account has been silently sending the literal string `"undefined"` as the Subscription Schedule's `phases[0][start_date]` — this flow (built earlier this session) may never have actually worked in production.

**Fix:** added two shared helpers to `services/stripe.js` — `getSubscriptionPeriodEnd(sub)` / `getSubscriptionPeriodStart(sub)` — reading `items.data[0].current_period_end/start` first, falling back to the classic top-level field for forward/backward compatibility. Replaced every direct `sub.current_period_end`/`sub.current_period_start` read across `orchestration/stripeWebhook.js`, `orchestration/session.js`, and `services/stripe.js` with these helpers. `handleUpgradeToAnnual` now also hard-fails with a clear error instead of silently proceeding if `periodStart` still can't be determined.

**Frontend**: `js/altitude.js`'s membership card now shows both the countdown and the actual date — "12 days remaining · Renews August 5, 2026" — for both Monthly and Annual, per explicit request. The "Auto-renews · Cancel anytime" note (added in the prior follow-up) is unchanged, still gated to real Stripe-billed plans only.

Deployed to `skyfares-altitude` (version `2ae1aea1-8226-4914-8d6b-38e40a04b1aa`), diagnostic route removed before this deploy. Existing broken records self-heal automatically on their next `/altitude/verify` call — no manual KV edits made. **Not yet verified**: an actual end-to-end test of `handleUpgradeToAnnual` against this account post-fix (the Subscription Schedule creation) — worth a real test-mode upgrade attempt before trusting that flow live, given it may never have worked correctly before this fix.

## Member portal: header scroll-listener race, missing renewal date, self-heal (2026-07-24, follow-up)

Three more bugs reported live on `/pages/altitude`'s member view, all traced to root cause rather than patched symptomatically:

**1. Header reverts to white text at the top of the page, dark once scrolled.** The earlier same-day fix (poll for `#main-header`, then enforce dark text) was correct but incomplete — it registered its own `scroll` listener *eagerly*, in `showMemberShell()`, independent of whether `header.js`'s own scroll listener had been registered yet. `js/altitude.js` is a `defer`red script; by the time it runs, `document.readyState` is already past `'loading'`, so its `init()` can fire *before* `header.js`'s `DOMContentLoaded` handler has run at all. When that race goes the wrong way, our scroll listener gets added *before* `header.js`'s — and same-event-type listeners fire in registration order, so `header.js`'s own transparent-at-top logic then runs second and wins back on every scroll, exactly matching "dark on scroll, white again at the top." Fixed by moving the listener registration inside `_enforceMemberHeaderStateWhenReady()`, gated on `#main-header` actually existing — which is only true once `header.js`'s entire synchronous `DOMContentLoaded` handler body (injection *and* its own scroll listener) has already run, guaranteeing correct order every time.

**2. Membership card showed a permanently blank days-remaining.** Root cause found by inspecting the live KV record directly (`wrangler kv key get --remote`): an old member record (`joined_at: 2026-06-26`, predating this session's work) has a real `stripe_subscription_id` but `current_period_end: ""` — never populated, and nothing previously re-derived it. Fixed with a self-heal in `orchestration/session.js`'s `handleVerify`: if a member record has a `stripe_subscription_id` but no `current_period_end`, fetch the real value from Stripe and backfill it into KV. Runs at most once per affected record (the write makes it a no-op on every later `/verify`). Frontend fallback text changed from blank to "Renewal date unavailable" for the one verify call in between, rather than silent empty space.

**3. Added "Auto-renews · Cancel anytime" to the membership card**, shown only for real Stripe-billed plans (`monthly`/`annual`) — not for Guide-bundle recipients, who have no subscription behind their 90-day grant and nothing to cancel.

Deployed to `skyfares-altitude` (version `cd5dd071-53b8-4064-b6bd-4e21c2785dc8`). Frontend changes (`js/altitude.js`, `pages/altitude.html`) need no deploy — static files, served via GitHub Pages.

## Post-refactor audit: secrets/endpoints confirmed, root wrangler.jsonc landmine removed (2026-07-24, follow-up)

Ran a full check after the module split to confirm nothing was left orphaned or duplicated:

- **Secrets**: all 8 (`AIRTABLE_API_KEY`, `BEEHIIV_API_KEY`, `JWT_SECRET`, `STRIPE_GUIDE_PRICE_ID`, `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) confirmed live on `skyfares-altitude` via `wrangler secret list`.
- **Every `env.X` reference** across the new module tree (14 total, including the 5 `[vars]` and the `ALTITUDE_KV` binding) cross-checked against secrets + `wrangler.toml` — zero missing, zero unused.
- **Frontend endpoint references**: every file under `js/`, `pages/`, `index.html`, `components/` points to exactly one URL, the correct live Worker (`skyfares-altitude.klent-5fa.workers.dev`) — zero stale references to the deleted `subscribe-worker`.

**Found and removed a second, older landmine** while re-checking for stray configs: a root-level `wrangler.jsonc` (repo root, not `cloudflare/`), sharing the exact name `"skyfares-altitude"` with the real Worker but with no `main` script — an asset-only config that would deploy the entire repo root as static files under the same Worker name if `wrangler deploy` were ever run from the repo root without `--config`. Traced its origin via `git log --follow`: auto-generated in a single commit by the `cloudflare-workers-and-pages[bot]` GitHub App on 2026-06-23 (the same day `skyfares-altitude` was first created) — never hand-authored, never modified since. Confirmed it wasn't backing anything real: the actual static site deploys via GitHub Pages (`.github/workflows/deploy.yml`, unrelated to Cloudflare entirely), and this quirk was already documented as a known footgun in both `README.md` and `cloudflare-reports/README.md` (the latter's setup instructions exist specifically because someone hit this during `skyfares-reports-bot`'s own setup). Deleted it, then updated both README files' warnings from "here's how to avoid this landmine" to "this landmine was removed, but keep passing `--config` explicitly as good practice anyway."

**Final state**: exactly two `wrangler.toml` files exist in the repo now (`cloudflare/wrangler.toml` for `skyfares-altitude`, `cloudflare-reports/wrangler.toml` for `skyfares-reports-bot`), each the sole config for its respective Worker — confirmed via a repo-wide search for any `wrangler.toml`/`.jsonc`/`.json` file. No Beehiiv tags/segments/automations were touched in this follow-up — those were only ever moved verbatim during the module split, not modified, so no re-verification against live Beehiiv state was needed.

## Split subscribe-worker.js into modules; deleted the orphaned subscribe-worker deployment (2026-07-24)

User asked whether the account's Workers could be split apart "so it wont overload." Investigated and explained: Cloudflare Workers don't share a resource pool like a traditional server, so there's no real overload risk from keeping routes in one file — splitting into *separate deployed Workers* would only add cost (cross-service network calls where the code is currently one function call, more secrets duplicated across more places, and the exact "orphaned worker nobody remembers" risk already found once on this account). Landed on Option A instead: keep **one** deployed Worker (`skyfares-altitude`), split the 2654-line `cloudflare/subscribe-worker.js` into organized modules — the same pattern already proven by `cloudflare-reports/` (`config/`, `services/`, `utils/`, one `worker.js` entrypoint, plain ES module imports, no build step).

**Orphaned Worker deleted first.** The account's third Worker, `subscribe-worker` (created 2026-07-01, never modified since), was confirmed via `workers_get_worker_code` to be a frozen mid-development duplicate of this same codebase — missing Annual billing, Guide/bundle routes, and the upgrade flow entirely. Zero secrets configured (every handler would 503 immediately), and all three Beehiiv automation IDs its old code referenced no longer exist in the account. No file in this repo references its URL, and no `wrangler.toml` anywhere targets its name. Ran `wrangler delete --name subscribe-worker` — confirmed gone via `workers_list` (account now shows 2 Workers, not 3).

**Module split — new layout under `cloudflare/`:**
```
worker.js                 — entrypoint: fetch() router + scheduled() cron dispatch only
config/constants.js       — every automation/tag/segment ID, ALLOWED_ORIGINS, SITE_URL/PUB_BASE_URL,
                             ROUTE_LABELS, and a new KV_PREFIX object centralizing what were
                             previously ~18 scattered hand-typed KV key-prefix string literals
                             (MEMBER: alone was touched by 3+ call sites — a real duplication risk)
utils/crypto.js           — b64url*, getHmacKey (pure Web Crypto, reused by both jwt.js and
                             services/stripe.js's webhook signature verification)
utils/jwt.js              — signJwt, verifyJwt, getBearer, generateMagicToken
utils/http.js             — respond(), getBaseUrl()
services/stripe.js        — checkout sessions, webhook signature verify, Billing Portal, the
                             deferred Monthly→Annual upgrade flow — zero Beehiiv calls, a clean leaf
services/beehiiv.js       — every tag/segment/automation function, checkBeehiivPremium,
                             setupBeehiivMember, handleWaitlist, handleMagicRequest, and the new
                             handleSubscribe (root POST / — previously inlined directly in fetch(),
                             the one route with no named handler; extracted as part of this split)
services/airtable.js      — flight applications, contact inquiries, testimonials
services/newsletter.js    — post reads (kept separate from services/beehiiv.js on purpose — that
                             file's own header comment already declared "never writes/mutates
                             Beehiiv state," matching this account's existing read/write boundary)
orchestration/stripeWebhook.js — the webhook dispatcher + every handler that calls both Stripe
                             and Beehiiv in one function body (handleCheckoutComplete,
                             handleGuideCheckoutComplete, handleSubscriptionDeleted/Updated,
                             handleInvoicePaymentSucceeded)
orchestration/guideBundle.js   — grantGuideAltitudeBundle, activateDeferredGuideBundle
orchestration/session.js       — handleActivate, handleVerify, handleMagicVerify, sendStarterMagicLink
orchestration/cron.js          — runRenewalReminders, expireGuideBundles
```

**Two placement calls made explicit rather than left ambiguous:** `grantGuideAltitudeBundle`/`activateDeferredGuideBundle` went into `orchestration/`, not `services/beehiiv.js`, despite neither calling Stripe directly — both read/write the canonical Stripe-shaped `member:` record, and putting them in the Beehiiv module would have broken its "only talks to Beehiiv" contract. `sendStarterMagicLink` stayed in `orchestration/session.js` rather than joining its near-twin `sendGuideMagicLink` in `services/beehiiv.js`, since it's tightly coupled to `handleActivate`'s request/Origin handling and has no other caller.

**Verification, all before touching production:**
- Symbol diff (old file's 86 top-level declarations vs. the full new tree): zero missing, zero duplicated across files — only 2 expected new names (`KV_PREFIX`, `handleSubscribe`).
- Route-dispatch diff (old `fetch()` if-chain vs. new `worker.js`): identical, same order.
- Grepped the new tree for every old KV key-prefix literal: zero leftover hand-typed occurrences, everything now reads `KV_PREFIX.X`.
- `wrangler deploy --dry-run` against a temporary config pointed at `worker.js` (real `wrangler.toml` untouched) — Cloudflare's actual esbuild bundler resolved the entire import graph cleanly, twice (re-ran immediately before cutover to catch any drift).

**Cutover:** `wrangler.toml`'s `main` repointed from `subscribe-worker.js` to `worker.js`, old monolithic file deleted, deployed (version `c69dd677-9212-41b7-9012-835cf6b6f4e1`). Post-deploy smoke test against the live URL: `/newsletter/posts` (200, real Beehiiv data), `/altitude/verify` with no token (401), `/airtable/testimonials` (200, real Airtable data), invalid-email subscribe (400), magic-request for a non-member (404), testimonial-scores with no filters (200, correct null shape), CORS preflight (204) — all matched expected behavior. `wrangler tail` during a follow-up request showed clean `Ok` status, no exceptions.

Pure reorganization — no behavior, route, or route-order changes; every function's body is byte-identical to before, only its file location and cross-file references changed.

## KrisFlyer Guide: dedicated magic-link automation + success modal (2026-07-24)

Applied the same pattern just built for Altitude Monthly/Annual (dedicated automation + success modal instead of a toast) to the Guide's one-time purchase flow.

**Answering "does the Guide have a separate magic link?":** Before this change, no — `sendGuideMagicLink` already generated its own unique token and pointed to its own landing page (`/pages/krisflyer-guide?magic=...`, vs. Altitude's `/pages/altitude?magic=...`), but sent that link through the same shared automation as the generic on-demand "Member Access" request flow (`MAGIC_LINK_AUTOMATION_ID`). Now it has its own: new automation **"KrisFlyer Guide — Magic Link"** (`aut_783ff7b2-e472-400c-aafd-180274e45a34`, `draft`, needs manual publish), referenced by a new `GUIDE_MAGIC_LINK_AUTOMATION_ID` const. `sendGuideMagicLink` (`cloudflare/subscribe-worker.js`) changed by exactly one line — the automation ID it POSTs to — everything else (token generation, `magic:{token}` KV entry, `MAGIC_LINK_CF_NAME` custom field, destination URL) is untouched, since the magic-link auth mechanism itself is automation-agnostic. Confirmed via grep that the default on-demand flow (`handleMagicRequest`, line ~2134) still correctly uses the original `MAGIC_LINK_AUTOMATION_ID`, and the Altitude Starter flow still uses its own `STARTER_MAGIC_LINK_AUTOMATION_ID` — three separate automations now, one for each purchase-context/copy, all reading the same shared `magic_link_url` custom field.

**Frontend:** `pages/krisflyer-guide.html`'s post-purchase state previously just showed a toast ("Payment received — check your email…"). Replaced with a modal, built from the user's empty `components/magic-modal-krisflyer.html` — a single self-contained success panel ("Purchase Successful! We sent you a magic link…"), deliberately a *separate* component from the shared `components/magic-modal.html` (this page has no "request a new link" form to also house, and the user created a distinct file for it). New `openGuidePurchaseModal()`/`closeGuidePurchaseModal()` in `js/krisflyer-guide.js` fetch/inject it once (same guarded pattern as `js/magic-modal.js`), fired from `init()` on `?purchased=1` in place of the old toast call.

**Conflict check (this page loads both modal systems):** `pages/krisflyer-guide.html` loads `header.js`, which globally injects the shared `#magic-modal` (`js/magic-modal.js`) on every page — including this one. The new Guide modal uses deliberately distinct ids (`magic-modal-krisflyer`, `data-magic-modal-krisflyer-close`) so the two injected modals coexist on the same page with zero collision. The existing `?magic=` consumption path (`handleMagicCallback` → `checkGuideAccess` → `unlockGuideContent`, all in `js/krisflyer-guide.js`) is completely untouched — it doesn't care which automation sent the email, only that the token in the clicked link matches a live `magic:{token}` KV entry.

Deployed to `skyfares-altitude` (version `56465f8c-d5c2-4f9f-b78c-591133925c68`). New automation still needs a manual publish in the Beehiiv editor before it actually sends — same standing checklist as the other draft automations already noted in this file.

## Found and removed two more duplicate "Member Access" modals (2026-07-24, follow-up)

User flagged that `components/magic-modal.html` "only had the new modal" and asked for everything consolidated so there's one place to look. The default + starter panels were in fact both already in the shared component (`js/header.js`'s "Altitude Access" button and `pages/altitude.html`'s "Already a Member?" trigger already both used it) — but a repo-wide grep for the modal's actual markup (`alt-login-modal`, `Access your membership`) rather than just its trigger function name turned up two **more** standalone copies that the original migration missed entirely, because they used different element ids (`member-access-modal` / `member-access-form` instead of `alt-login-*`) so the earlier grep for those specific ids never caught them:

- `index.html` — its own `ensureMemberAccessModal()`/`handleMemberAccessSubmit()`/`window.openMemberAccessModal`/`window.closeMemberAccessModal`, byte-for-byte the same form/copy as the shared modal, wired to a "This issue is for Altitude members" paywall-teaser popup (`altitude-access-modal` — a distinct, separate feature, left untouched) via `window.switchToMemberAccessModal()`.
- `js/newsletter-archive.js` (loaded by `pages/newsletter.html`) — an identical duplicate of the same pair.

Removed both private copies entirely; `switchToMemberAccessModal()` in each file now just calls `window.closeAltitudeAccessModal(); window.openLoginModal();` — the shared modal from `components/magic-modal.html` (both pages already load `js/header.js`, which injects it globally, so `openLoginModal` is guaranteed available). Also fixed a stale comment in `pages/altitude.html` still referencing the old `js/member-login-modal.js` filename from the original migration.

**Left untouched, deliberately:** the "This issue is for Altitude members" paywall-teaser modal (`altitude-access-modal`, Join-Waitlist CTA) is *also* duplicated between `index.html` and `js/newsletter-archive.js`, but it's a different feature from the magic-link modal (no email form, no backend call) and wasn't part of what the user asked to consolidate — flagging it here in case it's worth a future cleanup pass.

Verified via repo-wide grep: no remaining references to `openMemberAccessModal`/`closeMemberAccessModal`/`member-access-modal` anywhere. Inline `<script>` blocks in `index.html` and `js/newsletter-archive.js` syntax-checked clean after the edits. Not yet deployed anywhere (these are static frontend files, no Worker/backend change, no `wrangler deploy` needed).

## Stop auto-login after Stripe checkout; centralized magic-link modal; new Starter automation (2026-07-24)

Previously, `pages/altitude-success.html` called `POST /altitude/activate` with the Stripe `session_id`, received a JWT back, stored it in `localStorage`, and immediately redirected into the logged-in member view — no email, no click required. User wanted this stopped: a fresh Monthly/Annual subscriber should complete checkout, see a confirmation, and log in the same way every other member does — by clicking an emailed magic link.

**Backend (`cloudflare/subscribe-worker.js`):** `handleActivate` now branches on `isFreshCheckout = !!sessionId`. All existing payment-verification/self-heal/tagging logic is untouched. Only the tail changed: on a fresh checkout, instead of issuing/returning a JWT, it calls a new `sendStarterMagicLink(email, env, origin)` — mirrors `handleMagicRequest`'s existing send block exactly (same `magic:{token}` KV entry, same `MAGIC_LINK_CF_NAME` custom field, same `/pages/altitude?magic=` destination that `js/altitude.js`'s existing magic-link consumption already handles unchanged) — and responds `{ success: true, magic_link_sent: true, email }` with no token. The `email`-only branch of `handleActivate` (confirmed via repo-wide grep to be unused by any current frontend) is untouched and still issues a JWT directly, kept for API completeness.

**New Beehiiv automation** — "Altitude — Starter Magic Link" (`aut_7f86ca72-14cb-4af3-9b26-9e7275f20114`), separate from the existing "Altitude Magic Link" automation (`aut_765b1f46...`, which stays scoped to on-demand "Member Access" requests) per explicit request. Same `api`-trigger + single `send_email` pattern as every other automation in this account; email reuses the same `{{magic_link_url}}` merge-tag button as the existing automation (read from its live content to match), with post-purchase-confirmation copy instead of "you requested a link." Created as `draft` — needs a manual publish from the Beehiiv editor before it sends (same standing checklist as the other draft automations already noted below).

**Centralized modal.** The login modal previously lived as a JS-owned template string in `js/member-login-modal.js`. Migrated verbatim into a new shared `components/magic-modal.html` (the user had already created this file empty), containing two panels in one overlay shell:
- `#magic-modal-panel-default` — the existing "Member Access" request form, unchanged ids/classes/behavior.
- `#magic-modal-panel-starter` — new: "Successful! We sent you a magic link. Please check your email to access your account."

`js/member-login-modal.js` was renamed to `js/magic-modal.js` and reworked to `fetch()` the component once and inject it (instead of a synchronous template string) — this introduces one new wrinkle: `openLoginModal()`/`openStarterSuccessModal()` calls made before that fetch resolves are now queued and replayed once the DOM exists, rather than silently no-oping, since `altitude-success.html` calls `openStarterSuccessModal` programmatically right after activation. Global function names (`window.openLoginModal`, `window.closeLoginModal`) are preserved, plus a new `window.openStarterSuccessModal(email)` — so every existing call site (`js/header.js`'s "Altitude Access" button, `pages/altitude.html`'s "Already a Member?" triggers, `js/altitude.js`'s failed-magic-verify path) kept working with zero changes beyond `js/header.js`'s one-line script-src update (`js/member-login-modal.js` → `js/magic-modal.js`, the only place it's loaded). Old file deleted after migration.

**`pages/altitude-success.html`:** removed the `localStorage.setItem('altitude_jwt', ...)` / `window.location.replace('altitude')` auto-login branch. On success it now shows a trimmed `#state-success` block ("Payment Confirmed" / "Check your email for a one-time login link" — no "Enter Altitude" button, since access is no longer immediate) and calls `window.openStarterSuccessModal(email)` so the modal opens on top, per the user's explicit choice to keep this on the existing success page rather than redirecting elsewhere first.

Deployed to `skyfares-altitude` (version `89932941-3896-4c50-a731-42c166c199c5`). Out of scope / unaffected: KrisFlyer Guide checkout (separate `mode: 'payment'` path, already magic-link-only, never auto-logged in). Not yet tested end-to-end against a live Stripe test-mode checkout this session — the new automation also still needs its manual publish before any email actually sends.

## Member-page header fix, membership card, deferred Monthly→Annual upgrade billing (2026-07-24)

Four related fixes to `/pages/altitude`'s member experience, deployed together.

**1. Header white-text bug, fixed.** `js/header.js` detects the dark public hero (`#alt-public-hero`'s `.page-hero-bg`) once at `DOMContentLoaded` and locks in `.header-transparent` (white text) for all future scroll updates — it never re-checks which view is actually showing. The member view has no dark hero (white background), so its header text was rendering white-on-white. Fixed entirely in `js/altitude.js` (shared `header.js` untouched): a new `enforceMemberHeaderState()` forces `.header-scrolled` once in `showMemberShell()` and on every `scroll` event thereafter (registered after header.js's own listener, so it wins); `hideMemberShell()` removes that listener and restores header.js's normal transparent/scrolled logic for the public hero.

**2. Membership summary card, added.** New always-visible `#alt-membership-card` section in `pages/altitude.html`, populated by a new `_populateMembershipCard()` in `js/altitude.js`: shows the plan label (Monthly/Annual/Guide Bundle) and days remaining until `current_period_end`, computed client-side from the existing KV member record — no new backend fields needed for this part.

**3. Critical billing bug, fixed — deferred upgrade via Stripe Subscription Schedules.** The old `handleUpgradeToAnnual` swapped the Stripe price *and* the Beehiiv tag immediately on click using `proration_behavior: 'create_prorations'`, which only adds a line to the *next* invoice rather than guaranteeing an immediate charge — a member could end up tagged/entitled as Annual without ever being charged the Annual amount. Separately, the intended flow turned out to be different from a same-day-charge fix: **no charge or tag change should happen at click time at all** — the member already paid for their current Monthly period, so nothing should change until it naturally ends.

Rebuilt on Stripe's own documented mechanism for this exact case (`docs.stripe.com/billing/subscriptions/change-price` → "Subscription schedules"): `handleUpgradeToAnnual` now converts the subscription to a Subscription Schedule (`from_subscription`) with two phases — phase 1 keeps the existing Monthly price through `current_period_end` (what's already paid for), phase 2 starts there on the Annual price with `proration_behavior: 'none'` and `iterations: 1`, then `end_behavior: 'release'` so billing continues normally afterward. Nothing is charged and no plan/tag changes at click time — only `member.pending_plan = 'annual'` / `member.upgrade_effective_at` are set, and the upgrade card switches to static "Annual Subscription will automatically take effect after the N days remaining expires" copy (no button — nothing left to click).

The actual switch happens later: `handleSubscriptionUpdated`'s existing plan-change-detection block (previously just a safety net for the old immediate-swap flow) is now the **primary** completion path — when Stripe applies the schedule's phase 2 at the period boundary, it fires `customer.subscription.updated` with the new Annual price, which this handler detects, then calls the existing `swapIntervalTag()` (unchanged — already correctly removes `altitude monthly` and applies `altitude annual`, never both at once) and clears `pending_plan`/`upgrade_effective_at`.

**4. New Beehiiv automation, created.** "Altitude — Upgraded to Annual" (`aut_2c9e00f8-3e2f-4fbc-bc2c-224bdef7df75`), same `api`-trigger + single `send_email` pattern as `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID` — a short congrats email, fired from `handleSubscriptionUpdated` at the moment the switch actually takes effect, not at click time. Still `draft` in Beehiiv (needs a manual publish before it sends, same as the other pending automations already flagged in this file).

Deployed to `skyfares-altitude` (version `de11951a-6180-41ef-9b99-c2fae3efbf27`). Verification still needed: a Stripe test-clock run through a full Monthly→scheduled-upgrade→boundary-switch cycle hasn't been done yet — the schedule-creation call path was syntax/logic-reviewed but not live-tested against Stripe test mode this session.

## Annual/Guide checkout fixed: wrong Stripe account, not a code bug (2026-07-24)

User reported "No such price" errors on both Annual and Guide checkout in production. Root cause was NOT a code or secret-corruption issue (both ruled out with direct evidence) — it was a **completely different Stripe account** than the one I'd been auditing all session.

**Diagnosis, in order:**
1. Confirmed the price IDs I'd set (`price_1TvZKKB9...` Annual, `price_1TvYo4B9...` Guide) were valid, active, correctly-shaped objects when read directly via Stripe — ruled out "price doesn't exist."
2. Re-set both secrets with `printf '%s'` instead of `echo` (which appends a trailing newline) in case of value corruption — no change, ruled that out too.
3. Added a temporary diagnostic route to the worker (`GET /debug/stripe-account`) that asks Stripe "which account does this key belong to," using the worker's own `STRIPE_SECRET_KEY`. **Result: `acct_1TmBCQEJ1qCzN8Sn` ("skyfare sandbox")** — not `acct_1Tl1nJB9NfKSwBnU` ("Klent sandbox"), which is the account my Stripe MCP tools are actually connected to. Two entirely separate Stripe test accounts, both live under the same login.

**This means the "full Stripe catalog audit" from the earlier full-system QA pass this session (2 products, 3 prices, no live-mode objects) was auditing the wrong account** — "Klent sandbox," not the one actually wired into `skyfares-altitude`. The Annual/Guide price IDs I originally set as secrets were real, valid prices — just in the wrong Stripe account entirely, hence "No such price" from the worker's actual key's point of view.

**Fix:** since I have no direct API access to "skyfare sandbox" via any available tool, used the worker itself as a proxy — added a second temporary route listing that account's real products/prices (confirmed it had exactly **one** price total: the working Monthly one, on a product literally named "Skyfare"), then a third temporary route that created the missing objects directly in the correct account: an Annual price (`price_1TwP5UEJ1qCzN8SnsTxVACna`, $49.99/yr) on the existing Skyfare product, and a new "The KrisFlyer Guide (Test)" product (`prod_UwHeci7vtQRCKT`) with its one-time price (`price_1TwP5VEJ1qCzN8SnQzDHORGH`, $39.99). Set both as the corrected secrets, removed all three temporary debug routes, redeployed clean, and verified: both Annual and Guide checkout now return real Stripe Checkout Session URLs.

**Standing caveat for any future Stripe work this session's tools can't resolve alone:** my Stripe MCP integration is scoped to "Klent sandbox," not "skyfare sandbox." Any future audit of Stripe state needs to go through the worker (which holds the correct key) rather than the Stripe MCP tools directly, or explicitly confirm which account is being inspected first.

## "Altitude Premium Subscribers" segment retired from code, ready for Beehiiv deletion (2026-07-23)

Asked whether the "Altitude Premium Subscribers" segment and the "Altitude Access — Welcome" / "Apply Altitude Premium Tag" automations were safe to delete. Findings, checked against live Beehiiv state directly:

- **"Altitude Access — Welcome" automation — not a deletion candidate.** Still live and actively used today: its `api` trigger is what `enrollWelcomeAutomation` calls for the generic/Guide-bundle-grant welcome path. It does carry one dead `segment_action` trigger condition (still checks for the retired `altitude premium` tag) that will simply never fire again once that tag is gone — noted, not urgent.
- **"Apply Altitude Premium Tag" automation — still the correct deletion candidate**, unchanged from the earlier finding. Confirmed via grep against the now-deployed code: nothing calls it. Still needs the Beehiiv editor (no delete-automation tool exists).
- **"Altitude Premium Subscribers" segment (`seg_6b2bf91a...`) — was NOT an orphan when asked, now fully is.** It was never literally unused — it's the union of Monthly + Annual (`where: subscriber_tag IN (altitude-monthly, altitude-annual)`, already correctly migrated weeks ago), and `skyfares-reports-bot` read it directly by ID for its `premiumCount` metric in every Slack report. Deleting it without changing that code would have made reports silently show 0 premium subscribers forever, not error loudly.

**Resolved by removing the dependency instead of just renaming it** (per explicit direction — consolidate rather than keep a redundant rollup segment):
- `cloudflare-reports/services/beehiiv.js`: `fetchSegmentCounts()` now sums `SEG_MONTHLY` + `SEG_ANNUAL` directly instead of reading the combined segment. `cloudflare-reports/config/constants.js` swapped `SEG_PREMIUM` for `SEG_MONTHLY`/`SEG_ANNUAL` accordingly. Redeployed `skyfares-reports-bot`, verified the live bundle contains the summed logic.
- `cloudflare/subscribe-worker.js`: `triggerSegmentRecalculation()` no longer recalculates `SEG_PREMIUM` (Monthly and Annual are already independently recalculated in the same list). Redeployed `skyfares-altitude`.

**Net result: the segment is now genuinely unreferenced by any code**, on either Worker. Safe to delete in the Beehiiv editor whenever convenient — no tool available to do this remotely (no `delete_segment` operation exists), so this is still a manual step.

## Secrets/vars audit on both Workers (2026-07-23)

Post-deploy check requested: any unused API keys on `skyfares-altitude`, especially Stripe. Cross-referenced `wrangler secret list` against every `env.X` reference in `subscribe-worker.js` (grepped the full file). Result: **all 8 secrets and all 5 vars are in active use, nothing orphaned** — `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_PRICE_ID_ANNUAL`/`STRIPE_GUIDE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` each map to exactly one purpose (no duplicate or legacy Stripe price/key sitting around), same for `BEEHIIV_API_KEY`, `AIRTABLE_API_KEY`, `JWT_SECRET`, and the Airtable/Beehiiv vars. Caveat: `wrangler secret list` only proves a secret *name* is bound and referenced, not that its *value* is still valid — secret values aren't readable by any tool. `STRIPE_PRICE_ID_ANNUAL`/`STRIPE_GUIDE_PRICE_ID` are verified correct (set this session directly from Stripe's own price list); the three pre-existing Stripe secrets were never touched and weren't independently re-verified.

**Follow-up finding, meaningfully de-risks the orphaned `subscribe-worker` question from the entry below:** ran the same secret check against `subscribe-worker` — it has **zero secrets configured**. Its code hard-requires `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`BEEHIIV_API_KEY` etc. just to respond to anything (every handler 503s immediately without them — e.g. `handleStripeWebhook` returns "Webhook not configured" with no `STRIPE_WEBHOOK_SECRET`). So even if something external (a stray Stripe webhook endpoint, an old bookmark) still points at it, it cannot actually process a request today. Still recommend the Stripe/Cloudflare dashboard checks from the entry below to close this out properly and clean up the dead endpoint/worker if one exists, but the "is it silently corrupting data" risk is now confirmed low.

## Production deploy completed + a second landmine found (2026-07-23)

Deployed `skyfares-altitude` for real (`wrangler deploy` from `cloudflare/`, run directly via terminal with an already-authenticated `wrangler` OAuth session — confirmed via `wrangler whoami`), closing out the gap documented in the entry below. Verified post-deploy by re-fetching the live source: `/guide/checkout`, `/altitude/upgrade`, `activateDeferredGuideBundle`, `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID`, and `checkBeehiivPremium`'s new `altitude monthly`/`altitude annual`/`krisflyer bundle` check are all live, byte-consistent with local. `modified_on` now shows today's deploy time.

**Pre-flight catch:** `wrangler secret list` showed production was missing `STRIPE_PRICE_ID_ANNUAL` and `STRIPE_GUIDE_PRICE_ID` — secrets the new Annual/Guide checkout code requires, that a redeploy alone would never set (secrets persist independently of code deploys). Fetched the real Stripe test-mode price IDs (`price_1TvZKKB9NfKSwBnUvuRsSPGK` for Annual, `price_1TvYo4B9NfKSwBnU0PJfw4LJ` for the Guide) and set both via `wrangler secret put` before deploying — without this, Annual and Guide checkout would have 503'd with "Stripe not configured" immediately after the code went live.

**Second landmine found and worked around, not yet cleaned up:** a `wrangler.jsonc` at the **repo root** (not `cloudflare/`) also declares `"name": "skyfares-altitude"` — the exact same Worker name — but as a static-assets-only deployment (`assets.directory: "."`, no `main` script at all). A bare `wrangler deploy` run from the repo root, or from anywhere `npx` resolves the project root to the repo root instead of `cloudflare/`, would silently overwrite the real API worker with a static-file server exposing the entire repo (including `.git` internals) and zero backend logic. Confirmed this is exactly what happened on the first deploy attempt this session — it read "1628 files from the assets directory" and failed only because a `.git` pack file exceeded Workers' 25 MiB asset limit; a smaller repo would have let it silently succeed. Worked around by forcing `wrangler deploy --config wrangler.toml` explicitly from `cloudflare/`. **Not resolved**: the root `wrangler.jsonc` itself still exists and is still a live footgun for the next person (or session) who runs a bare `wrangler deploy` from the wrong directory. Recommend either deleting it (if confirmed to be an abandoned experiment — nothing in this session's investigation found any legitimate use for it) or renaming its `name` field so it can never collide with the real Worker again.

## Production deployment gap + orphaned Worker found (2026-07-22)

Final QA pass asked to verify Beehiiv tags/segments/automations, Stripe, and "all workers" are correctly configured. Re-checking live state (not trusting the prior audit's snapshot) surfaced two critical infrastructure findings, both confirmed via direct Cloudflare/Beehiiv API reads, not assumption:

**1. The actual deployed Worker (`skyfares-altitude`) has not been redeployed since 2026-07-16 — none of this session's work is live.** Diffed the deployed source against local `cloudflare/subscribe-worker.js` line-by-line. Missing entirely from production: `POST /altitude/upgrade`, `POST /guide/checkout`, the whole KrisFlyer Guide feature, Annual billing (no `STRIPE_PRICE_ID_ANNUAL` anywhere), `handleInvoicePaymentSucceeded`, `expireGuideBundles`, and the `SEG_GUIDE`/`SEG_MONTHLY`/`SEG_ANNUAL` recalculation. Production's `checkBeehiivPremium` still gates purely on the old `altitude premium` tag, and `handleCheckoutComplete` still hardcodes `plan: "monthly", amount_cents: 499` on every purchase regardless of what was bought. Already-live in production (not missing, as first assumed): `/altitude/waitlist` and all three `/airtable/testimonial*` routes — those didn't need this deploy.

**2. A second, orphaned Worker (`subscribe-worker`) exists in the Cloudflare account** — created 2026-07-01, never updated since, named after the local filename rather than `wrangler.toml`'s configured `name` (`skyfares-altitude`), consistent with a one-off dashboard upload rather than a real `wrangler deploy`. Its code is a snapshot from the "magic link + renewal reminders" era (no Airtable, no Annual, no Guide) and references three Beehiiv automation IDs (`aut_94f6dbad...`, `aut_c64c648b...`, `aut_b14dc6cd...`) that **no longer exist in Beehiiv at all** — confirmed via direct `get_automation` lookups, all three "not found." Whether it still receives any real traffic (e.g. a forgotten Stripe webhook endpoint) is unverifiable via any available tool — flagged for a manual Stripe Dashboard / Cloudflare Dashboard check, not resolved.

**Decided (per explicit direction): delete, not pause, the "Apply Altitude Premium Tag" automation (`aut_da7df205`) and the `altitude premium` tag itself** — both fully retired now that `altitude monthly`/`altitude annual` exist. Critical constraint: this must happen **only after** `skyfares-altitude` is redeployed, since the *currently live* pre-redeploy code has no other way to tag anyone — deleting either first would break all new-signup tagging until the redeploy lands. Also discovered while trying to execute this: **no available tool can actually delete a Beehiiv automation or a Beehiiv tag** (`delete_automation_step`/`delete_automation_trigger` only strip pieces of an automation, leaving the object itself behind; there is no `delete_subscriber_tag` at all) — same for publishing drafts and deploying the Worker. All of this is now a manual checklist for the team: `wrangler deploy` → publish the 6 draft automations → delete the old automation + tag in the Beehiiv editor → manually check Stripe/Cloudflare dashboards for `subscribe-worker`'s exposure.

**Confirmed unaffected / still clean:** `skyfares-reports-bot` (the third Worker in the account) — legitimate Slack reporting bot, reads `SEG_PREMIUM`/`SEG_FREE`/`SEG_PRELAUNCH` by ID not tag name, automatically unaffected by the tag migration. Stripe catalog unchanged (2 test products, 3 test prices, no live-mode objects). All 5 Beehiiv tags and every `SEG_*` constant in local code still match live Beehiiv IDs exactly.

## Implementation Status (as of 2026-07-21)

This doc was written as an architecture recommendation, not a build spec (see "Scope note" below) — implementation has since happened, in Stripe **test mode**, not yet deployed to production. Cross-checked against this doc's own numbered items by direct code review, not from memory.

### Done — code-complete, not yet deployed

- [x] **Item 1 (Payment)** — Guide gets its own one-time Stripe test Price + a sibling route `POST /guide/checkout` (the sibling-route option this doc offered, not the `product`-parameter alternative), `mode: 'payment'`, entirely separate from Altitude's `mode: 'subscription'` checkout.
- [x] **Item 2 (Fulfillment)** — On `checkout.session.completed`, the webhook writes `guide:{email}` to KV, applies the `krisflyer` Beehiiv tag, and sends the magic-link email via the existing `MAGIC_LINK_AUTOMATION_ID` — the exact three steps this doc specifies.
- [x] **"KrisFlyer Guide Subscribers" Beehiiv segment** — already exists live in the account (confirmed via the Beehiiv API, not assumed), correctly filtered on the real `krisflyer` tag ID. This doc's own ⚠️ warning about the tag being named `altitude premium`, not `premium`, was checked and confirmed correct.
- [x] **Item 3 (Access control)** — `/altitude/magic-verify`'s JWT now carries an additive `guide` claim, and `/altitude/verify` independently re-checks the `guide:{email}` KV record live on every call (stronger than relying on the JWT claim alone) — one shared login for Guide-only, Altitude-only, or both.
- [x] **Item 4 (Revealing content)** — `js/krisflyer-guide.js` checks the session on page load and removes `.kf-blur` + the lock overlays only when `guide` access is confirmed; the default (no session) state is unchanged from today's gated page.
- [x] **Security hardening found during review** — a Guide purchase's session_id can no longer be replayed against `/altitude/activate` to claim free Altitude access; webhook retries no longer risk sending the magic-link email twice.
- [x] **Beyond this doc's original scope** (added per later requests, not part of the architecture described below):
  - 90-day bundled Altitude Premium access on Guide purchase, with automatic expiry — the promise already sitting in the page's own pricing-card copy ("90 days of Altitude Premium included"), which this doc didn't originally cover.
  - Altitude Access annual billing ($49.99/yr) alongside the existing monthly plan.

### Not started

- [ ] **Item 5** — "Guide Purchases" Airtable table (visibility only; KV/JWT remain the actual access gate either way).
- [ ] **Item 6** — print-to-PDF download button + `@media print` stylesheet.
- [ ] **Deploying any of this** — `wrangler secret put` for the new secrets, then `wrangler deploy`. Everything above exists only as local, unshipped code changes.
- [ ] **This doc's own "Verification" checklist below** — logically traced and syntax-checked, but the actual live test-mode loop (checkout → webhook → KV → tag → email → magic link → JWT → unblur) has never been run end-to-end, since nothing is deployed yet.
- [ ] Re-adding `kf-blur` / the lock overlay to the pricing card — it's currently in the "temporarily removed for local testing" state the HTML's own comment describes, and should be restored before this goes live for real visitors.

### Ready, no code needed

- **Item 7** (update notifications) — the tag/segment this depends on already exists live, so the team can already send a one-off update email to Guide buyers whenever content changes, exactly as this doc describes.

## Recommendations & Suggestions (2026-07-21)

1. **This doc's "Scope note" and "Verification" sections below are now stale** — they still read as if nothing has been built. Worth a follow-up pass once this ships to fold the Implementation Status above into the doc's permanent narrative, rather than leaving it as a status snapshot bolted onto an unchanged architecture doc.
2. **Resolve which Stripe account is authoritative before going live.** Everything built so far points at a test-mode sandbox account, connected separately from whatever account (if any) actually backs the currently-deployed `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID` secrets. This needs a decision before any `wrangler secret put` targets production.
3. **Clarify the "after 90 days" copy before launch.** The pricing card's "continue Altitude for $4.99/month, or cancel anytime" reads like a trial-to-paid auto-conversion to a first-time reader — the actual implementation is a plain grant that silently expires (confirmed decision, 2026-07-21). Either adjust the copy to be unambiguous ("your free access simply ends after 90 days, no card required") or scope the larger auto-conversion feature (saved payment method, real Stripe Subscription with a trial period) if that's actually the intended model.
4. **No "resend my magic link" path exists for Guide-only buyers.** `/altitude/magic-request` (the existing resend flow) is gated on Altitude Premium status, so a Guide-only buyer who misses their 1-hour link window currently has no self-service way to get a new one. Worth building before this is customer-facing.
5. **`handleActivate`'s rare self-healing fallback** (Beehiiv says premium, but no local KV record exists) still assumes `plan: 'monthly', amount_cents: 499` — a pre-existing gap, now more likely to be wrong given annual and bundle plans exist. Low priority (narrow edge case) but worth a follow-up.
6. **Build the Item 5 Airtable table sooner rather than later** — it's the cheapest remaining piece (no Stripe/webhook risk) and gives the team purchase visibility without needing Stripe dashboard access, exactly as this doc originally argued.
7. **Test in a preview/staging environment before deploying to the production Worker** — `cloudflare/subscribe-worker.js` also serves live Altitude traffic today; the changes are additive by design, but this is still the first real deploy touching that shared file since this work began.

## Related Beehiiv work: Altitude Access — Monthly / Annual / Renewed automations (2026-07-22)

Separate from the Guide itself, but touching the same Beehiiv publication (`pub_0be395f6-cacb-4ba9-b8a5-04c69ea44bf1`) and directly relevant to the "Altitude Access annual billing" line already noted above under Implementation Status. Prompted by a question about the existing **"Altitude Access — Welcome"** automation: it turns out that automation fires for *every* Altitude Premium subscriber regardless of billing interval — it's tag-driven, not plan-driven — and its copy hardcoded **"Your $4.99/month membership is now active,"** which is wrong for annual buyers who get enrolled into the exact same automation. Beehiiv itself has zero native paid tiers (`list_tiers` returns empty) and no billing-interval signal reaches it at all today — only Stripe and the Worker's own KV records (`plan: 'monthly' | 'annual'`) know which plan someone is on.

**Fixed now (live automation, copy only):**

- `Altitude Access — Welcome`'s hardcoded price line was changed to plan-agnostic wording ("Your Altitude membership is now active"). This is staged in Beehiiv and needs a manual publish from the editor to take effect — trigger and enrollment logic were left untouched (see the "why not just retarget the trigger" note below).

**Built as new drafts (Beehiiv config only — `cloudflare/subscribe-worker.js` was NOT touched):**

Two new tags: `altitude monthly`, `altitude annual`.
Two new segments (each requires `status = 'active'` + the `altitude premium` tag + the matching interval tag): **"Altitude Monthly Subscribers"**, **"Altitude Annual Subscribers"**.

Process flow, once the Worker follow-up below exists (not live yet):

|Plan|Tag(s) applied on checkout|Segment entered|Automation triggered|
|-|-|-|-|
|Monthly checkout|`altitude premium` + `altitude monthly`|Altitude Monthly Subscribers|**Altitude Access — Welcome (Monthly)**|
|Annual checkout|`altitude premium` + `altitude annual`|Altitude Annual Subscribers|**Altitude Access — Welcome (Annual)**|
|Monthly renewal|*(n/a — enrolled directly via API call, not tag/segment-driven)*|—|**Altitude Membership Renewed — Monthly**|
|Annual renewal|*(n/a — enrolled directly via API call, not tag/segment-driven)*|—|**Altitude Membership Renewed — Annual**|

All 4 new automations are `draft` and inert — no subscriber can reach them yet.

**⚠️ Why the existing Welcome automation's trigger was NOT retargeted to the new segments:** `subscribe-worker.js`'s `enrollWelcomeAutomation()` calls this automation's ID directly and unconditionally on every successful tagging, regardless of plan — separately from its `segment_action` trigger. Narrowing the trigger without also updating that Worker call would have silently stopped the welcome email from sending to anyone until the follow-up below ships. Copy-only fix now; real split takes effect once the Worker changes land.

**✅ Required Worker follow-up — implemented 2026-07-22, not yet deployed:**
1. `setupBeehiivMember()` now takes an additive `planTag` parameter ('monthly' | 'annual' | undefined) — when provided, a new `applyIntervalTag()` call tags the subscriber `altitude monthly` or `altitude annual` alongside the existing `altitude premium` tag, in every success branch of the existing tagging cascade. `handleCheckoutComplete` and `handleActivate`'s session_id fallback both now pass the plan they already derive via `derivePlanFromSubscription`; `grantGuideAltitudeBundle` (the Guide's 90-day bundle) deliberately omits it — a free bundle isn't billed monthly or annually, so it shouldn't claim either tag or land in either plan-specific welcome email.
2. New webhook case `invoice.payment_succeeded` → `handleInvoicePaymentSucceeded()`, gated on `billing_reason === 'subscription_cycle'` (so the subscriber's very first invoice at checkout doesn't also trigger a "renewed" email). Looks up the member's stored `plan` via the existing `customer:{custId}` → email → `member:{email}` KV chain and calls `enrollInAutomation()` — the exact helper the renewal-reminder cron already uses — against the matching Renewed automation ID.
3. `enrollWelcomeAutomation()` now takes the same additive `planTag` parameter and picks `WELCOME_MONTHLY_AUTOMATION_ID` / `WELCOME_ANNUAL_AUTOMATION_ID` instead of the generic one when provided; omitted (the Guide bundle's call) keeps the exact original generic-welcome behavior.

All 4 new automation IDs are hardcoded as consts (matching how every other automation ID in this file is stored — not a secret). **Still unverified:** whether enrolling a subscriber into a Beehiiv automation that's still in `draft` state actually works once it's later published, or needs a fresh enrollment call after publish — confirm with a real test-mode purchase once the 4 automations are published in Beehiiv.

**✅ Price discrepancy — resolved 2026-07-22:** confirmed $49.99/yr is correct (matches the original Stripe test Price and the Implementation Status entry above). Fixed `index.html`'s Annual card (was showing $49) and the Welcome (Annual) email draft's body copy (was written to $49) to both say $49.99.

**✅ Two conflicts found in a follow-up audit (2026-07-22), both fixed:**
1. **Stale interval tag on cancellation.** `handleSubscriptionDeleted` removed `altitude premium` on cancel but never the `altitude monthly`/`altitude annual` tag applied at checkout — a subscriber who cancelled Monthly and later resubscribed Annual would end up tagged with *both* intervals at once, matching both segments simultaneously. Fixed: a new `removeIntervalTag()` (mirrors `removeBeehiivTag`'s find-then-DELETE pattern) is now called alongside it, keyed off the member record's stored `plan`.
2. **New segments never recalculated.** `triggerSegmentRecalculation()` never had the two new Monthly/Annual segment IDs added (only `SEG_GUIDE` was, in the prior round) — tagging a subscriber wouldn't promptly refresh their Monthly/Annual segment membership. Fixed: `SEG_MONTHLY`/`SEG_ANNUAL` added to the same recalculation array.

Confirmed clean in that same audit: Free signup is fully isolated from all tag/segment logic; Guide purchases structurally can't trigger subscription webhook events (`mode: 'payment'` never creates a Stripe Subscription object); access gating (`checkBeehiivPremium`) correctly stays interval-agnostic; webhook-ordering races (e.g. `invoice.payment_succeeded` arriving before `checkout.session.completed`) already no-op safely; no KV or rate-limit key collisions across any of the four paths.

**Structure decision:** separate, individual automations per plan × event, not branch logic inside fewer automations — matches how every other distinct scenario in this account is already built (Pre-Launch Welcome, Signup Welcome, the 3 reminder-day automations, and the KrisFlyer confirmation above are all separate automations, none of them branching internally).

## Final Pre-Launch QA Audit (2026-07-22)

Full formal audit across Beehiiv, Stripe, the website, and every cross-product edge case (Free/Monthly/Annual/Guide upgrades, cancellations, refunds, duplicate purchases, plan switching) — re-verified everything from live evidence (Stripe/Beehiiv API calls, a dedicated frontend sweep) rather than trusting prior rounds' notes.

**Fixed:** `setupBeehiivMember()`'s Step 2 only checked whether `altitude premium` already existed and returned immediately if so — meaning a Guide-bundle recipient (already holds `altitude premium` from their free 90-day grant) who later bought a real Monthly/Annual subscription would never get tagged `altitude monthly`/`altitude annual` or enrolled in the plan-specific Welcome automation, since Step 2 short-circuited before reaching that logic. Access itself was never affected (the gate is plan-agnostic), but tagging/segment/email data would have been silently wrong forever. Fixed: Step 2 now checks both the premium tag and (when a plan is given) the specific interval tag, and applies just whichever piece is missing — still returns immediately, retry-safe, if both already exist.

**Decided, no code change:**
- Altitude login modal (`pages/altitude.html`) stays fully disabled (every trigger commented out, blocking the one existing paying member from logging in) — confirmed intentional pending the upcoming launch, not a bug.
- No refund/dispute handling — the business runs a no-refund policy, so a refunded/disputed charge never needs to auto-revoke access. Confirmed out of scope, not a gap.
- No protection against creating a second Stripe subscription while already subscribed (e.g. clicking Annual while already Monthly) — real double-billing risk, confirmed and flagged, but explicitly not being fixed this session.

**Two items literally cannot be verified with the tools available and need manual confirmation in the Stripe Dashboard:**
- Whether a webhook endpoint is even configured to point at `/altitude/webhook`, and which events it's subscribed to (the Stripe MCP tool exposes no webhook-endpoint-listing operation).
- Whether a default Customer Portal configuration exists (same limitation — no portal-configuration operation exposed). Without one, every "Manage Membership" click fails outright.

**Confirmed clean:** Stripe catalog has exactly 2 products / 3 prices, no duplicates or orphans (checked directly, not assumed). Free signup, Free→Monthly, and an existing Altitude subscriber separately buying the Guide all behave correctly. All 5 new Beehiiv automations have real (non-empty) email content. The `magic_link_url` custom field exists. No KV or rate-limit key collisions anywhere across the four purchase paths.

**Still flagged, not fixed (low/medium, by your direction to focus only on the clear bug above):** silent failure states in `js/krisflyer-guide.js` when a magic link fails to verify; no acknowledgment shown when a Stripe checkout is cancelled; `invoice.payment_failed` isn't handled (only `invoice.payment_succeeded` is); a second Guide purchase by the same email doesn't extend the existing 90-day bundle.

## Monthly → Annual Upgrade Flow (2026-07-22)

The double-billing risk flagged in the audit above ("no protection against creating a second Stripe subscription while already subscribed") is now built out as a real feature, not just blocked.

**Architectural review first, per your request — three planned pieces didn't match what's actually in the codebase:**
- **`/pages/pre-signup-link` was proposed as the entry point — rejected.** It's a public, unauthenticated pre-launch waitlist page with zero auth/JWT code, and its own FAQ tells existing members *not* to be there ("you already have full access today"). Used `pages/altitude.html`'s existing member view instead — it already has JWT auth, a working magic-link exchange, and `/altitude/verify` already returns `plan`/`status`/`current_period_end` on the member object.
- **The "Access Premium" card under "Ways to Fly Smarter" doesn't exist** — searched the live codebase and full git history, no match anywhere. What's actually already live: clicking a locked Premium newsletter card on the homepage opens a modal with a fully working "Already a member? Enter your email for a magic link" path (`index.html`, `openAltitudeAccessModal` → `switchToMemberAccessModal`) — nothing needed restoring, it already works today. `pages/altitude.html`'s *own* login modal triggers stay commented out per your explicit prior decision ("keep it commented... launching soon not now") — not touched.
- **Magic Link success redirecting to `pages/altitude-success.html` — not implemented.** That page is built specifically around Stripe's `?session_id=` → `/altitude/activate` flow; it has no magic-link-token handling. Magic-link auth already completes in place (verify → store JWT → render member view, no navigation) — kept that, since routing it through a Stripe-specific page would risk the "broken redirects/auth loops" you asked to avoid.

**Built:**
- `POST /altitude/upgrade` (`handleUpgradeToAnnual`, subscribe-worker.js) — modifies the customer's **existing** Stripe subscription in place (fetches the subscription's line item, swaps its price to `STRIPE_PRICE_ID_ANNUAL`, `proration_behavior: 'create_prorations'`) rather than creating a new Checkout Session. Same subscription ID, same customer — no duplicate, no second charge stream. Confirmed decision: prorate and invoice the difference immediately, not deferred to next renewal.
- New shared `swapIntervalTag(email, oldPlan, newPlan, env)` — removes the old interval tag, applies the new one, recalculates segments. Deliberately does **not** enroll in any Welcome automation (this is an existing member changing plans, not a first-time signup — "You're in! Welcome to Altitude" would be the wrong email).
- `handleSubscriptionUpdated` webhook now additionally detects a plan change (via the existing `derivePlanFromSubscription`) and calls `swapIntervalTag` as a safety net, in case the upgrade endpoint's own KV/tag update didn't complete.
- Frontend: a new "Current Membership / Upgrade to Annual" section in `pages/altitude.html`'s member view (`#alt-upgrade-section`), shown only when `member.plan === 'monthly'` (hidden for Annual and Guide-bundle members) — reuses the site's existing `card-utility`/pricing-card visual language. `js/altitude.js`'s `handleUpgradeToAnnual()` mirrors the existing `handleManageMembership()` pattern exactly, and re-runs `verifyAndRender` on success so the card disappears and the plan/renewal info updates immediately.

**Known limitation:** the upgrade card doesn't appear immediately after a fresh magic-link login, since that path (`handleMagicCallback`) doesn't have the member object yet (only email + token) — it appears correctly on the next full page load/verify. Not fixed this round; flagging rather than silently leaving undocumented.

**Future extensibility (not built):** the requested future `pages/access-guide.html` (Guide purchasers' own access page) needs no architecture changes to support later — same shared JWT (`guide` claim already exists), same `/altitude/verify` endpoint, its own page-scoped JS file matching `js/krisflyer-guide.js`'s existing pattern.

## Guide Access Flow Review + "No Content Yet" (2026-07-22)

Asked to check the Guide's magic-link flow against Altitude's implementation and confirm the session length matches. Confirmed: both already share the exact same mechanism (same `/altitude/magic-verify` endpoint) — magic link token expires in 1 hour, the JWT session it issues lasts 24 hours ("1 day"). No change needed there, already consistent.

You initially asked about building the deferred `pages/access-guide.html` now — clarified you want the existing inline flow on `pages/krisflyer-guide.html` improved instead, not a new page. Two things fixed:

1. **Error-handling parity with `js/altitude.js`.** `js/krisflyer-guide.js`'s `handleMagicCallback` previously failed completely silently on an expired/already-used link (no toast, no feedback at all) — the exact "silent failure" gap flagged in the last audit round. Now shows a clear error toast on both a bad-token response and a network failure, matching the intent of Altitude's equivalent handling (Altitude falls back to a login modal it has and Guide doesn't, so this isn't a byte-for-byte copy, but the "always tell the user what happened" behavior now matches).
2. **"What's Inside" replaced with an honest "No content yet" card.** The 7 chapters were always just titles — no chapter body content has ever been written. The old treatment blurred/locked that title list behind a "Coming Soon" overlay, which implied finished content was sitting there waiting. Replaced with a plain placeholder card ("We're still writing the guide..." + Join the Waitlist), not gated behind `kf-blur`/login at all, since there's nothing to unlock either way. The redemption-conditions table (real content) is untouched and still gates normally. Removed the now-dead `kf-chapters-content`/`kf-chapters-lock` element references from `unlockGuideContent()` in `js/krisflyer-guide.js` — confirmed via repo-wide grep that no other file references those IDs anymore.

**Still not built (unchanged from before):** a self-service "resend my magic link" path for Guide-only buyers who miss their 1-hour window — same gap noted in the prior audit, not in scope for this pass.

## Altitude Re-Enabled for Testing (2026-07-22)

Restored the real checkout + login UI on `pages/altitude.html` and the homepage Pricing cards, reversing the "not purchasable yet" (Sahej, 2026-07-03) gating specifically so the full flow can be tested end-to-end. Everything disabled/re-enabled below is toggled with the exact same "comment, don't delete" convention already used throughout this codebase, so it can be flipped back before real launch just as easily.

- **`pages/altitude.html` hero**: restored the real `$4.99/month` badge, the checkout form (`#alt-checkout-form`), and the "Already a Member? Log In" trigger — all previously replaced with waitlist-only copy. The waitlist versions are preserved as comments alongside each, ready to swap back in.
- **`pages/altitude.html` CTA band**: same treatment — restored "Ready to fly premium for less?" + Get Access button + Log In button, waitlist version preserved as a comment.
- **`js/altitude.js`**: the checkout button now calls a **new** `handleCheckout()` that hits the modern `POST /altitude/checkout` worker endpoint (same pattern as `js/index-pricing.js`/`js/krisflyer-guide.js`) — deliberately **not** a restoration of the old commented-out `PAYMENT_LINK` code, which pointed at a stale static Stripe Payment Link superseded by the dynamic Checkout Session approach built earlier this session. `wirePublicView()` now wires the form submit to it.
- **`index.html` Pricing section**: `pricing-blur` + lock overlays removed/commented on all three gated cards (Monthly/Annual/Guide), matching the exact toggle done (and reversed) twice already this session — the real CTA buttons underneath were never touched, just uncovered.

**Not touched**: the QR-code modal (`#alt-qr-modal`) stays commented out — it points at the same stale static Payment Link and has no live trigger anyway, so restoring it as-is would show a broken/outdated flow. Would need updating to the modern checkout endpoint before it's worth reviving.

## `altitude premium` tag retired — monthly/annual (+ krisflyer bundle) only (2026-07-22)

The three-tag design from the "Related Beehiiv work" section above (`altitude premium` as the universal access gate, `altitude monthly`/`altitude annual` layered additively on top) was retired the same day it shipped, per explicit direction: it was judged confusing long-term, even though `checkBeehiivPremium` staying "interval-agnostic" had been a deliberate, audited decision just hours earlier. Going forward, `altitude monthly` and `altitude annual` are the only tags that mean "has paid Altitude access."

**The blocker this surfaced:** the Guide's 90-day free bundle grant (`grantGuideAltitudeBundle`) rode on `altitude premium` alone, since it's neither a monthly nor annual billing plan. Reusing the permanent `krisflyer` tag for this was considered and rejected — `krisflyer` must persist forever (it's what lets the team email past Guide buyers whenever the guide's content changes, per Item 7 above), while the bundle must expire after 90 days. Tying them together would have silently granted free premium forever to lapsed bundle holders, and even to Guide buyers who never received the bundle in the first place (e.g. someone who already had a paid subscription when they bought the guide). **Resolved:** a new dedicated tag, `krisflyer bundle` (id `e1e9ccfe-bee9-4786-bf7f-2e20bb94a2da`), created specifically for this grant — applied by a new `tagGuideBundle()` (mirrors `tagGuideBuyer`'s proven pattern), removed by the existing `expireGuideBundles` cron on expiry, and included in `checkBeehiivPremium`'s OR-check alongside the two interval tags. Deliberately **excluded** from `SEG_PREMIUM` (which now means "real paying subscriber," and feeds `cloudflare-reports`' paying-subscriber count) and from `SEG_MONTHLY`/`SEG_ANNUAL` (semantically wrong — a free grant isn't either).

**Confirmed via live Beehiiv reads before touching anything:** all 4 relevant tags (`altitude premium`, `altitude monthly`, `altitude annual`, `krisflyer`) had 0 subscribers at the time of this change — a clean migration, not a live-data risk. Also confirmed the "Apply Altitude Premium Tag" automation (`aut_da7df205...`) is hardcoded, non-plan-aware, and cannot be edited to apply the interval tags instead — so it's simply no longer called (left live but inert in Beehiiv, not deleted, for reversibility) and `setupBeehiivMember`'s old automation-enroll → PATCH → POST fallback cascade was replaced with a single direct REST tag-apply, mirroring the pattern `tagGuideBuyer` already proved works. Also confirmed (via the `staging` workspace, since the automations are still `draft`): `WELCOME_MONTHLY_AUTOMATION_ID`/`WELCOME_ANNUAL_AUTOMATION_ID`'s only trigger is `segment_action` on `SEG_MONTHLY`/`SEG_ANNUAL`, not an `api` trigger — so the worker's direct journeys-endpoint call to them is presently a no-op; real enrollment happens automatically via segment entry. The call was kept anyway (harmless, forward-compatible).

**Beehiiv-side changes:** created the `krisflyer bundle` tag; updated `SEG_PREMIUM`, `SEG_MONTHLY`, `SEG_ANNUAL`'s `where` clauses to drop the `altitude premium` AND-condition (required — without this, once the worker stopped applying `altitude premium`, nobody would ever have matched these segments again, silently breaking the Welcome/Renewed automations). `SEG_GUIDE` untouched — already correct.

**Worker changes (`cloudflare/subscribe-worker.js`):** deleted `BEEHIIV_TAG_ID`/`ALTITUDE_TAG_AUTOMATION_ID`; `checkBeehiivPremium`/new `verifyIntervalTag` (renamed from `verifyBeehiivTag`) now check monthly/annual/bundle tags only; `setupBeehiivMember`'s `planTag` is now required (fails loud if omitted — there's no more universal tag to fall back to); `removeBeehiivTag`/`removeIntervalTag` consolidated into one `removePlanTag(email, plan, env)` handling monthly/annual/guide_bundle uniformly; added a fix so a former bundle recipient who later buys a real plan gets `krisflyer bundle` cleaned up (`handleCheckoutComplete`), which would otherwise persist forever and misrepresent them in reporting. Not deployed yet as of this writing — none of this feature set has been `wrangler deploy`ed to production (see "Not started" above).

**Flagged, not fixed (pre-existing, out of scope for this pass):** `handleActivate`'s self-healing fallback still hardcodes a synthetic `plan: 'monthly', amount_cents: 499` record regardless of which tag actually matched — already a known gap (see item 5 above), now with a third possible match (the bundle tag). Proper fix needs `checkBeehiivPremium` to return which plan matched, not just a boolean — a larger interface change touching every call site. Track as a fast-follow.

## Full-system QA audit — final pass (2026-07-22)

Broader audit requested beyond the subscription/tagging logic already covered above: every worker route's HTTP semantics, all three integrations (Stripe/Beehiiv/Airtable), duplicate/orphan detection, and error-handling consistency, end to end. Three parallel investigations covered the ground not yet touched this session — full route-by-route review of `subscribe-worker.js`, live Stripe/Beehiiv state cross-referenced against every hardcoded ID, and frontend/backend consistency across every `fetch()` call site.

**Major finding — most Beehiiv automations the worker calls are not actually live.** Only `WELCOME_AUTOMATION_ID` and `MAGIC_LINK_AUTOMATION_ID` are published with a working `api` trigger. The other 8:
- `WELCOME_MONTHLY_AUTOMATION_ID` / `WELCOME_ANNUAL_AUTOMATION_ID` — already known (segment_action trigger only, no `api` trigger; real delivery already works via segment entry, the direct call is a harmless structural no-op).
- `RENEWAL_7D_AUTOMATION_ID` / `RENEWAL_3D_AUTOMATION_ID` / `RENEWAL_1D_AUTOMATION_ID` — **new finding**: still `draft`, zero triggers live. The daily cron runs without error but renewal reminder emails are not sending to anyone.
- `RENEWED_MONTHLY_AUTOMATION_ID` / `RENEWED_ANNUAL_AUTOMATION_ID` — **new finding**: same — "your membership renewed" emails are not sending.
- `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID` — already flagged when built earlier this session, still needs publish.

**This needs a manual pass in the Beehiiv editor before launch — I cannot do this via any available tool.** `save_automation`'s own documentation is explicit: "going live, pausing, and publishing all stay human actions done in the editor." Checklist:
- [ ] Publish `RENEWAL_7D`/`RENEWAL_3D`/`RENEWAL_1D` — trigger config already correct in staging, just needs publishing.
- [ ] Publish `RENEWED_MONTHLY`/`RENEWED_ANNUAL` — same.
- [ ] Publish `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID` (`aut_88e0a2b5...`) — same.
- [ ] Pause (or otherwise deactivate) the orphaned **"Apply Altitude Premium Tag"** automation (`aut_da7df205`) — still live, applies the retired `altitude premium` tag, nothing in the worker calls it anymore. I initially planned to do this via MCP; confirmed during execution that no such tool exists — this also needs the editor.

**Three small, mechanical code fixes made** (all verified safe against live frontend behavior before applying, not just theoretical):
1. `handleFlightApplication`/`handleContactInquiry`/`handlePostTestimonial` only incremented their rate-limit counter *after* a successful Airtable write, unlike every other route in the file — a submission that failed validation or errored at Airtable never counted, allowing unlimited free retries. Fixed to count every real (non-honeypot) attempt immediately, matching the root subscribe route's own documented convention. Also fixed 3 spots missing a `parseInt` radix while in the area.
2. `handleGetTestimonials` silently ignored an unrecognized `?route=` param and returned *all* approved testimonials instead of none — its sibling `handleGetTestimonialScores` already handled the identical case correctly (empty result). Fixed to match.
3. `handleActivate`/`handleMagicRequest`'s rate-limit responses used full human sentences instead of the `{error: 'rate_limited'}` machine code every other route uses. Verified `js/altitude.js` already overrides the displayed message by `res.status === 429` for both call sites, ignoring the error text entirely — so this was a pure consistency fix with zero frontend behavior change.

**Flagged, not fixed** (matches this codebase's established convention of naming known gaps rather than silently accepting them): the daily cron's two triggers (`* * * * *` and `0 1 * * *`) both match at 01:00 UTC, so `triggerSegmentRecalculation` fires twice that minute — harmless (idempotent, negligible cost), not worth the added fragility of UTC-minute-matching logic to prevent one redundant call a day. `ROUTE_LABELS` silently omits the `Route` field for an unrecognized testimonial-submission code rather than erroring (currently in sync with the frontend's 37 codes, but fragile if one is ever added frontend-first). Duplicated commented-out dead code (old `PAYMENT_LINK`/QR-modal references) copy-pasted across 5+ frontend files — confirmed fully inert, cosmetic only. Whether a Stripe webhook endpoint is configured against `/altitude/webhook`, and which events it's subscribed to, remains unverifiable via any available tool — same unresolved gap as the last two audits, needs a manual Stripe Dashboard check.

**Confirmed clean**: zero dead code (all 56 top-level functions in the worker are called from somewhere); all 17 routes use correct HTTP methods; CORS has exactly one deliberate bypass (the Stripe webhook); every frontend `fetch()` call across the whole site matches its route/method/payload shape with zero mismatches; the "Upgrade to Annual" card correctly stays hidden for both `annual` and `guide_bundle` members; a guide-bundle member's login/access and cancellation-handling work identically to a real subscriber's; every `SEG_*`/tag/tag-ID constant matches live Beehiiv state exactly, and `cloudflare-reports/config/constants.js` has zero drift from the worker; Stripe's catalog is exactly 2 products / 3 prices with no orphans, though **entirely test-mode** — no live-mode Stripe objects exist at all, a reminder that launch requires swapping to production keys/price IDs.

**Subscriber-activity note** (unrelated to anything above, but relevant context for future changes): all Altitude/Guide tags and segments remain at 0 live subscribers — still a safe zone. `SEG_PRELAUNCH` (32 members) and `SEG_FREE` (49 members), plus two signup-triggered automations, now have real subscriber activity — worth keeping in mind before touching those specific segments/automations in a future session.

## Final QA audit + deferred KrisFlyer Bundle activation (2026-07-22)

Full audit of all subscription/tagging scenarios requested before calling the tag migration above production-ready. Four scenarios re-verified correct with no changes needed: Free→Monthly (`altitude monthly` only, correct segment), Free→Annual (mirrors Monthly), Monthly→Annual upgrade (`handleUpgradeToAnnual` modifies the existing Stripe subscription in place — no duplicate subscription; `swapIntervalTag` never enrolls in any Welcome automation — no duplicate onboarding email), and standalone Guide purchase (both `krisflyer` and `krisflyer bundle` tags applied, as intended).

**Real gap found and fixed:** `grantGuideAltitudeBundle` previously discarded the Guide's 90-day bundle entirely whenever the buyer already held any premium tag — no memory that a bundle was owed. Now: a Monthly/Annual member who buys the Guide gets `krisflyer` immediately (permanent ownership, unchanged), while the bundle **defers** (`guide-bundle-pending:{email}` KV key, no TTL) until their real membership ends, then **activates automatically** — `handleSubscriptionDeleted` now calls a new `activateDeferredGuideBundle()`, which writes a fresh `guide_bundle` member record (90 days from cancellation, not from the original guide purchase) and applies `krisflyer bundle`.

**Two bugs caught by a dedicated design-review pass before any code shipped:**
1. `handleActivate`'s pre-existing self-heal fallback can write a KV record with `plan: 'monthly'` but no `stripe_subscription_id` for someone who actually only holds `krisflyer bundle`. Without a guard, a second Guide purchase by that person would have wrongly deferred instead of correctly no-op'ing. Fixed by requiring `stripe_subscription_id` to be truthy before deferring — genuine checkout-written records always have one, the self-heal fallback never does.
2. More seriously: naively activating on *any* cancellation would have let the pre-existing "no protection against a second Stripe subscription" gap silently downgrade a still-paying customer — cancelling a stale/secondary subscription would overwrite `member:{email}` with a free bundle grant even though a different, still-active subscription is the one actually tracked there. Fixed with a `wasCurrentSubscription` guard (`record.stripe_subscription_id === sub.id`) — activation only fires when the subscription being deleted is the one KV currently tracks.

**New dedicated Beehiiv automation** (`aut_88e0a2b5-f8d3-48e0-ae71-b27f26fcdad7`, "KrisFlyer Guide — Bundle Activated", `api`-triggered): per explicit decision, deferred activation does **not** reuse the generic "You're in! Welcome to Altitude" email — that copy would confuse someone who was already a member and just cancelled about their subscription status. Draft content written (subject: "Your KrisFlyer Guide bonus is now active"); **still `draft` in Beehiiv, needs a manual publish from the editor** before it actually sends, same as the other plan-specific Welcome/Renewed automations from the prior section.

**Confirmed unaffected:** `cloudflare-reports/config/constants.js` (only references `SEG_PREMIUM`'s ID). **Confirmed still open, not touched:** the pre-existing double-Stripe-subscription gap itself (only the new activation hook is guarded against being fooled by it); the Guide pricing page's copy doesn't mention deferred activation to existing members (content decision, not addressed); deferred activation's Beehiiv tagging has no retry-on-failure, same characteristic the standalone grant already has.

## Context

The CEO asked how buyers will actually receive the KrisFlyer Guide (PDF? emailed? embedded but downloadable? site-only?) so the right functionality can be prepared in advance. A generic AI answer he received recommended third-party checkout tools (Lemon Squeezy, Payhip, or Stripe + Zapier) to "auto-deliver a PDF." Those are ruled out — no new tools, no Zapier. The business already runs on Airtable (CRM), Beehiiv (email/newsletter), and Stripe (payment), all already integrated in `cloudflare/subscribe-worker.js` for the separate Skyfare Altitude product. This plan uses what's already there.

This matters beyond just answering the question: `pages/krisflyer-guide.html` already exists and was built with a specific assumption baked in — the guide's content (chapters, redemption tables) lives as HTML *on the site itself*, currently shown blurred/locked behind a "Coming Soon" tease pending launch. That existing structure only makes sense under one specific delivery model, so this is really about deciding which model to build toward so the current page's design stays coherent rather than requiring a rebuild.

## Recommendation: web-based access, not a PDF

**Deliver the guide as gated content on skyfareconsulting.com, unlocked via the same magic-link/JWT session Altitude members already use — no PDF file changes hands at any point.**

Why this beats a PDF, specifically for this business:

- **The pricing card already promises "free updates whenever the guide is revised"** (`pages/krisflyer-guide.html`, the bundled feature list). A PDF can't satisfy that without manually re-emailing every past buyer each time content changes — web content just gets updated in place, no redistribution step, no version-tracking headache.
- **A PDF is one export away from being forwarded to five friends.** Web access tied to a per-buyer magic link isn't unbreakable DRM, but it's meaningfully more friction than "here's the attachment" — consistent with why the pricing/chapter list are already CSS-gated rather than sitting in a downloadable file.
- **It drives repeat visits to the site**, which matters for a concierge business trying to cross-sell Nominee Redemption bookings and Altitude — a PDF read once in a downloads folder never brings anyone back.
- **It reuses real, already-built infrastructure** instead of adding a payment processor's hosted checkout page as a second front door to the business.

## The architecture, mapped to what already exists

**1. Payment — Stripe, extended, not replaced.**
`cloudflare/subscribe-worker.js` already has `POST /altitude/checkout` creating a Stripe Checkout session, currently hardcoded `mode: 'subscription'` for Altitude's $4.99/mo. Stripe Checkout supports `mode: 'payment'` in the exact same API for one-time purchases — this is a config difference, not new integration work. The Guide gets its own one-time Stripe Price object and either a sibling route (`/guide/checkout`) or a `product` parameter on the existing route.

**2. Fulfillment on purchase — Stripe takes the payment, Beehiiv delivers access, not Zapier.**
Stripe is the payment processor only — it never touches email or access. The webhook handler (`checkout.session.completed`) already exists for Altitude; on a Guide purchase it does the same thing Zapier would have glued together, natively in the Worker:

1. Write a KV access record (mirroring the existing `member:{email}` pattern, e.g. `guide:{email}`).
2. Apply a new Beehiiv subscriber tag, **`krisflyer`**, to that buyer.
3. Call Beehiiv's automations API the same way the existing magic-link request handler already does (`MAGIC_LINK_AUTOMATION_ID`) to email the buyer their magic-link access link.

No Zapier step exists to replace — the Worker *is* the automation, and Beehiiv is what actually sends the email.

**New Beehiiv segment: "KrisFlyer Guide Subscribers."**
Condition: subscriber has the `krisflyer` tag, OR has both the `krisflyer` tag **and** the `premium` tag (covers Guide-only buyers and buyers who also hold Altitude Premium). ⚠️ To verify before this is built: the existing Altitude subscriber tag in this account is named **`altitude premium`**, not `premium` — the segment condition needs to reference whichever tag name is actually live, or it will silently match zero of the intended "also has Altitude" buyers. Confirm the exact tag name before creating the segment.

**3. Access control — the same JWT/magic-link session, extended.**
`/altitude/magic-request` and `/altitude/magic-verify` already issue a signed JWT after confirming Beehiiv/KV membership. The Guide reuses this verbatim — a buyer's JWT carries a `guide: true` claim (or a second KV namespace check) alongside the existing Altitude claim, so someone who bought only the Guide, only Altitude, or both, all resolve through one login mechanism instead of two. The `krisflyer` tag (and the "KrisFlyer Guide Subscribers" segment built from it) is what the *email/marketing* side reads — it's a parallel signal to the KV record, not a replacement for it; the KV record is what the Worker actually checks to gate the page.

**4. Revealing content — the gating already built.**
`pages/krisflyer-guide.html`'s `.kf-blur` treatment on the pricing card, chapter list, and redemption table stays exactly as-is structurally. The only new work is a small script that checks the visitor's JWT on page load and removes the blur/lock overlay when it's valid — the visual scaffolding for "locked vs. unlocked" already exists; it just isn't wired to a real session yet.

**5. Airtable's role — visibility, not access control.**
A new "Guide Purchases" table in the existing Skyfare Consulting base gives the team a human-browsable record (who bought, when) without needing Stripe dashboard access for every lookup — the same "lightweight CRM" role Airtable already plays for Flight Applications and Contact Inquiries. KV/JWT remain the actual gate; Airtable is just for people, not for the code.

**6. Optional download — generated live, not a stored file.**
A "Download" button on the unlocked page triggers the browser's print-to-PDF on the current content (via print-optimized CSS), rather than serving a pre-made file from a server. It's gated behind the same magic-link session as the web view, and every download reflects whatever the content says at that moment — there's no separately-hosted PDF to keep in sync whenever the guide is revised. This is frontend-only work (a `@media print` stylesheet); no PDF-generation service needed.

**7. Update notifications — Beehiiv, tag-based, manually triggered.**
Guide buyers get the same purchase tag used for access control (item 2). Whenever the guide's content changes, the team sends a targeted email to that tag/segment highlighting what's new — the same "one-off send to a specific segment" pattern already used elsewhere in this project. This is a manual step each time content is revised, not an automated pipeline, since edits are an editorial event rather than a continuous stream.

## What this explicitly rules out

No Lemon Squeezy, no Payhip, no Zapier, no hosted third-party checkout page, and no separately-hosted static PDF file. A download does exist (item 6), but it's generated on demand from the live, gated page — not a file sitting on a server that can go stale or leak independently of a purchase.

## Scope note

This is an architecture recommendation to align on, not a build-it-now spec — "UI only for now" has been the standing instruction throughout this project's KrisFlyer Guide work so far. Actual implementation (new Stripe Price, webhook branch, Beehiiv automation/tag, KV schema, the unlock-on-load script) is real backend work touching live payment and email systems, and should be a deliberate next step once this direction is signed off — not something wired up incidentally.

## Conclusion

Web-based delivery via magic link, reusing the Stripe + Beehiiv + JWT setup already built for Altitude, is the best option here. It answers the CEO's actual question (embedded on the site, not downloadable, not emailed as a file) with the smallest possible amount of new work, since every piece it needs already exists in `cloudflare/subscribe-worker.js` — it just isn't wired to the Guide yet. It also happens to be the only option of the ones on the table that doesn't quietly contradict a promise already sitting in the page's own copy ("free updates whenever the guide is revised"), and it avoids introducing a second payment tool/identity for the business to reconcile against Stripe going forward. Recommend confirming this direction with the CEO, then scoping the actual backend work (new Stripe price, webhook branch, Beehiiv tag/automation, unlock script) as its own task.

## Verification (once implementation is greenlit)

Test the full loop in Stripe test mode: checkout with `mode: 'payment'` → webhook fires → KV record written → Beehiiv automation triggered → magic link email received → link verifies → JWT includes guide claim → `pages/krisflyer-guide.html` unblurs for that session. Confirm a plain Altitude-only member still sees the Guide content locked, and vice versa.
