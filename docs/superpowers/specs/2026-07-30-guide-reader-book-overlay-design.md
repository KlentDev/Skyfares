# Guide Chapter Reader — Bespoke Book-Style Overlay

## Context

A first pass styled the existing `SkyUI.modal()` component (wider, taller, scrollable,
brand typography) for reading chapters, but a floating dialog card with visible
backdrop margin around it still reads as "a dialog," not a book. The user confirmed
they want a **book-style page**: an off-white/parchment page surface, generous
margins, minimal chrome, sitting on a dimmed backdrop — closer to an ebook reader than
a confirmation dialog.

## Design

A new, bespoke overlay (`.kf-reader-overlay`) — not `SkyUI.modal()` — built and
styled specifically for this one reading surface. One overlay element is created
lazily on first use and reused for every subsequent open (title/body/nav content
updated in place), rather than creating/destroying a modal instance per chapter.

- **Page surface**: `#f5f5f7` (Skyfare's existing parchment tone, already used
  elsewhere in `css/style.css` — not a new color), ~800px wide (94vw max), ~90vh tall,
  rounded corners, soft shadow, sitting on a dimmed/blurred backdrop.
- **Chrome kept minimal**: a slim header with just the chapter title (Lexend) and a
  circular × close button — no action bar.
- **Prev/Next as page-turn arrows**: quiet circular chevron buttons anchored to the
  page's left/right edges (ebook-reader placement), low-opacity until hovered, hidden
  entirely at the first/last chapter (no wraparound, matching the original spec).
- **Body**: scrollable within the page only, same reading typography as the previous
  pass (Manrope 17px/1.47 for body text, Lexend for in-content `<h2>`s), explicit
  `scrollTop = 0` on every open so Prev/Next always lands at the top of the new
  chapter.
- **Dismiss**: × button, backdrop click, or Escape — body scroll locked while open,
  restored on close, matching how the rest of the site's modals already behave.

## Out of scope

Library grid cards, the toolbar/email confirmation flow, backend PDF generation —
unchanged. This replaces `openChapterModal()`'s internals only; its call site
(`data-chapter-index` click delegation) doesn't change.

## Verification

1. Open a chapter — confirm it looks like a page (parchment surface, shadow, dimmed
   backdrop) rather than a dialog box.
2. Click Next/Prev repeatedly — confirm each chapter opens scrolled to the top, arrows
   correctly disappear at the first and last chapter.
3. Close via ×, backdrop click, and Escape — confirm all three work and body scroll
   unlocks correctly afterward.
4. Resize to a narrow/mobile width — confirm the page still fits and the page-turn
   arrows remain usable.
