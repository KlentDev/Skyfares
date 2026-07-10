// report/dailyReport.js
import { renderValue } from "../slack/formatMrkdwn.js";
import { headerBlock, contextBlock, sectionBlock, dividerBlock, tableBlock } from "../slack/blockKit.js";
import { buildSystemHealthBlocks } from "./systemHealth.js";
import { buildConclusion } from "./conclusion.js";
import { formatManilaDateNoWeekday, getManilaWeekdayUpper, formatManilaDateLong, formatManilaTimeShort } from "../utils/dates.js";

/** @param {import('./reportRunner.js').ReportContext} ctx */
export function build(ctx) {
  const r = ctx.results;
  const premiumPurchases = String(ctx.newPremiumInWindow);

  // window.start/end are the reported day's boundaries (a full Manila calendar day), NOT the
  // send time — the report for Monday is sent Tuesday 12:05 AM, so the title must reflect
  // Monday, not the actual send instant. ctx.runDate is the send instant, used only for the
  // "Sent:" line below.
  const weekday = getManilaWeekdayUpper(ctx.window.start);
  const reportDate = formatManilaDateNoWeekday(ctx.window.start);
  const nextDate = formatManilaDateNoWeekday(ctx.window.end);

  const blocks = [
    headerBlock(`📊 DAILY REPORT ${weekday}: ${reportDate}`),
    contextBlock(`From ${reportDate} 12:00 AM to ${nextDate} 12:00 AM (UTC+8)`),
    contextBlock(`Sent ${formatManilaDateLong(ctx.runDate)} · ${formatManilaTimeShort(ctx.runDate)} (UTC+8)`),
    dividerBlock(),

    sectionBlock("*Summary*"),
    tableBlock(
      ["Metric", "Value"],
      [
        ["✈️ Flight Applications", renderValue(r.flightAppsWindow)],
        ["✉️ Contact Inquiries", renderValue(r.contactWindow)],
        ["📅 Strategy Calls Booked", "Not Connected Yet"],
        ["📧 New Newsletter Subscribers", renderValue(r.newSubscribersTotal)],
        ["⭐ Early Access Signups", renderValue(r.newPrelaunch)],
        ["💳 Premium Purchases", premiumPurchases],
        ["💰 Revenue", "Not Connected Yet"],
      ]
    ),
    dividerBlock(),

    sectionBlock("*Overall (All-Time)*"),
    tableBlock(
      ["Metric", "Value"],
      [
        ["✈️ Flight Applications", renderValue(r.flightAppsAllTime)],
        ["✉️ Contact Inquiries", renderValue(r.contactAllTime)],
        ["📧 Subscribers", renderValue(r.activeSubscribers)],
      ]
    ),
    dividerBlock(),

    ...buildSystemHealthBlocks(ctx),
    dividerBlock(),

    sectionBlock(`*Alerts*\n${ctx.alerts.length ? ctx.alerts.join("\n") : "None"}`),
    dividerBlock(),

    sectionBlock(`*Conclusion*\n${buildConclusion(ctx)}`),
  ];

  const fallbackText = `DAILY REPORT ${weekday}: ${reportDate}`;
  return { blocks, fallbackText };
}
