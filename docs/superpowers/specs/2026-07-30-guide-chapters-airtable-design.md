# KrisFlyer Guide Chapters — Airtable-Backed Content Design

## Context

The KrisFlyer Guide's 7 chapters have never had real content — `js/kf-guide-portal.js`'s
`CHAPTERS` array is a hardcoded placeholder with every `ready` flag `false`, and
`cloudflare/services/guideContent.js` (built for the secure PDF pipeline earlier this
session) returns a fixed cover + the redemption-conditions table as a stand-in. Real
chapter drafts already exist informally (`guide-kf.md`, chapters 3–5), so there's real
content ready to migrate in once a proper home for it exists.

Goal: Airtable becomes the source of truth for chapter text (long-form prose, formatted
with Airtable's own rich-text toolbar) and a manually-uploaded Cloudinary cover image per
chapter. This feeds **both** the existing PDF-generation pipeline and a new on-site
chapter reader (a modal with Next/Prev, reusing the site's existing `SkyUI.modal()`).

Scope is strictly additive to `pages/private-pages/kf-guide-access-portal.html`'s chapter
library grid section — the redemption-conditions table, toolbar (Download/Send-to-Email),
header/footer, and every other portal function stay untouched.

## Airtable schema

New table **"Guide Chapters"** in the existing "Skyfare Consulting" base:

| Field | Type | Notes |
|---|---|---|
| Chapter Number | Number | Ordering |
| Title | Single line text | |
| Content | Long text, rich text enabled | Team writes with Airtable's bold/italic/heading/list toolbar. Airtable's API returns this as markdown-syntax text. |
| Cover Image URL | URL | One Cloudinary URL per chapter, uploaded manually by the team; pasted here as a plain link. No inline mid-content images for now (few assets, prose-heavy guide — can add an inline-image convention later if ever needed). |
| Status | Single select: Draft / Published | Gates visibility in *both* the PDF and the website — mirrors the `Approved` pattern on the Testimonials table. |
| Last Modified | Last Modified Time (automatic) | Not authored — Airtable maintains this. Used only for a display-only "content updated" date, never for password derivation (see below). |

## Password derivation change (decoupling from content)

Today, `deriveGuidePdfPassword(email, entitlementId, guideId, guideVersion, env)` mixes a
content-version string into the password seed. Confirmed with the user: **editing chapter
content must never change an existing customer's password** (that would generate support
tickets — "my password stopped working" — every time a typo gets fixed). Fix: drop
`guideVersion` from the function signature and the HMAC seed entirely. The seed becomes
`email + entitlementId + guideId` only. A password only ever changes via
`PDF_PASSWORD_SECRET` rotation (already the documented mass-invalidation mechanism), never
via content edits.

## Worker changes

- **New `cloudflare/services/guideChapters.js`** — the only file that talks to the Guide
  Chapters Airtable table. Exports `getPublishedChapters(env)`:
  fetches rows where `Status = "Published"`, sorted by Chapter Number, converts each row's
  markdown-syntax `Content` into HTML via `marked` (new npm dep — verified zero-dependency,
  pure string processing, ships a browser build, safe for Workers), and returns
  `{ chapters: [{ number, title, contentHtml, coverImageUrl }], contentUpdatedAt }` (the
  latter is the max `Last Modified` across returned rows, ISO string).

- **`cloudflare/services/guideContent.js`** — no longer a placeholder. `getGuideContent`
  becomes `async`, calls `getPublishedChapters(env)`, and concatenates every chapter into
  the PDF body as its own `<h2>` section (the print template already has
  page-break-before-chapter CSS from the original build). Return shape unchanged
  (`{ html, version }`) — `version` now carries `contentUpdatedAt`, displayed in the PDF as
  "Content updated: [date]" instead of the old placeholder string. `guidePdf.js`'s call
  site changes from `getGuideContent(GUIDE_ID)` to `await getGuideContent(GUIDE_ID, env)`,
  and its password-derivation call drops the version argument.

- **New `cloudflare/orchestration/guideChaptersHandler.js`** — one handler,
  `handleGetGuideChapters(request, env, corsHeaders)`, for `GET /guide/chapters`. Same
  live-entitlement gate as the PDF routes (JWT + live `guide:{email}` KV check — never
  trusts the JWT claim alone). Returns the full published-chapter array in one response so
  the website fetches once and the modal's Next/Prev never needs another round trip.
  Light rate limit — 30/hour per email (new `KV_PREFIX.RL_GUIDE_CHAPTERS`) — consistent
  with every other route's defensive posture, even though this is read-only and already
  entitlement-gated.

- **`cloudflare/worker.js`**: one new route line for `GET /guide/chapters`, one new
  secrets/route doc-comment line. No existing route touched.

- **`cloudflare/wrangler.toml`**: one new `[vars]` entry, `AIRTABLE_TABLE_GUIDE_CHAPTERS`,
  matching the existing convention for the other three Airtable table IDs.

- **`cloudflare/package.json`**: add `marked` as a dependency.

## Frontend changes (scoped to the chapter library grid only)

- **`js/kf-guide-portal.js`**: `renderLibrary()` and the hardcoded `CHAPTERS` array are
  replaced — the library grid now fetches `GET /guide/chapters` once (right after
  `unlockGuideContent`, same place `renderLibrary()` is already called) and renders cards
  from the real response instead of the placeholder array. Unpublished chapters simply
  aren't in the response (no more `ready:false` "Coming soon" card — a chapter either
  exists and is readable, or doesn't appear yet, matching how the site already avoids
  "implying finished content is hidden" per `pages/krisflyer-guide.html`'s existing
  approach).
- Each card's "Read chapter" link opens a **modal** (reusing `window.SkyUI.modal()`,
  already used elsewhere on the site) showing that chapter's cover image + content, with
  Prev/Next buttons that just index into the already-fetched in-memory chapter array — no
  extra network call per click. Prev is disabled (not wrapped to the last chapter) on the
  first chapter, and Next is disabled on the last — no wraparound.
- Nothing else in this file changes: `wireToolbar()`, `checkGuideAccess()`,
  `handleMagicCallback()`, the redemption-conditions unlock logic, all untouched.
- **`pages/private-pages/kf-guide-access-portal.html`**: no structural change expected —
  the existing `#kf-library-grid` container is reused as-is; cards are still generated by
  JS, just from real data now.

## Out of scope for this pass

- Inline images within chapter body text (only a cover image, per user's "assets are just
  a few" confirmation).
- Migrating `guide-kf.md`'s existing draft prose into Airtable — natural next step once
  the table exists, but a content-entry task, not a system-building one.
- Any change to the redemption-conditions table, the Download/Send-to-Email toolbar, or
  any other portal function.

## Verification

1. Create 1–2 real chapter rows in Airtable (one Draft, one Published) and confirm only
   the Published one appears via `GET /guide/chapters` and in the PDF.
2. Generate a PDF and confirm all Published chapters appear, each starting on a fresh page,
   with the "Content updated" date reflecting Airtable's actual Last Modified value.
3. Edit a Published chapter's text and re-download the PDF for the same account — confirm
   the **password is unchanged** (the whole point of the decoupling).
4. On the live portal, confirm the library grid shows only Published chapters, "Read
   chapter" opens the modal with correct content, and Next/Prev cycle correctly at the
   first/last chapter boundary.
5. Confirm the redemption-conditions table, toolbar, and header/footer are pixel-identical
   to before — no regression from this change.
