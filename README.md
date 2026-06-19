1

2

3

4

5

6

7

8

S K Y F A R E C O N S U L T I N G
Website Rebuild
Specification Document
Version 1.0 · June 2026 · Confidential
1. Overview
This document is the full specification for the Skyfare Consulting website rebuild at
skyfareconsulting.com. It covers brand architecture, page structure, Beehiiv newsletter integration,
paywall logic, technical integrations, and copy guidelines. It is intended for handoff to the frontend
developer.
P R O J E C T G O A L S
– Integrate Beehiiv with a paid newsletter subscription (Skyfare Altitude) at $4.99/month
– Add newsletter subscribe CTAs throughout the site
– Implement a paywall: visitors read the first 3 paragraphs of any issue for free; full content
requires an active Altitude subscription
– Establish a clear three-tier brand architecture (Skyfare / Skyfare Altitude / Skyfare Concierge)
– Refresh the overall design to feel more premium and editorial
2. Brand Architecture
The Skyfare brand now has three distinct tiers. These must be clearly communicated on the website
and consistently named across all pages, CTAs, and copy.
Tier Name Price What's Included
Free Skyfare $0 / month Teaser articles (first 3
paragraphs), deal alert
headlines, brand content
Tier Name Price What's Included
Paid Skyfare Altitude $4.99 / month Full newsletter issues, deal
breakdowns with routing, miles
strategy guides, redemption
tutorials
Premium Skyfare Concierge Custom quote End-to-end flight arrangement
service, dedicated consultant,
priority sourcing
Important naming rules:
– Never abbreviate 'Skyfare Altitude' to just 'Altitude' in headers or CTAs — always use the full
name on first reference per page
– 'Skyfare Concierge' replaces all references to 'our booking service' or 'redemption service' on the
rebuilt site
– The umbrella company name remains Skyfare Consulting Pte. Ltd. — do not rename the brand,
only the sub-products
3. Page Structure
The following pages must be built or rebuilt. Priority P0 pages must be live at launch. P1 pages should
follow within two weeks.
Page / Route Purpose Key Components Priority
/ (Homepage) Dual conversion: book a
flight OR subscribe to
Altitude
Hero with two CTAs, tier
explainer strip,
newsletter teaser,
testimonials, airline
logos
P0 — Launch
/altitude Altitude newsletter sales
page
Value prop, sample
issue teaser, $4.99
CTA, Beehiiv embed,
FAQ
P0 — Launch
/newsletter Public archive of past
issues (SEO + paywall
conversion)
Issue cards with teaser
text, locked blur overlay,
Unlock CTA
P0 — Launch
/services Concierge booking
service detail
Rename to 'Skyfare
Concierge', process
steps, WhatsApp CTA,
intake form link
P0 — Launch
/how-it-works Explainer for new
visitors
Step-by-step flow, FAQ,
trust signals
P1 — Shortly after
/contact Booking enquiry intake Netlify form (existing),
WhatsApp link
P1 — Shortly after
Page / Route Purpose Key Components Priority
/faq Reduces support
volume
Accordion FAQ,
categorised by topic
P1 — Shortly after
3A. Homepage ( / )
The homepage currently has a single conversion path (WhatsApp for bookings). The rebuild adds a
second path: newsletter subscription. Both must be prominent in the hero.
Hero Section
– Headline: 'Fly premium. Think smarter.'
– Subheadline: 'Book Business and First Class for up to 60% less — or get the inside knowledge to
do it yourself.'
– Two CTA buttons, equal visual weight:
– Primary: 'Book a Flight' → WhatsApp link
– Secondary: 'Get Altitude Access' → /altitude
Tier Explainer Strip
Below the hero, a clean three-column strip explains the three tiers. Each column: icon, tier name, one-
line description, CTA. This is the primary place the brand architecture is explained to first-time visitors.
Newsletter Teaser Block
A section previewing the most recent Altitude issue. Show the issue headline, the first 2–3 sentences,
then a blur/fade with an 'Unlock with Skyfare Altitude — $4.99/month' CTA. This is a conversion block,
not a design flourish.
Keep from current site
– Client testimonials (Ronit S., Harry, Adi A.)
– Savings statistic (60% avg savings)
– Airline logos strip (trust signal)
– WhatsApp CTA at the bottom of page
3B. Skyfare Altitude ( /altitude )
This is the dedicated sales page for the paid newsletter. It should be the highest-converting page on the
site. Every element on this page should drive toward the $4.99/month subscribe CTA.
Page Sections (in order)
– Hero: 'The smartest miles strategy, delivered to your inbox.' — Short subheadline. Beehiiv
subscribe embed. $4.99/month price visible immediately.
– What you get: Three or four benefit tiles. Examples: Full deal breakdowns with exact routing and
miles required. Monthly miles strategy guides. Redemption tutorials. Early access to Skyfare
Concierge availability.
– Sample issue teaser: Show one past issue headline + first 3 paragraphs. Blur the rest. 'Subscribe
to read the full issue' CTA.
– Pricing block: Simple. $4.99/month. Cancel anytime. Beehiiv checkout link.
– FAQ: 3–4 questions. What is Skyfare Altitude? How is it different from the booking service? Can I
cancel? Is this the same as a KrisFlyer newsletter?
3C. Newsletter Archive ( /newsletter )
A public-facing archive of all past Altitude issues. Primary purpose: SEO and paywall conversion. Each
issue card shows enough to create curiosity, then hits a wall.
Issue Card Component
– Issue number and date
– Headline
– First 2–3 sentences (visible to all)
– Blurred/faded content below the preview
– 'Unlock with Skyfare Altitude' CTA button
Implementation note: The paywall logic lives inside Beehiiv — subscribers get a unique link to the full
issue via Beehiiv's platform. The website only needs to host the teaser card and link to the Beehiiv
paywall. Do not try to build a custom auth layer on the website side.
3D. Services — Skyfare Concierge ( /services )
The existing services page should be rebuilt and renamed. The service is now called Skyfare
Concierge everywhere on this page.
– Remove all references to 'redemption' or 'miles redemption' — use 'flight arrangement' or
'premium cabin booking'
– Keep the four-step process (Request, Source, Secure, Fly)
– Primary CTA: WhatsApp
– Secondary CTA: Contact form (/contact)
– Add a short section distinguishing Concierge from Altitude: 'Looking for insights rather than a
booking? Explore Skyfare Altitude.'
4. Beehiiv Integration
4A. Setup (Sahej to complete before developer starts)
– Create a Beehiiv account at beehiiv.com and set up the Skyfare Consulting publication
– Enable Beehiiv Premium (paid subscriptions feature) in the Beehiiv dashboard
– Set subscription price to $4.99/month USD
– Connect a Stripe account to Beehiiv for payment processing
– Publish at least one past issue to Beehiiv so the developer has real content to embed
– Get the Beehiiv embed code from: Publication Settings → Subscribe Widget → Copy embed
code
4B. Developer Implementation
– Embed the Beehiiv subscribe widget on: homepage (newsletter teaser block), /altitude (hero and
pricing block), /newsletter archive page header
– The embed is a standard iframe or JS snippet — drop it into the relevant sections
– Style the embed container to match the site design (Beehiiv allows some CSS customisation
inside the embed)
– For the paywall blur effect on /newsletter issue cards: use CSS blur + gradient overlay on content
below the preview. On CTA click, open a modal or redirect to the Beehiiv subscribe page
– Beehiiv generates a unique subscriber access link per user after payment — the site does not
need to handle authenticated content delivery
5. Technical Integrations
Integration Tool Who handles it Notes
Newsletter + Paywall Beehiiv Premium Sahej sets up; developer
embeds
Enable Beehiiv Premium
in dashboard. Stripe-
powered checkout is
native — no separate
Stripe setup needed on
the site.
Email capture widget Beehiiv embed form Developer embeds on
/altitude and homepage
Replace current contact
form for newsletter leads.
Beehiiv provides iframe
and JS embed snippet.
Paywall content blur Custom CSS + JS Developer builds Tease first 3 paragraphs.
Blur remaining content.
Trigger modal with
Beehiiv subscribe link on
Integration Tool Who handles it Notes
scroll or CTA click.
Booking intake form Netlify Forms (existing) Developer keeps existing Keep current form at
/contact for Concierge
bookings. Separate from
newsletter flow entirely.
WhatsApp CTA wa.me link (existing) Developer keeps Keep +6581575306 link
across all pages. Primary
channel for Concierge
enquiries.
Analytics Google Analytics 4 or
Plausible
Developer installs Track newsletter
subscribe events,
paywall hits, and
WhatsApp CTA clicks as
conversion goals.
Hosting Existing (confirm with
developer)
Developer confirms Current site appears
static. Rebuild can
remain static
HTML/CSS/JS or move
to Next.js if newsletter
archive requires SSG.
5A. Hosting & Stack
The current site appears to be a static HTML site. Options for the rebuild:
– Static HTML/CSS/JS (simplest): Fine if the newsletter archive is managed manually or via
Beehiiv's hosted page. Lowest complexity.
– Next.js with static generation: Recommended if the /newsletter archive should auto-populate from
Beehiiv's API. Pages pre-render at build time, remain fast, and can be redeployed on new issue
publication.
Decision: Discuss with developer. If Beehiiv's hosted newsletter page is acceptable as the archive,
static HTML is sufficient. If Sahej wants the archive on the main domain with custom design, Next.js is
the better choice.
6. Design Guidelines
6A. Brand Colours
– Primary blue: #1A6FD4
– Dark text: #111827
– Body text: #374151
– Light background: #EFF6FF
– White: #FFFFFF
6B. Typography
– Headlines: Arial or Inter, bold, dark
– Body: Arial or Inter, regular, #374151
– Labels / eyebrow text: uppercase, tracked, blue, small
6C. Tone & Copy Rules
– Never use the word 'redemption' or 'miles redemption' in client-facing copy — use 'flight
arrangement', 'award travel', or 'premium cabin booking'
– Never reference specific miles prices or costs in public-facing content
– Aspirational but grounded — avoid over-promising. 'Up to 60% less' not 'always 60% less'
– No em dashes anywhere in copy
6D. Visual Style
– Premium, editorial feel — think business travel magazine, not a discount aggregator
– Generous white space
– Thin rules and dividers rather than heavy card borders
– Airline cabin photography (sourced from Unsplash or Sahej's own travel content)
– Avoid stock imagery of generic 'business people'
7. Key Copy Blocks
Suggested copy for developer to use as placeholder. All copy should be reviewed by Sahej before
launch.
7A. Altitude Value Proposition
"Miles are a shadow currency — and most people don't know how to spend them. Skyfare Altitude
is a monthly briefing on how to earn faster, redeem smarter, and fly in cabins you thought were out
of reach. Written by someone who books 100+ premium cabin itineraries a year."
7B. Paywall Gate Copy
"This issue is available to Skyfare Altitude subscribers. Subscribe for $4.99/month to unlock every
issue — including the full deal breakdown below."
7C. Homepage Subheadline
"Fly Business and First Class for up to 60% less — or get the inside knowledge to do it yourself.
Two ways to fly smarter with Skyfare."
8. Out of Scope (V1)
The following are explicitly excluded from this rebuild and should not be built in V1:
– Member login portal on the main website — Beehiiv handles subscriber auth natively
– GDS or booking engine integration
– E-commerce or direct payment for Concierge bookings — WhatsApp and form remain the
booking flow
– Mobile app
– Automated deal alert emails — these will be managed through Beehiiv's broadcast feature, not
website code
9. Pre-Launch Checklist
Items that must be confirmed before the site goes live:
– Beehiiv Premium enabled and $4.99/month price set
– Stripe connected to Beehiiv and test payment completed
– At least two past issues published to Beehiiv for archive teaser content
– Beehiiv embed code provided to developer
– All copy reviewed and approved by Sahej
– Netlify form endpoint confirmed and tested
– Google Analytics 4 or Plausible installed and subscribe/CTA events firing
– Mobile responsive tested on iPhone and Android
– All pages reviewed for 'redemption' language — must be removed
– Domain DNS confirmed — site should go live on skyfareconsulting.com without any redirect
issues
Skyfare Consulting Pte. Ltd. · skyfareconsulting.com · Confidential · V1.0 June 2026