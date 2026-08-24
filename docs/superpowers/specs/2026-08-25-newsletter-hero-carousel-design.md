# Newsletter Page Hero Carousel — Design

## Context

`pages/newsletter.html` currently opens with `.page-hero-bg.newsletter-hero-v2` — the same canonical static-photo hero every interior page uses (`services.html`, `krisflyer.html`, etc.), just with a subscribe form and an "Inside the brief" desk card layered on top. Directly below it, a separate "2. FEATURED ISSUE" section (`#featured-issue-container`, populated by `renderFeatured()` in `js/newsletter-archive.js`) shows the single newest issue again as a horizontal split card.

The user wants the newsletter page to look distinct from the rest of the site instead of reusing the shared hero pattern, and wants the "latest issue" data to actually live in the hero — full-bleed, as a rotating carousel of the 3 newest issues — rather than in a separate section beneath it.

## Goal

Replace the static-photo hero with a full-bleed, auto-rotating carousel hero built from the 3 latest issues' own thumbnails/titles/descriptions/tags. Remove the now-redundant single-issue "Latest Issue" section. Relocate the "Inside the brief" explainer to its own section after the bottom CTA band.

## Approach

### 1. New hero markup — `pages/newsletter.html`

Replace the `<section class="page-hero-bg newsletter-hero-v2 ...">` block (lines 44–104) with:

```html
<section class="newsletter-hero-v3" id="newsletter-hero-carousel" aria-label="Latest issues">
  <div class="newsletter-hero-v3__topbar container mx-auto px-4 md:px-6">
    <span class="newsletter-hero-v3__brand"><i class="fa-solid fa-envelope-open-text"></i> Skyfare Altitude &middot; Free</span>
    <div class="newsletter-hero-v3__form" data-newsletter-form>
      <label for="hero-email" class="sr-only">Email address</label>
      <input id="hero-email" data-newsletter-email type="email" autocomplete="email" placeholder="Your email address">
      <button data-newsletter-btn><i class="fa-solid fa-paper-plane"></i> Subscribe</button>
      <p data-newsletter-status class="hidden" aria-live="polite"></p>
    </div>
  </div>

  <div id="newsletter-hero-track" class="newsletter-hero-v3__track" aria-live="off">
    <!-- 3x .newsletter-hero-v3__slide, rendered by js/newsletter-archive.js -->
  </div>

  <div id="newsletter-hero-dots" class="newsletter-hero-v3__dots" role="tablist" aria-label="Choose issue"></div>
</section>
```

`data-newsletter-form`/`data-newsletter-email`/`data-newsletter-btn`/`data-newsletter-status` are unchanged from today so `js/newsletter.js`'s existing `SkyNewsletter.bind()` wiring keeps working without modification — this is just a visually-compacted copy of the same form.

Skeleton state (before the fetch resolves): one static slide using `images/page-images/newsletter.png` (today's hero photo) with a pulse/loading treatment, so there's no layout flash.

### 2. Hero carousel styles — `css/style.css`

New `.newsletter-hero-v3*` rules, placed near the existing `.newsletter-hero-v2*` block (which stays — other pages don't use it, but nothing else currently depends on removing it):

- `.newsletter-hero-v3`: `height: clamp(32rem, 80vh, 46rem)`, `position: relative`, `overflow: hidden`, dark navy `background: #0d1b35` fallback (shows briefly if an image fails to load).
- `.newsletter-hero-v3__track` / `__slide`: each slide `position: absolute; inset: 0`, background-image via inline `style` (mirrors the `--hero-img` var pattern already used by `.page-hero-bg`), `opacity: 0; transition: opacity .6s ease`; `.is-active { opacity: 1; z-index: 1; }`. Bottom-up gradient overlay reusing the same stops as `.testimonials-featured-card__media::after` (already fixed for legibility earlier in this project) so the two full-bleed-image treatments on the site read as one family.
- Slide content (`.newsletter-hero-v3__slide-content`): positioned `absolute; inset-inline: 0; bottom: 0`, inner width capped to the site's standard `container mx-auto px-4 md:px-6`, holding: a topic-tag chip, an `<h1>`-scale title (`font-display font-bold`, clamped size), a 2-line-clamped description, and a meta row (author · date · Free/Premium badge · "Read issue" arrow link).
- `.newsletter-hero-v3__topbar`: `position: absolute; inset-inline: 0; top: 0; z-index: 2`, flex row, brand chip left / compact form right (stacks on mobile).
- `.newsletter-hero-v3__dots`: `position: absolute; bottom: 1.25rem; inset-inline: 0; z-index: 2`, centered row of small buttons; `.is-active` gets a filled/wider pill state (same visual language as `.marquee` dot patterns if any exist, otherwise a simple filled-vs-outline circle).
- Mobile (`max-width: 768px`): shorter clamp height (~26rem), title/description font-size step down, topbar switches to stacked layout (brand chip above the compact form, both full-width).

### 3. Rendering — `js/newsletter-archive.js`

New function, called from `init()` right alongside the existing `renderFeatured(data.posts[0])` / `renderHomePreview(...)` calls:

```js
renderHeroCarousel(data.posts.slice(0, 3)); // literal newest 3 -- not withPinnedFirst
```

`renderHeroCarousel(posts)`:
- No-ops if `#newsletter-hero-track` isn't in the DOM (same guard pattern as `renderFeatured`) — so this function is safe to leave in the shared file without affecting `index.html`.
- Builds one `.newsletter-hero-v3__slide` per post: background-image inline style from `post.thumbnail_url` (falls back to the navy `background` color already set on `.newsletter-hero-v3` if absent), topic chip from the same "first non-utility tag" logic `buildArchiveCard()` already uses, title/description via `post.title` / `getPostSummary(post)`, meta row via `formatDate()` + `isPremium()` (existing helpers).
- Slide click behavior mirrors `buildHomeFeature()`: free issues are an `<a>` with the existing `data-free-newsletter-choice` wiring (so `wireFreeNewsletterChoice()` — already global — handles the read-choice modal); premium issues are a `<div>`/`<article>` with `onclick="window.openAltitudeAccessModal()"`.
- Builds 3 dot buttons into `#newsletter-hero-dots`, each `data-slide-index`.
- Rotation: `setInterval(..., 2000)` advancing `.is-active` to the next slide/dot, wrapping at 3. Manual dot click jumps directly and resets the interval timer (clear + re-`setInterval`) so it doesn't immediately jump again right after a manual pick.
- Respects `prefers-reduced-motion: reduce` (checked once, same as `js/newsletter-modal.js`'s existing carousel and `js/marquee.js`): if set, render all 3 slides/dots but skip the `setInterval` entirely — first slide stays active, dots remain clickable.
- If fewer than 2 posts have thumbnails, degrade gracefully: render whatever's available (1 slide, no dots) rather than erroring.

### 4. Removed — `pages/newsletter.html`

Delete section "2. FEATURED ISSUE" (`data-section="latest-issue"`, `#featured-issue-container`) entirely. `renderFeatured()` in `js/newsletter-archive.js` is left as-is (it already no-ops via `if (!container) return;` when `#featured-issue-container` is absent, and nothing else currently renders it into that container).

### 5. Relocated — `pages/newsletter.html`

Move the "Inside the brief" block (today's `.newsletter-hero-v2__desk`, lines 84–101) to a new standalone section placed after the CTA mount (`data-cta-mount`) and before `</main>`:

```html
<section class="tile-dark2 py-16" aria-label="What the newsletter covers">
  <div class="container mx-auto px-4 md:px-6">
    <div class="newsletter-hero-v2__desk slide-up"> <!-- markup unchanged -->
      ...
    </div>
  </div>
</section>
```

Reuses the existing `.newsletter-hero-v2__desk*` CSS as-is (that component's white-on-glass styling assumes a dark background, which `tile-dark2` — already used elsewhere on the site, e.g. testimonials-featured-card's `#1A2437` — provides). No CSS changes needed for this block, only its markup location.

## Out of scope

- No changes to the "All Issues" archive grid, its filters, or `js/newsletter-modal.js`'s own separate carousel (the popup's left-rail carousel is a different component and already has its own pinned/latest logic — untouched).
- No changes to `index.html`'s newsletter preview section.
- `.newsletter-hero-v2*` CSS/markup is not deleted, since it may still be referenced by memory/other specs as "the" pattern for other interior pages — only `pages/newsletter.html`'s usage of it is replaced.
