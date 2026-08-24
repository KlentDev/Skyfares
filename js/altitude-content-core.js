/* Altitude private-content bootstrap: auth-gated fetch + dispatch to a
   per-type render module (js/altitude-content-{type}.js), each of which
   registers into window.AltitudeContent.renderers. Replaces the former
   monolithic js/altitude-content.js -- see docs/superpowers/specs plan
   "Altitude Private Pages — Editorial Redesign" for why this was split. */
(function () {
  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var loaded = false;

  var ENDPOINTS = {
    'award-alerts': '/altitude/content/award-alerts',
    'krisflyer-escapes': '/altitude/content/krisflyer-escapes',
  };

  // Zero-backend-terminology copy shown while content loads, keyed by
  // data-altitude-content-root value. Keep these in sync with the static
  // placeholder markup in each HTML shell (see the HTML comment there).
  var LOADING_COPY = {
    'award-alerts': 'Preparing the latest award opportunities for you…',
    'krisflyer-escapes': 'Curating this month’s KrisFlyer Escapes…',
  };

  var EMPTY_COPY = {
    'award-alerts': 'No award alerts are live right now. New opportunities are added the moment they’re found.',
    'krisflyer-escapes': 'This month’s KrisFlyer Escapes are being finalized. Check back shortly.',
  };

  var app = window.AltitudeContent = window.AltitudeContent || {};
  app.renderers = app.renderers || {};
  app.state = app.state || {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var root = getRoot();
    if (!root) return;
    window.addEventListener('skyfare:altitude-member', loadContent);
    if (document.body.classList.contains('private-auth-ready')) {
      setTimeout(loadContent, 0);
    }
  }

  function loadContent() {
    if (loaded) return;
    var root = getRoot();
    if (!root) return;

    var type = root.getAttribute('data-altitude-content-root') || '';
    var endpoint = ENDPOINTS[type];
    var token = getToken();
    if (!endpoint || !token) return;

    loaded = true;
    renderLoading(root, type);

    fetch(WORKER + endpoint, {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          renderError(root, type, res.data && res.data.error ? res.data.error : 'Could not load content.');
          return;
        }
        var records = Array.isArray(res.data.records) ? res.data.records : [];
        if (!records.length) {
          renderEmpty(root, type);
          return;
        }
        renderByType(root, type, records);
      })
      .catch(function () {
        renderError(root, type, 'Network error. Please try again.');
      });
  }

  function renderByType(root, type, records) {
    var renderer = app.renderers[type];
    if (typeof renderer !== 'function') {
      renderError(root, type, 'This page is still being set up.');
      return;
    }
    renderer(root, records);
  }

  // ── Skeleton loading ──────────────────────────────────────────────────

  function skeletonFor(type) {
    var copy = LOADING_COPY[type] || 'Preparing your content…';
    var body = SKELETON_SHAPES[type] ? SKELETON_SHAPES[type]() : SKELETON_SHAPES['default']();
    return '<div class="alt-skeleton" role="status" aria-live="polite">' +
      body +
      '<p class="alt-skeleton__copy">' + e(copy) + '</p>' +
    '</div>';
  }

  var SKELETON_SHAPES = {
    'award-alerts': function () {
      return '<div class="alt-skeleton-award-alerts">' +
        '<div class="alt-skeleton-award-alerts__list">' +
          Array(4).fill(0).map(function () {
            return '<div class="alt-skeleton-award-alerts__row">' +
              '<span class="alt-skeleton__badge"></span>' +
              '<span class="alt-skeleton__line alt-skeleton__line--medium"></span>' +
              '<span class="alt-skeleton__line alt-skeleton__line--short"></span>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="alt-skeleton-award-alerts__detail">' +
          '<span class="alt-skeleton__title"></span>' +
          '<span class="alt-skeleton__line alt-skeleton__line--medium"></span>' +
          '<div class="alt-skeleton-award-alerts__metrics">' +
            Array(6).fill(0).map(function () { return '<span class="alt-skeleton__block"></span>'; }).join('') +
          '</div>' +
          '<span class="alt-skeleton__line alt-skeleton__line--long"></span>' +
          '<span class="alt-skeleton__line alt-skeleton__line--long"></span>' +
        '</div>' +
      '</div>';
    },
    'krisflyer-escapes': function () {
      return '<div class="alt-skeleton-escapes">' +
        '<span class="alt-skeleton__block alt-skeleton-escapes__hero"></span>' +
        '<span class="alt-skeleton__title"></span>' +
        '<span class="alt-skeleton__line alt-skeleton__line--medium"></span>' +
        '<div class="alt-skeleton-escapes__grid">' +
          Array(3).fill(0).map(function () { return '<span class="alt-skeleton__block"></span>'; }).join('') +
        '</div>' +
      '</div>';
    },
    'default': function () {
      return '<span class="alt-skeleton__title"></span>' +
        '<span class="alt-skeleton__line alt-skeleton__line--long"></span>' +
        '<span class="alt-skeleton__line alt-skeleton__line--medium"></span>';
    },
  };

  function renderLoading(root, type) {
    root.innerHTML = skeletonFor(type);
  }

  function renderEmpty(root, type) {
    var copy = EMPTY_COPY[type] || 'Nothing to show here yet.';
    root.innerHTML =
      '<div class="alt-empty">' +
        '<span class="alt-empty__icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span>' +
        '<p class="alt-empty__copy">' + e(copy) + '</p>' +
      '</div>';
  }

  function renderError(root, type, message) {
    loaded = false;
    root.innerHTML =
      '<div class="alt-empty">' +
        '<span class="alt-empty__icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>' +
        '<p class="alt-empty__copy">Could not load this content. ' + e(message || 'Content is temporarily unavailable.') + '</p>' +
        '<button type="button" class="private-action private-action--primary" data-altitude-content-retry="' + e(type) + '">' +
          '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again' +
        '</button>' +
      '</div>';
    var retry = root.querySelector('[data-altitude-content-retry]');
    if (retry) retry.addEventListener('click', loadContent);
  }

  // ── Shared render helpers, exposed to per-type modules ────────────────

  function metric(label, value, extraClass) {
    if (value == null || value === '') return '';
    return '<div class="alt-metric' + (extraClass ? ' ' + extraClass : '') + '"><span class="alt-metric__label">' + e(label) + '</span><strong class="alt-metric__value">' + e(value) + '</strong></div>';
  }

  function note(title, value) {
    if (!value) return '';
    return '<article class="alt-note"><h3 class="alt-note__title">' + e(title) + '</h3><p class="alt-note__body">' + e(value) + '</p></article>';
  }

  // Singapore Airlines cabin branding, 4 distinct tiers: Economy green,
  // Premium Economy teal, Business light blue, First/Suites gold.
  // Order matters -- "premium economy" must be checked before the bare
  // "economy" test or it would fall into the Economy bucket.
  function cabinTone(cabinClass) {
    var value = String(cabinClass || '').toLowerCase();
    if (/first|suite/.test(value)) return 'first';
    if (/business/.test(value)) return 'business';
    if (/premium/.test(value)) return 'premium-economy';
    if (/economy/.test(value)) return 'economy';
    return '';
  }

  // Airport code -> country flag file, reused from the same table in
  // js/krisflyer.js (kept in sync manually -- no shared module system in
  // this codebase), plus SIN (every SQ route's hub) and BOM (appears in
  // Award Alerts data but was missing from the source table).
  var ROUTE_FLAGS = {
    SIN: 'singapore.png',
    BWN: 'cambodia.png', DPS: 'indonesia.png', CGK: 'indonesia.png', SUB: 'indonesia.png', KUL: 'malaysia.png', PEN: 'malaysia.png',
    BKK: 'thailand.png', CEB: 'philippines.png', DAD: 'vietnam.png',
    HAN: 'vietnam.png', SGN: 'vietnam.png', MNL: 'philippines.png', PNH: 'cambodia.png', REP: 'cambodia.png', HKT: 'thailand.png', RGN: 'myanmar.png',
    CTU: 'china.png', CKG: 'china.png', CAN: 'china.png', HGH: 'china.png', SZX: 'china.png', XMN: 'china.png', PKX: 'china.png',
    HKG: 'hong-kong.png', TPE: 'taiwan.png', PEK: 'china.png', PVG: 'china.png',
    AMD: 'india.png', BLR: 'india.png', MAA: 'india.png', COK: 'india.png', CMB: 'sri-lanka.png', DEL: 'india.png', DAC: 'bangladesh.png',
    HYD: 'india.png', KTM: 'nepal.png', CCU: 'india.png', MLE: 'maldives.png', BOM: 'india.png',
    PUS: 'south-korea.png', FUK: 'japan.png', KIX: 'japan.png', ICN: 'south-korea.png', NRT: 'japan.png', HND: 'japan.png',
    DRW: 'australia.png', PER: 'australia.png', ADL: 'australia.png', AKL: 'new-zealand.png', BNE: 'australia.png', CNS: 'australia.png', CHC: 'new-zealand.png',
    MEL: 'australia.png', SYD: 'australia.png',
    CPT: 'south-africa.png', DXB: 'united-arab-emirates.png', DOH: 'qatar.png', IST: 'turkey.png', JNB: 'south-africa.png',
    AMS: 'netherlands.png', BCN: 'spain.png', BRU: 'belgium.png', CPH: 'denmark.png', FRA: 'germany.png', LHR: 'united-kingdom.png', MAN: 'united-kingdom.png',
    MXP: 'italy.png', MUC: 'germany.png', CDG: 'france.png', FCO: 'italy.png', ZRH: 'switzerland.png',
    LAX: 'united-states.png', SFO: 'united-states.png', SEA: 'united-states.png', IAH: 'united-states.png', JFK: 'united-states.png',
  };

  // Handles both "City (CODE)" (Award Alerts convention, e.g. "New York
  // (JFK)") and "CODE (Descriptive name)" (route-grid convention, e.g.
  // "PKX (Beijing Daxing)") -- tries the part before any parenthesis
  // first, falls back to the part inside it.
  function extractIataCode(value) {
    var str = String(value || '').trim();
    var paren = /\(([^)]+)\)/.exec(str);
    var before = (paren ? str.slice(0, paren.index) : str).replace(/[^A-Za-z]/g, '').toUpperCase();
    if (before.length === 3) return before;
    if (paren) {
      var inside = paren[1].replace(/[^A-Za-z]/g, '').toUpperCase();
      if (inside.length === 3) return inside;
    }
    return before;
  }

  function flagFor(value) {
    var file = ROUTE_FLAGS[extractIataCode(value)];
    if (!file) return '';
    return '<img src="../../../logos/flags/' + file + '" alt="" class="alt-flag" loading="lazy">';
  }

  // Splits a multi-segment route string ("SIN - FRA - JFK", "SIN-DPS",
  // "LAX-HND (Tokyo)") into its waypoints and prefixes each with its
  // flag. Falls back to plain escaped text if there's nothing to split.
  function routeStringWithFlags(value) {
    var str = String(value || '');
    if (!str) return '';
    var parts = str.split(/\s*(?:->|→|>|-|–|—)\s*/).filter(Boolean);
    if (parts.length < 2) return flagFor(str) + e(str);
    return parts.map(function (part) {
      return flagFor(part) + e(part.trim());
    }).join(' – ');
  }

  function cabinLabel(cabinClass) {
    if (!cabinClass) return '';
    var tone = cabinTone(cabinClass);
    return '<span class="alt-cabin' + (tone ? ' alt-cabin--' + tone : '') + '">' + e(cabinClass) + '</span>';
  }

  function badge(label, tone) {
    var cls = 'alt-badge' + (tone ? ' alt-badge--' + tone : '');
    return '<span class="' + cls + '">' + e(label) + '</span>';
  }

  function formatScore(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1).replace(/\.0$/, '') : '';
  }

  function dateRange(start, end) {
    return [formatDate(start), formatDate(end)].filter(Boolean).join(' – ');
  }

  function dateValue(value) {
    var d = new Date(value || 0);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return String(value || '');
    }
  }

  function formatDateTime(value) {
    if (!value) return '';
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return String(value || '');
    }
  }

  function getRoot() {
    return document.querySelector('[data-altitude-content-root]');
  }

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || ''; } catch (_) { return ''; }
  }

  function e(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  app.utils = {
    e: e,
    metric: metric,
    note: note,
    badge: badge,
    cabinTone: cabinTone,
    cabinLabel: cabinLabel,
    flagFor: flagFor,
    routeStringWithFlags: routeStringWithFlags,
    formatScore: formatScore,
    dateRange: dateRange,
    dateValue: dateValue,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
  };
})();
