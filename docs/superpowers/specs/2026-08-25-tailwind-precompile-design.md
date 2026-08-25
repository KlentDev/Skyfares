# Precompile Tailwind CSS — Design Spec

## Goal

Fix the slow-to-appear live production site by eliminating its single largest render-blocking cost: the Tailwind "Play CDN" runtime compiler. Replace it with static, precompiled CSS. **Strictly scoped** — this changes only how Tailwind's CSS is produced and loaded. No business logic, layout, markup content, styling values, auth/Stripe/Airtable/Beehiiv integration, or any other site behavior changes.

## Diagnosis (measured against the live site)

- `lib/tailwind/tailwind.min.js` (Tailwind v3, 407KB decompressed) loads synchronously (no `defer`) in the `<head>` of every page. It doesn't ship CSS — it scans the rendered DOM at runtime, generates CSS for every class it finds, injects it, then keeps a `MutationObserver` running to re-scan on every DOM mutation.
- `header.js` and `footer.js` inject large chunks of markup via `innerHTML` shortly after initial parse, forcing a second full re-scan/re-compile cycle.
- Isolated measurement: the script's synchronous parse+execute alone costs ~65ms of main-thread blocking, before any DOM-scanning work. Live-site testing showed resource downloads finishing by ~750ms but first paint not occurring until ~1.3–2s — that gap is main-thread JS work, dominated by this script.
- Tailwind's own runtime prints a console warning on every page load: *"cdn.tailwindcss.com should not be used in production."*
- Confirmed no dynamic Tailwind class-name construction anywhere in the codebase's JS (e.g. no `` `bg-${color}-500` `` patterns) — every class Tailwind needs to generate CSS for appears as a literal string in some `.html` or `.js` file, which is what makes static compilation safe here.

## What changes

### New files
- **`package.json`** (root) — single devDependency: `tailwindcss` (latest v3.x, matching the currently-vendored major version so no v3→v4 syntax migration is needed). Includes `package-lock.json` for reproducible CI installs.
- **`tailwind.config.js`** (root) — a direct port of the `tailwind.config` object currently set by `js/tailwind-config.js` (the `brand`/`deepblue`/`gold`/`surface` color scales and `fontFamily` extensions), unchanged in content, plus:
  ```js
  content: ['*.html', 'pages/**/*.html', 'components/**/*.html', 'js/**/*.js']
  ```
  Deliberately broad — scanning a few extra files that happen to contain no Tailwind classes costs nothing; missing a file that does would silently break styling.
- **`css/tailwind-input.css`** — the standard 3-line Tailwind v3 source:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

### CI change — `.github/workflows/deploy.yml`
Insert between the existing `Checkout` and `Upload site` steps:
1. `actions/setup-node@v4`
2. `npm ci`
3. `npx tailwindcss -i css/tailwind-input.css -o css/tailwind.css --minify`

`css/tailwind.css` is never committed — it's a build artifact only, added to `.gitignore`. It's generated fresh on every deploy, so there is no "forgot to rebuild" failure mode. This is the only pipeline change; `Setup Pages`, `Upload site`, and `Deploy to GitHub Pages` steps are untouched.

### All 36 HTML pages (mechanical, identical change everywhere)
Remove:
```html
<script src="[prefix]lib/tailwind/tailwind.min.js"></script>
<script src="[prefix]js/tailwind-config.js" defer></script>
```
Replace with, in the same position (so it still loads before `css/style.css`, preserving today's cascade — hand-written overrides in `style.css` keep winning ties exactly as they do now):
```html
<link rel="stylesheet" href="[prefix]css/tailwind.css">
```
`[prefix]` follows the existing per-directory-depth convention already used for every other asset reference on the page (`''`, `'../'`, `'../../'`, or `'../../../'` depending on the file's location).

### Cleanup
- Delete `js/tailwind-config.js` (its content is now `tailwind.config.js`, confirmed to have exactly one caller pattern — the Play CDN global — with no other references anywhere).
- Delete `lib/tailwind/tailwind.min.js` (407KB, fully superseded) — only after the new setup is verified working.
- Add `css/tailwind.css` to `.gitignore`.
- Update `README.md`'s Stack section: it currently states "no build step or bundler," which becomes slightly inaccurate for CSS specifically (a CI-only build step now exists; nothing else about the site's build-free nature changes).

### Local development
`npm install` once, then `npx tailwindcss -i css/tailwind-input.css -o css/tailwind.css --watch` while editing, to preview styling locally. That local output file stays untracked (matches the CI-artifact-only approach) — it's for local preview only, never the source of truth for what ships.

## Explicitly out of scope

- No changes to `css/style.css` (hand-written custom CSS, untouched).
- No changes to any page's markup, JS logic, business logic, auth, Stripe, Airtable, or Beehiiv integration.
- No changes to `js/links.js` or `js/mileage-route-data.js` (both currently non-deferred, both real but secondary contributors identified during diagnosis) — left untouched to keep this change strictly scoped to the Tailwind runtime removal, which is the dominant cost. Could be a separate, later follow-up if further load-time improvement is wanted.
- No changes to Font Awesome's stylesheet loading (also a secondary contributor, same reasoning).
- No design/visual changes — the goal is byte-for-byte equivalent rendered output, just compiled ahead of time instead of at runtime.

## Testing plan

- Run the build locally (`npx tailwindcss ...`), start a local static server, and screenshot-compare several representative pages (homepage, `pages/altitude.html`, `pages/cabin-compare.html`, `pages/newsletter.html`) against their current rendering to catch any missing-class regressions.
- Confirm the "should not be used in production" console warning is gone and no new console errors appear.
- Re-run the same FCP/long-task measurement methodology used during diagnosis, locally, to quantify the improvement.
- Push to `staging`, confirm the GitHub Actions build succeeds (the new `npx tailwindcss` step in particular), and once merged to `main` and deployed, spot-check the live site's real FCP the same way it was originally measured.
