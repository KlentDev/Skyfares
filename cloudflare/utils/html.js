// utils/html.js — the one place basic HTML-escaping lives. Extracted out of
// services/guidePdf.js (which had its own private copy) since
// services/guideChapters.js now needs the same primitive for figure/figcaption
// rendering — better one shared copy than two private ones drifting apart.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
