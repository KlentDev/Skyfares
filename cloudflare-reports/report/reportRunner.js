// report/reportRunner.js
// Orchestrates one report run end-to-end: fetch every integration in parallel (isolated via
// Promise.allSettled so one failure never blocks the rest), build the Block Kit blocks, save a
// KV snapshot for the next period's comparison, and post to Slack via chat.postMessage.
import { getDailyWindow, getWeeklyWindow, getMonthlyWindow } from "../utils/dates.js";
import { getPreviousSnapshot, saveSnapshot, getTrailingDailySnapshots } from "../utils/kvSnapshots.js";
import * as beehiiv from "../services/beehiiv.js";
import * as airtable from "../services/airtable.js";
import { getStripeSummary } from "../services/stripe.js";
import { getCalendlySummary } from "../services/calendly.js";
import { getGa4Summary } from "../services/ga4.js";
import { postReport } from "../slack/slackClient.js";
import { detectAlerts } from "./alerts.js";
import { build as buildDaily } from "./dailyReport.js";
import { build as buildWeekly } from "./weeklyReport.js";
import { build as buildMonthly } from "./monthlyReport.js";

/**
 * @typedef {Object} ReportContext
 * @property {'daily'|'weekly'|'monthly'} type
 * @property {Date} runDate
 * @property {{start:Date,end:Date,periodKey:string,previousPeriodKey:string}} window
 * @property {{year:number,month:number}} [monthYm]
 * @property {Object.<string, import('../config/constants.js').IntegrationResult>} results
 * @property {import('../config/constants.js').ReportSnapshot|null} previousSnapshot
 * @property {import('../config/constants.js').ReportSnapshot[]} trailingDaily
 * @property {number} newPremiumInWindow
 * @property {string[]} alerts
 */

const WINDOW_BUILDERS = {
  daily: getDailyWindow,
  weekly: getWeeklyWindow,
  monthly: getMonthlyWindow,
};

const REPORT_BUILDERS = {
  daily: buildDaily,
  weekly: buildWeekly,
  monthly: buildMonthly,
};

/** Runs every task concurrently and normalizes each outcome to {status, data|error}. */
async function runTasks(taskFns) {
  const keys = Object.keys(taskFns);
  const settled = await Promise.allSettled(keys.map((k) => taskFns[k]()));
  const results = {};
  settled.forEach((s, i) => {
    const key = keys[i];
    if (s.status === "fulfilled") {
      results[key] = { status: "ok", data: s.value };
    } else {
      const message = s.reason?.message || String(s.reason);
      results[key] = { status: "error", error: message };
      console.error(`[reportRunner] ${key} failed: ${message}`);
    }
  });
  return results;
}

/**
 * "New Premium members in window" can't be a real client-filtered count the way subscriber
 * joins can (see services/beehiiv.js) — a subscriber's `created` timestamp is their original
 * signup date, not their upgrade date, and Beehiiv exposes no per-subscriber upgrade timestamp.
 * So this stays a snapshot delta: current Premium total minus the prior period's stored total.
 * On the very first report ever (no previous snapshot), there's nothing to diff against — this
 * defaults to 0, which also happens to be the true value today (nobody has upgraded yet).
 */
function computeDelta(current, previous) {
  return previous == null ? 0 : current - previous;
}

/**
 * @param {'daily'|'weekly'|'monthly'} type
 * @param {any} env
 * @param {{runDate?: Date, post?: boolean}} [options]
 */
export async function runReport(type, env, { runDate = new Date(), post = true } = {}) {
  const window = WINDOW_BUILDERS[type](runDate);

  const criticalTasks = {
    segments: () => beehiiv.fetchSegmentCounts(env),
    subscribersInWindow: () => beehiiv.countSubscribersInWindow(window, env),
    flightAppsWindow: () => airtable.countRecordsInWindow(env.AIRTABLE_TABLE_FLIGHT_APPLICATIONS, window, env),
    contactWindow: () => airtable.countRecordsInWindow(env.AIRTABLE_TABLE_CONTACT_INQUIRIES, window, env),
  };
  // "Overall" cumulative totals only appear in the daily report — no need to page through
  // every record on weekly/monthly runs.
  if (type === "daily") {
    criticalTasks.flightAppsAllTime = () => airtable.countAllRecords(env.AIRTABLE_TABLE_FLIGHT_APPLICATIONS, env);
    criticalTasks.contactAllTime = () => airtable.countAllRecords(env.AIRTABLE_TABLE_CONTACT_INQUIRIES, env);
  }

  const results = await runTasks(criticalTasks);

  const previousSnapshot = await getPreviousSnapshot(type, window.previousPeriodKey, env);

  // Total active subscribers = Free + Premium segment counts (mutually exclusive by
  // definition — see config/constants.js segment descriptions).
  results.activeSubscribers =
    results.segments.status === "ok"
      ? { status: "ok", data: results.segments.data.premiumCount + results.segments.data.freeCount }
      : { status: "error", error: "derived from segments, which failed" };

  // Real client-filtered counts (see services/beehiiv.js) — accurate from the very first report,
  // no snapshot-delta guesswork needed for these two.
  results.newSubscribersTotal =
    results.subscribersInWindow.status === "ok"
      ? { status: "ok", data: results.subscribersInWindow.data.total }
      : { status: "error", error: "subscribersInWindow failed" };
  results.newPrelaunch =
    results.subscribersInWindow.status === "ok"
      ? { status: "ok", data: results.subscribersInWindow.data.prelaunch }
      : { status: "error", error: "subscribersInWindow failed" };

  const newPremiumInWindow =
    results.segments.status === "ok"
      ? computeDelta(results.segments.data.premiumCount, previousSnapshot?.beehiiv?.premiumCount ?? null)
      : 0;

  // Stub services never throw and already return {status, ...} — no need to route them
  // through the generic ok/error wrapper above.
  results.stripe = await getStripeSummary();
  results.calendly = await getCalendlySummary();
  results.ga4 = await getGa4Summary();

  // Reference point is the REPORTED day (window.start), not the send instant (runDate) — the
  // daily report for Monday sends Tuesday 00:05, but "trailing 7 days" should mean the 7 days
  // before Monday, not before Tuesday.
  const trailingDaily = type === "daily" ? await getTrailingDailySnapshots(7, window.start, env) : [];

  const ctx = {
    type,
    runDate,
    window,
    monthYm: type === "monthly" ? parseMonthKey(window.periodKey) : undefined,
    results,
    previousSnapshot,
    trailingDaily,
    newPremiumInWindow,
    alerts: [],
  };
  ctx.alerts = detectAlerts(ctx);

  const { blocks, fallbackText } = REPORT_BUILDERS[type](ctx);

  const snapshot = buildSnapshot(type, window, results, newPremiumInWindow, previousSnapshot);

  if (post) {
    // Save before sending: a Slack delivery failure shouldn't cost the next period's comparison data.
    await saveSnapshot(snapshot, env);
    await postReport(blocks, fallbackText, env);
  }

  return { blocks, fallbackText, alerts: ctx.alerts, results, snapshot };
}

function parseMonthKey(periodKey) {
  const [year, month] = periodKey.split("-").map(Number);
  return { year, month };
}

function buildSnapshot(type, window, results, newPremiumInWindow, previousSnapshot) {
  const val = (result, fallback = 0) => (result?.status === "ok" ? result.data : fallback);
  return {
    period: type,
    periodKey: window.periodKey,
    windowStartUtc: window.start.toISOString(),
    windowEndUtc: window.end.toISOString(),
    beehiiv: {
      activeSubscribers: val(results.activeSubscribers, previousSnapshot?.beehiiv?.activeSubscribers ?? 0),
      premiumCount: results.segments.status === "ok" ? results.segments.data.premiumCount : previousSnapshot?.beehiiv?.premiumCount ?? 0,
      freeCount: results.segments.status === "ok" ? results.segments.data.freeCount : previousSnapshot?.beehiiv?.freeCount ?? 0,
      prelaunchCount: results.segments.status === "ok" ? results.segments.data.prelaunchCount : previousSnapshot?.beehiiv?.prelaunchCount ?? 0,
      newSubscribersInWindow: val(results.newSubscribersTotal, 0),
      newPrelaunchInWindow: val(results.newPrelaunch, 0),
      newPremiumInWindow,
    },
    airtable: {
      flightApplicationsInWindow: val(results.flightAppsWindow, 0),
      contactInquiriesInWindow: val(results.contactWindow, 0),
      flightApplicationsAllTime: val(results.flightAppsAllTime, previousSnapshot?.airtable?.flightApplicationsAllTime ?? 0),
      contactInquiriesAllTime: val(results.contactAllTime, previousSnapshot?.airtable?.contactInquiriesAllTime ?? 0),
    },
    integrationErrors: Object.entries(results)
      .filter(([, v]) => v.status === "error")
      .map(([k]) => k),
    savedAt: new Date().toISOString(),
  };
}
