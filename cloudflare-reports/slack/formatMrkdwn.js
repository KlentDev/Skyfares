// slack/formatMrkdwn.js
// Plain value-formatting helpers used as table cell values (see slack/blockKit.js for the
// structural Block Kit builders — headers, sections, tables).

/** "↑ +2 vs last week: 4 → 6" / "↓ -1 vs last month: 4 → 3" / "" if no prior value. */
export function deltaLine(current, previous, label) {
  if (previous === null || previous === undefined) return "";
  const delta = current - previous;
  if (delta === 0) return ` (flat vs ${label}: ${previous} → ${current})`;
  const arrow = delta > 0 ? "↑" : "↓";
  const sign = delta > 0 ? "+" : "";
  return ` (${arrow} ${sign}${delta} vs ${label}: ${previous} → ${current})`;
}

/** Status text for a table cell — no name prefix, since the name is the row's own label cell. */
export function statusValue(result) {
  if (result.status === "ok") return "✅ Connected";
  if (result.status === "not_connected") return "⚪ Not Connected Yet";
  return "❌ API Failed";
}

/** Renders a fetched numeric metric, or "—" if that call's status was 'error'. */
export function renderValue(result) {
  return result.status === "ok" ? String(result.data) : "—";
}
