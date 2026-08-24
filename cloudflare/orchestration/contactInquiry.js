// orchestration/contactInquiry.js — the public Contact page and the
// Altitude Support modal both POST here (see js/altitude-portal-extras.js's
// _handleSupportSubmit and the public contact form). Lives in
// orchestration/, not services/airtable.js, because it now talks to both
// Beehiiv and Airtable -- services/airtable.js is deliberately kept a
// clean Airtable-only leaf (see that file's header comment).
import { respond } from '../utils/http.js';
import { KV_PREFIX } from '../config/constants.js';
import { writeToAirtable } from '../services/airtable.js';
import { checkBeehiivPremium } from '../services/beehiiv.js';

export async function handleContactInquiry(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `${KV_PREFIX.RL_AIRTABLE_CONTACT}${ip}`;
  const rlCount = parseInt((await env.ALTITUDE_KV.get(rlKey)) || '0', 10);
  if (rlCount >= 5) {
    return respond({ error: 'rate_limited' }, 429, corsHeaders);
  }

  let body;
  try { body = await request.json(); }
  catch { return respond({ error: 'invalid_body' }, 400, corsHeaders); }

  if (body['bot-field']) return respond({ success: true }, 200, corsHeaders);

  // Count every real (non-honeypot) attempt here, regardless of outcome —
  // matches the root subscribe route's convention, so validation/Airtable
  // failures can't be retried past the limit for free.
  await env.ALTITUDE_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const name    = (body['name']    || '').trim().slice(0, 200);
  const email   = (body['email']   || '').trim().toLowerCase().slice(0, 200);
  const subject = (body['subject'] || '').trim().slice(0, 300);
  const message = (body['message'] || '').trim().slice(0, 5000);

  if (!name || !message) {
    return respond({ error: 'missing_fields' }, 400, corsHeaders);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'invalid_email' }, 400, corsHeaders);
  }

  // Server-side membership check by email -- neither the public contact
  // form nor the Altitude Support modal sends an auth token, so this is
  // the only reliable source of truth (also catches a public submitter
  // who happens to already be a member, not just Support-modal senders).
  // Never let a Beehiiv hiccup block the actual submission.
  const isAltitudeMember = await checkBeehiivPremium(email, env).catch(() => false);

  try {
    await writeToAirtable(env.AIRTABLE_TABLE_CONTACT_INQUIRIES, {
      'Name': name,
      'Email': email,
      'Subject': subject || '(no subject)',
      'Message': message,
      'Status': 'New',
      'Source': 'website',
      'Member Tier': isAltitudeMember ? 'Altitude Access' : 'Free',
      'Submission Date': new Date().toISOString().split('T')[0],
    }, env);
  } catch (err) {
    console.error('Airtable contact error:', err.message);
    return respond({ error: 'submission_failed' }, 500, corsHeaders);
  }

  return respond({ success: true }, 200, corsHeaders);
}
