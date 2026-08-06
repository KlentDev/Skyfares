# Email Automation Consolidation Design

Date: 2026-08-06

## Objective

Every transactional/lifecycle email (Welcome, subscription confirmations,
upgrade confirmations, purchase confirmations) should be triggered by exactly
one consistent mechanism, fire exactly once per lifecycle event, and arrive
immediately — no automation should depend on segment-recalculation timing to
decide whether or when a user gets emailed. This removes a confirmed duplicate
email, a confirmed dead automation, and closes a class of "arrives up to 24h
late" bugs introduced as a side effect of this session's earlier
segment-recalculation cost optimization.

## Current Architecture Reviewed

Relevant Worker modules:

- `cloudflare/services/beehiiv.js`
- `cloudflare/orchestration/stripeWebhook.js`
- `cloudflare/orchestration/session.js`
- `cloudflare/orchestration/guideBundle.js`
- `cloudflare/orchestration/calcomWebhook.js`
- `cloudflare/config/constants.js`
- `cloudflare/worker.js` (daily cron → `triggerSegmentRecalculation(env, { all: true })`)

## Audit Findings

Confirmed by reading the live Worker code and the live Beehiiv automation
configs (`list_automations`) together — the code alone reads as correct in
several of these spots; only cross-checking against Beehiiv's actual trigger
config and enrollment stats revealed the real behavior.

1. **Dead automation.** `WELCOME_AUTOMATION_ID` (`aut_ed8a12c4-…`) no longer
   exists in Beehiiv (`Resource not found`). It's only reached from
   `tagGuideBundle`'s no-`activationAutomationId` branch — used when a Guide
   buyer gets their free 90-day Altitude bundle granted. That "you got a bonus
   90 days" notification has been silently failing for every such buyer.

2. **Confirmed duplicate: Monthly → Annual upgrade.** `swapIntervalTag` (the
   upgrade path) calls `triggerSegmentRecalculation(env)` with no `{ all:
   true }`, so `SEG_ANNUAL` — moved to the "paused" (daily-cron-only) tier
   during the 2026-08-04 cron optimization — doesn't get recalculated until
   the next daily cron, up to 24h later. Separately, the upgrade path
   immediately, directly enrolls the user in `UPGRADED_ANNUAL_AUTOMATION_ID`
   ("You're officially on Altitude Annual! 🎉"). When the delayed cron
   eventually recalculates `SEG_ANNUAL`, the subscriber enters it for the
   first time, and its `segment_action` trigger fires `WELCOME_ANNUAL_AUTOMATION_ID`
   ("You're in. Welcome to Altitude.") — wrong copy for an upgrader, arriving
   up to a day after the real "you're upgraded" email. Two emails, one event.

3. **Confirmed delay (not a duplicate, but a regression): Welcome
   Monthly/Annual and Guide Purchase Confirmation.** `WELCOME_MONTHLY_AUTOMATION_ID`,
   `WELCOME_ANNUAL_AUTOMATION_ID`, and the (currently Worker-unreferenced)
   "KrisFlyer Guide — Purchase Confirmation" automation are all `live`,
   `segment_action`-only, and firing real emails — a stale code comment in
   `constants.js` claims they're still `draft`/no-ops; they aren't. But
   because `SEG_MONTHLY`/`SEG_ANNUAL`/`SEG_GUIDE` are all in the "paused"
   tier, these confirmation emails now arrive up to 24h after the purchase
   instead of immediately.

4. **Working correctly, different mechanism.** Travel Strategy Call
   ("Book a Call") and the three Magic Link automations already use direct
   `POST /automations/{id}/journeys` enrollment tied to the exact code path
   that owns the event, and their segments (`SEG_TRAVEL_STRAT_CALL`) stayed
   in the real-time tier — so they already fire immediately, once. This is
   the pattern to standardize the rest on.

5. **Not a duplicate.** The generic "Welcome to Skyfare Altitude"
   (`aut_632376e1`, Beehiiv-native `signup` trigger, no Worker involvement)
   does not refire when a free subscriber later upgrades to Monthly/Annual —
   `reactivate_existing` doesn't replay the `signup` event. Confirmed correct,
   no change needed.

## Recommended Architecture

**One rule, applied everywhere:** every transactional automation is triggered
by a direct API enrollment call from the exact Worker code path that owns
that lifecycle event. Segments are never a trigger source for these emails —
they stay pure CRM/reporting, free to run on the once-daily cron without any
email-timing side effect.

Concretely: for each of the four automations that currently rely (fully or
partially) on `segment_action`, remove `segment_action` from their Beehiiv
trigger config and rely solely on `api`. Standardize `enrolment_type` to
`unlimited` on all of them, moving the "did this already send" guarantee out
of Beehiiv's one-time-slot mechanism (already the root cause of two separate
bugs this session — the Travel Strategy Call `limited` block, and this
session's confirmed Welcome Monthly/Annual/Guide-Confirmation delays) and
into an explicit KV idempotency check in the Worker, mirroring the pattern
`GUIDE_MAGIC_SENT` already uses for the Guide magic link.

| Automation | Trigger today | Trigger after | Enrolment type after | Fires from |
|---|---|---|---|---|
| Welcome (Monthly) `aut_d710e39c` | `segment_action` | `api` only | `unlimited` | `setupBeehiivMember` (unchanged call site) |
| Welcome (Annual) `aut_5dbf5c22` | `segment_action` | `api` only | `unlimited` | `setupBeehiivMember` (unchanged call site) |
| KrisFlyer Guide — Purchase Confirmation `aut_89052bc6` | `segment_action` | `api` only | `unlimited` | new call in `handleGuideCheckoutComplete` |
| Travel Strategy Call — Booking Confirmation `aut_14deb6a2` | `segment_action` + `api` | `api` only | `unlimited` (already) | `sendAssessmentBookingEmail` (unchanged call site) |

Not touched (already correct, out of scope — see below): generic Welcome
(`aut_632376e1`), Pre-Launch Welcome, both Magic Link automations,
Upgraded-to-Annual, Guide Bundle Activated.

### Why Welcome Monthly/Annual don't need a new KV idempotency key

`setupBeehiivMember` already has a "is the interval tag already present"
check (Step 2) that short-circuits before re-tagging or re-enrolling if the
plan tag is already applied — this already prevents a retry of the same
checkout event (webhook redelivery, or the `beehiiv_tagged === false` retry
path in `session.js`) from double-sending. No new guard needed there; moving
the trigger to `api` just makes that existing, already-idempotent call path
the one that actually sends the email.

### Why the Annual-upgrade duplicate disappears with no extra code

`swapIntervalTag` (the upgrade path) never calls `enrollWelcomeAutomation`
directly — it only re-tags and recalculates segments. Once Welcome (Annual)
stops listening for `segment_action`, the delayed segment recalculation
simply has nothing left to trigger. Only the upgrade path's explicit
`UPGRADED_ANNUAL_AUTOMATION_ID` call fires on upgrade; Welcome (Annual) only
fires from a genuine new-Annual-signup going through `setupBeehiivMember`.

### Guide bundle bonus notification

Rather than replace the dead `WELCOME_AUTOMATION_ID` with a new dedicated
automation, remove the call entirely. `tagGuideBundle`'s no-`activationAutomationId`
branch (the *immediate* 90-day grant, given to a first-time Guide-only buyer)
stops attempting any email of its own — the bonus access gets mentioned in
the copy of the Purchase Confirmation email every Guide buyer already
receives (a Beehiiv content edit, not a code change). `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID`
stays exactly as-is, reserved for the one case it actually needs a dedicated,
differently-worded email: a former paying member's *deferred* bundle
activating once their real subscription ends.

## Code Changes

`cloudflare/config/constants.js`:
- Remove `WELCOME_AUTOMATION_ID` (dead, no longer referenced anywhere after
  the `tagGuideBundle` change below).
- Add `GUIDE_CONFIRMATION_AUTOMATION_ID = 'aut_89052bc6-a52f-4930-bd76-eed6c257f951'`
  (not previously in this file — it only fired via `segment_action`, so the
  Worker never needed to reference it directly until now).
- Add two `KV_PREFIX` entries: `GUIDE_CONFIRMATION_SENT: 'guide-confirmation-sent:'`,
  `ASSESSMENT_CONFIRMATION_SENT: 'assessment-confirmation-sent:'`.
- Replace the stale "still `draft` … harmless no-op" comment above
  `WELCOME_MONTHLY_AUTOMATION_ID`/`WELCOME_ANNUAL_AUTOMATION_ID` — both are
  live and, after this change, `api`-triggered for real.

`cloudflare/services/beehiiv.js`:
- `enrollWelcomeAutomation(email, env, planTag)`: drop the no-`planTag`
  fallback branch; require `monthly`/`annual`, log and return early otherwise
  (mirrors `setupBeehiivMember`'s own existing guard at line 271-275).
- `tagGuideBundle`: remove the `else { enrollWelcomeAutomation(email, env) }`
  branch — when no `activationAutomationId` is passed, tag and recalculate
  only, no automation enrollment.

`cloudflare/orchestration/stripeWebhook.js`:
- `handleGuideCheckoutComplete`: after the existing `tagGuideBuyer` call, add
  a new guarded call enrolling the buyer in `GUIDE_CONFIRMATION_AUTOMATION_ID`,
  keyed on `KV_PREFIX.GUIDE_CONFIRMATION_SENT + session.id`, same
  check-before-work/write-on-success/7-day-TTL shape as the existing
  `magicSentKey` guard three lines below it.
- `handleAssessmentCheckoutComplete`: wrap the existing `sendAssessmentBookingEmail`
  call in the same guard shape, keyed on `KV_PREFIX.ASSESSMENT_CONFIRMATION_SENT + session.id`.
  (Not needed for correctness today — `SEG_TRAVEL_STRAT_CALL`'s real-time
  recalculation plus `segment_action` has been working — but once
  `segment_action` is removed from this automation's trigger config, the
  direct `api` call becomes the sole path, and Stripe's webhook redelivery
  becomes a real double-send vector that needs the same guard every other
  direct-enrollment call site already has.)

## Beehiiv-Side Changes (manual — outside this Worker's code)

The Beehiiv MCP connection dropped mid-session; these four automations need
their trigger config edited directly in Beehiiv (dashboard or MCP once
reconnected), matching the table above:

1. Welcome (Monthly) — remove `segment_action` trigger, confirm/add `api`,
   set `enrolment_type: unlimited`.
2. Welcome (Annual) — same.
3. KrisFlyer Guide — Purchase Confirmation — same.
4. Travel Strategy Call — Booking Confirmation — remove `segment_action`
   trigger only (already `api` + `unlimited`).

## Resulting Email Count Per Scenario

- **Free signup:** 1 email (generic Welcome). Unchanged.
- **Free → Monthly:** 2 emails (Starter Magic Link, immediate; Welcome
  Monthly, now immediate instead of delayed). Generic Welcome does not refire.
- **Monthly → Annual upgrade:** 1 email (Upgraded to Annual). Welcome Annual
  no longer fires — duplicate eliminated.
- **Guide purchase:** 2 emails (Magic Link, immediate; Purchase Confirmation,
  now immediate instead of delayed). The previously-broken bonus-bundle email
  is removed rather than fixed — its message folds into the Purchase
  Confirmation copy instead (content edit, not in scope here).
- **Book a Call:** 1 email (Booking Confirmation), unchanged — was already
  correct.

## Edge Cases

- Webhook redelivery for any of the four direct-enrollment call sites: caught
  by the new/existing per-session KV guard — second delivery finds the key
  already set and skips the send, same as `GUIDE_MAGIC_SENT` today.
- A genuinely new purchase months after a prior one for the same email
  (e.g., cancel Monthly, resubscribe to Monthly a year later): the KV guards
  are all session-id-keyed with 7-day TTLs, and `setupBeehiivMember`'s
  tag-presence check only short-circuits while the tag is still applied — a
  real new subscription event still sends its Welcome/Confirmation email, as
  it should.
- A Guide buyer who is already a paying Monthly/Annual member (bundle grant
  deferred, not immediate): no bonus-bundle email was ever intended for this
  path either (see `GUIDE_BUNDLE_ACTIVATED_AUTOMATION_ID`'s own scoping) — no
  change in behavior, still silent until the deferred activation actually
  happens later.
- `enrollWelcomeAutomation` called with no `planTag` after this change (should
  no longer happen once `tagGuideBundle`'s fallback branch is removed): logs
  and no-ops rather than silently hitting a dead ID again.

## Testing Plan

Manual, against the live Worker + Beehiiv, mirroring this session's existing
verification pattern (code read + `get_automation`/`list_automation_journeys`
cross-check) once the Beehiiv MCP connection is back:

- Free signup → confirm only generic Welcome sends.
- Free → Monthly checkout → confirm Starter Magic Link and Welcome Monthly
  both arrive within seconds, not up to 24h; confirm generic Welcome does not
  resend.
- Monthly → Annual scheduled upgrade takes effect → confirm only Upgraded-to-
  Annual sends; confirm Welcome Annual does not fire, including after the
  next daily cron runs.
- Guide purchase (fresh buyer, not already premium) → confirm Magic Link and
  Purchase Confirmation both arrive immediately; confirm no bonus-bundle send
  is attempted (no more dead-automation error in logs).
- Guide purchase by an existing Monthly/Annual member → confirm bundle grant
  is deferred silently, no email attempt logged.
- Book a Call purchase → confirm Booking Confirmation still arrives
  immediately (regression check — this one was already correct).
- Replay each Stripe webhook event a second time (simulating redelivery) →
  confirm no automation sends twice.

## Out of Scope

- Pre-Launch Welcome (`aut_d3ce27b7`) and the generic signup-triggered Welcome
  (`aut_632376e1`) — both already fire correctly today (real-time segment /
  native `signup` trigger) and weren't part of the three reported scenarios;
  changing a currently-healthy automation's trigger config isn't worth the
  risk without a specific problem to fix.
- All `draft` automations (Renewal reminders, Renewed Monthly/Annual, Free
  Subscriber Upgrade Journey) — per explicit instruction, left untouched.
- Rewriting any automation's email copy/content in Beehiiv (including folding
  the bonus-bundle message into the Purchase Confirmation email) — a content
  edit for the user to make directly, not a code or automation-config change.
- The Airtable/WhatsApp admin-notification step for Travel Strategy Call
  bookings — already a known, deferred future feature per `trav-start-call.md`,
  unrelated to this consolidation.
- Changing the daily-cron segment recalculation cadence itself — this design
  deliberately keeps that cost optimization intact by removing email delivery's
  dependency on it, rather than reverting it.
