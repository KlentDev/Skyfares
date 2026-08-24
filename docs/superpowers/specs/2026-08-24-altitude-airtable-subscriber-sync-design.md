# Altitude Airtable Subscriber Sync — Design

## Context

The Airtable base `Skyfare Consulting` (`appA5rSlwgc57nswR`) has a fully-schema'd `Altitude Subscribers` table (`tblvGUFFeUG9gwvDS`, env var `AIRTABLE_TABLE_ALTITUDE_SUBSCRIBERS`), described as "Paid Altitude Monthly/Annual subscriber mirror." It has 29 fields including `Last Synced At` and `Last Sync Error`, clearly designed for an ongoing, code-driven sync — but no code anywhere writes to it. Confirmed via a live query: the table has 0 records.

This surfaced when a live payment test for `sahejsingh1@gmail.com` (Altitude Monthly, active) completed successfully — Stripe charged, Cloudflare KV recorded the member, Beehiiv tags applied — but no Airtable row appeared, because `cloudflare/orchestration/stripeWebhook.js`'s handlers only ever write to `ALTITUDE_KV` and call `syncBeehiivAltitudeAccess`. `services/airtable.js` has write functions for Flight Applications, Testimonials, and Assessment Bookings, but none for Altitude Subscribers.

**Immediate fix already applied (not part of this spec's implementation):** the missing `sahejsingh1@gmail.com` record was created directly in Airtable (`recy6Y1M3ZuQxaPWf`) using verified Stripe (`cus_V86rzDj4xtedMm` / `sub_1U7qdt6rDDK1rfhleqZfLu0T`) and Beehiiv (`sub_035d6974-8007-4e2a-ba00-fc3ed89acab2`) data. This spec covers the code fix so this doesn't happen for the next subscriber.

## Goal

Every place that currently updates an Altitude member's `ALTITUDE_KV` record should also mirror that record into the `Altitude Subscribers` Airtable table, kept in sync across the full lifecycle (signup, renewal, plan change, cancellation, payment failure) — not just a one-time write at checkout.

## Approach

### 1. New upsert helper — `services/airtable.js`

```js
export async function upsertAltitudeSubscriber(email, fields, env) {
  // 1. GET with filterByFormula: {Email}="<email>" against
  //    env.AIRTABLE_TABLE_ALTITUDE_SUBSCRIBERS to find an existing record id.
  // 2. PATCH that record if found, else POST a new one (same pattern as
  //    writeToAirtable, but PATCH targets /v0/{base}/{table}/{recordId}).
  // 3. Always include "Last Synced At": new Date().toISOString() in fields.
  // 4. On any failure, do NOT throw -- callers already wrap every Airtable/
  //    Beehiiv side effect in .catch(() => {}) so a sync failure never blocks
  //    the webhook's 200 response to Stripe. Instead, best-effort a second
  //    write of just { "Last Sync Error": <message> } so staff can see it
  //    failed without needing worker logs.
}
```

### 2. Field mapping

| Airtable field | Source | Notes |
|---|---|---|
| Email | `record.email` | |
| Full Name | `session.customer_details?.name` | Best-effort, often blank — Stripe Checkout doesn't always collect it |
| Subscription Tier | `record.plan` | `'monthly'` → `"Altitude Monthly"`, `'annual'` → `"Altitude Annual"` |
| Subscription Status | `record.status` | Map Stripe's raw status strings to the table's exact option list: `active`→`"Active"`, `trialing`→`"Trialing"`, `past_due`→`"Past Due"`, `canceled`/`cancelled`→`"Cancelled"`, `unpaid`→`"Unpaid"`, `incomplete`→`"Incomplete"`, `incomplete_expired`→`"Incomplete Expired"`, `paused`→`"Paused"`; anything else (including the KV record's own `'active'` default before a real Stripe status has been seen) → `"Other"`. `"Expired"` has no direct Stripe status source in the current handlers — left unused rather than guessed at. |
| User Status | same as Subscription Status | Per user decision — no independent signal exists yet, so it mirrors billing status rather than introducing an unused field |
| Stripe Customer ID / Subscription ID / Checkout Session ID | `record.stripe_customer_id` / `stripe_subscription_id` / `stripe_session_id` | Direct copy, already on the KV record |
| Stripe Customer Link / Subscription Link | Constructed | `https://dashboard.stripe.com/customers/{id}` and `/subscriptions/{id}` |
| Stripe Transaction / Payment ID | `invoice.id` | Only reliably available in `handleInvoicePaymentSucceeded` (the invoice object is already in hand there); left blank at initial checkout otherwise |
| Beehiiv Subscriber ID, Beehiiv Found, Beehiiv Subscription Status | `sync.beehiiv_subscription_id`, derived, `entitlements.subscriber_active` | Already returned by `syncBeehiivAltitudeAccess` today |
| Channel / Source / Medium | New: parsed from Beehiiv's `acquisition_source` field (e.g. `"api: website / organic"` → Channel=`"api"`, Source=`"website"`, Medium=`"organic"`) | Requires extending `getBeehiivEntitlements()` (see below) |
| Subscriber Since | New: Beehiiv subscription's `subscribed_on` | Same extension — this is the *original free-newsletter* join date, distinct from... |
| Subscription Start Date | Stripe subscription `start_date` | ...the date they became a *paid* Altitude subscriber. Confirmed via the live example these two dates are genuinely different (free subscriber since 2026-07-06, paid subscription started 2026-08-24) |
| Current Period End, Cancel At Period End, Cancelled At | Already on/derivable from the KV record | |
| Tags, Unique Referral Link, Subscriber Management Link | **Left blank by the sync** | Tags has no single canonical source; a Management Link would need a stable account page, not the short-lived session URL `handleManagePortal` generates. Flagged as a gap, not guessed. |

### 3. Beehiiv extension — `services/beehiiv.js`

`getBeehiivEntitlements()` calls `findBeehiivSubscription()`, which already fetches the full subscription object. Add three more fields to its return value: `acquisition_source` (raw string, parsed by the caller) and `subscribed_on`. This is a read-only addition — no new Beehiiv API calls, no writes, just surfacing two more fields from a response already being fetched. Per user confirmation, this is in scope for this fix despite the "don't touch Beehiiv" instruction, since it's additive and read-only.

### 4. Call sites — `orchestration/stripeWebhook.js`

Add an `upsertAltitudeSubscriber(email, fields, env).catch(() => {})` call, using the field mapping above, at the end of:
- `handleCheckoutComplete` (new signup)
- `handleSubscriptionUpdated` (plan change, renewal, status change)
- `handleSubscriptionDeleted` (cancellation)
- `handleInvoicePaymentSucceeded` (renewal payment — also the one place `Stripe Transaction / Payment ID` gets populated reliably)

Each of these already has the full member record in hand at the point of the call, so no extra Stripe API fetches are needed beyond what these handlers already do.

## Explicitly out of scope

- **Historical backfill** of any other pre-existing Altitude members that predate this fix (only `sahejsingh1@gmail.com` was confirmed and fixed manually — if there are others, that's a separate pass; the table's near-emptiness suggests the feature is new enough that this may be the only real gap, but this wasn't exhaustively verified against the full KV keyspace).
- `handleInvoicePaymentFailed` mirroring — it already only flips `status` to `'past_due'` on the KV record; wiring it in later is a one-line addition once this pattern exists, not required for the initial fix.
- Tags, Unique Referral Link, Subscriber Management Link fields (see mapping table above).

## Verification

- Trigger a real (or Stripe test-mode) Altitude checkout; confirm a row appears in `Altitude Subscribers` with `Last Synced At` set and no `Last Sync Error`.
- Cancel a test subscription; confirm the same row updates (not a duplicate) with `Subscription Status = "Cancelled"` and `Cancelled At` set.
- Force an Airtable failure (e.g. temporarily wrong table ID) and confirm the webhook still returns 200 to Stripe and `Last Sync Error` gets written on the next successful attempt.
