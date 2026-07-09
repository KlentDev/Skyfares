// report/conclusion.js
// One short, honest sentence summarizing the run — grounded in the same numbers already in
// the report, not an invented "insight." Health and Alerts take priority over the business
// summary since a system problem matters more than a quiet metrics day.
import { deriveOverallHealth, deriveServiceStatus } from "./alerts.js";

function plural(n, singular, pluralForm = `${singular}s`) {
  return n === 1 ? singular : pluralForm;
}

function dailySummary(ctx) {
  const r = ctx.results;
  const apps = r.flightAppsWindow.status === "ok" ? r.flightAppsWindow.data : null;
  const contacts = r.contactWindow.status === "ok" ? r.contactWindow.data : null;
  const subs = r.newSubscribersTotal.status === "ok" ? r.newSubscribersTotal.data : null;

  if (apps === null || contacts === null || subs === null) {
    return "Some numbers above are unavailable due to an API failure — see Alerts.";
  }
  const quietLeads = apps === 0 && contacts === 0;
  if (quietLeads && subs > 0) {
    return `Quiet day for leads, but the newsletter kept growing with ${subs} new ${plural(subs, "subscriber")}.`;
  }
  if (quietLeads) {
    return "Quiet day overall — no new leads or subscribers.";
  }
  return `Steady day — ${apps} flight ${plural(apps, "application")} and ${contacts} contact ${plural(contacts, "inquiry", "inquiries")} came in.`;
}

function periodSummary(ctx, periodLabel) {
  const r = ctx.results;
  const apps = r.flightAppsWindow.status === "ok" ? r.flightAppsWindow.data : null;
  const contacts = r.contactWindow.status === "ok" ? r.contactWindow.data : null;
  const subs = r.newSubscribersTotal.status === "ok" ? r.newSubscribersTotal.data : null;

  if (apps === null || contacts === null || subs === null) {
    return "Some numbers above are unavailable due to an API failure — see Alerts.";
  }
  if (apps === 0 && contacts === 0 && subs === 0) {
    return `Slow ${periodLabel} — no new leads or subscribers.`;
  }
  return `${apps} flight ${plural(apps, "application")}, ${contacts} contact ${plural(contacts, "inquiry", "inquiries")}, and ${subs} new ${plural(subs, "subscriber")} this ${periodLabel}.`;
}

/** @param {import('./reportRunner.js').ReportContext} ctx */
export function buildConclusion(ctx) {
  const serviceStatus = deriveServiceStatus(ctx);
  const health = deriveOverallHealth(serviceStatus);

  if (health.status === "degraded") {
    return "Some systems need attention — check System Health above before trusting these numbers.";
  }
  if (ctx.alerts.length) {
    return `${ctx.alerts.length} ${plural(ctx.alerts.length, "alert")} flagged above — worth a quick look.`;
  }
  if (ctx.type === "daily") return dailySummary(ctx);
  if (ctx.type === "weekly") return periodSummary(ctx, "week");
  return periodSummary(ctx, "month");
}
