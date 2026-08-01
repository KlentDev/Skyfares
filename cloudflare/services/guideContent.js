// services/guideContent.js — assembles the PDF body. Talks only to
// services/guideChapters.js (the actual Airtable fetch lives there) —
// nothing else in the PDF pipeline (entitlement check, password derivation,
// encryption, delivery, audit log) reads or depends on this module's
// internals, only its `{ html, version }` return shape.
import { getPublishedChapters } from './guideChapters.js';

// Real, non-placeholder content that's already live on the site (the
// redemption-conditions table on kf-guide-access-portal.html) — kept as a
// fixed front section ahead of whatever chapters exist, rather than
// something to replace once chapters ship.
const REDEMPTION_TABLE_HTML = `
    <h2>Award rules by redemption type</h2>
    <p>Compare how each award behaves after booking, including baggage, stopovers,
    cancellations, and change fees.</p>
    <table style="width:100%; border-collapse: collapse; font-size: 9.5pt;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1pt solid #ccc; padding:4pt 6pt;">Redemption condition</th>
          <th style="text-align:left; border-bottom:1pt solid #ccc; padding:4pt 6pt;">Business Promo</th>
          <th style="text-align:left; border-bottom:1pt solid #ccc; padding:4pt 6pt;">Business Saver</th>
          <th style="text-align:left; border-bottom:1pt solid #ccc; padding:4pt 6pt;">Business Advantage</th>
          <th style="text-align:left; border-bottom:1pt solid #ccc; padding:4pt 6pt;">Business Access</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Checked Baggage</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">40kg</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">40kg</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">40kg</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">40kg</td>
        </tr>
        <tr>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Seat Selection</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Complimentary</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Complimentary</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Complimentary</td>
          <td style="padding:4pt 6pt; border-bottom:0.5pt solid #e5e5e5;">Complimentary</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:8.5pt; color:#8a8a8a; margin-top:10mm;">
      Redemption conditions shown reflect Singapore Airlines' published fare rules at
      time of writing and are subject to change without notice. Skyfare Consulting is
      an independent travel consultancy and is not affiliated with, endorsed by, or
      sponsored by Singapore Airlines Limited. KrisFlyer&reg; is a registered trademark
      of Singapore Airlines Limited.
    </p>
`;

function renderChapterSection(chapter) {
  const cover = chapter.coverImageUrl
    ? `<img src="${chapter.coverImageUrl}" alt="" style="width:100%; max-height:90mm; object-fit:cover; margin-bottom:6mm;">`
    : '';
  // Chapter Number 0 is the Introduction (see docs/superpowers/specs/2026-07-30-
  // guide-chapters-airtable-design.md) — it isn't "Chapter 0" to a reader, so
  // it gets its title alone instead of the "Chapter N — " prefix.
  const heading = chapter.number > 0
    ? `Chapter ${chapter.number} — ${chapter.title}`
    : chapter.title;
  return `
    <h2>${heading}</h2>
    ${cover}
    ${chapter.contentHtml}
  `;
}

/**
 * @param {string} guideId - accepted for a future second private guide reusing
 *   this same pipeline (see config/constants.js's GUIDE_ID) — unused today,
 *   only one guide exists.
 * @param {object} env
 * @returns {Promise<{ html: string, version: string|null }>}
 */
export async function getGuideContent(guideId, env) {
  const { chapters, contentUpdatedAt } = await getPublishedChapters(env);

  const chaptersHtml = chapters.length
    ? chapters.map(renderChapterSection).join('\n')
    : `
      <h2>Chapters</h2>
      <p>The full seven-chapter guide is still being finalised. This document will be
      reissued with chapter content as it's published &mdash; your access and this same
      password will continue to work on future versions.</p>
    `;

  return {
    html: REDEMPTION_TABLE_HTML + chaptersHtml,
    version: contentUpdatedAt,
  };
}
