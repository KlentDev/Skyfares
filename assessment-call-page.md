1

2

3

SKYFARE CONSULTING
Web Brief: Assessment Call Page
Prepared for: Klent Micko Bering
Prepared by: Sahej Singh, Skyfare Consulting
Date: 27 July 2026
1. Objective
Add a paid Assessment Call product to skyfareconsulting.com. This will also serve as the landing page
for Meta ad campaigns, so it must work as a standalone destination, not only as a section on the
services page.
2. What to build
• A dedicated landing page at /assessment-call (primary Meta ads destination).
• A card or section on the existing services page linking to the landing page.
• Stripe checkout for a one time SGD 99 payment.
• After successful payment, show a confirmation page with Sahej's direct WhatsApp link (wa.me
link to be provided by Sahej) and a short welcome message. No booking or scheduling tool
needed.
• The WhatsApp contact must only be revealed after payment, never on the public page.
3. Page copy (final, ready to use)
Hero
Assessment Call
SGD 99 · Direct access · Fully refunded when you book with us
Find out exactly how far your miles can take you.
Body
For SGD 99, you get direct access to me. Call or text anytime with any enquiry: your miles, your
cards, a trip you are planning, or a fare you have seen. No booking slots, no waiting. You ask, I
answer.
We will map out your travel goals together. I review your miles balances, credit cards, and upcoming
trips, then tell you exactly what is possible: which cabins, which airlines, and what it will take to get
there.
Already have miles? We assess what you own and show you how to get the most out of it. Starting
from zero? We can help source the miles for you, so a premium cabin is still within reach.
You get a clear, personalised plan. And if you proceed with a flight arrangement within 30 days, your
SGD 99 is refunded in full.
How it works
1. Pay SGD 99 and you get my direct line straight away.
2. Call or text anytime. Ask anything about your miles, cards, or travel plans.
3. You get a plan. Clear options, realistic timelines, and what each is worth in cash terms.
4. Book with us and the fee comes back. Proceed with a flight arrangement within 30 days and the
SGD 99 is refunded in full.
FAQ
Do I need a lot of miles already?
No. If you already have miles, we assess what you own and how to maximise it. If you are starting
from zero, we can help source the miles for you as part of your flight arrangement.
How do I reach you after paying?
You receive my direct WhatsApp contact immediately after payment. Call or text anytime with your
enquiries.
What if I do not proceed after the assessment?
That is completely fine. You keep the plan and everything we discussed. The SGD 99 covers the
assessment and direct access itself.
How is the refund applied?
When you confirm a flight arrangement within 30 days, we refund the SGD 99 to your original
payment method.
Call to action button
Book your Assessment Call — SGD 99
4. Technical requirements
• Stripe: one time payment product, SGD 99, named "Assessment Call" in neutral travel language.
• Meta Pixel: fire a Purchase event on successful payment and a Lead or InitiateCheckout event
on button click, so ad campaigns can optimise correctly.
• Page must be mobile first and fast loading, as most traffic will arrive from Instagram and
Facebook ads.
• Refund mechanic is operational, not automated: Sahej will process refunds manually via Stripe
when a client proceeds. No code needed for the refund itself.
• No mention of the word "redemption" anywhere on the page, in metadata, or in the Stripe
product name.
5. Out of scope
• No changes to Cabin Compare, the calculator, or Altitude pages.
• No automated refund logic.
• No new email flows for now; the booking tool confirmation is sufficient at launch.
6. Sign off
Please share a preview link before pushing live. Nothing merges to the live site without Sahej's
review.

## 7. Recommendations & Open Items (Klent, 27 July 2026)

Reviewed this brief against the live site. The payment-first, Stripe-only flow described in §2/§4 is
correct and is exactly how it should work — no manual WhatsApp-negotiated payment, no booking tool.
Flagging four things before build starts:

**1. Naming collision with an existing free page — needs Sahej's call.**
`skyfareconsulting.com/assessment` already exists: a live, **free** 20–30 min "Assessment Call"
consultation, linked from the Services page ("Book Free Assessment"), the header nav, FAQ, How It
Works, and Terms. Its CTA books a slot on Sahej's Calendly (`calendly.com/sahejsingh1/30min`) — a
real scheduled call, not instant access. This new brief's paid product would sit at `/assessment-call`,
same product name, same brand voice, but a completely different mechanic: no scheduling at all, instant
WhatsApp access right after payment. Two products called "Assessment Call" — one free and
Calendly-scheduled, one $99 and instant — risks a customer clicking through from a Meta ad and landing
on (or being confused with) the free, scheduled version. Keeping
"Assessment Call" as the paid product's name either way (it's the most accurate term for what
happens), but this needs a decision: rename the existing free page, add a clear qualifier to one or
both (e.g. "Free Travel Scoping Call" vs. "Paid Assessment Call"), or accept the overlap. Not resolved
in this pass — no changes made to the existing free page.

**2. WhatsApp link — still outstanding.**
§2 notes Sahej's wa.me link is "to be provided." This is a hard blocker for finishing the real
success-page content — everything else can be built with a placeholder, but the actual reveal can't
be tested end-to-end without it.

**3. Payment verification: server-side check, not a trusted redirect flag.**
Recommend the success page call a small server-side endpoint that re-confirms the Stripe session is
actually `paid` (and the correct product/price — not, say, an Altitude or Guide session replayed here)
before rendering the WhatsApp link, rather than just trusting a `?purchased=1`-style URL parameter.
This matches how the existing Altitude checkout's success page already works, and avoids a class of
bug (URL-guessing/replay) already seen elsewhere in this codebase.

**4. No login or magic-link step — intentionally excluded.**
The site's existing paid products (Altitude membership, KrisFlyer Guide) use an email magic-link step
to gate access, because they protect an ongoing account/recurring content. Assessment Call has neither
— it's a single link revealed once, right after payment — so adding a login/email round-trip here
would only add friction and contradict this brief's own "direct access straight away" promise. Recommend
keeping this flow to: pay → server verifies → link shown. No email step, no scheduling tool, matching
§2/§5 exactly.

**Build status (as of this section):** not started. Waiting on Sahej's naming decision (#1) and the
WhatsApp link (#2) before the paid checkout flow and success page are built and put in front of him
for preview per §6.

## 8. Flow Change — Confirmed with Sahej (Klent, 28 July 2026)

Raised issues #1 and #3 above directly with Sahej over chat, along with an alternative flow idea.
His reply, quoted in full since it changes the build:

> "ur right - my whatsapp is indeed everywhere, i missed that when the AI generated the brief. I
> think what we can do is that after the customer pays the $99 - they can book a slot on calendy
> with me - then airtable etc - and yea the option of whatsapp can be there as well. also for the
> refund - i wanted to basically give them $99 credit on the booking they do instead of an actual
> credit card refund. I tbh dont expect many ppl to do this - but its a feature to have cus why not."

**This supersedes §2's original flow and §4's refund mechanic.** Recorded below as history, not
deleted, since it's what was originally signed off on:

- ~~Pay $99 → confirmation page reveals Sahej's WhatsApp link directly, no scheduling tool~~ —
  superseded. Sahej confirmed his WhatsApp number being public everywhere (Services, hero, founder
  section) means this could never have delivered "exclusive direct access" as written.
- ~~Refund handled manually via Stripe when a client proceeds~~ — superseded. Sahej wants a $99
  **credit toward the client's flight booking**, not an actual Stripe refund.

**Confirmed new flow:**
1. Customer pays $99 via Stripe (unchanged from §4 — still a one-time payment product).
2. Success page verifies the payment server-side (not a trusted URL flag — same recommendation as
   §7.3, still holds).
3. Once verified: show a link to book a slot on Sahej's Calendly (`calendly.com/sahejsingh1/30min`,
   the same link the existing free page uses — see open item below) **plus** a WhatsApp link as a
   bonus/optional channel for quick follow-up questions. WhatsApp is no longer the exclusive
   deliverable, since Sahej confirmed it was never actually exclusive.
4. The Stripe webhook writes a record of the paid booking to a new Airtable table (email, Stripe
   session/payment IDs, amount, status) the moment payment succeeds.
5. **Not auto-capturing the Calendly booking time for launch** — building a real Calendly webhook
   integration would need Sahej's Calendly plan confirmed (Standard tier or above, unconfirmed) and
   new signing-secret verification code that doesn't exist anywhere in this codebase today. Given
   Sahej's own "don't expect many people to do this" expectation, launching with Sahej manually
   checking his Calendly calendar is the right amount of build for now — can revisit if volume
   picks up.
6. If the client books a flight within 30 days, the $99 becomes a credit applied manually by Sahej
   at invoicing — tracked as a status field on the same Airtable record (not purely verbal) so
   there's a paper trail if it's ever disputed.

**Still open:**
- **Naming/positioning (carried over from §7.1, now sharper):** both the free and paid "Assessment
  Call" go through Calendly booking now — the thing that used to separate them (instant WhatsApp vs.
  scheduled call) no longer exists. Recommend Sahej either creates a separate Calendly event type for
  the paid call (e.g. "Priority Assessment Call") so it's a visibly distinct booking experience, or
  clearly differentiates the two products' copy/positioning even sharing the same booking mechanism.
  Not resolved yet — needs Sahej's call before launch.
- WhatsApp link itself (§7.2) is no longer a hard blocker for the core flow, since it's a bonus
  channel now and can reuse the existing site-wide WhatsApp number/link already in `js/links.js`.

**Build status:** plan updated, not yet built. Next: confirm the Calendly-event naming question with
Sahej, then build the checkout flow, Calendly-based success page, and Airtable logging, and share a
preview link before anything goes live per §6.

## 9. Naming Resolved + Pages Merged (Klent, 28 July 2026)

The naming/positioning item flagged as open in §8 is now resolved, and the site build has moved ahead
of this doc — recording what actually shipped:

- **One page, not two.** `pages/assessment.html` and `pages/book.html` were merged — `pages/book.html`
  is deleted. `pages/assessment.html` is now the site's single universal booking/contact page (it also
  absorbed the site-wide "Book a Flight" header button and the KrisFlyer/Itinerary/Cabin-Compare
  booking CTAs, which all used to point at the now-deleted `book.html`).
- **Naming collision resolved by making it one product, two tiers**, instead of two differently-named
  products: the page is titled **"Assessment Call"** and offers (a) a free Calendly/WhatsApp option
  ("Two Ways to Connect" section) and (b) a **"Priority Assessment Call — $99"** card (`#priority`
  anchor) — the paid flow from §8, just renamed from a bare "Assessment Call" to "Priority Assessment
  Call" so it reads as an upgrade tier of the same page rather than a same-named competing product.
- Homepage's two paid CTAs (Ways to Fly Smarter card, Pricing card) now point to
  `pages/assessment#priority` instead of a separate `/pages/assessment-call` landing page, which is no
  longer planned as a separate page.
- The Priority card's CTA currently routes to WhatsApp with a pre-filled message ("I'd like to book a
  Priority Assessment Call ($99)") as an interim step, since Stripe checkout isn't built yet.

## 10. Switching Calendly → Cal.com (Klent, 28 July 2026) — planned, not yet built

Sahej mentioned his Calendly account is on the **free tier** (barely used, no reason to pay for it).
Free Calendly has no API/webhook access at all — that's gated behind the paid Standard tier ($10-12/mo)
— so the Airtable auto-logging described in §8 item 5 can't be built on his current plan without either
upgrading Calendly or switching providers.

**Decision: switch to Cal.com.** Its free tier includes real API/webhook access (`BOOKING_CREATED`
event), which is the specific thing Calendly charges for — so this gets the automation without any
new subscription cost. Confirmed this is the direction to go; **not building it yet** — this section
records the plan for when it's picked up.

**What's needed before this can actually be built:**
1. **Sahej needs to create a Cal.com account and event type** (mirroring his current 30-min Calendly
   event) — this is a real migration, not just a link swap. His availability/calendar connection
   (Google/Outlook) needs to move over to Cal.com for conflict-checking to work.
2. **The real Cal.com booking link** (e.g. `cal.com/sahejsingh`) — every `calendly.com/sahejsingh1/30min`
   reference across the site needs to be swapped to this once it exists (currently appears in
   `pages/assessment.html`'s "Two Ways to Connect" section, and previously in the deleted `book.html`).
3. **Backend work, once the link exists:** a new Cloudflare Worker webhook route (mirroring the
   existing Stripe webhook's signature-verification pattern in `cloudflare/services/stripe.js`) to
   receive Cal.com's `BOOKING_CREATED` event, plus a write into the same Airtable "Assessment Call
   Bookings" table already planned in §8 (booking time added to the existing Paid/Credit-status
   record, instead of Sahej manually cross-referencing his calendar).

**Not started:** no code has been changed for this yet — Calendly links are still live on the site.
This section exists so the plan isn't lost; pick this up once Sahej has actually created the Cal.com
account and has a real booking link to hand over.

## 11. No More Free Tier — Assessment Call Is Fully Paid (Klent, 28 July 2026)

Sahej stated there is **no free version of the Assessment Call anymore** — it's paid only, no free
scoping/consultation tier at all. This supersedes §9's "one page, two tiers" (free + Priority) model.

**Change made:** `pages/assessment.html`'s free framing was removed entirely — no "Free" badge, no
free consultation copy, no "Priority" upsell distinction (there's only one tier now, so "Priority
Assessment Call" reverted to plain "Assessment Call"). The page now describes a single $99 flow:
pay → get direct access (Calendly slot or WhatsApp) → get a plan → credited back if you book a flight
within 30 days. The `#priority` anchor used by the homepage's two "Assessment Call" CTAs was kept
(now an invisible anchor near the top of the page) so those existing links don't break.

**Known consequence, confirmed with Klent, not yet re-confirmed with Sahej:** `pages/assessment.html`
is also the site's general contact/booking hub (per §9 — it absorbed `book.html`, so the header's
global "Book a Flight" button and the KrisFlyer/Itinerary/Cabin-Compare CTAs all land here too). With
the free tier gone, all of those flows now land on a fully-paid page as well, not just people
specifically seeking the Assessment Call. Worth Sahej explicitly confirming this is intended before
this goes live — a general inquiry (e.g. "how does KrisFlyer nominee booking work") arguably shouldn't
require a $99 payment to ask. WhatsApp itself is still reachable site-wide from many other places
(footer, header, other pages' CTA bands) regardless of this page's framing, so it isn't a hard dead
end — just worth flagging as a real behavior change, not only a copy change.

**Build status:** content/UI updated, no backend changes (Stripe checkout still not built — the
page's CTAs currently route to WhatsApp with a pre-filled "I'd like to book my Assessment Call ($99)"
message as an interim step, same pattern used before).