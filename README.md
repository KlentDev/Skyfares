# Skyfare Consulting

Skyfare is a premium travel consultancy that books business and first-class flights using points, miles, and loyalty program strategies — a white-glove booking service built on award-travel expertise. This repo is the marketing site, member portal, and supporting backend for **skyfareconsulting.com**.

## Stack

- **Static frontend** — plain HTML/CSS/JS, no build step or bundler. Pages live in [`pages/`](pages/), shared logic in [`js/`](js/), styling in [`css/style.css`](css/style.css).
- **Tailwind CSS** — loaded via the Tailwind CDN script ([`lib/tailwind/`](lib/tailwind/)), no PostCSS/build pipeline.
- **Font Awesome** — bundled locally under [`lib/font-awesome/`](lib/font-awesome/).
- **Cloudflare Workers** — [`cloudflare/subscribe-worker.js`](cloudflare/subscribe-worker.js) is the API backend: Altitude Access membership (checkout, activation, magic-link login), newsletter routes, Airtable form submissions, and scheduled cron jobs (segment recalculation, renewal reminders). Configured in [`cloudflare/wrangler.toml`](cloudflare/wrangler.toml) and deployed independently via `wrangler deploy` (not tied to the GitHub Actions workflow below).
- **Cloudflare KV** — session/member state storage (`ALTITUDE_KV` binding).

## Third-party platforms

- **Beehiiv** — newsletter publishing, subscriber tagging/segments, and the premium (Altitude Access) vs. free audience gating.
- **Stripe** — checkout and billing for Altitude Access subscriptions, including the self-service Manage Membership portal.
- **Airtable** — CRM backend for flight application and contact inquiry form submissions.

## Deployment

- **GitHub Pages**, via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — triggers automatically on every push to the `staging` branch and publishes the static site to the custom domain in [`CNAME`](CNAME) (skyfareconsulting.com). `staging` is effectively the live branch; `main` currently has no attached deploy workflow.
- **Cloudflare Workers**, via `wrangler deploy` from `cloudflare/` — deployed manually/independently of the GitHub Pages pipeline.

## Repo layout

```text
index.html            Homepage
pages/                 All other site pages (Altitude Access, newsletter, booking, etc.)
js/                     Shared frontend logic (header, footer, newsletter, hero)
css/style.css           Global styles
cloudflare/             Worker source + wrangler config (API backend)
images/, logos/, lib/   Static assets and vendored libraries
design.md               Design system reference (colors, type, components)
```
