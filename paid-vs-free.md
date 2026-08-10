# Skyfare Consulting — Free vs. Paid, Sitewide Audit

Compiled across every page (homepage, Altitude, KrisFlyer Guide, Travel Strategy Call, Cabin Compare, the member portal) to finalize with the CEO what's free and what's paid, product by product. Section 6 is the actual decision list — everything above it is evidence.

## 1. Current Product Tiers

| Tier | Price | What it is |
|---|---|---|
| Free | $0 | Weekly newsletter — no credit card required |
| Altitude Monthly | $4.99/mo | Subscription |
| Altitude Annual | $39.99/yr | Subscription |
| Guide Bundle | Free (auto-granted) | 90 days of Altitude access, bundled into every Guide purchase — see §6.3 |
| Travel Strategy Call | $99 one-off | Not a membership tier — a standalone paid service |

## 2. Altitude Newsletter — Free vs. Paid *(already finalized by the CEO)*

**Paid — Altitude Access**

| Feature | Details |
|---|---|
| Award Alerts | Live award windows before they close, with full dates and booking detail. We do the searching for you, delivered straight to your inbox. Starting with Singapore Airlines, and members can request specific airlines or alliances to add to coverage. |
| Routing Strategies | Itineraries that maximise cabin quality. Built on 100+ flights booked for clients using miles across 10 airlines, including the tactics used to secure seats in tight award space. |
| Full Archive | Every issue, readable on-site, any time. |
| Members Only Content | Exclusive issues that never go to the free list. |
| The Skyfare Verdict on Cabin Compare | Full access to the Verdict on every product in Cabin Compare, written personally after flying the cabin. Members only. |
| Flash Alerts | When award space opens mid-week, members are alerted the moment it happens, not just in the Friday issue. |
| KrisFlyer Spontaneous Escapes | Full monthly breakdown of every drop, no paywall cutoff. |

**Free**

| Feature | Details |
|---|---|
| Cabin Reviews | First-hand Business and First Class reviews. 50+ flights flown this year, filmed and written up honestly. |
| Weekly Aviation News | Updates from across the world of aviation. |
| Transfer Bonuses | Airline and credit card transfer bonus roundups. |
| KrisFlyer Spontaneous Escapes | Monthly summary of each drop, with the full breakdown behind the paywall line. |
| Award Alerts (Limited) | Same alerts as members, but only a sample of dates shown. Full date lists sit behind the paywall line. |

**Plans & pricing:** Monthly $4.99/mo (default) · Annual $39.99/yr, shown as discounted from $55/yr. Cancel any time, instant access, secure checkout via Stripe. Deferred Monthly → Annual upgrade is supported (current period honored, no proration, Annual starts at next renewal).

**Access perks:** Instant access after checkout · magic-link (passwordless) login · member self-service billing portal (plan status, upgrade to annual, cancel).

## 3. KrisFlyer Guide — Free vs. Paid

**Free (preview):**
- Chapter 1 teaser — 2 paragraphs, real text ("How KrisFlyer actually works")
- Full "What's Inside" chapter list is visible to everyone (currently a placeholder — no chapters written yet)

**Paid (one-time purchase):**
- All 7 chapters, plus checklists, cheat sheets, and planning templates — yours forever
- Free updates whenever the guide is revised
- Full redemption-conditions table (fare class rules: baggage, seat selection, stopovers, upgrades, cancellation/date-change/no-show fees)
- **Bonus: 90 days of Altitude Premium included, free** (see §6.3 — this isn't shown in the live pricing card)

**⚠ Flag:** the price shown live on the homepage pricing card ($49.99 flat) doesn't match the full marketing page's structure ($39.99 for the first 24 hours, then $49.99) — and that full marketing page is currently commented out / not live (the public page shows a bare "Coming Soon" waitlist instead). Confirm which price is the real current offer.

## 4. Travel Strategy Call — Fully Paid, No Free Tier

$99 one-time, direct 1-on-1 with Sahej. $99 credited back if you book a flight with us within 30 days. No free component — this one isn't a tiering question, just a standalone paid product. Currently the only product on the site with a live, working checkout button.

## 5. Cabin Compare — Free Tool + Paid "Verdict"

**Free:** the entire comparison tool — route/cabin selector, full data table (airline, aircraft, seat, seat width, bed length, direct aisle access, Wi-Fi, cash fare, miles pricing, Skyfare score, client reviews). No gating.

**Paid (Altitude):** "The Skyfare Verdict" — Sahej's personal written analysis per product, after flying the cabin himself.

**⚠ Flag:** the Verdict is currently only CSS-blurred, not real server-side gating — the text is present in the page source and readable via view-source by anyone who looks. If this is meant to be a genuine Altitude-only perk, it needs the same real gating the newsletter already has (content withheld server-side for non-members), not just a visual blur.

## 6. Open Questions for the CEO

1. **Annual savings math is inconsistent across pages.** The homepage says "Save $19.89 vs. paying monthly" (comparing $39.99 to 12 × $4.99 = $59.88). The Altitude page, the member portal, and this doc's own Altitude section all say "save $15.01" (comparing $39.99 to a $55 list price). Both numbers are correct against their own reference point — pick one framing and make it consistent everywhere.

2. **KrisFlyer Guide price is inconsistent.** Live homepage card: $49.99 flat. The (not currently live) full marketing page: $39.99 for the first 24 hours, then $49.99. Confirm which is the real current offer before that page is turned back on.

3. **Should the 90-day free Altitude bundle be a marketed perk, or stay a silent bonus?** It's live and working today — every Guide purchase automatically grants 90 days of full Altitude access (deferred to start after an existing subscription ends, if the buyer already has one). But it isn't mentioned on the homepage Guide card or anywhere in this doc's Guide section until now. If it's meant to help sell the Guide, it should be in the marketing copy; if not, worth confirming that's intentional.

4. **Cabin Compare's Verdict needs real access control**, not just a CSS blur, if it's staying an Altitude-only perk (see §5). Small follow-up engineering task — flagged here because it directly affects whether that "paid" feature is actually paid-gated today.

5. **Confirm current real checkout status.** Altitude, the Guide, and the Cabin Compare Verdict are all in "Coming Soon"/waitlist mode site-wide right now — only the Travel Strategy Call has a live purchase button. Worth a quick click-through to confirm what's actually purchasable before the meeting, since that changes what "finalizing free vs. paid" even means in the short term (a pricing decision vs. a pricing-and-launch decision).

## 7. How Free vs. Paid Is Shown to Visitors Today

- **Badges:** blue "Free" pill + unlock icon vs. gold "Premium" pill + crown icon (newsletter archive and article pages)
- **Member portal:** the issue archive has its own Free / Premium filter, even for logged-in paying members
- **Homepage:** a 4-card pricing grid (Free, Travel Strategy Call, Altitude Access, KrisFlyer Guide) with a "What You Get" list per card
- **Article gating:** free issues show the full article body and share buttons; premium issues show a faded preview only, no share buttons, and an "Altitude Exclusive" upgrade prompt
