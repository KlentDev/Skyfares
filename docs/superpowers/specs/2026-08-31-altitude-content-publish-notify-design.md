# Altitude content publish notifications — design

## Problem

Members should get a push notification when new Altitude content actually goes live — specifically when an `Altitude Award Alerts` or `Altitude KrisFlyer Escapes` record's `Status` field is `Published`. This never happens today. It isn't a frontend bug: the toggle and toast built earlier this session correctly display whatever `POST /api/push/send` sends them, and that endpoint (`cloudflare/orchestration/pushHandlers.js`) is itself fully implemented, including an exactly-once `dedupeKey` guard whose own comment references "the plan's 'Fire condition: Draft -> Published, exactly once' section." Nothing, however, ever calls it:

- No webhook route in `worker.js` for inbound Airtable events.
- No cron job touches these two content tables — `cloudflare/orchestration/cron.js`'s existing jobs are all member/subscription related (renewal reminders, guide-bundle expiry, two Beehiiv reconciliation sweeps).
- Querying the Airtable base directly (`list_automations`) confirms only 4 automations exist, none referencing Award Alerts, KrisFlyer Escapes, or the Worker.

The trigger side of this feature was designed for (per the code comment) but never built, on either the Airtable or the Worker side.

## Why polling, not an Airtable-side webhook

Airtable automations have no native "send outbound webhook" action. The standard real-world workaround — a Run-Script action calling `fetch()` — isn't safely buildable through the Airtable MCP tools available here: `customScript` is absent from both the curated card catalog and the "available but not yet fully supported" catalog in `get_create_automation_instructions`, meaning its input shape is undocumented and a blind attempt risks silently creating a broken automation.

Instead, the Worker polls Airtable on a schedule — consistent with the existing pattern in `cron.js`, which already does "poll state, diff against a persisted flag, act once" for renewals and Beehiiv sync. A record is treated as "notify-worthy" whenever it is currently `Status = "Published"` and has no `push-sent:` KV entry yet — a state check, not a literal edit-history diff. This has one deliberate consequence: a record created directly as `Published` (never having been `Draft`) also notifies, on the same poll that first sees it. There's no prior working behavior to preserve here, and distinguishing "was Draft then flipped" from "always Published" would require storing extra per-record history for no member-visible benefit.

## Design

### 1. Extract `sendPushBroadcast` from `handlePushSend`

`cloudflare/orchestration/pushHandlers.js`'s `handlePushSend` currently does auth/rate-limiting/validation *and* the actual dedupe-check → find-recipients → send → clean-up-gone-subscriptions → write-dedupe-key work, all inline. Split the latter into:

```js
export async function sendPushBroadcast(env, { title, body, url, type, dedupeKey, audience, topics }) {
  // returns { sent, failed, removed, skipped }
}
```

`handlePushSend` becomes a thin HTTP wrapper: validate the request, then call `sendPushBroadcast`. No behavior change to the existing endpoint or its response shape — this is a pure extraction so the new poll job (below) can reuse the exact same send-and-dedupe logic as an in-process function call, without an HTTP round trip and without needing `PUSH_ADMIN_TOKEN` (which stays frontend-inaccessible, used only by the still-supported external HTTP path).

### 2. Shared "fetch Published records" helper

`cloudflare/services/airtable.js`'s `handleGetAltitudeContent` already fetches `Status="Published"` records per content type (`filterByFormula: '{Status}="Published"'`) and normalizes them via `ALTITUDE_CONTENT_TYPES[type].normalize`. Factor the fetch-and-normalize body out into an exported `fetchPublishedAltitudeContent(env, type)` that returns normalized records (each carrying `id`, `title`, `shortDescription`, etc. from `normalizeBaseContent`). `handleGetAltitudeContent` calls it too, instead of duplicating the fetch — the only behavior difference is that the HTTP handler still does its own entitlement check and table-configured/API-key guards before calling it.

### 3. New poll job: `notifyPublishedAltitudeContent(env)`

Added to `cloudflare/orchestration/cron.js`, alongside the existing daily poll jobs. For each of:

| content type | push `type` | destination `url` |
|---|---|---|
| `award-alerts` | `award_alert` | `/pages/private-pages/altitude-access/award-alerts.html` |
| `krisflyer-escapes` | `krisflyer_escape` | `/pages/private-pages/altitude-access/krisflyer-escapes.html` |

call `fetchPublishedAltitudeContent(env, type)`, then for each returned record call:

```js
sendPushBroadcast(env, {
  title: record.title,
  body: record.shortDescription,
  url: <destination url for this type>,
  type: <push type for this type>,
  dedupeKey: `${type}:${record.id}`,
  audience: 'altitude',
  topics: [],
});
```

`sendPushBroadcast`'s own dedupe check (below) makes repeat calls for the same record a fast no-op, so this function does not need to track anything itself beyond "loop over currently-Published records."

### 4. Cron wiring

`cloudflare/wrangler.toml`'s `crons` gains a second entry: `crons = ["0 1 * * *", "*/10 * * * *"]`. `worker.js`'s `scheduled(event, env, ctx)` branches on `event.cron` so the new 10-minute schedule runs only `notifyPublishedAltitudeContent(env)`, leaving the existing daily job (`triggerSegmentRecalculation`, `runRenewalReminders`, `expireGuideBundles`, `reconcileBeehiivAccess`, `reconcilePushSubscriptionAudience`) running only on its own `0 1 * * *` schedule as today.

## Duplicate prevention

Identical mechanism to the one already built into `handlePushSend`: KV key `push-sent:<dedupeKey>` (here, `<type>:<recordId>`), written only after a full send batch completes, 90-day TTL (existing `KV_PREFIX.PUSH_SENT` / send-batch idiom, unchanged). Every later poll that sees the same already-notified record does one cheap KV read and stops — no send, no duplicate. Editing an already-published record's text afterward does not re-fire, since the dedupe key is the record ID, not a content hash: this is "once per publication," not "once per edit."

## Testing

`wrangler dev` supports firing the scheduled handler manually via `/__scheduled?cron=*/10+*+*+*+*`, without waiting for a real cron tick. Verification plan:

1. **Draft → Published**: create an Award Alerts record as `Draft`, confirm no `push-sent:` KV entry and no push fires on a manual scheduled-handler invocation. Flip `Status` to `Published`, invoke again, confirm a push is sent to a real test subscription and the KV dedupe key is written.
2. **Draft stays Draft**: create a record, leave it `Draft`, invoke the scheduled handler — confirm no send.
3. **Already Published, unrelated update**: touch an unrelated field on an already-notified `Published` record, invoke again — confirm no duplicate send (KV dedupe short-circuits).
4. **Refresh/re-fetch**: invoke the scheduled handler multiple times in a row with no Airtable changes in between — confirm no duplicate sends across repeated polls.
5. Repeat 1–2 for KrisFlyer Escapes to confirm both content types are wired symmetrically.

## Deployment note

This lives entirely in the Cloudflare Worker (`cloudflare/`) — a different deploy path from the static site's GitHub Pages workflow. There is no CI workflow for the Worker in this repo; it ships via `wrangler deploy` run manually from `cloudflare/`. This needs to be deployed explicitly for any of this to take effect, the same way the earlier `sw.js` fix did.

## Files touched

- `cloudflare/orchestration/pushHandlers.js` — extract `sendPushBroadcast`.
- `cloudflare/services/airtable.js` — extract `fetchPublishedAltitudeContent`.
- `cloudflare/orchestration/cron.js` — new `notifyPublishedAltitudeContent`.
- `cloudflare/worker.js` — `scheduled()` branches on `event.cron`, wires in the new job.
- `cloudflare/wrangler.toml` — second `crons` entry.

## Out of scope

- No changes to the frontend toggle/toast (already fixed this session, and confirmed working correctly against whatever the Worker sends).
- No Airtable automation is created — the Airtable side of this feature intentionally has zero new configuration.
- `routing-strategies` (the third `ALTITUDE_CONTENT_TYPES` entry) is not wired into this notification job — its Airtable table (`AIRTABLE_TABLE_ALTITUDE_ROUTING_STRATEGIES`) isn't provisioned yet and it wasn't part of this request.
