# Guide Portal Toolbar — Dialog UX + Download Removal

## Context

The KrisFlyer Guide portal's toolbar (`pages/private-pages/kf-guide-access-portal.html`,
driven by `js/kf-guide-portal.js`'s `requestGuidePdf()`/`wireToolbar()`) currently uses
transient, auto-dismissing toasts for both "Download Guide" and "Send to My Email." The
user decided, after using it, that:

1. Both actions ending up delivering "the same thing" made Download redundant next to
   Send-to-Email — keep only Send-to-Email.
2. A toast is too easy to miss for something as important as "your guide is being sent" —
   replace it with a dialog that requires an explicit dismissal.

Dropping Download also removes the one remaining open design question from the prior
round (how to show the download flow's password in-app) — since email already delivers
the password in its own message body, there's nothing left to display in-app.

Confirmed with the user separately: the post-purchase confirmation modal
(`components/magic-modal-krisflyer.html`, `window.openGuidePurchaseModal()`) is already
correctly wired via `?purchased=1` in `js/krisflyer-guide.js` — no change needed there.
The backend `POST /guide/pdf/download` route stays as-is, just unlinked from the UI, so
the option can return later without rebuilding the pipeline.

## Design

**Toolbar markup** (`pages/private-pages/kf-guide-access-portal.html`): the
`#kf-download-dropdown` block (PDF + EPUB) is removed entirely. `#kf-send-dropdown`
collapses from a dropdown-with-one-item into a single plain button — no trigger/panel/
chevron, just one click target that calls the email flow directly.

**`js/kf-guide-portal.js`**:
- `wireToolbar()` loses its `_wireDropdown('kf-download-dropdown', ...)` call and the
  format-branching logic (EPUB check) inside the download callback; it now wires the
  single Send button directly to `requestGuidePdf()` (the `mode` parameter becomes
  vestigial with only one caller, but kept for now since deleting it narrows the
  function signature for no real benefit while the backend route still exists).
- `requestGuidePdf()` replaces every `SkyUI.toast(...)` call with a single dialog whose
  content is updated in place across three states, opened once at the start of the
  request:
  1. **Pending** — spinner + "Sending your guide…", no buttons.
  2. **Success** — "Check your inbox — your guide and password are on the way," one
     "Done" button.
  3. **Error** — the actual error message (rate-limited / server error / network), one
     "Close" button.
  No state auto-dismisses — every one requires an explicit click, which is the entire
  point of moving off toasts.
- Technically: open the modal via `SkyUI.modal()` once, keep its `handle`, and update
  `handle.el`'s body/actions in place as the request resolves, rather than closing and
  reopening between states (avoids flicker, matches how the chapter-reader modal already
  manipulates a single instance's lifecycle within one interaction).

## Out of scope

- Backend routes/handlers (`guidePdfHandlers.js`, `guidePdf.js`, password derivation) —
  untouched.
- The chapter reader modal, redemption table, auth flow, header/footer.
- Any change to the post-purchase confirmation modal (already verified correct).

## Verification

1. Portal toolbar shows only "Send to My Email," no Download dropdown, no EPUB anywhere.
2. Clicking it opens a dialog immediately (pending state) that stays open until the
   request resolves — no toast appears at any point in this flow.
3. Success and error states each require an explicit click to dismiss; nothing
   disappears on its own.
4. `POST /guide/pdf/download` still responds normally via direct request (e.g. curl) —
   confirms the backend route is untouched, just unlinked.
