// report/alerts.js
// Critical Beehiiv/Airtable calls are grouped into one status per external service (rather
// than one per API call) so a single flaky endpoint doesn't produce five duplicate "API
// failed" lines — both the alert list and the report's Connection Status block share this
// grouping via deriveServiceStatus().

// "activeSubscribers" is deliberately excluded here — it's derived from "segments", not an
// independent network call, so a "segments" failure already covers it. "newSubscribersTotal"/
// "newPrelaunch" are likewise derived from "subscribersInWindow", listed below instead.
const CRITICAL_KEYS_BY_SERVICE = {
  beehiiv: ["segments", "subscribersInWindow"],
  airtable: ["flightAppsWindow", "contactWindow"],
};

/** @returns {{beehiiv: 'ok'|'error', airtable: 'ok'|'error', stripe: 'not_connected', calendly: 'not_connected', ga4: 'not_connected'}} */
export function deriveServiceStatus(ctx) {
  const status = {};
  for (const [service, keys] of Object.entries(CRITICAL_KEYS_BY_SERVICE)) {
    const anyError = keys.some((key) => ctx.results[key]?.status === "error");
    status[service] = anyError ? "error" : "ok";
  }
  status.stripe = "not_connected";
  status.calendly = "not_connected";
  status.ga4 = "not_connected";
  return status;
}

/**
 * Technical health of the Worker itself — separate from the business Alerts below. A "zero
 * applications today" alert doesn't mean the Worker is unhealthy; a Beehiiv/Airtable request
 * actually failing does. Only Stripe/Calendly/GA4 being unconfigured never counts against
 * health — that's an expected, permanent state right now, not a fault.
 * @returns {{status: 'healthy'|'degraded', label: string}}
 */
export function deriveOverallHealth(serviceStatus) {
  const hasError = serviceStatus.beehiiv === "error" || serviceStatus.airtable === "error";
  return hasError
    ? { status: "degraded", label: "⚠️ Degraded — see Connection Status below" }
    : { status: "healthy", label: "✅ Healthy" };
}

function trailingAverage(trailingDaily, picker) {
  if (!trailingDaily.length) return null;
  const sum = trailingDaily.reduce((acc, snap) => acc + (picker(snap) ?? 0), 0);
  return sum / trailingDaily.length;
}

/** Always returns [] while Stripe stays a stub — kept as a named function so wiring real
 * Stripe data later only means filling this body in, not changing the alerts.js call site. */
function checkRevenueDrop() {
  return [];
}

/** @returns {string[]} */
export function detectAlerts(ctx) {
  const alerts = [];
  const serviceStatus = deriveServiceStatus(ctx);

  if (ctx.type === "daily" && ctx.results.flightAppsWindow.status === "ok" && ctx.results.flightAppsWindow.data === 0) {
    alerts.push("🚨 No flight applications received that day");
  }

  if (ctx.type === "daily" && ctx.results.newSubscribersTotal.status === "ok" && ctx.results.newSubscribersTotal.data === 0) {
    const avg = trailingAverage(ctx.trailingDaily, (snap) => snap.beehiiv?.newSubscribersInWindow);
    if (avg !== null && avg > 0) {
      alerts.push(`🚨 Newsletter subscriber growth is unusually low (0 that day vs a 7-day average of ${avg.toFixed(1)})`);
    }
  }

  if (serviceStatus.beehiiv === "error") alerts.push("🚨 Beehiiv API failed");
  if (serviceStatus.airtable === "error") alerts.push("🚨 Airtable request failed");

  alerts.push(...checkRevenueDrop());

  return alerts;
}
