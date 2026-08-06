# WhatsApp Admin Booking Notification Design

Date: 2026-08-06

Status: parked — decided and scoped, implementation on hold pending the
inputs listed in "Open Items" below.

## Objective

When a customer books a Travel Strategy Call slot on Cal.com, the admin
(Sahej) should get a WhatsApp notification that a new booking came in —
alongside, not instead of, the existing customer confirmation email and
Airtable record. This step has been explicitly deferred since the feature
was first built (see `trav-start-call.md`'s original flow diagram, which
marks "Airtable notifies Sahej on WhatsApp" as a pending future feature).

## Current Architecture Reviewed

- `cloudflare/orchestration/calcomWebhook.js` — `handleBookingCreated`, the
  sole write point for the Assessment Call Bookings table, fires on Cal.com's
  `BOOKING_CREATED` webhook. Already assembles email, name, notes,
  `bookingUid`, and `slotStart` before writing to Airtable.
- `cloudflare/services/airtable.js` — `createAssessmentBooking`,
  `hasExistingAssessmentBooking`.
- Airtable's "Send Booking Confirmation" automation (`wfl2ESWftuDOFSqQ0`) —
  fires when an Assessment Bookings record's Status becomes "Booked", sends
  the customer their confirmation via a Gmail action. This is the pattern
  the WhatsApp notification runs parallel to, not a replacement for it.
- Confirmed via Airtable's full automation trigger/action catalog: Airtable
  Automations has no native WhatsApp trigger or action (email, Slack, MS
  Teams, and several other third-party integrations exist; WhatsApp does
  not) — ruling out building this inside Airtable itself.

## Scope Decided

- Fires only for **Travel Strategy Call Bookings** — not Flight
  Applications, Contact Inquiries, or Testimonials. This is the one entry
  type with real money and a scheduled slot attached, and the only one
  flagged as needing this in the existing docs.
- Sender: **Meta WhatsApp Cloud API** (WhatsApp Business Platform),
  already provisioned — not Twilio, not a third-party bridge like
  Zapier/Make.
- An approved message template already exists in Meta Business Manager,
  with multiple variables (customer name, booking time, email, notes, etc.
  — exact mapping pending, see Open Items).

## Recommended Architecture

Fire directly from the Cloudflare Worker, not through Airtable and not
through a third-party bridge. `handleBookingCreated` in
`cloudflare/orchestration/calcomWebhook.js` already has every field the
template needs, assembled at the exact moment the booking is confirmed,
before it writes to Airtable. Adding one more direct call there avoids
making this notification depend on Airtable's own automation timing/
reliability, and matches how every other notification in this codebase
already works — a direct API call from the Worker code path that owns the
event, not indirection through a third-party automation engine. (Same
principle the 2026-08-06 email-automation-consolidation work applied to
Beehiiv.)

New module: **`cloudflare/services/whatsapp.js`** — owns all Meta WhatsApp
Cloud API calls, mirrors the shape of `services/beehiiv.js`/
`services/airtable.js` (a single external system, nothing else). One
function, `sendAdminBookingAlert(bookingDetails, env)`, POSTs to
`https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages` with the
approved template name, language code, and the mapped component
parameters.

Call site: `handleBookingCreated`, alongside (not blocking) the existing
`createAssessmentBooking` call — same fire-and-forget `.catch(() => {})`
pattern already used for every other non-critical side effect in that file
(e.g. the `ASSESSMENT_BOOKED` KV write). A WhatsApp send failure must never
block or fail the booking-creation flow itself.

## New Secrets Needed (Worker)

- `WHATSAPP_PHONE_NUMBER_ID` — Meta Cloud API sender's Phone Number ID.
- `WHATSAPP_ACCESS_TOKEN` — Meta permanent access token (system-user token,
  not a 24h temporary token).
- `WHATSAPP_ADMIN_NUMBER` — Sahej's WhatsApp number, E.164 format
  (e.g. `+65XXXXXXXX`).
- `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG` — template identifier
  and language code as registered in Meta Business Manager (e.g. `en_US`).

## Open Items — needed before implementation starts

Nothing gets built until these are in hand:

1. Exact approved template text, including its `{{1}}`, `{{2}}`, …
   placeholders in the order they appear — the Worker's parameter array has
   to match Meta's expected order exactly, or messages send garbled or get
   rejected outright.
2. Template name and language code as registered in Meta Business Manager.
3. Meta Phone Number ID and a permanent (system-user) access token.
4. Sahej's WhatsApp number in E.164 format.

## Error Handling

- Send failures are logged and swallowed — never surfaced to the customer,
  never blocking the booking flow. Matches every other secondary
  notification in this codebase.
- No retry queue for v1. If Meta's API is briefly down, the admin misses
  that one alert; Airtable and the customer email are unaffected, and the
  booking is still fully recoverable by checking Airtable directly. Worth
  revisiting only if missed alerts turn out to be a real problem in
  practice — not speculatively building it now.

## Testing Plan

- Trigger a real Cal.com test booking end-to-end: confirm the customer
  email still fires (unchanged), the Airtable record is still created
  (unchanged), and the admin's WhatsApp message arrives with correctly
  mapped fields.
- Simulate a WhatsApp API failure (bad token) and confirm the booking flow
  still completes normally — KV write, Airtable write, and customer email
  all unaffected.

## Out of Scope

- Flight Applications, Contact Inquiries, Testimonials — no WhatsApp
  notification for these, per the explicit scope decision above.
- Two-way WhatsApp (admin replying, customer receiving WhatsApp messages) —
  this is outbound-only, one message, one direction.
- Any Airtable-side automation changes — this bypasses Airtable's
  automation engine entirely, since it doesn't support WhatsApp.
