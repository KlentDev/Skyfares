# Skyfare Services + KrisFlyer Surface Redesign

## Objective

Bring `/pages/services` and `/pages/krisflyer` up to the current homepage standard while improving the customer journey from discovery to enquiry. Preserve Skyfare's real business model: founder-led premium travel consulting with WhatsApp as the primary conversion path.

The `/pages/assessment` page is completely out of scope. `/pages/cabin-compare` remains unchanged except for removing the bottom “Skyfare Verdict” section.

## Approved conversion model

Use a balanced, intent-aware CTA hierarchy rather than repeating the same CTA on every surface.

| Surface | Primary CTA | Secondary CTA |
| --- | --- | --- |
| Services | `Find the right service` → service selector | `Send us your trip` → WhatsApp |
| KrisFlyer | `Check a KrisFlyer route` → WhatsApp | `Explore the mileage map` → map section |

The service selector should let visitors self-identify before opening WhatsApp. KrisFlyer visitors have clearer intent, so route checking can lead directly to WhatsApp. Section-level CTAs remain contextual: `Compare cabins`, `Arrange a transfer`, `See concierge support`, and `Explore routes`.

## Services page architecture

1. **Hero / orientation**
   - Message: Skyfare helps with the specific parts of premium travel that are expensive, complex, or easy to get wrong.
   - Primary action: `Find the right service`.
   - Secondary action: `Send us your trip`.
   - Use an asymmetric editorial composition with existing overview imagery and a compact proof strip. Do not introduce unsupported statistics.

2. **Service selector**
   - Three distinct paths based on the existing ecosystem:
     - KrisFlyer Miles: route, timing, redemption, and booking-path guidance.
     - Chauffeur: Changi pickup, departure, meet-and-greet, and vehicle handoff.
     - Concierge: fast track, visas, hotels, premium fares, and trip details.
   - Each path gets a different visual treatment and outcome-led copy rather than identical generic cards.

3. **Decision support / “Which path fits?”**
   - A concise problem-to-service matrix or editorial selector.
   - Answer: “I know what I want to improve, but which service is appropriate?”
   - Keep the interaction lightweight and accessible; no new dependency or complex wizard.

4. **Route proof**
   - Retain the existing real route imagery and mileage examples.
   - Present routes as evidence of practical capability, not as a second service directory.
   - Keep the existing data and WhatsApp deep-link behavior.

5. **How the engagement works**
   - Explain the real path: share the trip → Skyfare checks the relevant options → choose the next step.
   - Use a process composition, not another repeated three-card feature row.

6. **Conversion close**
   - Primary: `Send us your trip`.
   - Secondary: `Explore KrisFlyer options`.
   - Keep copy human and specific; no fabricated outcomes or proof points.

## KrisFlyer page architecture

1. **Hero / route confidence**
   - Message: use KrisFlyer miles with a clearer plan before committing miles, dates, or a booking path.
   - Primary action: `Check a KrisFlyer route` → WhatsApp.
   - Secondary action: `Explore the mileage map` → map anchor.
   - Retain the KrisFlyer-specific hero photography and use a left-aligned editorial layout.

2. **Intent shortcuts**
   - Three lightweight links: check a route, compare redemption paths, understand the booking process.
   - These should anchor to existing page content, not create new products.

3. **Interactive mileage map**
   - Reuse the homepage route data, SVG map, route explorer, browse dialog, selected-route detail card, and route state behavior.
   - Adapt the section context specifically for KrisFlyer: “Explore where your miles can take you from Singapore.”
   - Add guidance explaining hover/focus/select behavior and the indicative nature of mileage.
   - Keep search, region filter, route list, selected destination detail, cabin compare link, and WhatsApp enquiry behavior.
   - Load the shared route-detail presenter so selected routes populate correctly.
   - Make asset paths page-aware through a small, backward-compatible shared-script option instead of duplicating the map implementation.

4. **Redemption path comparison**
   - Retain and refine Nominee Redemption vs Direct Transfer.
   - Make the distinction decision-oriented: speed / confirmed ticketing versus flexibility / miles to own account.
   - Preserve the existing timing and product claims.

5. **Mileage route board**
   - Retain the searchable route data table as a deeper reference below the map.
   - Use the map as the discovery layer and the table as the precision layer; do not make both sections compete for the same role.

6. **What Skyfare checks**
   - Retain real decision factors: availability and timing, taxes and surcharges, and booking path.
   - Present these as an editorial checklist or split panel rather than a generic feature grid.

7. **Conversion close**
   - Primary: `Check a KrisFlyer route`.
   - Secondary: `All Services`.

## Visual system

- Use existing homepage ground truth: Lexend headings, Manrope body/UI, Sky Blue interactive accent, Gold for premium/mileage signals, white/parchment/navy surface rhythm.
- Extend the existing additive `-v2` CSS pattern with page-scoped classes. Avoid changing shared legacy component behavior unless required for the map path fix.
- Prefer editorial split layouts, route imagery, data-led panels, and section-level composition over equal three-column card rows.
- Keep body copy around the current readable line length and do not introduce unsupported claims.
- Use existing icons, imagery, route data, WhatsApp links, and shared header/footer.

## Interaction and motion

- Preserve existing reveal behavior and reduced-motion support.
- Use short, interruptible transitions for hover, focus, press, selector state, and map selection.
- Add only purposeful motion: card affordance, route emphasis, map focus, and scroll reveal.
- Never animate layout dimensions or use decorative perpetual motion.
- Add explicit visible focus styles for selector links, map paths/nodes, table controls, and CTAs.
- Preserve accessible keyboard selection and screen-reader announcements in the map.

## Responsive behavior

- Desktop: asymmetric editorial split sections and wide map/table surfaces.
- Tablet: reduce split ratios, keep CTA hierarchy, and collapse dense grids to two columns.
- Mobile: single-column content, full-width primary CTA, compact intent shortcuts, map with usable minimum height, and route detail card placed below the map rather than obscuring it.
- Keep map search/filter controls stacked or wrapped without horizontal overflow.
- Preserve 44px minimum interactive targets and `prefers-reduced-motion` behavior.

## Allowed files and boundaries

Expected changes:

- `pages/services.html`
- `pages/krisflyer.html`
- `pages/cabin-compare.html` — remove only the Skyfare Verdict section and its local verdict-only CSS/comments if no longer needed.
- `css/style.css` — append new scoped page styles only.
- `js/mileage-route-explorer.js` and/or `js/route-modal.js` — only the minimal page-aware asset-prefix adjustment required to reuse the map on `/pages/krisflyer`.

Explicitly do not modify:

- `pages/assessment.html`
- authentication, payment, checkout, backend, or unrelated routes
- global header/footer behavior unless verification reveals a pre-existing page-path issue directly caused by the redesign
- unrelated pages or shared data values

## Verification

- Compare Services, KrisFlyer, and homepage side by side for typography, surfaces, CTA grammar, container alignment, and section rhythm.
- Confirm the map initializes, loads the world outline, responds to hover/focus/click, filters routes, opens the browse dialog, updates the selected-route card, and preserves the compare/enquiry links.
- Confirm route asset URLs work from both `/index.html` and `/pages/krisflyer.html`.
- Confirm `/pages/assessment.html` is byte-for-byte unchanged.
- Confirm Cabin Compare differs only by the removed verdict section.
- Run static checks, the Impeccable detector once over changed targets, and browser-based desktop/mobile visual checks.
