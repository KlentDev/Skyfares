# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Affluent/aspirational travelers who want to fly business or first class but don't want to learn the points-and-miles system themselves — professionals booking premium leisure or business travel who value time, service, and a trusted expert over doing the mileage-optimization research personally.

## Product Purpose

Skyfare Consulting is a white-glove booking concierge: it converts the founder's personal, hands-on expertise in premium-cabin award travel (flight reviews, lounge/service standards, loyalty-program mechanics) into a done-for-you service that books business/first-class flights using points and miles, typically at a fraction of cash fare cost. Success is a client flying premium for less, without having to learn nominee/transfer mechanics, saver-vs-advantage award pricing, or airline loyalty rules themselves.

## Positioning

Personal, founder-led expertise (not a faceless points-hacking forum or a generic travel agency) applied as a repeatable service: real flight/lounge experience translated into insider redemption strategy, delivered via a fast, high-touch WhatsApp/concierge relationship rather than a self-serve booking tool.

## Operating Context

- Primary booking channel today is WhatsApp-driven enquiry (route tiles, hero CTAs, and most page CTAs deep-link into a pre-filled WhatsApp message).
- A paid membership/subscription product ("Skyfare Altitude") exists alongside the core booking service, sold via Stripe Checkout (monthly/annual tiers) plus a one-off "KrisFlyer Guide" e-book product, both gated behind the same magic-link login system.
- A content arm (Beehiiv-backed newsletter, TikTok/Instagram social feeds, an Airtable-backed testimonials archive) supports trust-building and organic acquisition alongside the direct booking funnel.
- Static site, no backend framework: plain HTML pages + a single shared `css/style.css`, Tailwind (vendored Play/JIT build) for utility classes, and a Cloudflare Worker backing the dynamic bits (checkout, newsletter, testimonials, magic-link auth).

## Capabilities and Constraints

- `index.html` and 23 other pages under `/pages/` share one global stylesheet (`css/style.css`) and shared JS-injected header/footer (`js/header.js`, `js/footer.js`); a change to a shared CSS class or JS function used homepage-side can silently affect other pages.
- Real, working integrations exist behind several homepage sections and must not be treated as placeholder/demo content: Stripe Checkout (Pricing section button IDs), Airtable-backed testimonials (`js/testimonials.js`), Beehiiv-backed newsletter archive/signup (`js/newsletter.js`), TikTok/Instagram embeds, WhatsApp deep links (`js/links.js`).
- No stated accessibility standard beyond general web best practice; a working `prefers-reduced-motion` override already exists site-wide and must be preserved/extended, not replaced.

## Brand Commitments

- Brand name: Skyfare / Skyfare Consulting.
- Primary interactive accent: Sky Blue `#0066cc` — locked, non-negotiable for this and future visual work.
- Secondary accent: Gold `#C9A227` — reserved for loyalty/premium/"Altitude" signals — locked.
- Typography: Lexend (display/headings) + Manrope (body/UI), Google Fonts-hosted.
- WhatsApp green (`#22c55e`) is an intentional, separate messaging-CTA color, not a brand accent.

## Evidence on Hand

- Real destination/route photography (`images/routes-images/`), real founder photo/video (hero background video, founder section), real airline partner logos (marquee).
- Real testimonials (Airtable-backed, via `js/testimonials.js`), real newsletter archive (Beehiiv-backed), real TikTok/Instagram social presence.
- Real pricing tiers and live Stripe Checkout flow for Skyfare Altitude membership and the KrisFlyer Guide.
- No fabricated customers, benchmarks, or claims should be introduced by future design work; all of the above are genuine and already wired to live data sources.

## Product Principles

1. The founder's personal, demonstrated expertise is the trust mechanism — design should keep the human/founder story prominent, not abstract it into generic "expert-backed" iconography.
2. WhatsApp is the primary conversion path for the core booking service; every route/enquiry CTA should keep that deep-link pattern rather than routing to a generic contact form.
3. Real content (testimonials, routes, pricing, social proof) always outranks decorative placeholder UI — never invent data to fill a section.
4. The site is a single shared codebase across 24 pages; visual evolution should default to additive, non-destructive changes unless a shared-system update is explicitly scoped and approved.

## Accessibility & Inclusion

No product-specific requirement beyond general best practice (contrast, keyboard focus, `prefers-reduced-motion` support) has been established.
