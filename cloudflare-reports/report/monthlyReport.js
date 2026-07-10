// report/monthlyReport.js
import { renderValue, deltaLine } from "../slack/formatMrkdwn.js";
import { headerBlock, contextBlock, sectionBlock, dividerBlock, tableBlock } from "../slack/blockKit.js";
import { buildSystemHealthBlocks } from "./systemHealth.js";
import { buildConclusion } from "./conclusion.js";
import { formatManilaMonthLabel } from "../utils/dates.js";

/** @param {import('./reportRunner.js').ReportContext} ctx */
export function build(ctx) {
  const r = ctx.results;
  const prev = ctx.previousSnapshot; // null on first-ever run — deltaLine() omits itself when previous is null/undefined
  const premiumPurchases = String(ctx.newPremiumInWindow);
  const monthLabel = formatManilaMonthLabel(ctx.monthYm);

  const blocks = [
    headerBlock("📊 Skyfare Consulting — Monthly Business Summary"),
    contextBlock(monthLabel),
    dividerBlock(),

    sectionBlock("*Summary*"),
    tableBlock(
      ["Metric", "Value"],
      [
        ["✈️ Flight Applications", `${renderValue(r.flightAppsWindow)}${deltaLine(r.flightAppsWindow.data, prev?.airtable?.flightApplicationsInWindow, "last month")}`],
        ["✉️ Contact Inquiries", `${renderValue(r.contactWindow)}${deltaLine(r.contactWindow.data, prev?.airtable?.contactInquiriesInWindow, "last month")}`],
        ["📧 Subscribers", `${renderValue(r.activeSubscribers)}${deltaLine(r.activeSubscribers.data, prev?.beehiiv?.activeSubscribers, "last month")}`],
        ["⭐ Early Access Signups", renderValue(r.newPrelaunch)],
        ["💳 Premium Purchases", premiumPurchases],
        ["💰 Revenue", "Not Connected Yet"],
        ["📅 Strategy Calls", "Not Connected Yet"],
      ]
    ),
    dividerBlock(),

    sectionBlock("*Growth Rate*"),
    tableBlock(
      ["Metric", "Value"],
      [["📈 New Subscribers", `${renderValue(r.newSubscribersTotal)}${deltaLine(r.newSubscribersTotal.data, prev?.beehiiv?.newSubscribersInWindow, "last month")}`]]
    ),
    dividerBlock(),

    ...buildSystemHealthBlocks(ctx),
    dividerBlock(),

    sectionBlock(`*Alerts*\n${ctx.alerts.length ? ctx.alerts.join("\n") : "None"}`),
    dividerBlock(),

    sectionBlock(`*Conclusion*\n${buildConclusion(ctx)}`),
  ];

  const fallbackText = `Skyfare Consulting — Monthly Business Summary (${monthLabel})`;
  return { blocks, fallbackText };
}
