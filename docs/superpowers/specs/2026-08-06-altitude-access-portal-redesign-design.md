# Altitude Access Portal Redesign

Date: 2026-08-06

## Objective

`pages/private-pages/altitude-access-portal.html` is the JWT-gated dashboard
members land on after logging into Altitude. Today it covers only three
things: a hero/status summary, a conditional "Upgrade to Annual" card, and
an issue archive. It's missing the things a real membership portal needs: a
proper pricing/plans view, a reminder of what the membership actually
includes, a way to reach support without leaving the page, and any
FAQ/updates content. The goal is to turn it into a complete, professional
member dashboard — reusing the site's existing design system, existing
auth/verify flow, and existing content (the homepage pricing card, the
`/pages/altitude` comparison table, `pages/contact.html`'s form) — without
duplicating CTAs, breaking authentication, or overcrowding the page.

Four scope decisions were confirmed with the user up front:

- The new Membership Plans section replaces the existing standalone
  "Upgrade to Annual" card (one unified section, not two).
- Announcements has no CMS — ship a simple hand-edited static panel.
- FAQ — write new Altitude-specific copy (none exists anywhere in the
  codebase today).
- Support is triggered from a card inside the portal body, not a header
  icon.

## Current Architecture Reviewed

Verified against the live codebase (2026-08-06):

- `pages/private-pages/altitude-access-portal.html:77` — `#alt-upgrade-section`,
  confirmed present, matches the doc's described replacement target.
- `js/altitude-portal.js:188` — `PLAN_LABELS` maps `guide`, but the Worker
  returns `member.plan === 'guide_bundle'` — confirmed real, one-token
  display-lookup bug.
- `js/altitude-portal.js:119,228` — `handleManageMembership()` references
  `#alt-manage-btn`, which does not exist in the HTML today — confirmed
  dead reference.
- `js/altitude-portal.js:122-123` — `_populateMembershipCard`/
  `updatePrivateChrome`, called from `verifyAndRender`, confirmed the point
  where the parsed `member` object becomes available.
- `js/altitude-portal.js:396` — existing `skyfare:private-user`
  `CustomEvent` dispatch, confirmed as the event-bus idiom to extend.
- `js/ui.js:73-139` — `modal()`, confirmed current Escape/backdrop-close
  behavior with no focus trap or initial focus.

## Final Page Structure

Dashboard flow: status → account → task → context → help.

1. `private-hero` — unchanged.
2. **NEW** Updates/Announcements panel — placed right after the hero,
   lightweight, static.
3. **Membership Plans section** — replaces `#alt-upgrade-section` entirely.
4. Issue library / archive — unchanged, keeps its current position as the
   primary return-visit task.
5. **NEW** Free vs. Altitude comparison (adapted) — reference content, after
   the "using it" section.
6. **NEW** Help & Support (Support card + FAQ grouped together) — end of
   page.
7. Footer — unchanged.

## Section Details

### A. Membership Plans

Replaces `#alt-upgrade-section` (`altitude-access-portal.html:77-121`).

Build on the portal's own established vocabulary (`.private-panel`,
`.private-badge`/`--gold`, `.private-action`/`--primary`,
`.private-check-list`, `.private-upgrade__price`) rather than importing the
homepage's tabbed `.card-pricing-v2` pattern — a member is already on a
plan, so two side-by-side cards is clearer than a Monthly/Annual toggle.
New section id `alt-plans-section`, new CSS class `.private-plans-grid`
(responsive 2-col) and `.private-plan-card` / `.private-plan-card--current`
(gold ring + "Current Plan" badge for the active plan).

Consumes the member object already parsed by `js/altitude-portal.js`'s
`verifyAndRender` → `_populateMembershipCard`/`updatePrivateChrome`
(`js/altitude-portal.js:122-123`) — no new fetch.

State table:

| `member.plan` | Monthly card | Annual card | CTA |
|---|---|---|---|
| `monthly` | Current + badge + Manage Billing button (`id="alt-manage-btn"` — finally gives the existing dead reference in `handleManageMembership()` a real element) | Price/savings/checklist (same $39.99 vs $55, "Save $15.01/year" copy as today) | "Upgrade to Annual" → existing unmodified `window.handleUpgradeToAnnual()` |
| `monthly` + `pending_plan==='annual'` | Current + note | "Scheduled" copy (reuse `#alt-upgrade-pending-card`'s text) | none |
| `monthly` + no `current_period_end` | Current | "Not available yet" copy (reuse `#alt-upgrade-unavailable-card`'s text) | disabled |
| `annual` | Informational only — no downgrade endpoint exists, so no CTA; note pointing to Support instead | Current + badge + Manage Billing | Manage Billing only |
| `guide_bundle` | 2-card grid replaced by a single "Access Source" explainer panel — one-time bundle purchase, no renewal/upgrade language | — | none |

Section stays hidden until real member data arrives (same convention as
today's `#alt-upgrade-section`).

### B. Free vs. Altitude comparison (adapted from `pages/altitude.html:302-580`)

Reuse the table markup (rows, `role="table"`/`"row"`/`"cell"`, check/minus
icons, mobile `sm:hidden` inline-label pattern) largely as-is — it's already
single-accent-compliant. Changes:

- Wrapper: dual-class `class="card-utility private-panel"` (the documented
  dual-class pattern from `design.md`).
- Keep `.eyebrow-chip-v2`/`--gold` column chips as-is (no portal-native
  equivalent worth inventing for two labels).
- Replace the hardcoded `style="background:#fefce8;color:#C9A227;"` inline
  style on the "Members Only" row icon with a proper gold token class,
  since this block is already being touched.
- Remove the "Join the Waitlist" CTA (`pages/altitude.html:573-577`) —
  replace with a plain text link (not a `.btn-pill`, to avoid a second CTA
  reading) into the Support modal: "Need something not listed? Contact
  support."
- Reframe the heading copy for members already inside the portal (not a
  sales pitch).
- Fully static, renders unconditionally (not gated on verify) since it's
  identical regardless of plan.

### C. Contact/Support modal

Template lives inline as `<template id="alt-support-form-template">` in the
Help & Support section — hand-editable HTML, read via `.innerHTML` at click
time, handed to `SkyUI.modal({ html })`. Not a fetched partial (avoid
replicating `magic-modal.js`'s singleton-fetch pattern for a one-off use).

Trigger: `#alt-support-open-btn` inside a slim `private-panel` "Support"
banner in the Help & Support section, wired via `addEventListener`, visible
immediately (not gated behind verify) — a member with a real problem
shouldn't be blocked from reaching support if verify is slow/erroring.

Email pre-fill: read `window.SkyfarePrivate.getUser().email` at click time
(self-corrects if verify resolves after page load); field stays editable;
blank if not yet available.

Fields/payload mirror `pages/contact.html`/`js/contact.js` exactly: name,
email, subject, message, honeypot `bot-field` (hidden, `tabindex="-1"`),
POST to `https://skyfares-altitude.klent-5fa.workers.dev/airtable/contact`
with the same JSON shape.

Submit flow via `SkyUI.modal`'s actions:
`[{label:'Cancel'}, {label:'Send Message', style:'primary', onClick: handleSubmit}]`
(`js/ui.js:73-139`): `handleSubmit` always returns `false` synchronously
(keeps modal open per `js/ui.js`'s documented `onClick()===false` behavior)
and:

- Client-side validates name/message non-empty + email regex; shows inline
  error, focuses first invalid field.
- Loading state: disable the button (`[data-sky-action="1"]`), label →
  "Sending…".
- Fetch; on `result.success` → inline success message +
  `SkyUI.toast(...)`, then `handle.close()` after ~900ms (long enough to
  read the confirmation). No confetti — feels excessive in a 440px dialog.
- On failure, map the Worker's documented error codes (`missing_fields`,
  `invalid_email`, `invalid_body`, `429 rate_limited`,
  `500 submission_failed`) to specific messages, generic fallback
  otherwise; re-enable button, keep modal open.

**Accessibility fix (scoped to the shared primitive):** `js/ui.js`'s
`modal()` (lines 73-139) currently has Escape-to-close and backdrop-close
but no focus trap or initial focus (confirmed — no such logic exists
between the `onKey`/`keydown` wiring at lines 121-139). Add: focus the
first focusable element in `.sky-modal__card` on open, trap Tab/Shift+Tab
within it, restore focus to the trigger element on close. This is a small
addition to the shared function since it's the first real multi-field form
used inside `SkyUI.modal` — benefits any future form-in-modal use, and must
be spot-checked against `js/kf-guide-portal.js`'s existing
`SkyUI.modal`/`SkyUI.confirm` calls on the Guide portal afterward so
nothing there regresses.

Mobile: rely on `.sky-modal__card`'s existing 440px max-width +
`@media (max-width:480px)` stacked-actions rule (`css/style.css:1559-1662`);
add any extra sizing as a new inner class scoped to the injected form, not
by editing `.sky-modal__card` itself.

### D. New JS file: `js/altitude-portal-extras.js`

Loaded after `js/altitude-portal.js`, keeps new logic out of the
auth-critical file entirely:

- Add one `CustomEvent('skyfare:altitude-member', {detail: member})`
  dispatch in `js/altitude-portal.js`, right alongside the existing
  `updatePrivateChrome`/`skyfare:private-user` dispatch
  (`js/altitude-portal.js:122-123, 396`) — reuses the existing event-bus
  idiom already used between this file and `private-layout.js`, so it's not
  a new architectural pattern.
- Extras file listens for `skyfare:altitude-member` to render the
  Membership Plans states, and self-initializes on `DOMContentLoaded` to
  wire the Support modal.
- FAQ and Updates panel need no JS (pure static HTML).
- **Bug fix included in scope:** `PLAN_LABELS` (`js/altitude-portal.js:188`)
  maps `guide` but the Worker actually returns
  `member.plan === 'guide_bundle'` — one-token fix, required for the
  `guide_bundle` Membership Plans state and the existing membership summary
  card to label correctly. Low risk (pure display lookup).

**Left out of scope (noted, not fixed):** `#private-member-plan`'s unused
header hook in `private-layout.js`/`header-private.html` — that partial is
shared with the Guide portal, so wiring it is a separate cross-portal
decision.

### E. FAQ (new copy, `pages/faq.html`'s accordion pattern)

New `#alt-faq-section` inside Help & Support, reusing
`<details class="faq-item-light group"><summary>...<span class="faq-indicator">...</span></summary><div class="accordion-body">...</div></details>`
verbatim (already generic/page-agnostic). 5 new Q&As: updating payment
method (→ Manage Billing), cancel-anytime framing, what happens to access
after cancellation (continues until `current_period_end`), why a KrisFlyer
Guide buyer sees Altitude access (ties to the `guide_bundle` panel),
general access-trouble troubleshooting (→ Support). Static, no JS.

### F. Updates/Announcements panel

`private-panel private-updates` block after the hero. New
`.private-updates` CSS class for a simple stacked date+title+blurb list,
reusing `.private-badge` for a "New" tag on the latest entry and existing
`.private-summary__label`/`.private-summary__note` typography rather than
new tokens. 2-3 realistically-dated placeholder entries, plus an HTML
comment explaining the manual-edit convention (copy a block, edit
date/title/body, cap at ~4 entries, drop the oldest when adding new).
Static, no JS.

### G. Help & Support section (grouping)

One `.private-section` holding both C (Support banner, single CTA) and E
(FAQ) so they don't read as two unrelated blocks — the only place on the
page besides the archive filters and the plans CTAs where a member takes an
action.

## Verification Plan

No test suite exists — manual pass:

- Walk all 5 membership states (Monthly plain, Monthly+pending-annual,
  Monthly+no-period-end, Annual, `guide_bundle`): correct card marked
  current, correct/no CTA per the table above, no duplicate upgrade CTAs
  anywhere, correct plan label (validates the `PLAN_LABELS` fix).
- Unauthenticated (no JWT, no `?magic=`): confirm `redirectToPublic()`
  still fires immediately and no new section flashes before redirect.
- Trigger the real `/altitude/upgrade` flow from the new card; confirm it
  re-renders to "scheduled" via the existing `verifyAndRender` re-run, no
  reload needed.
- Support modal: empty-field submission stays open with inline errors; one
  real end-to-end test submission against the Worker (mind the 5/hr rate
  limit, use a clearly test-marked subject); Tab-cycle confirms the new
  focus trap stays inside the dialog and restores focus on close;
  Escape/backdrop-click still close it.
- Responsive check at ~375px / 768px / 1280px: Membership Plans grid,
  comparison table, FAQ accordion, Support modal (mobile stacked-action
  buttons, comparison table's inline mobile labels).
- Regression check: since `js/ui.js` and `css/style.css` are shared,
  re-open the Guide portal (`pages/private-pages/kf-guide-access-portal.html`)
  and confirm its existing `SkyUI.modal`/`SkyUI.confirm` usages
  (`js/kf-guide-portal.js`) still open, close, and focus correctly.

## Critical Files

- `pages/private-pages/altitude-access-portal.html` — main structural
  changes
- `js/altitude-portal.js` — `PLAN_LABELS` fix + one new `CustomEvent`
  dispatch line only
- `js/altitude-portal-extras.js` — new file, Membership Plans rendering +
  Support modal logic
- `js/ui.js` — add focus trap to `modal()` (lines ~73-139)
- `css/style.css` — new additive classes (`.private-plans-grid`,
  `.private-plan-card`, `.private-updates`, modal-body sizing helper); no
  edits to existing selectors' behavior except the gold-token swap in B
- `pages/altitude.html` — source of comparison table markup (lines
  ~302-580), read-only reference
- `pages/contact.html` / `js/contact.js` — source of contact form
  fields/submission pattern, read-only reference

## Out of Scope

- `#private-member-plan`'s unused header hook in `private-layout.js`/
  `header-private.html` (shared with the Guide portal — separate
  cross-portal decision).
- A CMS for the Updates/Announcements panel — hand-edited static block only.
- Any downgrade flow for Annual members (no downgrade endpoint exists
  today) — Section A's Annual state points to Support instead.
