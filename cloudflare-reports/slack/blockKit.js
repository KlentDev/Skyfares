// slack/blockKit.js
// Block Kit builders for chat.postMessage. Switched to this from a Slack Workflow Builder
// webhook specifically to get real table rendering — Slack's "table" block (GA'd 2026-05-20)
// only works in blocks sent via the Bot API, not through a Workflow's plain-text variable
// substitution. See slack/slackClient.js for the delivery side and cloudflare-reports/README.md
// for the Slack App / Bot Token setup this now requires.
//
// Table block schema (confirmed against Slack's own reference docs, docs.slack.dev):
//   { type: "table", rows: [[cell, cell, ...], ...] }
//   cell = { type: "raw_text", text: "..." } — up to 20 cells/row, 100 rows, 10,000 chars/table.
// Every value in these reports is rendered as raw_text (including numbers as their string
// form) rather than mixing in raw_number/rich_text cells — keeps cell-building uniform and
// avoids type-checking every metric, at no visible cost since raw_text renders numeric
// strings identically to raw_number in practice.

export function headerBlock(text) {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}

export function contextBlock(text) {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

export function sectionBlock(mrkdwnText) {
  return { type: "section", text: { type: "mrkdwn", text: mrkdwnText } };
}

export function dividerBlock() {
  return { type: "divider" };
}

function cell(value) {
  return { type: "raw_text", text: String(value) };
}

/** @param {[string, string][]} pairs - [label, value] rows; the first pair becomes the header row. */
export function tableBlock(headerPair, dataPairs) {
  return {
    type: "table",
    rows: [headerPair, ...dataPairs].map(([a, b]) => [cell(a), cell(b)]),
  };
}

/** Section header + its table, as a ready-to-spread block group. */
export function labeledTable(title, headerPair, dataPairs) {
  return [sectionBlock(`*${title}*`), tableBlock(headerPair, dataPairs)];
}
