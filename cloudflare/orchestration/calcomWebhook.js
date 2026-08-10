// orchestration/calcomWebhook.js — receives Cal.com's BOOKING_CREATED webhook
// and creates the Airtable "Assessment Call Bookings" row for it. This is the
// ONLY point that table gets written to -- payment success (Beehiiv tag +
// confirmation email, see orchestration/stripeWebhook.js) does not touch
// Airtable at all. Lives in orchestration/, not services/, because it touches
// both a Cal.com-shaped payload and Airtable in the same function body --
// same reasoning as orchestration/stripeWebhook.js's module placement (see
// krisflyer.md for the services/ vs orchestration/ split).
import { verifyCalcomSignature } from '../services/calcom.js';
import { createAssessmentBooking, hasExistingAssessmentBooking } from '../services/airtable.js';
import { KV_PREFIX } from '../config/constants.js';

export async function handleCalcomWebhook(request, env, corsHeaders) {
  if (!env.CALCOM_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 503 });
  }

  // Coarse per-worker rate limit -- this endpoint has no per-IP identity
  // worth keying on (Cal.com's servers, not a browser), just a sanity cap.
  const rlKey = `${KV_PREFIX.RL_CALCOM_WEBHOOK}global`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 500) {
    return new Response('rate_limited', { status: 429 });
  }
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const body = await request.text();
  const signature = request.headers.get('X-Cal-Signature-256') || '';

  const valid = await verifyCalcomSignature(body, signature, env.CALCOM_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  // Always ack fast regardless of internal outcome, same as the Stripe
  // webhook (orchestration/stripeWebhook.js) -- Cal.com retries on non-2xx.
  if (event.triggerEvent === 'BOOKING_CREATED') {
    await handleBookingCreated(event.payload || {}, env)
      .catch(err => console.error('[calcom-webhook] booking-created handling failed:', String(err).slice(0, 200)));
  }

  return new Response('ok', { status: 200 });
}

// Booking-confirmed notifications (customer + admin) are handled from
// Airtable now, not from here -- this just creates the record. See
// trav-start-call.md for the current flow.
async function handleBookingCreated(payload, env) {
  const email = (payload.attendees?.[0]?.email || '').toLowerCase().trim();
  if (!email) return;
  // Name and additional notes are both optional on Cal.com's own booking
  // form, so either can be blank. Notes can land in a couple of different
  // payload shapes depending on how the booking form/question is set up --
  // check the common ones rather than assuming a single field.
  const name  = (payload.attendees?.[0]?.name || '').trim();
  const notes = (
    payload.responses?.notes?.value ||
    payload.additionalNotes ||
    payload.description ||
    ''
  ).trim();

  // Cal.com has no built-in per-attendee booking limit (see
  // services/airtable.js's hasExistingAssessmentBooking for why), so this is
  // the enforcement point: flag, don't block, a second booking from the same
  // email -- a human (Sahej) decides whether it's legitimate.
  const possibleDuplicate = await hasExistingAssessmentBooking(email, env).catch(() => false);

  await createAssessmentBooking({
    email,
    name,
    notes,
    bookingUid: payload.uid || '',
    slotStart: payload.startTime || '',
    possibleDuplicate,
  }, env);

  // Marks this email as having a confirmed booking -- checked by
  // orchestration/assessmentBooking.js before it redirects to Cal.com, so
  // the same emailed link can't be used to book a second slot. No
  // expirationTtl on purpose: this should stick regardless of how far out
  // the call is scheduled. Known, accepted tradeoff: a genuine second
  // purchase's NEW booking link would also get blocked by this same
  // email-keyed flag -- that's fine by design, the block screen's WhatsApp
  // CTA is the intended path for that (rare) case, not a bug to route around.
  await env.ALTITUDE_KV.put(`${KV_PREFIX.ASSESSMENT_BOOKED}${email}`, JSON.stringify({
    bookingUid: payload.uid || '',
    slotStart: payload.startTime || '',
  })).catch(() => {});
}
