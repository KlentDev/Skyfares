// services/guideChapters.js — the only file that talks to the "Guide Chapters"
// Airtable table. Feeds both the PDF pipeline (via services/guideContent.js)
// and the on-site chapter reader (via orchestration/guideChaptersHandler.js).
//
// Airtable's rich-text long-text field (the team writes with Airtable's own
// bold/italic/heading/list toolbar) is returned by the API as markdown-syntax
// text, not HTML or a structured doc — the "rich text" toggle only changes
// Airtable's own editing UI, not the wire format. `marked` converts that
// markdown into real HTML for both the PDF template and the website modal.
import { marked } from 'marked';
import { escapeHtml } from '../utils/html.js';

// Wraps any inline chapter image that has alt text in a <figure>/<figcaption>
// pair instead of marked's default bare <img> — the alt text becomes a
// visible caption. Images with no alt text render as a plain <img>, same as
// before. contentHtml is shared between the PDF template and the on-site
// reader, so both surfaces get this for free from a chapter author's own
// markdown (`![caption](url)`) with zero Airtable schema change.
const chapterRenderer = new marked.Renderer();
chapterRenderer.image = function ({ href, title, text }) {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  if (!text) {
    return `<img src="${href}" alt=""${titleAttr}>`;
  }
  return `<figure><img src="${href}" alt="${escapeHtml(text)}"${titleAttr}><figcaption>${escapeHtml(text)}</figcaption></figure>`;
};

/**
 * @param {object} env
 * @returns {Promise<{ chapters: Array<{number: number, title: string, contentHtml: string, coverImageUrl: string}>, contentUpdatedAt: string|null }>}
 */
export async function getPublishedChapters(env) {
  const params = new URLSearchParams({
    filterByFormula: '{Status}="Published"',
    'sort[0][field]': 'Chapter Number',
    'sort[0][direction]': 'asc',
    pageSize: '100', // 7 chapters today; comfortably covers this guide even if it grows
  });
  ['Title', 'Chapter Number', 'Content', 'Cover Image URL', 'Last Modified'].forEach(f => params.append('fields[]', f));

  const res = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_GUIDE_CHAPTERS}?${params.toString()}`,
    { headers: { 'Authorization': `Bearer ${env.AIRTABLE_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const raw = await res.json();
  const records = raw.records || [];

  const chapters = records.map(rec => ({
    number: rec.fields['Chapter Number'] || 0,
    title: rec.fields['Title'] || '',
    contentHtml: marked.parse(rec.fields['Content'] || '', { renderer: chapterRenderer }),
    coverImageUrl: rec.fields['Cover Image URL'] || '',
  }));

  // Max "Last Modified" across the returned chapters — display-only (see the
  // password-derivation note in services/pdfPassword.js for why this never
  // feeds the password). null if there are no published chapters yet.
  const modifiedDates = records
    .map(rec => rec.fields['Last Modified'])
    .filter(Boolean)
    .map(d => new Date(d).getTime());
  const contentUpdatedAt = modifiedDates.length
    ? new Date(Math.max(...modifiedDates)).toISOString()
    : null;

  return { chapters, contentUpdatedAt };
}
