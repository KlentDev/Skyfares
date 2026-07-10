// report/weeklyReport.js
import { renderValue, deltaLine } from "../slack/formatMrkdwn.js";
import { headerBlock, contextBlock, sectionBlock, dividerBlock, tableBlock } from "../slack/blockKit.js";
import { buildSystemHealthBlocks } from "./systemHealth.js";
import { buildConclusion } from "./conclusion.js";
import { formatManilaDateRange, formatManilaDateLong, formatManilaTimeShort } from "../utils/dates.js";

/** @param {import('./reportRunner.js').ReportContext} ctx */
export function build(ctx) {
  const r = ctx.results;
  const prev = ctx.previousSnapshot; // null on first-ever run — deltaLine() omits itself when previous is null/undefined
  const premiumPurchases = String(ctx.newPremiumInWindow);
  // window.start/end are the completed Monday-Sunday week's boundaries, not the send time —
  // sent Monday 12:05 AM alongside that day's daily report, but titled by the week it covers.
  const rangeLabel = formatManilaDateRange(ctx.window.start, ctx.window.end);

  const blocks = [
    headerBlock(`📈 WEEKLY REPORT: ${rangeLabel}`),
    contextBlock(`Monday–Sunday, full week (UTC+8)`),
    contextBlock(`Sent ${formatManilaDateLong(ctx.runDate)} · ${formatManilaTimeShort(ctx.runDate)} (UTC+8)`),
    dividerBlock(),

    sectionBlock("*This Week*"),
    tableBlock(
      ["Metric", "Value"],
      [
        ["✈️ Flight Applications", `${renderValue(r.flightAppsWindow)}${deltaLine(r.flightAppsWindow.data, prev?.airtable?.flightApplicationsInWindow, "last week")}`],
        ["✉️ Contact Inquiries", `${renderValue(r.contactWindow)}${deltaLine(r.contactWindow.data, prev?.airtable?.contactInquiriesInWindow, "last week")}`],
        ["📧 Newsletter Subscribers", `${renderValue(r.activeSubscribers)}${deltaLine(r.activeSubscribers.data, prev?.beehiiv?.activeSubscribers, "last week")}`],
        ["⭐ Early Access Signups", renderValue(r.newPrelaunch)],
        ["💳 Premium Purchases", premiumPurchases],
        ["💰 Revenue", "Not Connected Yet"],
      ]
    ),
    dividerBlock(),

    sectionBlock("*Growth*"),
    tableBlock(
      ["Metric", "Value"],
      [["📈 New Subscribers", `${renderValue(r.newSubscribersTotal)}${deltaLine(r.newSubscribersTotal.data, prev?.beehiiv?.newSubscribersInWindow, "last week")}`]]
    ),
    dividerBlock(),

    ...buildSystemHealthBlocks(ctx),
    dividerBlock(),

    sectionBlock(`*Alerts*\n${ctx.alerts.length ? ctx.alerts.join("\n") : "None"}`),
    dividerBlock(),

    sectionBlock(`*Conclusion*\n${buildConclusion(ctx)}`),
  ];

  const fallbackText = `WEEKLY REPORT: ${rangeLabel}`;
  return { blocks, fallbackText };
}
