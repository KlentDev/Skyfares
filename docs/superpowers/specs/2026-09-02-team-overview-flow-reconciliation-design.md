# Team Overview — Flow Reconciliation with Process Flow Blueprint

## Context

`skyfare-team-overview.html` is the plain-English, whole-team diagram of "how Skyfare works." `skyfare-process-flow-blueprint.html` is the internal technical trace of the same system, aimed at engineers. They were built separately and have drifted apart: some cards in the overview show conditional logic that contradicts the blueprint, and two paid-product cards are presented as fully live when the blueprint (and the live Worker code) show them as built-but-not-yet-open-to-customers.

This is a content and small-UI reconciliation pass on `skyfare-team-overview.html` only. `skyfare-process-flow-blueprint.html` is not modified. The overview's existing visual language (warm off-white canvas, rounded white cards, gold accents, the `.dept`/`.flow`/`.decision` component grammar) is preserved — nothing about the overall layout, palette, or diagram structure changes.

## Verification done

Checked `cloudflare/worker.js`: both `/guide/checkout` and `/assessment/checkout` (Strategy Call) routes exist and are live in code, but the Strategy Call route is wired to a separate sandbox Stripe account per the file's own comments — consistent with the overview's existing footnote and with the blueprint's "Coming Soon — built, not yet open to customers" status on both flows.

## Changes

### 1. "Coming soon" status ribbon (new small component)

A pill-shaped ribbon, reusing existing gold tokens (`--gold-bg`, `--gold-fg`) already used elsewhere in the file (Newsletter card, decision diamonds) so it reads as native to the design, not bolted on.

- Position: absolute, top-right corner of the card, overlapping the top edge slightly (e.g. `top:-10px; right:18px`), so it reads as a corner tag.
- Text: `COMING SOON` (matches the blueprint's own badge wording exactly).
- Card border: on just these two cards, override the default solid `1px solid var(--line)` with a dashed gold border (`1.5px dashed var(--gold-fg)` or similar), echoing the blueprint's `.fnode.muted` treatment for not-yet-live steps.
- Applies to: **Travel Strategy Call** (card 03) and **KrisFlyer Guide** (card 02).
- Does **not** apply to: **Altitude Membership** (card 01) — stays exactly as-is, no ribbon. Its plainness next to the two ribboned cards is enough to signal "this one is live."

### 2. Travel Strategy Call — flow and decision rewrite

Current flow: `Pay for the call → Book on Cal.com` then straight into a decision diamond reading "Booked before the deadline?" with CRM-visibility outcomes. This contradicts the blueprint, which traces a refund-based condition instead.

New flow for card 03:

1. Pay for the call (unchanged)
2. Book on Cal.com (unchanged)
3. **New step**: "Call happens" — matches the blueprint's "Call takes place" node, so the decision that follows makes sense as a post-call condition rather than a pre-call deadline.
4. Decision diamond, replacing the current one:
   - Question: **"Did they book a flight with Skyfare?"**
   - YES branch: **"💰 Stripe refund issued"** (replaces "✅ CRM record created")
   - NO branch: **"✅ No refund — call complete"** (replaces "🚩 Stays invisible to CRM")

The existing footnote ("Card payments for the Strategy Call still run through a temporary test account") stays unchanged — it's accurate and now reinforced by the new ribbon.

### 3. Newsletter — add the "awaiting first issue" caveat

The blueprint flags Premium Newsletter Publishing as a live, working mechanism that simply hasn't fired yet ("Live mechanism — awaiting first premium issue") — distinct from "Coming Soon" (which means not yet built/opened). The overview's Newsletter card (05) should carry this same caveat.

Change: append a second line to the existing `.note` div under the Newsletter card (currently "Free subscribers live in Beehiiv only") reading:
> "No premium issue has gone out yet — the mechanism is live and waiting."

No new component needed — this is a content-only addition to an existing element.

### 4. Systems strip — split "Cache" into KV + R2

The blueprint treats KV (access/entitlement state) and R2 (generated files) as two distinct systems with different jobs. The overview currently collapses both into one "Cache" tile. Split it:

- Remove the single `Cache` `.schip2` tile (⏱️ icon, "Fast lookups, backed by Stripe/Beehiiv").
- Add two tiles in its place, using the same `.schip2` markup pattern as the rest of the strip:
  - **KV** — icon 🔑 (distinct from R2's icon, and not reused from the removed Cache tile) — subtext: "Access state — entitlements, premium & guide access"
  - **R2** — icon 📦 — subtext: "Generated files — guide PDFs, signed download links"
- Update the section subtitle from "Six tools, read from or written to across every journey above" to **"Seven tools, read from or written to across every journey above."**
- Cal.com tile is unchanged — it's a real, currently-live tool used for bookings elsewhere (e.g. Assessment calls), so it stays even though the blueprint's systems key omits it.

Card height (170px) and layout (`flex-wrap` strip) comfortably fit a 7th tile at the existing tile width (180px) — no structural resize needed.

### 5. Unchanged (confirmed accurate against the blueprint or business reality)

- **KrisFlyer Guide bonus-period decision** ("Already an Altitude member?" → bonus timing) — real business rule, kept as-is. (Only the card's ribbon/border changes per section 1; its internal decision logic is untouched.)
- **Contact Us priority-queue decision** ("Sender is an Altitude member?" → priority vs standard queue) — real, kept as-is.
- **Consulting (WhatsApp)**, **Routes & Cabin Compare**, **Skyfare Flight**, **Testimonials** cards — already consistent with the blueprint's traced logic, no changes.

## Out of scope

- No changes to `skyfare-process-flow-blueprint.html`.
- No changes to overall canvas layout, card positions/sizes (beyond the two cards' border style), color system, or typography.
- No new "LIVE" ribbon on Altitude Membership (considered and explicitly declined).
