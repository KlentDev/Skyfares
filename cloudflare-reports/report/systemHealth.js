// report/systemHealth.js
// Shared "System Health" table used by all three report types — the CEO-facing at-a-glance
// answer to "is this thing actually working," separate from the business Alerts section.
import { tableBlock, sectionBlock } from "../slack/blockKit.js";
import { statusValue } from "../slack/formatMrkdwn.js";
import { deriveServiceStatus, deriveOverallHealth } from "./alerts.js";
import { formatManilaDateLong, formatManilaTimeShort, formatNextRunLabel } from "../utils/dates.js";

/** @param {import('./reportRunner.js').ReportContext} ctx */
export function buildSystemHealthBlocks(ctx) {
  const serviceStatus = deriveServiceStatus(ctx);
  const health = deriveOverallHealth(serviceStatus);
  const r = ctx.results;

  return [
    sectionBlock("*System Health*"),
    sectionBlock(
      `🕒 *Last Updated:* ${formatManilaDateLong(ctx.runDate)} · ${formatManilaTimeShort(ctx.runDate)} (UTC+8)\n` +
        `⏭️ *Next Report:* ${formatNextRunLabel(ctx.type, ctx.runDate)}`
    ),
    tableBlock(
      ["Check", "Status"],
      [
        ["Overall", health.label],
        ["Beehiiv", statusValue({ status: serviceStatus.beehiiv })],
        ["Airtable", statusValue({ status: serviceStatus.airtable })],
        ["Stripe", statusValue(r.stripe)],
        ["Calendly", statusValue(r.calendly)],
        ["GA4", statusValue(r.ga4)],
      ]
    ),
  ];
}
