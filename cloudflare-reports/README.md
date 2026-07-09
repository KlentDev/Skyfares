# Skyfare Reports Bot

A standalone Cloudflare Worker that posts automated daily/weekly/monthly business summaries
into a private Slack channel (`#reports`), while the V2 centralized admin dashboard is being
built. It is read-only against every external service, fully decoupled from
[`cloudflare/subscribe-worker.js`](../cloudflare/subscribe-worker.js), and never behaves like a
chatbot — it only ever sends one message per scheduled run.

## Architecture

```text
Cron trigger "5 0,8 * * *" (Asia/Manila): daily 12:05 AM (reports the day that just ended) /
weekly 12:05 AM Monday (reports the completed Mon-Sun 7-day week) / monthly 8:05 AM on the 1st
  → services/beehiiv.js + services/airtable.js   (real reads)
  → services/stripe.js + calendly.js + ga4.js     (stubs — "Not Connected Yet")
  → report/reportRunner.js                        (Promise.allSettled, KV snapshot diffing)
  → report/{daily,weekly,monthly}Report.js         (Block Kit blocks, incl. real tables)
  → slack/slackClient.js                          (chat.postMessage with a Bot Token)
  → #reports
```

**Why a Bot Token instead of a Workflow Builder webhook:** the original design used a
no-code Slack Workflow webhook (simpler setup, no OAuth). That was switched after testing
showed Slack's real table rendering (the `table` Block Kit block, GA'd 2026-05-20) only works
in `blocks` sent via the Bot API — a Workflow's "Send a message" step only supports plain-text
variable substitution, no Block Kit. The trade-off: more setup (a real Slack App + OAuth
scope) in exchange for genuine tables instead of a plain list. The bot's only scope is
`chat:write` and it only ever posts to `#reports` — it never reads messages or replies to
anything, so this is still a sender, not a chatbot.

See file-level comments in each module for the reasoning behind specific decisions (cron
overlap behavior, the Airtable `Submission Date` UTC-vs-Manila gotcha, why "new Premium
members" is a KV snapshot delta rather than a live filter, the table block schema, etc.) —
this README covers setup and operation, not design rationale.

## One-time setup

### 1. Slack App + Bot Token (manual — Slack has no API for creating apps)

The `#reports` private Slack channel already exists (created via MCP, only the creator is a
member; channel ID `C0BG6A1GGD7`, already set in `wrangler.toml` as `SLACK_CHANNEL_ID`).

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**. Name it something like "Skyfare Reports Bot" and pick the `skyfareconsulting` workspace.
2. **OAuth & Permissions** → under **Scopes → Bot Token Scopes**, add `chat:write`. That's the only scope needed — no `channels:read`, no `chat:write.public`, nothing that lets it read or join channels on its own.
3. **Install to Workspace** at the top of that same page → approve.
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`).
5. In Slack, open `#reports` → **Integrations** (or `/invite`) → invite the app you just created. A bot with `chat:write` only (no `chat:write.public`) can't post to a channel it hasn't been invited to.

### 2. Secrets

Run from this directory:

```bash
npx wrangler secret put AIRTABLE_API_KEY --config wrangler.toml
npx wrangler secret put BEEHIIV_API_KEY --config wrangler.toml
npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.toml
npx wrangler secret put DEBUG_RUN_TOKEN --config wrangler.toml
```

- `AIRTABLE_API_KEY` / `BEEHIIV_API_KEY` — reuse the same values already used by
  `cloudflare/subscribe-worker.js` (Wrangler secrets are per-Worker, so they need to be
  re-entered here even though it's the same underlying credential). Confirm the Airtable PAT's
  scope already covers base `appA5rSlwgc57nswR` with read access before relying on it.
- `SLACK_BOT_TOKEN` — the `xoxb-...` token from step 1 above.
- `DEBUG_RUN_TOKEN` — any random string (e.g. `openssl rand -hex 20`), used to gate the
  `/debug/run` route below.

### 3. Deploy

**Important:** always pass `--config wrangler.toml` explicitly. Running bare `wrangler deploy`
from this folder resolves the repo-root `wrangler.jsonc` instead (a real quirk hit during
setup — Wrangler's config search picked the parent config over the one in the current
directory), which tries to deploy the entire static site as Workers Assets and fails on `.git`
being over the 25 MiB asset size limit.

```bash
npx wrangler deploy --config wrangler.toml
```

The KV namespace (`REPORTS_KV`) is already created and wired into `wrangler.toml`.

## Testing

**Local**, without touching Slack or real API quota:

```bash
npx wrangler dev --test-scheduled --config wrangler.toml
```

then in another terminal:

```bash
curl "http://localhost:8787/__scheduled?cron=5+0,8+*+*+*"
```

This simulates the one trigger; `worker.js` checks the real current Manila time inside the
handler, so what it actually does depends on when you run this locally — at real hour 0 Manila
it sends the daily report for the day that just ended (+weekly if that day was a real Sunday),
at real hour 8 on the actual 1st it runs monthly, any other hour it's a no-op. To force a
specific report type regardless of the current time, use the `/debug/run` route below instead.

Local secrets go in a `.dev.vars` file in this directory (already git-ignored by the repo's
existing `.gitignore` rules) — copy the same values used for step 2 above.

**Deployed**, via the gated debug route:

```text
GET /debug/run?type=daily&token=<DEBUG_RUN_TOKEN>            # dry run — returns Block Kit JSON, no Slack post, no KV write
GET /debug/run?type=daily&token=<DEBUG_RUN_TOKEN>&post=true   # full run — posts to Slack and saves a snapshot
```

`type` is `daily`, `weekly`, or `monthly` — the debug route lets you force any of the three
regardless of what day it actually is, unlike the real cron (which only ever fires `weekly`/
`monthly` on the actual Monday / 1st). The dry-run response is `{ fallbackText, blocks }` —
paste the `blocks` array into [Slack's Block Kit Builder](https://app.slack.com/block-kit-builder)
to see exactly how it will render, including the tables, before trusting `post=true`.

**Cron trigger budget** — this account has a hard cap of 5 cron triggers total, shared across
every Worker, and it's already at that cap without this Worker needing more than 1 slot
(confirmed by hitting error code 10072 "exceeded the limit of 5" when a multi-trigger version
was attempted). That's why daily/weekly/monthly all share one cron expression
(`5 0,8 * * *`) instead of registering separate triggers (see `wrangler.toml` comment). If a
future change ever needs a real second trigger, the `subscribe-worker` deployment mentioned in
project memory as orphaned/stale is worth revisiting first — it still holds its own cron
triggers for no active purpose.

**Schedule summary:**

| Report  | Sent                  | Covers                                                                      |
| ------- | --------------------- | ---------------------------------------------------------------------------- |
| Daily   | 12:05 AM every day    | The full previous Manila day (e.g. Tuesday 12:05 AM sends Monday's report)  |
| Weekly  | 12:05 AM every Monday | The completed Monday–Sunday 7-day week (the site runs 24/7, weekends count) |
| Monthly | 8:05 AM on the 1st    | The full previous calendar month (unchanged)                                |

## Operating notes

- No CI/CD — deploys are manual, matching how `cloudflare/subscribe-worker.js` already ships.
- If a report ever looks wrong, `wrangler tail --config wrangler.toml` while manually hitting
  `/debug/run` is the fastest way to see the actual `console.error` output from whichever
  integration failed.
- Stripe/Calendly/GA4 are intentionally not wired up (see `services/stripe.js` etc. for what
  each would need). No secrets for them are declared in `wrangler.toml` at all, so there's no
  accidental path to using stale/wrong credentials for these later.
