/* Altitude Overview page -- compact live-data previews for the Award
   Alerts and KrisFlyer Escapes intelligence cards (real records, not
   decorative placeholders). Fetches the same two endpoints the detail
   pages use and renders a couple of rows each, formatted with the shared
   helpers from js/altitude-content-core.js where available. Scoped to
   [data-overview-preview]; no-ops on every other page. */
(function () {
  var containers = document.querySelectorAll('[data-overview-preview]');
  if (!containers.length) return;

  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var ENDPOINTS = {
    'award-alerts': '/altitude/content/award-alerts',
    'krisflyer-escapes': '/altitude/content/krisflyer-escapes',
  };
  var EMPTY_COPY = {
    'award-alerts': 'No award alerts are live right now.',
    'krisflyer-escapes': 'This month’s KrisFlyer Escapes are being finalized.',
  };
  var loaded = false;

  if (document.body.classList.contains('private-auth-ready')) {
    setTimeout(load, 0);
  }
  window.addEventListener('skyfare:altitude-member', load);

  function load() {
    if (loaded) return;
    var token = getToken();
    if (!token) return;
    loaded = true;

    containers.forEach(function (root) {
      var type = root.getAttribute('data-overview-preview');
      var endpoint = ENDPOINTS[type];
      if (!endpoint) return;

      fetch(WORKER + endpoint, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          var records = res.ok && Array.isArray(res.data.records) ? res.data.records : [];
          if (!records.length) { renderEmpty(root, type); return; }
          if (type === 'award-alerts') renderAlerts(root, records);
          else renderEscapes(root, records);
        })
        .catch(function () { renderEmpty(root, type); });
    });
  }

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || ''; } catch (_) { return ''; }
  }

  // js/altitude-content-core.js loads just before this file and exposes
  // its formatting helpers regardless of whether a [data-altitude-content-root]
  // exists on the page. Falls back to a minimal local set if it's ever
  // missing so this preview still degrades to plain text instead of breaking.
  function utils() {
    return (window.AltitudeContent && window.AltitudeContent.utils) || FALLBACK_UTILS;
  }

  var FALLBACK_UTILS = {
    e: function (v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; },
    formatDate: function (v) { return v ? String(v) : ''; },
    dateValue: function (v) { var d = new Date(v || 0); return isNaN(d.getTime()) ? 0 : d.getTime(); },
    cabinLabel: function (c) { return c ? '<span class="alt-cabin">' + FALLBACK_UTILS.e(c) + '</span>' : ''; },
  };

  function renderEmpty(root, type) {
    root.innerHTML = '<p class="altitude-intel-preview__empty">' + (EMPTY_COPY[type] || 'Nothing to show yet.') + '</p>';
  }

  function renderAlerts(root, records) {
    var u = utils();
    // Sorts by Airtable's own record-creation timestamp, not Found At/
    // Publish Date -- both are hand-typed free text in this table (e.g.
    // "Week of 14 August 2026 (live app pulls)", "2026-08-26 4:36 PM SGT")
    // and never parse as real dates, so this had no actual "latest" signal
    // to sort by. Same fix as js/altitude-content-award-alerts.js -- this
    // file has its own independent copy of the sort since it renders a
    // separate compact preview, not the full list.
    var top = records.slice().sort(function (a, b) {
      return u.dateValue(b.createdTime) - u.dateValue(a.createdTime);
    }).slice(0, 3);

    root.innerHTML = top.map(function (item) {
      var route = [item.origin, item.destination].filter(Boolean).join(' – ') || item.airline || 'Route';
      var meta = [
        item.cabinClass ? u.cabinLabel(item.cabinClass) : '',
        item.milesRequired ? u.e(item.milesRequired) + ' mi' : '',
      ].filter(Boolean).join(' · ');
      var when = item.foundAt || item.publishDate;

      return '<div class="altitude-intel-preview__row">' +
        '<div class="altitude-intel-preview__row-top">' +
          '<strong class="alt-route">' + u.e(route) + '</strong>' +
          (when ? '<span class="alt-date">' + u.e(u.formatDate(when)) + '</span>' : '') +
        '</div>' +
        (meta ? '<span class="alt-meta">' + meta + '</span>' : '') +
      '</div>';
    }).join('');
  }

  function renderEscapes(root, records) {
    var u = utils();
    var featured = records.find(function (r) { return r.featured; }) || records[0];
    var picks = Array.isArray(featured.routeRows) ? featured.routeRows : [];
    var pick = picks[0];

    root.innerHTML =
      (featured.thumbnail
        ? '<div class="altitude-intel-preview__media"><img src="' + u.e(featured.thumbnail) + '" alt="" loading="lazy"></div>'
        : '') +
      (featured.dropMonth ? '<p class="alt-label">' + u.e(featured.dropMonth) + '</p>' : '') +
      (featured.title ? '<p class="alt-card-title altitude-intel-preview__title">' + u.e(featured.title) + '</p>' : '') +
      (pick
        ? '<div class="altitude-intel-preview__row">' +
            (pick.verdict ? '<span class="alt-pick-card__verdict alt-pick-card__verdict--' + verdictTone(pick.verdict) + '">' + u.e(pick.verdict) + '</span>' : '') +
            '<strong class="alt-route">' + u.e(pick.route || 'Route') + '</strong>' +
          '</div>'
        : (featured.summaryVerdict ? '<p class="alt-support">' + u.e(featured.summaryVerdict) + '</p>' : ''));
  }

  function verdictTone(verdict) {
    var v = String(verdict || '').toLowerCase();
    if (/book/.test(v)) return 'book';
    if (/consider|watch/.test(v)) return 'watch';
    return 'skip';
  }
})();
