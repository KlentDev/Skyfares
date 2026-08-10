# Skyfare Services UI/UX Redesign Plan

Planning status: documentation only. No implementation yet.

Primary implementation targets for first build:
- `pages/services.html`
- `pages/krisflyer.html`

Later targets in the same service system:
- `pages/chauffeur.html`
- `pages/extra-services.html`

Explicitly ignored for this phase:
- Travel Strategy Call page

## 1. Current-State Audit

### Existing strengths

Skyfare already has strong base ingredients:

- Brand system is clear: Lexend for display, Manrope for body, Sky Blue `#0066cc`, Gold `#C9A227`, deep navy surfaces.
- Shared header is injected from `js/header.js`, and the visible header CTA is already focused on Altitude Access.
- Shared CTA band exists through `components/cta-section.html` and `js/cta-section.js`.
- Coming Soon and locked states are centralized through `js/coming-soon.js`.
- Service pages use real image assets:
  - `images/page-images/overview.JPG`
  - `images/page-images/krisflyer-miles.png`
  - `images/page-images/chauffeur.png`
  - `images/page-images/concierge-services.png`
  - `images/routes-images/*.jpg`
  - `images/destinations/*`
- Services and KrisFlyer already contain useful route and mileage data in `js/services.js` and `js/krisflyer.js`.
- Existing motion base is usable: `.slide-up`, `.reveal-pop`, route-card hover states, reduced-motion handling.

### Current weaknesses

The Services experience still reads too much like:

> Here are services we offer.

The current pages rely on a repeated pattern:

Hero, benefit cards, grid cards, CTA.

That makes the experience feel polished but predictable. It does not yet help a visitor answer:

- Which Skyfare service fits my trip?
- What problem does each service solve?
- What outcome will I get?
- Why should I ask Skyfare instead of doing it myself?
- What should I do next?

### Page-specific findings

Services Overview:
- Current hero is attractive, but generic: "Expert strategy for Business & First Class."
- It jumps from hero to nominee redemption, so the page behaves like a KrisFlyer page instead of a true service gateway.
- Popular route cards are strong and should be reused, but they should become part of discovery, not just a static gallery.
- Award chart is valuable but data-heavy. It needs framing so visitors understand why it matters.

KrisFlyer Miles:
- The page explains two redemption options, but it does not yet create enough "I need this" momentum.
- Nominee Redemption vs Direct Transfer is useful, but should become a decision tool rather than two static cards.
- The locked KrisFlyer Guide cross-sell currently says "Join the waitlist"; the desired direction is simply "Coming Soon."
- "Why Skyfare" repeats generic trust claims. It should become a concrete method section.

Chauffeur:
- Current page is clear but thin.
- It sells reliability but not the experience of arrival, handoff, timing, and confidence.
- It needs more premium travel storytelling: Changi pickup, flight tracking, meet-and-greet, vehicle comfort, traveler context.

Concierge Services:
- Current page combines chauffeur and concierge, then lists services in cards.
- It has good service inventory: fast track immigration, visa assistance, cash flight bookings, hotel recommendations.
- It needs a stronger "tell us what you need handled" interaction and a more personalized feel.

## 2. Redesign Strategy

### New positioning

The Services area should become:

> A travel experience design system that helps visitors explore what is possible, understand the right path, and ask Skyfare for help with confidence.

Not:

> A directory of service pages.

### Core experience model

Use this flow across the Services ecosystem:

1. Intent: What kind of trip are you trying to create?
2. Discovery: Which travel need best matches you?
3. Possibility: What routes, miles, services, and support are available?
4. Proof: Why Skyfare can handle it safely and well.
5. Action: Start with the lowest-friction next step.

### Design tone

The local UI database recommended an immersive/interactive direction with a bento-style structure, variance 8, motion 6, density 4. Apply that direction with Skyfare's existing brand system instead of replacing the brand fonts or colors.

Use:
- Asymmetric layouts.
- Interactive decision panels.
- Route and mileage visualization.
- Editorial section pacing.
- Real travel photography.
- Premium microcopy.
- Compact proof moments.
- Motion that explains state changes.

Avoid:
- Generic three-card service grids.
- Repeating homepage sections.
- Overusing "Why Skyfare" blocks.
- Large decorative gradient backgrounds.
- Heavy WebGL or scroll-jacking.
- Marketing copy that sounds like a traditional travel agency.
- Long static FAQ walls inside service pages.

## 3. Services Overview Page Plan

Primary page role:

> Gateway, service discovery, recommendation, and route exploration.

The Overview page should not deeply explain every service. It should help people choose a direction.

### Section 1: Interactive Service Hero

Purpose:
- Shift the page from "services list" to "trip design entry point."

Concept:
- Hero headline asks a visitor-facing question:
  - "What kind of trip are you trying to create?"
  - or "Start with the trip. We will shape the path."

Composition:
- Left: editorial headline, short copy, primary CTA.
- Right: layered travel board with route chips, destination image tiles, mini itinerary notes, and service tags.
- Keep real travel photography visible in first viewport.

Primary CTA:
- "Explore Services"
- Scrolls to Service Finder.

Secondary CTA:
- "Message Skyfare"
- WhatsApp.

Do not use:
- "Book a Call" as the main CTA in this phase.

Motion:
- Route chips stagger in at 40ms intervals.
- Hero image slowly settles from scale `1.02` to `1`.
- CTA press feedback `scale(0.97)`.
- Reduced motion: static hero, no stagger.

### Section 2: Service Finder

Purpose:
- Help visitors self-identify the right service.

Question:
- "What can we help shape?"

Choices:
- "Use my miles better"
- "Book premium seats"
- "Make arrival seamless"
- "Handle trip details"
- "Compare travel options"
- "I am not sure yet"

Behavior:
- Clicking a choice updates one recommendation panel.
- Panel shows recommended service, why it fits, best next action, and a supporting visual.
- No long questionnaire.

Recommendation map:
- Use my miles better -> KrisFlyer Miles
- Book premium seats -> KrisFlyer Miles or Concierge cash booking
- Make arrival seamless -> Chauffeur
- Handle trip details -> Concierge Services
- Compare travel options -> Services Overview route explorer
- I am not sure yet -> WhatsApp / general concierge path

Motion:
- Active chip moves with a small transform.
- Recommendation panel fades and translates `y: 8px`, 180-220ms.
- Avoid layout shift by keeping panel height stable.

### Section 3: Service Worlds

Purpose:
- Present each service as a distinct experience, not equal cards.

Layout:
- Three asymmetric panels instead of uniform cards.

KrisFlyer Miles panel:
- Visual language: mileage ticker, route line, cabin label.
- Message: "Turn miles into confirmed premium seats."
- Action: "Explore KrisFlyer Miles."

Chauffeur panel:
- Visual language: arrival timeline, airport to hotel route.
- Message: "Make the first and last mile feel effortless."
- Action: "Explore Chauffeur."

Concierge panel:
- Visual language: request stack or trip checklist.
- Message: "Let Skyfare handle the details around the flight."
- Action: "Explore Concierge."

Interaction:
- Hover reveals a "best for" line.
- Mobile uses stacked panels with horizontal image band.

### Section 4: Route Opportunity Explorer

Purpose:
- Make the existing route data feel exploratory and premium.

Use current route cards:
- New York City
- London
- Melbourne
- Dubai
- Paris
- Los Angeles

Upgrade concept:
- Convert static grid into "Where could this take you?"
- Add route filters:
  - Long-haul
  - Europe
  - Australia
  - USA
  - Quick wins
- Keep simple buttons or segmented controls.

Each route card should show:
- SIN -> destination code
- destination photo
- starting miles
- cabin
- best service path
- WhatsApp enquire action

Motion:
- Route line draw on active filter.
- Image zoom max `1.04`.
- Card hover `translateY(-4px)`.
- Route list filter uses opacity and transform, no expensive layout animations.

### Section 5: Decision Matrix

Purpose:
- Help visitors decide quickly.

Format:
- A compact comparison table or responsive switchboard.

Rows:
- "I already have miles"
- "I need a confirmed seat"
- "I want airport transfer"
- "I need visas, hotels, fast track, or extras"
- "I have a complex trip"

Columns:
- Best Skyfare path
- Why it fits
- Next action

CTA by row:
- KrisFlyer page
- Chauffeur page
- Concierge page
- WhatsApp

Motion:
- Row hover highlight.
- On mobile, each row becomes a compact decision card.

### Section 6: Trust Through Process

Purpose:
- Replace generic trust claims with concrete operating principles.

Content model:
- "What happens after you message us?"

Steps:
- Send route or trip need.
- Skyfare checks availability, timing, and fit.
- You receive the recommended path.
- Skyfare handles booking, handoff, or concierge coordination.

Keep it short. This is not another full "How It Works" section.

### Section 7: Closing CTA

Purpose:
- Convert undecided users.

CTA copy:
- Heading: "Not sure where to start?"
- Description: "Tell us the trip you are trying to create. We will point you to the right Skyfare path."
- Primary: "Message Skyfare"
- Secondary: "Explore KrisFlyer Miles" or "Browse Routes"

Use shared CTA system, but set page-specific copy from the mount.

## 4. KrisFlyer Miles Page Plan

Primary page role:

> Help visitors understand how Skyfare turns miles into premium flight outcomes.

The page should feel like a premium miles advisory experience, not a pricing/options page.

### Section 1: Miles Opportunity Hero

Purpose:
- Make KrisFlyer value feel tangible immediately.

Concept:
- "Your miles can become more than a balance."
- or "Turn KrisFlyer miles into confirmed premium seats."

Composition:
- Editorial copy on one side.
- Interactive miles card on the other:
  - route code
  - cabin
  - starting miles
  - nominee/direct option tags
  - "confirmed path" status

Primary CTA:
- "Check a Route on WhatsApp"

Secondary CTA:
- "Compare Redemption Options"

Avoid:
- Locked assessment CTA as the dominant first action.

Motion:
- Mileage number count-up once when visible, 600-800ms.
- Route line draw, 700-900ms.
- Reduced motion: static number and line.

### Section 2: Redemption Path Selector

Purpose:
- Make Nominee Redemption vs Direct Transfer easy to understand.

Format:
- Two-tab or segmented comparison.

Tabs:
- "I want a confirmed ticket"
- "I want miles in my account"

Nominee Redemption content:
- Best for confirmed seats.
- Faster path.
- Skyfare manages ticketing.
- No waitlist positioning.
- CTA: WhatsApp.

Direct Transfer content:
- Best for flexibility.
- 3-4 week timing.
- Miles credited to account.
- CTA: WhatsApp or Contact.

Show tradeoffs:
- Speed
- Flexibility
- Control
- Complexity
- Best traveler type

Motion:
- Tab underline slides 180ms.
- Content crossfades 180-220ms.
- No height jumps.

### Section 3: Mileage Route Board

Purpose:
- Turn the award chart from raw data into discovery.

Use existing `awards` data.

Top view:
- Curated route cards or compact route board.
- Search and region filter remain.
- Add "featured route" state for popular routes.

Messaging:
- "Use this as a starting point. Availability, taxes, and routing rules still matter."

Interaction:
- Search destination.
- Filter region.
- Click route opens WhatsApp with prefilled route inquiry if implementation allows later.

Motion:
- Table row reveal should be subtle, no full table re-animation on every keystroke.
- Filter chips use transform/opacity only.

### Section 4: What Skyfare Checks

Purpose:
- Build trust by showing expertise.

Replace generic "Why Skyfare" with a method section:

- Award availability.
- Saver vs Advantage logic.
- Taxes and surcharges.
- Routing and partner options.
- Nominee registration and timing.
- Ticketing sequence and privacy.

Composition:
- Split layout with checklist on one side and route/miles visual on the other.

### Section 5: Common Mistakes Accordion

Purpose:
- Create urgency and expertise without fearmongering.

Accordion items:
- Assuming waitlists will clear.
- Transferring points before checking availability.
- Ignoring partner routes.
- Comparing miles without checking taxes.
- Choosing the wrong cabin or date window.

Motion:
- Accordion open 180-240ms.
- Rotate indicator only.
- Reduced motion: instant open.

### Section 6: KrisFlyer Guide Cross-Sell

Purpose:
- Mention the Guide without competing with the service.

State:
- Coming Soon only.
- No "Join waitlist" copy.
- Keep it locked/blurred only if the current product state requires it.

Copy direction:
- "The KrisFlyer Guide is coming soon."
- "A self-study playbook for travelers who want to learn the strategy behind premium redemptions."

CTA:
- None, or a disabled "Coming Soon" badge.

### Section 7: Closing CTA

Purpose:
- Make action simple.

CTA copy:
- Heading: "Have a route in mind?"
- Description: "Send us your destination, dates, and preferred cabin. We will check the best KrisFlyer path."
- Primary: WhatsApp.
- Secondary: Services Overview or Browse Routes.

## 5. Chauffeur Page Plan

Primary page role:

> Sell the feeling of a seamless arrival and departure.

### Section plan

Hero:
- Move from "Airport Transfers" to a more experience-led headline:
  - "Land. Be met. Move smoothly."
  - or "Premium airport transfers, handled from touchdown."

Arrival Timeline:
- Visual route strip:
  - Flight lands.
  - Chauffeur tracks arrival.
  - Meet and greet.
  - Luggage and vehicle handoff.
  - Hotel, meeting, or home.

Service Context Selector:
- "What kind of ride do you need?"
- Options:
  - Changi arrival
  - Changi departure
  - Hourly charter
  - Multi-stop city ride
  - Family or group transfer

Vehicle Comfort Band:
- Use photography if available.
- If no specific fleet photos exist, keep asset use conservative and do not fake exact vehicles.

Trust Section:
- Replace vague stats with operational details:
  - flight tracking
  - terminal knowledge
  - punctual dispatch
  - professional chauffeurs
  - 24/7 coordination

CTA:
- WhatsApp primary.
- Concierge secondary.

## 6. Concierge Services Page Plan

Primary page role:

> Help visitors imagine the details Skyfare can remove from their trip.

### Section plan

Hero:
- Position concierge as "around-the-flight support."
- Headline:
  - "Tell us what needs handling."
  - or "Every detail around the flight, handled."

Request Composer:
- Lightweight interactive panel:
  - "I need help with..."
  - fast track immigration
  - visa assistance
  - hotel recommendations
  - cash flight bookings
  - special occasion trip
  - complex itinerary

Output:
- Updates a small "recommended concierge path" summary.

Journey Layer:
- Before trip:
  - visas, hotel selection, itinerary coordination.
- During trip:
  - fast track, transfers, changes.
- After landing:
  - hotel handoff, onward transport, support.

Service Detail Modules:
- Each service should be a distinct story, not a same-size card:
  - Fast Track: airport time saved and smoother arrival.
  - Visa Assistance: paperwork clarity and fewer missed steps.
  - Cash Flight Bookings: premium fare access and complex itinerary support.
  - Hotel Recommendations: better fit, perks, upgrades where available.

CTA:
- WhatsApp primary.
- Chauffeur secondary where relevant.

## 7. Shared Component Strategy

Do not build four unrelated page designs. Build a flexible service system.

Recommended shared components:

- `service-hero-shell`
  - Editorial headline, supporting copy, image/art panel, CTAs.
- `intent-finder`
  - Choice chips and recommendation panel.
- `route-opportunity-card`
  - Destination image, route code, starting miles, best action.
- `service-world-panel`
  - Larger asymmetric service panels for Overview.
- `journey-timeline`
  - Used for Chauffeur and Concierge.
- `path-selector`
  - Used for KrisFlyer redemption path selector.
- `decision-matrix`
  - Used on Overview.
- `proof-snapshot`
  - Compact proof and method cards.
- `service-cta-band`
  - Use existing shared CTA mount and component where possible.

Keep implementation static HTML + Tailwind-style utility classes. Add small progressive enhancement JS only where interaction helps the user decide.

## 8. Motion Plan

Motion rule:

> Animate meaning, not decoration.

Use existing motion foundation:
- `.slide-up`
- `.reveal-pop`
- shared IntersectionObserver in `js/header.js`
- reduced-motion CSS already present

Recommended additions:

- Route-line draw:
  - SVG stroke animation.
  - 700-900ms.
  - `cubic-bezier(0.23, 1, 0.32, 1)`.
- Service Finder state change:
  - opacity and translateY only.
  - 180-220ms.
- Card hover:
  - `translateY(-4px)`.
  - image scale max `1.04`.
  - pointer-fine only.
- Button press:
  - `scale(0.97)`.
  - 100-160ms.
- Accordion:
  - 180-240ms.
- Stagger:
  - 30-60ms between small groups.
  - avoid staggering more than 8 items.
- Numbers:
  - count up once.
  - 600-800ms.
  - static in reduced motion.

Avoid:
- `transition: all` in new CSS.
- animating height, width, margin, top, left when transform/opacity can work.
- infinite decorative loops.
- scroll-jacking.
- pinning sections.
- heavy WebGL.
- cursor effects on many elements.

## 9. Visual Direction

Use a richer rhythm than hero plus cards.

Page rhythm:
- immersive hero
- interactive decision panel
- asymmetric service world
- route or journey visual
- proof/method section
- final CTA

Color:
- Keep Skyfare Sky Blue and Gold.
- Add more tonal contrast through white, deep navy, soft gray, and restrained gold accents.
- Avoid one-note blue pages.

Typography:
- Keep Lexend and Manrope for brand consistency.
- Make the pages feel playful through copy, interaction, layout, and visual objects, not by changing to a childish font.

Photography:
- Use current page and route images.
- Use destination photos as proof of possibility.
- Avoid generic dark overlays everywhere.
- Make images inspectable and specific.

Iconography:
- Continue Font Awesome unless a broader icon migration happens later.
- Use icons as utility signals, not decoration.

## 10. Marketing and Conversion Strategy

Services Overview conversion goal:
- Get the visitor to choose a relevant path or message Skyfare.

KrisFlyer conversion goal:
- Get the visitor to send a route/dates/cabin inquiry.

Chauffeur conversion goal:
- Get the visitor to request a transfer.

Concierge conversion goal:
- Get the visitor to describe what needs handling.

Marketing principles:

- Lead with the desired travel outcome.
- Explain services through situations, not internal categories.
- Use route and mileage data as proof.
- Make uncertainty feel solvable.
- Keep WhatsApp as the low-friction action.
- Treat assessment/travel strategy as out of scope for this phase.

Recommended CTA language:

- "Message Skyfare"
- "Check a Route"
- "Explore KrisFlyer Miles"
- "Request a Transfer"
- "Tell Us What You Need"
- "Browse Popular Routes"

Avoid:

- Too many "Book Now" CTAs.
- Repeated "Book a Call" CTAs.
- Generic "Learn More" when a more specific action exists.
- Waitlist CTAs for KrisFlyer Guide in this phase.

## 11. Content Redundancy Rules

Do not copy homepage sections.

Avoid repeating:
- Homepage "Choose Your Path" cards.
- Homepage pricing blocks.
- Homepage FAQ wall.
- Homepage testimonial grid.
- Generic "Why Skyfare" claims.

Instead:
- Services Overview owns discovery.
- KrisFlyer owns miles strategy and redemption decision-making.
- Chauffeur owns arrival/departure experience.
- Concierge owns personal travel-detail handling.

## 12. Responsive Plan

Mobile:
- Service Finder choices become horizontally scrollable chips or two-column buttons.
- Recommendation panel remains fixed-height enough to prevent jumping.
- Route explorer uses horizontal scroll-snap.
- Tables become cards or retain horizontal scroll only where data density requires it.
- Hero art should appear below copy or as background detail, not squeeze text.

Tablet:
- Two-column layouts where image and decision panel can breathe.
- Keep route cards in two columns.

Desktop:
- Use asymmetry.
- Keep max text width controlled.
- Allow image and data panels to become the visual anchor.

QA widths:
- 375px
- 768px
- 1024px
- 1440px

## 13. Accessibility and Performance

Accessibility:
- All interactive chips must be real buttons.
- Use `aria-pressed` or tab roles only if behavior truly matches tabs.
- Visible focus states required.
- Locked/coming-soon elements must remain accessible, consistent with current `js/coming-soon.js` behavior.
- Reduced motion must disable route draw, count-up, parallax, and stagger.

Performance:
- Lazy-load offscreen images.
- Keep route and destination imagery optimized.
- Use transform and opacity only for most motion.
- Avoid loading GSAP unless a specific interaction cannot be done cleanly with CSS/vanilla JS.
- No WebGL for this phase.

## 14. Implementation Sequence

Phase 1: Services Overview and KrisFlyer

1. Freeze page inventory and content.
2. Create service-specific CSS layer in `css/style.css` with scoped classes.
3. Redesign `pages/services.html` structure.
4. Add small service finder behavior to `js/services.js`.
5. Redesign `pages/krisflyer.html` structure.
6. Add redemption selector and route-board refinements to `js/krisflyer.js`.
7. Update CTA mount copy for both pages.
8. Verify no Travel Strategy page implementation changes.
9. Test desktop and mobile.
10. Test reduced motion.

Phase 2: Chauffeur and Concierge

1. Apply shared service hero shell.
2. Build Chauffeur arrival timeline.
3. Build Concierge request composer.
4. Reuse shared CTA and proof patterns.
5. Test mobile touch interactions.

Phase 3: Polish

1. Add route-line animation.
2. Add number count-up.
3. Refine hover states.
4. Check contrast.
5. Check text fit.
6. Run browser screenshots if a local server is started during implementation.

## 15. First Build Recommendation

Start with `pages/services.html`.

Reason:
- It defines the service system.
- It controls the visitor's first understanding of all service pages.
- Its Service Finder and Service Worlds can become reusable patterns.

Then build `pages/krisflyer.html`.

Reason:
- It has the most valuable existing data.
- It is the most conversion-sensitive service page.
- It can reuse route, mileage, and decision components from Overview.

Do not begin by redesigning Chauffeur or Concierge, because their final shape should inherit patterns from the Overview page.

