// worker.js — entry point for the Skyfare Reports Bot Worker.
//
// scheduled(): a SINGLE cron trigger, "5 0,8 * * *" (see wrangler.toml) — fires at :05 past
// hour 0 and hour 8, Manila time, every day. Cloudflare accounts cap out at 5 cron triggers
// total across every Worker, and the existing production Worker already uses several, so this
// Worker deliberately shares one trigger slot across all three report types instead of
// registering one each:
//   - hour 0 (00:05 Manila)  → always sends the daily report for the day that just ended
//                              (e.g. Monday's report sends Tuesday 00:05); also sends the
//                              weekly report if the day that just ended was a Sunday — a full
//                              Monday-Sunday week (the site runs 24/7, so weekends count), sent
//                              the following Monday alongside that day's daily report.
//   - hour 8 on the 1st (08:05 Manila) → sends the monthly report, unchanged in cadence from
//                              before (still the 1st of the month, ~8AM) aside from the 5-minute
//                              shift needed to share this one cron expression.
//
// fetch(): the only HTTP route is a token-gated /debug/run, for manually testing report
// output before trusting the cron. There is no other surface — this Worker never receives
// webhooks and never serves the public.
import { isManilaSunday, getManilaHourAndDay } from "./utils/dates.js";
import { runReport } from "./report/reportRunner.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default {
  async scheduled(event, env, ctx) {
    const runDate = new Date(event.scheduledTime);
    const { hour, day } = getManilaHourAndDay(runDate);

    let types = [];
    if (hour === 0) {
      // The daily report always covers the day that just ended, not "today" (the send day).
      const reportedDay = new Date(runDate.getTime() - ONE_DAY_MS);
      types = isManilaSunday(reportedDay) ? ["daily", "weekly"] : ["daily"];
    } else if (hour === 8 && day === 1) {
      types = ["monthly"];
    }
    if (types.length === 0) return; // not one of the two report-firing hours — no-op

    ctx.waitUntil(
      Promise.allSettled(
        types.map((type) =>
          runReport(type, env, { runDate }).catch((err) => {
            console.error(`[worker] ${type} report failed: ${err.message}`);
            throw err;
          })
        )
      )
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/debug/run") {
      return handleDebugRun(request, env);
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
