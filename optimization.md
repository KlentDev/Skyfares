# SEO / AEO / GEO — Current State & Ownership

This document answers where the site currently stands on **SEO** (Search Engine Optimization), **AEO** (Answer Engine Optimization — being surfaced as a direct answer, e.g. Google's AI Overviews, featured snippets), and **GEO** (Generative Engine Optimization — being cited/summarized by ChatGPT, Perplexity, Claude, Gemini, etc.), and who owns each part. It's a baseline audit, not a strategy doc — no prior SEO/AEO/GEO work or guidelines exist in this repo, so treat this as the starting reference.

## Direct answers

**Are these a documented priority?** No. There is no `CLAUDE.md` in this repo, and neither `design.md` nor `README.md` mentions SEO, AEO, GEO, schema, sitemaps, or robots.txt. Nothing here has been treated as a formal priority so far — this file is the first artifact on the subject.

**Is it implemented already?** Partially, and unevenly. The homepage (`index.html`) has solid classic-SEO metadata. Every other page under `pages/` (23 files) is missing most of it. Structured data (schema.org) doesn't exist anywhere. There's no sitemap or robots.txt. AEO/GEO haven't been addressed at all, and the site has a structural issue (below) that actively works against both.

**Who owns this — codebase, CMS, or third party?** 100% codebase. There is no CMS. This is a plain static HTML/CSS/JS site (no bundler, no SSG — confirmed no `package.json` anywhere in the repo) deployed via GitHub Pages (`.github/workflows/deploy.yml`, triggered on push to `staging`, published to `skyfareconsulting.com` per `CNAME` — see `README.md:20-24`). The three third-party services in use — **Airtable** (CRM backend for flight/contact form submissions), **Beehiiv** (newsletter publishing + subscriber segments), **Stripe** (Altitude Access billing) — do not touch metadata, redirects, sitemaps, or structured data. The Cloudflare Worker (`cloudflare/subscribe-worker.js`) is a pure API backend (CORS, form submission, membership/checkout routes, cron jobs); it has no routing/redirect/header logic relevant to SEO. **Practically: any SEO/AEO/GEO change you make will be a code change in this repo, not a config change in a third-party dashboard.**

**Is there an AEO/GEO strategy for AI-powered search?** No — nothing has been done here yet. The most consequential existing issue for AEO/GEO specifically: the header, nav, and footer markup lives only inside JS template strings (`js/header.js`, `js/footer.js`) and gets injected via `innerHTML` after page load. A crawler or answer engine that doesn't execute JavaScript sees a page with **no navigation structure at all**. Many AI/answer-engine crawlers are JS-light or skip JS entirely, so this is a bigger risk for AEO/GEO than it is for classic Google SEO (which does render JS, just slower/less reliably).

**Are there existing requirements, audits, or guidelines to follow?** None. No prior audit, no style guide entry, no checklist. Follow the design conventions already established for `.md` reference docs in this repo (see `design.md`, `README.md`) and treat the gap list below as the working backlog until the team sets explicit priorities.

## Current-state findings

| Area | Status | Notes |
|---|---|---|
| Title / meta description / viewport / lang | ✅ Exists, unique per page | Every page has `<meta charset>`, `<meta name="viewport">`, `<html lang="en">`, and a hand-written, unique `<title>`/`<meta name="description">`. One exception: `pages/newsletter-detail.html` ships placeholder title/description that's overwritten client-side by `js/newsletter-detail.js` (`document.title = pageTitle`) — so raw HTML has no real per-article metadata. |
| `noindex` on utility pages | ✅ Correct | `pages/rate-us.html`, `404.html`, `500.html`, `offline.html` correctly carry `<meta name="robots" content="noindex, nofollow">`. |
| Open Graph / Twitter cards | ⚠️ Homepage + 1 page only | Full tags exist on `index.html:10-18` and `pages/pre-signup-link.html`. The other 21 pages under `pages/` (confirmed via repo-wide search) have none. |
| Structured data (schema.org / JSON-LD) | ❌ Absent site-wide | No `<script type="application/ld+json">`, no microdata, anywhere. `pages/faq.html` has an actual FAQ UI that would directly benefit from `FAQPage` schema — currently unused. |
| Canonical URLs | ⚠️ Homepage only | Only `index.html:9` has `<link rel="canonical">`. Confirmed zero matches under `pages/`. |
| Sitemap & robots.txt | ❌ Absent | Neither file exists anywhere in the repo. |
| Semantic HTML | ⚠️ Present only after JS runs | Raw `index.html` and `pages/*.html` contain no `<header>`/`<nav>`/`<footer>` tags — these only exist inside JS template strings in `js/header.js` and `js/footer.js`, injected via `innerHTML` on `DOMContentLoaded`. Page bodies also lean heavily on generic `<div>`s over `<section>`/`<article>`. |
| Internal linking | ⚠️ Centralized, but JS-dependent | Nav links are centralized in `js/links.js` (loaded non-deferred, before header/footer) and rendered by `js/header.js`/`js/footer.js`. Same JS-dependency caveat as above applies to link discoverability for non-JS crawlers. |
| Rendering strategy | Static HTML/JS, no SSR/SSG | No bundler or static-site generator; pages are plain files served as-is via GitHub Pages. Tailwind is loaded via CDN script, not built. |
| Analytics / search tooling | ⚠️ Minimal | Only Meta/Facebook Pixel (`js/meta-pixel.js`, loaded post-consent — not present in raw page source). No Google Search Console, GA, or Plausible found anywhere. |
| Orphaned long-form content | ❌ Not published | `krisflyer-guide.md` and `krisflyer-purchase-guide.md` (~320+ lines each) sit at the repo root but aren't linked from or rendered by any HTML/JS page — they're not crawlable or indexable in their current state. |

## Ownership summary

- **Codebase-owned (everything above):** all metadata, OG/Twitter tags, canonical URLs, structured data, sitemap/robots.txt, semantic HTML, internal linking, and rendering — all live in this repo's HTML/JS and are deployed statically via GitHub Pages. There is no separate SEO plugin, CMS field, or dashboard controlling any of it.
- **Third-party services (no SEO role today):**
  - **Beehiiv** — source of newsletter content (fetched client-side via `js/newsletter-archive.js` / `js/newsletter-detail.js`); generates no metadata, OG tags, or schema for the site.
  - **Airtable** — CRM backend for form submissions only; not content- or metadata-facing.
  - **Stripe** — billing/checkout for Altitude Access; unrelated to search visibility.
  - **Cloudflare Worker** (`cloudflare/subscribe-worker.js`) — API backend only (CORS, forms, membership, cron); no redirect, header-injection, or routing logic relevant to SEO.

## Prioritized gap list (working backlog)

Roughly ranked by impact vs. effort — not yet approved as a committed roadmap, just the ordering the gaps naturally fall into:

- **P0 — Add `robots.txt` and `sitemap.xml`.** Missing entirely; cheap to add; establishes baseline crawlability for every search/answer engine.
- **P0 — Add canonical tags to all pages under `pages/`.** Currently only the homepage has one; risk of duplicate-content ambiguity elsewhere.
- **P1 — Add OG/Twitter tags to all pages under `pages/`.** Needed for correct link previews and shareability sitewide, not just the homepage.
- **P1 — Add JSON-LD structured data:** `Organization`/`LocalBusiness` sitewide, `FAQPage` on `pages/faq.html`, `Article`/`BlogPosting` on newsletter pages. Directly supports AEO/GEO (answer engines lean heavily on structured data to extract facts).
- **P1 — Make header/nav/footer present in raw HTML, not only JS-injected.** The single highest-impact AEO/GEO fix — non-JS-executing crawlers currently see zero navigation structure. Doesn't require a full framework migration; could be as simple as inlining the static markup and letting JS enhance rather than construct it.
- **P2 — Server-render or pre-render newsletter article content and metadata.** Currently 100% client-fetched (`js/newsletter-archive.js`, `js/newsletter-detail.js`); individual articles have no per-article canonical/OG/schema and may not be indexed as distinct URLs at all.
- **P2 — Semantic HTML pass on page bodies.** Replace generic `<div>`s with `<section>`/`<article>`/`<main>` landmarks where appropriate.
- **P3 — Decide: publish or delete `krisflyer-guide.md` / `krisflyer-purchase-guide.md`.** Currently orphaned, unindexable content sitting at the repo root.
- **P3 — Decide whether to add search-visibility analytics** (e.g., Google Search Console). A product/ownership decision more than a code task — flagged here rather than prescribed.

None of this has been actioned yet — flagging for prioritization before any implementation work begins.
