// worker.js — entry point for the Skyfare Reports Bot Worker.
//
// scheduled(): a SINGLE cron trigger, "5 0,16 * * *" in UTC (see wrangler.toml) — Cloudflare
// cron triggers always fire in UTC, so this is written as UTC hours even though the intent is
// Manila-local times (00:05 UTC = 08:05 Manila; 16:05 UTC = 00:05 Manila the following day).
// getManilaHourAndDay() below converts back to the actual Manila hour at fire time, which is
// what the branching logic checks — never the raw UTC hour. Cloudflare accounts cap out at 5
// cron triggers total across every Worker, and the existing production Worker already uses
// several, so this Worker deliberately shares one trigger slot across all three report types
// instead of registering one each:
//   - Manila hour 0 (fires 16:05 UTC) → always sends the daily report for the day that just
//                              ended (e.g. Monday's report sends Tuesday 00:05 Manila); also
//                              sends the weekly report if the day that just ended was a
//                              Sunday — a full Monday-Sunday week (the site runs 24/7, so
//                              weekends count), sent the following Monday alongside that day's
//                              daily report.
//   - Manila hour 8 on the 1st (fires 00:05 UTC) → sends the monthly report, unchanged in
//                              cadence from before (still the 1st of the month, ~8AM Manila)
//                              aside from the 5-minute shift needed to share this one cron
//                              expression.
//
// Heartbeat logging: every scheduled() firing writes a durable KV record independent of the
// report itself, specifically so a missed report is diagnosable later (2026-07-15's daily
// report went missing with zero trace anywhere — Cloudflare doesn't retain queryable historical
// logs without Logpush configured, which isn't set up here). Check via GET /debug/heartbeat.
//
// fetch(): /debug/run to manually test report output, /debug/heartbeat to check recent cron
// activity. Both token-gated. There is no other surface — this Worker never receives webhooks
// and never serves the public.
import { isManilaSunday, getManilaHourAndDay } from "./utils/dates.js";
import { runReport } from "./report/reportRunner.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

async function recordHeartbeat(env, key, data) {
  await env.REPORTS_KV.put(`heartbeat:${key}`, JSON.stringify(data), { expirationTtl: HEARTBEAT_TTL_SECONDS }).catch(
    (err) => console.error(`[heartbeat] failed to record ${key}: ${err.message}`)
  );
}

export default {
  async scheduled(event, env, ctx) {
    const runDate = new Date(event.scheduledTime);

    // Recorded FIRST, before any other logic, and wrapped in a top-level try/catch below — so
    // even a genuinely unexpected crash (not just a report-generation failure, but a bug in the
    // dispatch logic itself) still leaves a trace instead of failing 100% silently, which is
    // exactly what made 2026-07-15's miss unfixable-by-inspection after the fact.
    ctx.waitUntil(recordHeartbeat(env, "lastFire", { firedAt: runDate.toISOString() }));

    try {
      const { hour, day } = getManilaHourAndDay(runDate);

      let types = [];
      if (hour === 0) {
        // The daily report always covers the day that just ended, not "today" (the send day).
        const reportedDay = new Date(runDate.getTime() - ONE_DAY_MS);
        types = isManilaSunday(reportedDay) ? ["daily", "weekly"] : ["daily"];
      } else if (hour === 8 && day === 1) {
        types = ["monthly"];
      }

      ctx.waitUntil(recordHeartbeat(env, "lastDispatch", { firedAt: runDate.toISOString(), manilaHour: hour, manilaDay: day, decidedTypes: types }));

      if (types.length === 0) return; // not one of the two report-firing hours — no-op

      ctx.waitUntil(
        Promise.allSettled(
          types.map(async (type) => {
            await recordHeartbeat(env, `${type}:lastAttempt`, { at: runDate.toISOString() });
            try {
              await runReport(type, env, { runDate });
              await recordHeartbeat(env, `${type}:lastSuccess`, { at: new Date().toISOString() });
            } catch (err) {
              await recordHeartbeat(env, `${type}:lastFailure`, { at: new Date().toISOString(), error: err.message });
              console.error(`[worker] ${type} report failed: ${err.message}`);
            }
          })
        )
      );
    } catch (err) {
      // Catches anything unexpected in the dispatch logic itself (not a report failure — those
      // are already isolated above). Should never fire in practice; exists purely so "never
      // fails silently" is actually true rather than aspirational.
      ctx.waitUntil(recordHeartbeat(env, "scheduledCrash", { at: new Date().toISOString(), error: err.message }));
      console.error(`[worker] scheduled() crashed: ${err.message}`);
      throw err;
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/debug/run") {
      return handleDebugRun(request, env);
    }
    if (request.method === "GET" && url.pathname === "/debug/heartbeat") {
      return handleDebugHeartbeat(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};

async function handleDebugRun(request, env) {
  const url = new URL(request.url);

  if (!env.DEBUG_RUN_TOKEN || url.searchParams.get("token") !== env.DEBUG_RUN_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  // Publicly reachable on *.workers.dev even with the token check, so still worth a light
  // rate-limit — mirrors the pattern already used in cloudflare/subscribe-worker.js.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rlKey = `debugrun-rl:${ip}`;
  const rlCount = parseInt((await env.REPORTS_KV.get(rlKey)) || "0", 10);
  if (rlCount >= 10) {
    return new Response("rate_limited", { status: 429 });
  }
  await env.REPORTS_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  const type = url.searchParams.get("type");
  if (!["daily", "weekly", "monthly"].includes(type)) {
    return new Response('Missing/invalid "type" — use daily, weekly, or monthly', { status: 400 });
  }
  // Defaults to a dry run (no Slack post, no snapshot write) so formatting can be iterated on
  // without spamming #reports or polluting the KV history used for period comparisons.
  const post = url.searchParams.get("post") === "true";

  try {
    const { blocks, fallbackText } = await runReport(type, env, { post });
    // Reports are Block Kit now (real Slack tables), not a single text string, so the
    // dry-run preview is JSON — paste it into Slack's Block Kit Builder (api.slack.com/block-kit-builder)
    // to see it rendered before trusting post=true.
    return new Response(JSON.stringify({ fallbackText, blocks }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    console.error(`[debug/run] ${type} failed: ${err.message}`);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

async function handleDebugHeartbeat(request, env) {
  const url = new URL(request.url);
  if (!env.DEBUG_RUN_TOKEN || url.searchParams.get("token") !== env.DEBUG_RUN_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  const keys = [
    "lastFire",
    "lastDispatch",
    "scheduledCrash",
    "daily:lastAttempt",
    "daily:lastSuccess",
    "daily:lastFailure",
    "weekly:lastAttempt",
    "weekly:lastSuccess",
    "weekly:lastFailure",
    "monthly:lastAttempt",
    "monthly:lastSuccess",
    "monthly:lastFailure",
  ];
  const entries = await Promise.all(
    keys.map(async (k) => {
      const raw = await env.REPORTS_KV.get(`heartbeat:${k}`).catch(() => null);
      return [k, raw ? JSON.parse(raw) : null];
    })
  );

  return new Response(JSON.stringify(Object.fromEntries(entries), null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
