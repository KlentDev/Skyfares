// services/beehiiv.js
// Read-only against Beehiiv — this Worker never writes/mutates Beehiiv state (no tagging,
// no segment recalculation triggers; that mutation logic stays in cloudflare/subscribe-worker.js).
//
// IMPORTANT — verified against LIVE API responses via wrangler tail + direct curl, 2026-07-09:
//   - Each segment object's member count field is `total_results`, NOT `num_members`. The
//     `num_members` name came from the MCP Beehiiv integration's own abstraction layer, which
//     renames fields — it is NOT the real REST field name.
//   - `GET /subscriptions` silently ignores `subscribed_after`/`subscribed_before`/`created_after`/
//     `segment_id` query params entirely on this account/plan (tested directly, identical results
//     with or without them). A dedicated `/segments/{id}/subscriptions` endpoint also returns 404.
//   - `order_by=created&direction=desc` IS honored, and cursor pagination (`cursor` request param,
//     `has_more`/`next_cursor` response fields — NOT `page`, unlike the segments endpoint) works
//     correctly. countSubscribersInWindow() below uses this to filter client-side instead of
//     relying on the broken server-side filters: walk pages newest-first, stop as soon as a
//     subscriber's `created` (unix seconds) falls before the window start.
//   - Each subscription object carries its own `utm_campaign`, which is exactly the Pre-Launch
//     segment's own defining condition (`utm_campaign = 'altitude_prelaunch'`) — so pre-launch
//     membership is checked directly per-subscriber during that same walk, rather than through
//     the broken segment_id filter.
import { fetchWithRetry } from "../utils/retry.js";
import { SEG_PREMIUM, SEG_FREE, SEG_PRELAUNCH } from "../config/constants.js";

const BASE = "https://api.beehiiv.com/v2";
const PRELAUNCH_UTM_CAMPAIGN = "altitude_prelaunch";

function authHeaders(env) {
  return { Authorization: `Bearer ${env.BEEHIIV_API_KEY}` };
}

/** Cumulative segment member counts — one call covers all three known segments. */
export async function fetchSegmentCounts(env) {
  const res = await fetchWithRetry(
    `${BASE}/publications/${env.BEEHIIV_PUB_ID}/segments?limit=100`,
    { headers: authHeaders(env) }
  );
  if (!res.ok) throw new Error(`beehiiv segments ${res.status}`);
  const json = await res.json();
  const segments = json.data || [];
  const byId = Object.fromEntries(segments.map((s) => [s.id, s]));
  return {
    premiumCount: byId[SEG_PREMIUM]?.total_results ?? 0,
    freeCount: byId[SEG_FREE]?.total_results ?? 0,
    prelaunchCount: byId[SEG_PRELAUNCH]?.total_results ?? 0,
  };
}

/**
 * Real count of active subscribers created within [start, end], filtered client-side (see file
 * header for why). Returns both the total and the pre-launch-scoped subset in one walk.
 * @param {{start: Date, end: Date}} window
 */
export async function countSubscribersInWindow({ start, end }, env) {
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);
  let cursor;
  let total = 0;
  let prelaunch = 0;

  for (;;) {
    const params = new URLSearchParams({ limit: "100", order_by: "created", direction: "desc" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetchWithRetry(
      `${BASE}/publications/${env.BEEHIIV_PUB_ID}/subscriptions?${params.toString()}`,
      { headers: authHeaders(env) }
    );
    if (!res.ok) throw new Error(`beehiiv subscriptions ${res.status}`);
    const json = await res.json();
    const items = json.data || [];

    let passedWindowStart = false;
    for (const sub of items) {
      if (sub.created < startSec) {
        passedWindowStart = true;
        break;
      }
      if (sub.created <= endSec && sub.status === "active") {
        total += 1;
        if (sub.utm_campaign === PRELAUNCH_UTM_CAMPAIGN) prelaunch += 1;
      }
    }
    if (passedWindowStart || !json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }

  return { total, prelaunch };
}
