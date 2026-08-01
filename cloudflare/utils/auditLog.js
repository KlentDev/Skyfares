// utils/auditLog.js — durable, queryable log of every guide-PDF generation
// attempt (granted or denied). Separate D1 database (AUDIT_DB), not KV —
// KV has no query capability, and this is exactly the kind of "who requested
// what, when, and did it succeed" data you'd want to filter/aggregate on if
// investigating abuse or a leaked file later.
//
// See migrations/0001_guide_pdf_audit_log.sql for the schema. Logging must
// never block or fail the actual request — a D1 outage should degrade to
// "ungated but unlogged," not "PDF delivery broken" — so every call site
// wraps this in a .catch(() => {}), same convention as this codebase's
// existing best-effort side calls (e.g. tagGuideBuyer in stripeWebhook.js).

/**
 * @param {object} entry
 * @param {string} entry.email
 * @param {string} entry.guideId
 * @param {string|null} entry.entitlementId
 * @param {'download'|'email'} entry.method
 * @param {'success'|'denied'|'error'} entry.status
 * @param {string} [entry.reason]
 * @param {string} [entry.ip]
 * @param {{AUDIT_DB: D1Database}} env
 */
export async function logGuidePdfRequest(entry, env) {
  if (!env.AUDIT_DB) return; // not provisioned in this environment (e.g. early local dev)
  await env.AUDIT_DB.prepare(
    `INSERT INTO guide_pdf_audit_log
      (created_at, email, guide_id, entitlement_id, delivery_method, status, reason, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    new Date().toISOString(),
    entry.email,
    entry.guideId,
    entry.entitlementId || null,
    entry.method,
    entry.status,
    entry.reason || null,
    entry.ip || null
  ).run();
}
