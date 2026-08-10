# Success-modal confetti — design

## Context

Three purchase flows show a post-payment success modal but no celebratory feedback beyond the modal text itself:

- **Altitude Monthly/Annual** — `components/magic-modal.html`'s `#magic-modal-panel-starter` panel, opened via `window.openStarterSuccessModal(email)` in `js/magic-modal.js`.
- **KrisFlyer Guide** — `components/magic-modal-krisflyer.html`'s `#magic-modal-krisflyer-panel-purchase` panel, opened via `window.openGuidePurchaseModal()` in `js/krisflyer-guide.js`.
- **Travel Strategy Call** — `components/travel-strat-modal.html`, opened via `openTravelStratModal()` in `js/assessment-checkout.js`.

The site already has two working confetti implementations (`js/contact.js` and `js/newsletter.js`, both using [canvas-confetti](https://www.kirilv.com/canvas-confetti/) lazy-loaded from a CDN on first use). `js/newsletter.js` specifically branches on whether the trigger is inside the `#altitude-popup` modal, using a softer single burst for the in-modal case versus a 3-burst cannon for its page-level case. All three targets above are modals, so the in-modal burst is the right visual fit — not the page-level cannon.

## Goal

Add the same brand-consistent confetti burst to all three success modals above, without duplicating the burst config three times and without touching the two existing (working) confetti implementations.

## Design

### New file: `js/confetti.js`

A single small shared helper, extracted from the "in-modal" branch already proven in `js/newsletter.js:44-52`:

```js
window.fireBrandConfetti = function () {
  loadConfetti(function () {
    if (typeof confetti !== 'function') return;
    confetti({
      particleCount: 90,
      spread: 65,
      origin: { x: 0.5, y: 0.55 },
      colors: ['#0C4A6E', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff'],
      zIndex: 9999,
    });
  });
};
```

`loadConfetti` is the same lazy-load guard already used in both existing implementations: no-op if `canvas-confetti` is already on the page, otherwise inject the CDN `<script>` once and fire on load.

Loaded via `js/header.js`, alongside the other globally-injected helpers (`magic-modal.js`, `modal-verify-access.js`). This makes `window.fireBrandConfetti` available on every page at zero cost until a call site actually invokes it — the CDN script itself only downloads on first real use.

### Call sites (3 new one-liners, no other files changed)

1. **`js/magic-modal.js`** — inside `_open()`, when `panel === 'starter'`, call `window.fireBrandConfetti()`. Covers both Altitude Monthly and Annual, since they share this one success panel.
2. **`js/krisflyer-guide.js`** — inside `kfOpenPanel()`, when `panel === 'purchase'`, call `window.fireBrandConfetti()`.
3. **`js/assessment-checkout.js`** — inside `openTravelStratModal()`'s inner `_open()` function, call `window.fireBrandConfetti()`.

Each call fires once per modal open, matching the existing pattern in `newsletter.js`/`contact.js` (confetti fires when the success state is shown, not on every subsequent render).

## Explicitly out of scope

- **`js/newsletter.js` and `js/contact.js`** — left untouched. Their existing confetti already works; no need to migrate them onto the new shared helper and risk regressing two working flows for a cosmetic dedup.
- **Altitude Monthly → Annual upgrade** — the portal's `#alt-upgrade-pending-card` (`pages/private-pages/altitude-access-portal.html`) is an inline dashboard confirmation, not a success modal. No confetti added there.
- **Per-product color variants** — all bursts use the one existing brand palette; no new colors introduced.

## Testing

Manual only (no test suite covers frontend JS in this repo): trigger each of the 3 flows in a browser (test-mode Stripe checkout for Altitude Monthly, Altitude Annual, KrisFlyer Guide, and the Travel Strategy Call) and confirm the burst fires once when each success modal opens, with no console errors if `canvas-confetti` fails to load (existing `loadConfetti` guard already handles this).
