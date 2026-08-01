// services/guidePdf.js — orchestrates one KrisFlyer Guide PDF generation:
// live entitlement re-check, purchaser-name lookup, template fill, Puppeteer
// render, password derivation, encryption. Returns bytes + password; callers
// (orchestration/guidePdfHandlers.js) decide whether to stream or upload+email.
//
// Deliberately does NOT reuse orchestration/session.js's verifyGuideEntitlement
// — that helper isn't exported (only used internally by handleVerify), and
// exporting it would mean editing a file backing the live /altitude/verify
// route for a change unrelated to that route. The live KV check duplicated
// below is ~5 lines and reads the same KV_PREFIX.GUIDE key that function
// reads — the schema stays centralized even though the read is duplicated.
// This intentionally does NOT duplicate the Beehiiv-recovery fallback that
// verifyGuideEntitlement also does — if KV is missing here, the request is
// denied and the user is pointed back at the normal portal re-verify flow
// instead of a second recovery path for the same data.
import puppeteer from '@cloudflare/puppeteer';
import { KV_PREFIX, GUIDE_ID } from '../config/constants.js';
import { getGuideContent } from './guideContent.js';
import { deriveGuidePdfPassword } from './pdfPassword.js';
import { encryptGuidePdf } from './pdfCrypto.js';
import { escapeHtml } from '../utils/html.js';
import templateHtml from '../templates/pdf-kf-guide-template.html';

// Single source of truth for the page margin — used for both the actual
// Puppeteer page.pdf() call AND the template's {{PAGE_MARGIN}} placeholder
// (the @page CSS rule), which previously hand-duplicated this same value in
// two files with no guarantee they'd ever be changed together.
const PDF_MARGIN = { top: '26mm', right: '18mm', bottom: '20mm', left: '18mm' };

/**
 * Live entitlement re-check — never trust the JWT's `guide` claim alone (it's
 * a UI hint set at login time; KV is the only source of truth for whether
 * access is still active right now). Returns the parsed KV record or null.
 */
export async function getActiveGuideEntitlement(email, env) {
  const raw = await env.ALTITUDE_KV.get(`${KV_PREFIX.GUIDE}${email}`);
  if (!raw) return null;
  let guide;
  try { guide = JSON.parse(raw); } catch { return null; }
  if (!guide || guide.status !== 'active') return null;
  return guide;
}

/** Stable per-purchase identifier used for password derivation + audit logs. */
export function getEntitlementId(guide) {
  return guide.stripe_session_id || guide.recovered_at || null;
}

/**
 * No name is collected anywhere in the current Guide checkout flow
 * (services/stripe.js never asks for one). Best-effort live lookup against
 * the purchase's own Checkout Session; falls back to a friendly name derived
 * from the email's local-part if Stripe never captured one. Not cached —
 * this only runs on the already-rate-limited PDF-generation path.
 */
async function getPurchaserName(email, guide, env) {
  const fallback = email.split('@')[0].replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  if (!guide.stripe_session_id || !env.STRIPE_SECRET_KEY) return fallback;

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${guide.stripe_session_id}?expand[]=customer_details`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
    if (!res.ok) return fallback;
    const session = await res.json();
    return session.customer_details?.name || fallback;
  } catch {
    return fallback;
  }
}

function fillTemplate(vars) {
  let html = templateHtml;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

function formatHumanDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// `version` is an ISO timestamp (services/guideContent.js's contentUpdatedAt,
// derived from Airtable's own Last Modified on the Content field) or null if
// no chapters are published yet — never a password input (see pdfPassword.js).
function formatContentUpdatedAt(version) {
  if (!version) return 'Chapters not yet published';
  const date = new Date(version);
  if (Number.isNaN(date.getTime())) return 'Chapters not yet published';
  return formatHumanDate(date);
}

/**
 * @param {string} email
 * @param {object} guide - active guide KV record (from getActiveGuideEntitlement)
 * @param {object} env
 * @returns {Promise<{ pdfBytes: Uint8Array, password: string, entitlementId: string|null, purchaserName: string }>}
 */
export async function generateGuidePdf(email, guide, env) {
  const entitlementId = getEntitlementId(guide);
  const { html: chapterHtml, version } = await getGuideContent(GUIDE_ID, env);
  const purchaserName = await getPurchaserName(email, guide, env);

  const filledHtml = fillTemplate({
    PURCHASER_NAME: escapeHtml(purchaserName),
    PURCHASER_EMAIL: escapeHtml(email),
    GENERATED_AT: escapeHtml(formatHumanDate(new Date())),
    GUIDE_VERSION: escapeHtml(formatContentUpdatedAt(version)),
    WATERMARK_TEXT: escapeHtml(`${email} — personal use only`),
    CHAPTER_CONTENT_HTML: chapterHtml,
    PAGE_MARGIN: `${PDF_MARGIN.top} ${PDF_MARGIN.right} ${PDF_MARGIN.bottom} ${PDF_MARGIN.left}`,
  });

  const browser = await puppeteer.launch(env.BROWSER);
  let unencryptedBytes;
  try {
    const page = await browser.newPage();
    await page.setContent(filledHtml, { waitUntil: 'networkidle0' });
    unencryptedBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-size:7px; color:#999; width:100%; text-align:center; padding:0 18mm;">
          Licensed for personal use only &mdash; not for redistribution &middot;
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
      margin: PDF_MARGIN,
    });
  } finally {
    await browser.close();
  }

  const password = await deriveGuidePdfPassword(email, entitlementId || 'legacy', GUIDE_ID, env);
  const pdfBytes = await encryptGuidePdf(unencryptedBytes, password);

  return { pdfBytes, password, entitlementId, purchaserName };
}
