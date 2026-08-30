# Push notification toggle sync — design

## Problem

Three UI surfaces read and write web-push subscription state independently, all through `js/push-subscribe.js`:

- The account-dropdown Notifications toggle (`pages/private-pages/header-private.html`, wired by `wireNotificationToggle`)
- The global session-scoped toast's own inline toggle (`showGlobalToast`)
- The Membership page's full preferences panel (`altitude-access/membership.html`, wired by `wirePrefsPanels`)

Each calls `subscribe()` or `unsubscribe()` and then updates only its own DOM. A change made in one surface (e.g. turning notifications on via the toast) doesn't show up in the others (e.g. the header dropdown toggle) until a full page reload, because nothing tells the other surfaces the underlying subscription state changed.

## Fix

`subscribe()` and `unsubscribe()` in `js/push-subscribe.js` are the single choke point every current (and any future) push-toggle UI already calls through. Right after a change actually succeeds in each of those two functions, dispatch:

```js
window.dispatchEvent(new CustomEvent('skyfare:push-status-changed', { detail: { subscribed: true|false } }));
```

- `subscribe()`: dispatched with `subscribed: true` once `postSubscription()` resolves OK, before the function's own promise resolves.
- `unsubscribe()`: dispatched with `subscribed: false` once the local unsubscribe completes, before the function's own promise resolves.

This matches the existing codebase convention of `window`-level CustomEvents for cross-module notification (`skyfare:private-layout-ready`, `skyfare:private-user` in `js/private-layout.js`).

Consumers each add a `window.addEventListener('skyfare:push-status-changed', ...)` that re-runs their own existing refresh logic, rather than the event carrying UI instructions — every surface re-derives its own display state independently:

- `wireNotificationToggle` — listener calls its existing `refresh()`.
- `wirePrefsPanels` — listener calls `refresh()` for every panel found on the page (there is normally one, but the existing code already supports multiple).
- `showGlobalToast` needs no listener — it already updates its own message text and dismisses itself locally when its own toggle changes.

## Edge cases

- **Self-triggered refresh:** the surface that initiated the change also receives its own dispatched event and re-runs `refresh()` on itself. This is one extra local `getStatus()` call (reads `Notification.permission` and `reg.pushManager.getSubscription()` — both local browser APIs, no network round-trip) — harmless. It does not cause a duplicate toast, since success/error toasts are posted from each call site's own `.then()`, never from the event listener.
- **Header not yet injected:** if `skyfare:push-status-changed` fires before the async header-partial fetch has resolved, `wireNotificationToggle` hasn't run yet and there's no listener registered to miss the event. This self-heals: once the header does get wired, its own initial `refresh()` call reads the current (already-correct) subscription state directly, same as on any normal page load.

## Files touched

`js/push-subscribe.js` only — two dispatch calls (in `subscribe()` and `unsubscribe()`) plus one new listener registration each in `wireNotificationToggle` and `wirePrefsPanels`.

## Out of scope

- No changes to `showGlobalToast()` itself beyond what already exists.
- No changes to any HTML markup — this is a behavioral wiring change only.
