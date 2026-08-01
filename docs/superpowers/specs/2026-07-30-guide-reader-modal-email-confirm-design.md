# Guide Portal — Book-Style Reader Modal + Email Confirmation Step

## Context

Chapters now have real content (populated into Airtable earlier this session — 6 full
chapters, 1 placeholder, 1 intro, 7,000–10,000+ characters each). The chapter-reader
modal built alongside the Airtable integration was sized for a short confirmation
dialog, not long-form reading — no typographic treatment, no scroll containment, no
comfortable reading width. Separately, "Send to My Email" fires immediately on click
with no confirmation step, which feels abrupt for an action a user might trigger by
accident.

Also fixed as part of this pass: the Introduction (Chapter Number 0) was rendering as
"Chapter 0 — How to Use This Guide" in both the PDF (`guideContent.js`, already fixed)
and the reader modal's title (fixing here too) — it should just show its own title,
no "Chapter 0" prefix.

## Design

### Reader modal (`openChapterModal()` in `js/kf-guide-portal.js`)

Still `window.SkyUI.modal()` — no changes to the shared `js/ui.js` component itself,
since it's used across the whole site. Instead, immediately after
`SkyUI.modal({...})` returns its `handle`, apply targeted inline styles directly to
`handle.el`'s card/body elements (the same "reach into `handle.el`" technique the
in-place dialog state updates already use elsewhere in this file):

- `.sky-modal__card` gets a wider max-width (~740px) and taller max-height (~85vh)
  than the component's default small-dialog sizing.
- `.sky-modal__body` gets `overflow-y: auto` with its own capped height (so only the
  chapter text scrolls, not the whole modal/page), font-family Manrope, 17px, 1.47
  line-height (Skyfare's existing brand body-copy spec — not a new typographic
  choice), and `<h2>` elements inside the injected `contentHtml` styled in Lexend to
  match section headings elsewhere on the site.
- Prev/Next buttons (rendered via `SkyUI.modal()`'s own `actions` array) land in
  `.sky-modal__actions`, which sits in normal document flow right after the capped-
  height scrollable body — so they're always visible without extra positioning work.
- Prev/Next continue to close the current modal and open a fresh one for the new
  chapter index (the existing pattern) rather than swapping content in place — this
  is what already guarantees each chapter starts scrolled to the top; no additional
  scroll-reset code needed.
- Title construction fix: `chapter.number > 0 ? 'Chapter ' + chapter.number + ' — ' + chapter.title : chapter.title` (mirrors the fix already made in `guideContent.js`).

### Email confirmation (`js/kf-guide-portal.js`)

- `wireToolbar(email)` currently discards its `email` parameter — thread it into the
  click handler instead of calling `requestGuidePdf()` directly.
- New `confirmSendGuidePdf(email)`: opens a small `SkyUI.modal()` (default sizing, no
  reader-style overrides) with body text "We are about to send the KrisFlyer guide to
  your email **{email}**." and two actions: **Cancel** (default dismiss, does
  nothing) and **Send now** (primary style).
- **Send now**'s `onClick` calls `requestGuidePdf()` (the existing pending → success/
  error dialog flow, unchanged) and lets the confirmation modal close normally — same
  "new modal opens as the old one is closing" sequencing already used by chapter
  Prev/Next, so this is a proven pattern in this exact file, not a new risk.

## Out of scope

No changes to `requestGuidePdf()`'s pending/success/error states themselves, the PDF
generation/backend routes, or any other part of the toolbar/portal.

## Verification

1. Open a chapter with real content — confirm the modal is noticeably wider/taller,
   the chapter text scrolls within the modal body while Prev/Next stay visible below
   it, and text renders in the brand body typeface at a comfortable reading size.
2. Open the Introduction — confirm its title shows without a "Chapter 0" prefix, both
   in this modal and (already fixed) in a downloaded PDF.
3. Click Next through several chapters — confirm each one opens scrolled to the top,
   not wherever the previous chapter's scroll position was.
4. Click "Send to My Email" — confirm the confirmation dialog appears with the
   correct email address before anything is sent; Cancel does nothing; Send now
   proceeds into the existing pending/success dialog exactly as before.
