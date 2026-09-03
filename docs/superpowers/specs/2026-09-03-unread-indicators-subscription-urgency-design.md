# Unread Content Indicators + Subscription Urgency Badge

Two additive features for the Altitude private portal (`pages/private-pages/`), approved via `/brainstorming` on 2026-09-03.

## Feature A — Unread red-dot indicators

**Goal:** signal unread Award Alerts, KrisFlyer Escapes, and premium newsletter issues per member/browser, clearing on view.

### Data model

New shared file `js/altitude-read-tracker.js`, loaded on all 7 Altitude pages, exposing `window.AltitudeReadTracker`:

- Per-section "seen" ID set in `localStorage`: `altitude_read:award-alerts`, `altitude_read:krisflyer-escapes`, `altitude_read:newsletter`.
- `seedIfFirstVisit(section, allIds)` — if a section has no read-history yet, marks every currently-live ID as seen (no dot flood on first-ever visit or on rollout day). No-op on every later call.
- `markRead(section, id)`.
- `isUnread(section, id)`.
- A cached per-section unread count in `localStorage` (`altitude_unread_count:*`), written whenever a page actually fetches that content type. Nav tabs read this cache only — no new network calls.

Every Award Alert / KrisFlyer Escape record already carries a stable Airtable `id` (`normalizeBaseContent()`, `cloudflare/services/airtable.js`). Beehiiv newsletter posts carry their own stable `id`.

### Per-item dots

- **Award Alerts** (`js/altitude-content-award-alerts.js`): each `.alt-opportunity-card` shows a dot when `item.id` is unread. Card click (existing `data-altitude-alert-index` handler) calls `markRead('award-alerts', item.id)` and clears that card's dot without a full re-render.
- **KrisFlyer Escapes** (`js/altitude-content-krisflyer-escapes.js`): one issue per month, switched via a native `<select>` — no per-option dot (native selects can't carry rich per-option markup cross-browser). The default-shown issue is marked read once rendered; switching month via the dropdown marks that issue read too. Unread signal here lives on the nav tab only.
- **Premium Newsletter** (`js/altitude-portal.js`'s archive grid, `newsletter.html`): each card gets a dot the same way as Award Alerts, keyed on the post's `id`; the existing click handler marks it read.

### Nav tab dots

A small dot on the "Award Alerts" / "KF Escapes" / "Latest Issues" subnav tabs (present in the static `.altitude-subnav` markup repeated across all 7 Altitude pages), driven by the cached unread counts — visible whenever that section has ≥1 unread item, gone once none remain.

Visually distinct from the existing editor-controlled gold "New" badge (`alertStatus()`/`statusBadge()` in `altitude-content-award-alerts.js`) — that's content freshness set by the team in Airtable; this is a per-member unread signal. Both can appear on the same item without reading as duplicated.

## Feature B — Subscription countdown badge

Extends `_populateMembershipCard()` in `js/altitude-portal.js` — already shared by the Overview page's and Membership page's membership card, so one change reaches both.

Adds a color-coded badge next to the existing "days remaining" line:

| Days left | Color | Monthly/Annual copy | Guide Bundle copy |
|---|---|---|---|
| ≤7 | Yellow | "Renews in N days" | "Free access ends in N days — upgrade to keep it" |
| ≤5 | Orange | same pattern | same pattern |
| ≤1 | Red | "Renews tomorrow" | "Free access ends tomorrow — upgrade to keep it" |
| >7 | — | no badge | no badge |

Only the single lowest-matching threshold renders (never stacked). "Renews today" if `days === 0`.

## Out of scope

- Server-side/cross-device read-state sync (localStorage only, matches every other client-side preference in this codebase).
- Real-time nav-dot updates without a page visit that fetches the relevant content.
- Changing the existing gold "New" content-freshness badge.

## Verification

- Fresh browser, no `altitude_read:*` keys: visiting each section seeds "seen" silently, no dots appear for pre-existing content.
- Publish a new Award Alert (or simulate by manually removing one ID from the seen set): dot appears on its card and on the "Award Alerts" nav tab; clicking the card clears both.
- Membership card at 7/5/1/0 days remaining shows the correct color and copy for both a Monthly/Annual member and a Guide Bundle member; >7 days shows no badge.
