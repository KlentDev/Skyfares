// services/airtable.js
// Read-only against Airtable — this Worker never writes records (writes stay in
// cloudflare/subscribe-worker.js's writeToAirtable()). Both tables are referenced by ID,
// matching the existing convention (env.AIRTABLE_TABLE_FLIGHT_APPLICATIONS / _CONTACT_INQUIRIES).
import { fetchWithRetry } from "../utils/retry.js";

const BASE = "https://api.airtable.com/v0";

function authHeaders(env) {
  return { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` };
}

// IMPORTANT gotcha: the "Submission Date" field is a plain Airtable `date` (no time component),
// and cloudflare/subscribe-worker.js populates it via `new Date().toISOString().split('T')[0]` —
// i.e. the *UTC* calendar date at write time, not the Manila calendar date. Manila is UTC+8, so
// the Manila daily report window (00:00-20:00 Manila) actually spans TWO different UTC calendar
// dates (Manila midnight = previous-UTC-day 16:00; Manila 8PM = same-UTC-day noon). Given the
// field can't represent anything finer than a day anyway, we filter on the inclusive UTC-date
// range spanned by the window's start/end instants rather than trying to derive a Manila date —
// that's the closest this data can get to "correct," and it's naturally more than adequate for
// week/month windows where this edge fuzziness is negligible.
function utcDateStr(date) {
  return date.toISOString().slice(0, 10);
}

async function listRecords(tableId, { filterByFormula, fields } = {}, env) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    if (fields) fields.forEach((f) => params.append("fields[]", f));
    if (offset) params.set("offset", offset);
    const res = await fetchWithRetry(
      `${BASE}/${env.AIRTABLE_BASE_ID}/${tableId}?${params.toString()}`,
      { headers: authHeaders(env) }
    );
    if (!res.ok) throw new Error(`airtable ${tableId} ${res.status}`);
    const json = await res.json();
    records.push(...(json.records || []));
    offset = json.offset;
  } while (offset);
  return records;
}

/** All-time record count — feeds the daily report's "Overall" cumulative block. */
export async function countAllRecords(tableId, env) {
  const records = await listRecords(tableId, { fields: ["Name"] }, env);
  return records.length;
}

/** Record count whose Submission Date falls within the UTC-date range spanned by the window. */
export async function countRecordsInWindow(tableId, window, env) {
  const startStr = utcDateStr(window.start);
  const endStr = utcDateStr(window.end);
  const formula = `AND(NOT(IS_BEFORE({Submission Date}, '${startStr}')), NOT(IS_AFTER({Submission Date}, '${endStr}')))`;
  const records = await listRecords(tableId, { filterByFormula: formula, fields: ["Name"] }, env);
  return records.length;
}
