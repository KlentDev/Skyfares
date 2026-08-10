// orchestration/assessmentBooking.js — the secure booking-redirect link sent
// in the Travel Strategy Call confirmation email and shown on the success
// page. Lives in orchestration/ rather than services/calcom.js because it's
// not talking to Cal.com at all -- it's a signed-link verification step
// (utils/signedLink.js) that gates access to the public Cal.com URL
// (config/constants.js's CALCOM_BOOKING_URL), so only someone holding the
// exact link mailed to their paying email can reach it.
import { verifyAssessmentBookingLink } from '../utils/signedLink.js';
import { CALCOM_BOOKING_URL, KV_PREFIX } from '../config/constants.js';

export async function handleAssessmentBookingRedirect(request, env) {
  const url   = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const exp   = url.searchParams.get('exp') || '';
  const sig   = url.searchParams.get('sig') || '';

  if (!email || !exp || !sig) {
    return new Response('Missing or invalid booking link.', { status: 400 });
  }

  const valid = await verifyAssessmentBookingLink(email, exp, sig, env);
  if (!valid) {
    return new Response(
      'This booking link is invalid or has expired. Please check your confirmation email, or message us on WhatsApp for help.',
      { status: 403 }
    );
  }

  // Stops the same emailed link being used to book a second slot -- set by
  // orchestration/calcomWebhook.js the moment Cal.com confirms a real
  // booking for this email (not on a mere link click/pre-fetch, see that
  // file's own comment on why that distinction matters). Shown as a page,
  // not just rejected, since a legitimate customer landing here needs a way
  // forward (WhatsApp) rather than a dead end.
  const bookedRaw = await env.ALTITUDE_KV.get(`${KV_PREFIX.ASSESSMENT_BOOKED}${email}`);
  if (bookedRaw) {
    let slotStart = '';
    try { slotStart = JSON.parse(bookedRaw).slotStart || ''; } catch {}
    return new Response(alreadyBookedHtml(slotStart), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Prefill the Cal.com booker's email so it matches who paid, without
  // exposing the raw Cal.com URL anywhere public/static (index.html,
  // assessment.html) -- it only ever appears after these checks pass.
  const dest = new URL(CALCOM_BOOKING_URL);
  dest.searchParams.set('email', email);
  return Response.redirect(dest.toString(), 302);
}

function formatSlotStart(isoStartTime) {
  if (!isoStartTime) return '';
  const date = new Date(isoStartTime);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore', timeZoneName: 'short',
  }).format(date);
}

function alreadyBookedHtml(slotStart) {
  const formatted = formatSlotStart(slotStart);
  const waMessage = encodeURIComponent("Hi Skyfare, I already booked my Travel Strategy Call but need help with it.");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Already Booked — Skyfare Consulting</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
    background:#0c1a2b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .card { background:#ffffff; border-radius:16px; padding:40px 32px; max-width:420px; width:100%; text-align:center;
    box-shadow:0 20px 50px rgba(0,0,0,0.35); }
  .icon { width:48px; height:48px; border-radius:9999px; background:#eff6ff; color:#0C4A6E; display:flex;
    align-items:center; justify-content:center; margin:0 auto 20px; font-size:22px; }
  h1 { font-size:1.25rem; font-weight:700; color:#111827; margin:0 0 12px; }
  p { font-size:0.9rem; color:#6b7280; line-height:1.6; margin:0 0 24px; }
  .slot { font-weight:600; color:#111827; }
  a.btn { display:inline-block; background:#25D366; color:#ffffff; text-decoration:none; font-weight:600;
    font-size:0.9rem; padding:14px 24px; border-radius:9999px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>You're already booked</h1>
    <p>
      Our records show you've already confirmed a Travel Strategy Call${formatted ? ` for <span class="slot">${formatted}</span>` : ''}.
      Need to reschedule, or have a question before your call? Message us on WhatsApp and we'll help right away.
    </p>
    <a class="btn" href="https://api.whatsapp.com/send?phone=6581575306&text=${waMessage}" target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>
  </div>
</body>
</html>`;
}
