# PWA Installability — Design Spec

## Goal

Let visitors install/save Skyfare Consulting to their desktop or mobile home screen, so it launches as a standalone app-like window and reliably reloads on repeat visits — without turning the site into a separate product, rebuilding it as an SPA, or introducing a build pipeline.

Priority order: **Installability → Reliability → Safety → Performance → UX.**

Explicitly out of scope for this stage: push notifications, offline article downloads, background sync, native device permissions, app-store packaging, native wrappers.

## Context

- Static site, **no build step or bundler** — 33 HTML pages (`index.html`, `pages/*.html`, `pages/private-pages/*.html`), shared logic hand-loaded per page via `<script>`/`<link>` tags in each `<head>` (same pattern used today for `js/links.js`, `js/header.js`, `js/footer.js`, `css/style.css`, Tailwind CDN, Font Awesome).
- Deployed via GitHub Pages (static file serving only — no server-side templating, no edge middleware for the frontend).
- All dynamic behavior (auth/magic-link, Stripe checkout, Airtable form submissions, newsletter content, Altitude entitlements) is fetched client-side from a **separate origin**: `https://skyfares-altitude.klent-5fa.workers.dev` (the `subscribe-worker.js` Cloudflare Worker). This origin must never be cached by the service worker.
- Brand: single accent color Sky Blue `#0066cc`; light canvas `#f5f5f7` (parchment). Existing favicon `logos/logo.webp` — a blue circular badge with a white plane mark, transparent background — is the source asset for all PWA icons.
- `offline.html` already exists, is fully branded, and already handles reconnect detection (`navigator.onLine`, `online`/`offline` listeners, auto-redirect home). It is reused as-is as the service worker's offline navigation fallback — not rebuilt.
- `js/error-handler.js` already shows a live in-page "you're offline" overlay when a loaded page loses connectivity mid-session. That is a *different* concern from the service worker's job (handling a *navigation* that fails outright, e.g. opening a new tab while offline) — both stay, unmodified, doing their separate jobs.

## No-build-step constraint (drives the caching design)

Because nothing content-hashes filenames, `css/style.css` (for example) has the same URL before and after every edit. A naive cache-first strategy would serve stale CSS/JS indefinitely. This is solved with two complementary mechanisms (see "Service Worker" below): a manually-bumped cache version string, and stale-while-revalidate for static assets so freshness self-heals even if the version bump is forgotten.

## 1. Web App Manifest

New file: **`/manifest.json`**, linked from every page's `<head>`.

```json
{
  "id": "/",
  "name": "Skyfare Consulting",
  "short_name": "Skyfare",
  "description": "Premium award travel consulting — Altitude membership, flight bookings, and travel insights.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f5f5f7",
  "theme_color": "#0066cc",
  "icons": [
    { "src": "/images/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/images/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/images/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `start_url` carries `?source=pwa` so GA (gtag is already wired site-wide) can distinguish installed-app sessions from regular browser sessions, at zero implementation cost.
- `theme_color` is duplicated as `<meta name="theme-color" content="#0066cc">` in every `<head>` so mobile browser chrome tints to match the brand.
- `<link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png">` also added everywhere (iOS ignores the manifest's icon list for home-screen icons).

## 2. Icons

Generated once from `logos/logo.webp` via a local one-off Node script (using `sharp`, installed temporarily — not added as a project dependency; the output PNGs are what get committed, not the tool). Output to `images/icons/`:

- `icon-192.png`, `icon-512.png` — direct resize, transparent background, `purpose: any`.
- `icon-512-maskable.png` — badge scaled down and centered on an opaque white square with real safe-zone padding (so Android adaptive-icon shapes — circle, squircle, rounded-square — don't clip the plane mark).
- `apple-touch-icon.png` (180×180) — flattened onto opaque white (iOS renders PNG transparency as black on home-screen icons, so this one cannot be transparent).

The existing `logos/logo.webp` favicon reference is untouched.

## 3. Install UX

No custom install button or card anywhere in the UI.

- **Desktop Chrome/Edge and Android Chrome**: once the manifest + service worker + HTTPS + icon criteria are satisfied, these browsers show their own native install affordance automatically (address bar icon on desktop, browser-menu item on Android). No `beforeinstallprompt` handling is implemented — the brief explicitly favors letting the browser own this rather than a custom banner/modal.
- **iOS Safari** (no native install affordance exists on iOS at all): one permanent, quiet text line added once to the footer template in `js/footer.js` (so it applies site-wide automatically), shown only when the visitor is detected as iOS Safari and not already running standalone:
  > "On iPhone or iPad? Add Skyfare to your Home Screen — tap Share, then 'Add to Home Screen.'"

  Plain text, no dismiss state, no modal, no localStorage tracking — matches the "convenience, not interruption" direction.

## 4. Service Worker

New file: **`/sw.js`**, scope `/`. Registered via a new small script, **`js/sw-register.js`**, added directly to every page's `<head>` (same boilerplate-script pattern already used for `js/links.js`).

### Cache versioning & update behavior

- A `CACHE_VERSION` constant at the top of `sw.js` (e.g. `'skyfare-v1'`) names the cache. Bumping this string is what forces a real refresh of precached/SWR-tracked assets — browsers diff `sw.js` byte-for-byte on every load, so any edit (including just the version bump) triggers install of a new worker, which populates a fresh versioned cache and deletes old-versioned caches on `activate`.
- **This version string must be bumped manually whenever a cached file changes** (CSS, shared JS, icons, manifest). This is the one manual step in the system and will be called out in the implementation summary/comments in `sw.js` itself.
- Updates are silent: `self.skipWaiting()` in `install`, `clients.claim()` in `activate`. The new worker takes control on the visitor's next navigation — no update toast or prompt.

### Caching strategy by request type

| Request | Strategy | Rationale |
|---|---|---|
| Same-origin HTML navigations (all 33 pages, incl. `pages/private-pages/*`) | Network-first, fall back to cache, then to `offline.html` | Content should be fresh when online. Safe to include private/portal pages: their actual member data is fetched client-side from the Worker API at runtime and is never touched by the service worker (see below) — only the static page shell/skeleton is ever cached. |
| Core static shell: `css/style.css`, `css/altitude-editorial.css`, shared `js/*.js` (`links.js`, `header.js`, `footer.js`, `ui.js`, `cookie-consent.js`, `error-handler.js`, `tailwind-config.js`), `lib/tailwind/tailwind.min.js`, `lib/font-awesome/css/all.min.css` + its `.woff2` files, `logos/logo.webp`, `images/icons/*`, `manifest.json` | Stale-while-revalidate, precached at `install` | Instant repeat loads; self-healing freshness even if a version bump is forgotten, since every fetch also refreshes the cache in the background. |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Cache-first (explicit cross-origin allowlist) | Font files are immutable and non-sensitive. |
| **Everything else cross-origin** — the Worker API (`skyfares-altitude.klent-5fa.workers.dev`: auth, magic-link, Stripe, Airtable, newsletter, entitlements), `googletagmanager.com`/gtag, Meta Pixel | **Not intercepted** — `fetch` handler declines to call `respondWith`, browser handles it natively | Safety-critical: no auth, membership, pricing, entitlement, or payment response is ever allowed to reach the Cache API, regardless of same-page origin tricks. |
| Large page imagery (`images/hero/`, `images/destinations/`, etc.) | Untouched — default browser HTTP cache | Not part of the "reliable revisit" goal; precaching would bloat the cache with no real benefit. |

### Offline fallback

`offline.html` (existing, unmodified) is added to the install-time precache list and served whenever a navigation request fails with no matching cache entry.

## 5. Files touched

**New:**
- `sw.js`
- `manifest.json`
- `js/sw-register.js`
- `images/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`

**Edited:**
- All 33 HTML files' `<head>` — adds: manifest link, theme-color meta, apple-touch-icon link, `sw-register.js` script tag. Same four lines inserted everywhere.
- `js/footer.js` — adds the iOS "Add to Home Screen" hint to the footer template.

**Untouched:**
- `cloudflare/` and `cloudflare-reports/` (Worker backends) — this work is entirely static-frontend scoped.
- All existing business logic, routing, auth, Stripe, and membership code.

## Testing plan

- **Manifest validity**: Chrome DevTools → Application → Manifest panel (no errors/warnings), plus a maskable-icon preview check.
- **Installability**: Chrome desktop address-bar install icon appears; Android Chrome install prompt available via menu; verify standalone window launches with correct name/icon/theme color.
- **iOS**: manually verify the footer hint renders only on iOS Safari, and that "Add to Home Screen" produces the correct icon/name.
- **Service worker correctness**: DevTools → Application → Service Workers (registered, correct scope); Network tab confirms Worker-API and analytics requests are never served from/written to Cache Storage; offline toggle in DevTools confirms navigations fall back to cache then to `offline.html`.
- **Update flow**: bump `CACHE_VERSION`, redeploy, confirm old caches are deleted on `activate` and new assets are served on next navigation without a manual hard-refresh.
- **Regression check**: confirm login/magic-link, Stripe checkout, Airtable form submissions, and Altitude portal content all behave identically with the service worker active (nothing stale, nothing cached that shouldn't be).
