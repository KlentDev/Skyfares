/**
 * Skyfare Altitude — per-member "unread" tracking for Award Alerts,
 * KrisFlyer Escapes, and the premium newsletter archive, exposing
 * window.AltitudeReadTracker. localStorage-only (matches every other
 * client-side preference in this codebase, e.g. js/private-layout.js's
 * SkyfareAccessCache) -- no server-side sync across devices.
 *
 * Also self-wires the subnav "has unread" dot (.altitude-subnav
 * [data-altitude-nav]) on every Altitude page, reading only the cached
 * per-section counts below -- it never fetches content itself. Those
 * counts are written by whichever renderer actually calls
 * seedIfFirstVisit()/markRead() (js/altitude-content-award-alerts.js,
 * js/altitude-content-krisflyer-escapes.js, js/altitude-portal.js's
 * newsletter archive), so the nav dot only refreshes when a page that
 * fetches that content type is visited -- same "no extra API calls"
 * principle as the rest of the private portal.
 *
 * Follows the same singleton-injection idiom as js/chatbot-launcher.js.
 */
(function () {
  if (window.AltitudeReadTracker) return;

  var SEEN_PREFIX = 'altitude_read:';
  var COUNT_PREFIX = 'altitude_unread_count:';

  function readSeenSet(section) {
    try {
      var raw = localStorage.getItem(SEEN_PREFIX + section);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function writeSeenSet(section, ids) {
    try { localStorage.setItem(SEEN_PREFIX + section, JSON.stringify(ids)); } catch (_) {}
  }

  function writeCount(section, count) {
    try { localStorage.setItem(COUNT_PREFIX + section, String(count)); } catch (_) {}
    renderNavDots();
  }

  function readCount(section) {
    try { return parseInt(localStorage.getItem(COUNT_PREFIX + section) || '0', 10) || 0; } catch (_) { return 0; }
  }

  /**
   * Call once per page load with every currently-live ID for a section,
   * right after fetching its records. On a browser that has never tracked
   * this section before, silently marks everything as seen (no dot flood
   * on first-ever visit) and returns without flagging anything unread.
   * Every later call is a normal no-op passthrough -- use isUnread()/
   * refreshCount() as usual after this.
   */
  function seedIfFirstVisit(section, allIds) {
    var hasHistory = false;
    try { hasHistory = localStorage.getItem(SEEN_PREFIX + section) !== null; } catch (_) {}
    if (hasHistory) return;
    writeSeenSet(section, (allIds || []).slice());
  }

  function isUnread(section, id) {
    if (!id) return false;
    return readSeenSet(section).indexOf(id) === -1;
  }

  function markRead(section, id) {
    if (!id) return;
    var seen = readSeenSet(section);
    if (seen.indexOf(id) !== -1) return;
    seen.push(id);
    writeSeenSet(section, seen);
  }

  /** Recomputes and caches the unread count for a section against its
   * current full ID list -- call after seedIfFirstVisit() once records
   * are loaded, so the nav dot reflects this page's fresh data. */
  function refreshCount(section, allIds) {
    var seen = readSeenSet(section);
    var count = (allIds || []).reduce(function (n, id) {
      return n + (seen.indexOf(id) === -1 ? 1 : 0);
    }, 0);
    writeCount(section, count);
  }

  function renderNavDots() {
    document.querySelectorAll('.altitude-subnav [data-altitude-nav]').forEach(function (link) {
      var section = link.getAttribute('data-altitude-nav');
      if (section === 'overview') return; // no content feed of its own
      link.classList.toggle('has-unread', readCount(section) > 0);
    });
  }

  window.AltitudeReadTracker = {
    seedIfFirstVisit: seedIfFirstVisit,
    isUnread: isUnread,
    markRead: markRead,
    refreshCount: refreshCount,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavDots);
  } else {
    renderNavDots();
  }
})();
