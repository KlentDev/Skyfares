# Newsletter Archive Search — Design

## Problem

Both newsletter archive pages (public `pages/newsletter.html` and private
`pages/private-pages/altitude-access/newsletter.html`) let visitors filter
issues by access level (All/Free/Premium) and topic, but there's no way to
find a specific issue by name. As the archive grows, browsing become
impractical.

## Scope

Add a live search input to the "All Issues" archive section on both pages,
placed in its own row above the existing access-pill + topic-dropdown
toolbar. No backend or API changes — search runs client-side over the
already-fetched post list, same as the existing filters.

## Behavior

- **Match fields:** post title, summary (subtitle/excerpt/description), and
  topic tags (`content_tags`) — case-insensitive substring match.
- **Live filtering:** debounced ~150ms on `input`, no submit button.
- **Combination:** AND-combined with the existing access filter and topic
  filter — e.g. Premium + Airlines + "upgrade" narrows all three together.
- **Clear button:** an inline (×) button appears once text is entered;
  clicking it clears the input and re-focuses it.
- **Empty state:** reuse each page's existing "no issues" empty state,
  extended to mention the active search term, e.g. `No issues match "foo".`
- **Private page pagination:** typing in the search resets
  `_altArchivePage` to 1, same as changing the access/topic filter does.

## Visual style

New CSS classes matching each page's existing pill aesthetic (not the
unrelated `.past-deals-*` search style used elsewhere on the site):

- Public page: `.archive-search` — white pill input, `#e7e9ee` border,
  `#0066cc` hover/focus border, magnifying-glass icon inset left, sized to
  match `.filter-select`.
- Private page: `.alt-archive-search` — same treatment using the
  `--private-*` custom properties that already drive `.alt-filter-select`.

## Data flow

**`js/newsletter-archive.js`**
- Add `_archiveSearch` state var (default `''`).
- Fold a search predicate into `_getFilteredArchivePosts()` alongside the
  existing access/topic checks.
- Wire a debounced `input` listener on the new search field, calling a new
  `_applySearchFilter(value)` that updates `_archiveSearch` and re-renders.

**`js/altitude-portal.js`**
- Add `_altArchiveSearch` state var (default `''`).
- Fold the same predicate into `_getFilteredPosts()`.
- Wire the same debounced `input` listener; on change, reset
  `_altArchivePage = 1` before re-rendering (mirrors `_applyTopicFilter`).

## Out of scope

- No server-side/API search — the archive is already fully fetched
  client-side.
- No search-term persistence in the URL (topic filter's `?tag=` query
  param stays as-is; search is not added to it).
- No fuzzy matching — plain substring match only.
