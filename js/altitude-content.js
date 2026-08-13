(function () {
  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var loaded = false;

  var ENDPOINTS = {
    'award-alerts': '/altitude/content/award-alerts',
    'routing-strategies': '/altitude/content/routing-strategies',
    'krisflyer-escapes': '/altitude/content/krisflyer-escapes',
    'cabin-verdicts': '/altitude/content/cabin-verdicts',
  };

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
    renderLoading(root);

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
    if (type === 'award-alerts') return renderAwardAlerts(root, records);
    if (type === 'routing-strategies') return renderRoutingStrategies(root, records);
    if (type === 'krisflyer-escapes') return renderKrisFlyerEscapes(root, records);
    if (type === 'cabin-verdicts') return renderCabinVerdicts(root, records);
  }

  function renderAwardAlerts(root, records) {
    var activeIndex = 0;

    root.innerHTML =
      '<div class="altitude-tool-layout">' +
        '<aside class="private-panel altitude-tool-rail slide-up is-visible" aria-label="Published alert list">' +
          '<div class="altitude-tool-rail__head">' +
            '<strong>Published alerts</strong>' +
            '<span>Airtable CMS</span>' +
          '</div>' +
          records.map(function (item, index) {
            return '<button type="button" class="altitude-alert-item' + (index === activeIndex ? ' active' : '') + '" data-altitude-alert-index="' + index + '">' +
              '<span>' + e(routeLabel(item)) + '</span>' +
              '<strong>' + e(item.title) + '</strong>' +
              '<small>' + e(alertSummary(item)) + '</small>' +
            '</button>';
          }).join('') +
        '</aside>' +
        '<section id="alert-detail" class="private-panel altitude-tool-detail slide-up is-visible" aria-live="polite"></section>' +
      '</div>';

    var detail = root.querySelector('#alert-detail');
    renderAwardDetail(detail, records[activeIndex]);

    root.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-altitude-alert-index]');
      if (!button || !root.contains(button)) return;
      var index = parseInt(button.getAttribute('data-altitude-alert-index'), 10);
      if (!records[index]) return;
      root.querySelectorAll('.altitude-alert-item').forEach(function (item) {
        item.classList.toggle('active', item === button);
      });
      renderAwardDetail(detail, records[index]);
    });
  }

  function renderAwardDetail(detail, item) {
    if (!detail || !item) return;
    detail.innerHTML =
      '<div class="altitude-tool-detail__top">' +
        '<div>' +
          badge(item.urgency || 'Published', item.urgency && item.urgency.toLowerCase().indexOf('high') !== -1) +
          '<h2 id="alert-detail-title">' + e(item.title) + '</h2>' +
        '</div>' +
        '<span class="altitude-tool-time">' + e(item.foundAt ? 'Found ' + formatDateTime(item.foundAt) : formatDate(item.publishDate)) + '</span>' +
      '</div>' +
      '<div class="altitude-route-banner">' +
        '<span>' + e(item.origin || 'Origin') + '</span>' +
        '<i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i>' +
        '<span>' + e(item.destination || 'Destination') + '</span>' +
      '</div>' +
      '<div class="altitude-tool-metrics" aria-label="Award alert details">' +
        metric('Cabin', item.aircraft || item.cabinClass) +
        metric('Seats', item.seatsAvailable ? item.seatsAvailable + ' available' : '') +
        metric('Miles', item.milesRequired) +
        metric('Fees', item.taxesFees) +
      '</div>' +
      '<div class="altitude-note-stack">' +
        note('Availability notes', item.availabilityNotes || item.shortDescription) +
        note('Booking notes', item.bookingNotes) +
        note('Fallback strategy', item.fallbackStrategy) +
      '</div>';
  }

  function renderRoutingStrategies(root, records) {
    root.innerHTML = records.map(function (item) {
      var paths = item.pathOptions && item.pathOptions.length ? item.pathOptions : [{
        badge: 'Recommended',
        route: item.recommendedRoute,
        description: item.shortDescription,
        cabinScore: '',
        risk: '',
        miles: '',
        layover: '',
        selected: true,
      }, {
        badge: 'Backup',
        route: item.backupRoute,
        description: '',
        selected: false,
      }].filter(function (path) { return path.route; });

      return '<section class="altitude-cms-stack">' +
        '<section class="private-panel altitude-strategy-hero slide-up is-visible">' +
          '<div>' +
            badge(item.strategyVerdict || 'Recommended path', true) +
            '<h2>' + e(item.title) + '</h2>' +
            '<p>' + e(item.shortDescription) + '</p>' +
          '</div>' +
          '<div class="altitude-strategy-score">' +
            '<span>Strategy confidence</span>' +
            '<strong>' + e(formatScore(item.confidenceScore)) + '</strong>' +
            '<small>Airtable CMS score</small>' +
          '</div>' +
        '</section>' +
        '<section class="altitude-path-grid" aria-label="Routing path comparison">' +
          paths.map(function (path) {
            return '<article class="private-panel altitude-path-card' + (path.selected ? ' altitude-path-card--selected' : '') + ' slide-up is-visible">' +
              badge(path.badge || (path.selected ? 'Best value' : 'Backup'), !!path.selected) +
              '<h2>' + e(path.route || path.label || 'Route option') + '</h2>' +
              '<p>' + e(path.description || '') + '</p>' +
              '<div class="altitude-tool-metrics">' +
                metric('Cabin', path.cabinScore || path.cabin || '') +
                metric('Risk', path.risk || '') +
                metric('Miles', path.miles || '') +
                metric('Layover', path.layover || '') +
              '</div>' +
            '</article>';
          }).join('') +
        '</section>' +
        '<section class="private-panel altitude-note-stack altitude-note-stack--split slide-up is-visible">' +
          note('Why this route wins', item.whyThisWins) +
          note('When to switch', item.whenToSwitch) +
          note('Member action', item.memberAction) +
        '</section>' +
      '</section>';
    }).join('');
  }

  function renderKrisFlyerEscapes(root, records) {
    root.innerHTML = records.map(function (item) {
      var rows = Array.isArray(item.routeRows) ? item.routeRows : [];
      return '<section class="altitude-cms-stack">' +
        '<section class="private-panel altitude-escapes-summary slide-up is-visible">' +
          '<div>' +
            badge(item.dropMonth || 'Monthly drop', true) +
            '<h2>' + e(item.title) + '</h2>' +
            '<p>' + e(item.summaryVerdict || item.shortDescription) + '</p>' +
          '</div>' +
          '<div class="altitude-tool-metrics">' +
            metric('Routes', item.routesCount) +
            metric('Book fast', item.bookFastCount) +
            metric('Consider', item.considerCount) +
            metric('Skip', item.skipCount) +
          '</div>' +
        '</section>' +
        '<section class="private-panel altitude-escapes-table slide-up is-visible">' +
          '<div class="altitude-section-title altitude-section-title--split">' +
            '<div>' +
              '<h2>Route-by-route breakdown</h2>' +
              '<p>' + e([item.bookingWindow, item.travelWindow].filter(Boolean).join(' | ')) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="altitude-krisflyer-table" role="table" aria-label="KrisFlyer Spontaneous Escapes routes">' +
            '<div class="altitude-krisflyer-table__row altitude-krisflyer-table__row--head" role="row">' +
              '<span role="columnheader">Route</span><span role="columnheader">Cabin</span><span role="columnheader">Discount</span><span role="columnheader">Verdict</span>' +
            '</div>' +
            rows.map(renderEscapeRow).join('') +
          '</div>' +
        '</section>' +
      '</section>';
    }).join('');
  }

  function renderCabinVerdicts(root, records) {
    root.innerHTML = records.map(function (item) {
      var scores = item.scoreBreakdown && item.scoreBreakdown.length ? item.scoreBreakdown : [];
      return '<section class="altitude-cms-stack">' +
        '<section class="private-panel altitude-verdict-hero slide-up is-visible">' +
          '<div>' +
            badge('Skyfare Verdict', true) +
            '<h2>' + e(item.verdictHeadline || item.title) + '</h2>' +
            '<p>' + e(item.personalFlightNote || item.shortDescription) + '</p>' +
          '</div>' +
          '<div class="altitude-verdict-final">' +
            '<span>Overall cabin score</span>' +
            '<strong>' + e(formatScore(item.overallScore)) + '</strong>' +
            '<small>' + e(item.airline || 'Altitude member verdict') + '</small>' +
          '</div>' +
        '</section>' +
        '<section class="altitude-verdict-grid" aria-label="Premium cabin verdict scoring">' +
          scores.map(function (score) {
            return '<article class="private-panel altitude-verdict-score slide-up is-visible">' +
              '<span>' + e(score.label || score.name || 'Score') + '</span>' +
              '<strong>' + e(formatScore(score.score)) + '</strong>' +
              '<p>' + e(score.note || score.description || '') + '</p>' +
            '</article>';
          }).join('') +
        '</section>' +
        '<section class="private-panel altitude-note-stack altitude-note-stack--split slide-up is-visible">' +
          note('Recommendation', item.recommendation) +
          note('Caveats', item.caveats) +
          note('Best for', item.bestFor) +
        '</section>' +
      '</section>';
    }).join('');
  }

  function renderEscapeRow(row) {
    var verdict = row.verdict || '';
    var tone = /book/i.test(verdict) ? 'book' : /consider|watch/i.test(verdict) ? 'watch' : 'skip';
    return '<div class="altitude-krisflyer-table__row" role="row">' +
      '<span role="cell"><strong>' + e(row.route || '') + '</strong><small>' + e(row.note || row.travelDates || '') + '</small></span>' +
      '<span role="cell">' + e(row.cabin || '') + '</span>' +
      '<span role="cell">' + e(row.discount || '') + '</span>' +
      '<span role="cell"><span class="altitude-verdict-pill altitude-verdict-pill--' + tone + '">' + e(verdict || 'Review') + '</span></span>' +
    '</div>';
  }

  function renderLoading(root) {
    root.innerHTML =
      '<div class="private-panel private-skeleton altitude-content-state">' +
        '<span class="private-skeleton__dot" aria-hidden="true"></span>' +
        '<p>Loading Airtable content</p>' +
      '</div>';
  }

  function renderEmpty(root) {
    root.innerHTML =
      '<div class="private-panel private-empty altitude-content-state">' +
        '<i class="fa-solid fa-inbox" aria-hidden="true"></i>' +
        '<p>No published records yet.</p>' +
      '</div>';
  }

  function renderError(root, type, message) {
    loaded = false;
    root.innerHTML =
      '<div class="private-panel altitude-access-error altitude-content-state">' +
        '<div class="icon-chip icon-chip-lg"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>' +
        '<div>' +
          '<h1>Could not load this content.</h1>' +
          '<p>' + e(message || 'Airtable content is temporarily unavailable.') + '</p>' +
          '<div class="private-actions">' +
            '<button type="button" class="private-action private-action--primary" data-altitude-content-retry="' + e(type) + '">' +
              '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var retry = root.querySelector('[data-altitude-content-retry]');
    if (retry) retry.addEventListener('click', loadContent);
  }

  function routeLabel(item) {
    return [item.origin, item.destination].filter(Boolean).join(' - ') || item.airline || 'Alert';
  }

  function alertSummary(item) {
    var dates = [formatDate(item.travelDateStart), formatDate(item.travelDateEnd)].filter(Boolean).join(' - ');
    return [item.seatsAvailable ? item.seatsAvailable + ' seats' : '', dates || item.milesRequired].filter(Boolean).join(' | ');
  }

  function metric(label, value) {
    return '<div><span>' + e(label) + '</span><strong>' + e(value == null || value === '' ? 'TBD' : value) + '</strong></div>';
  }

  function note(title, value) {
    if (!value) return '';
    return '<article><h3>' + e(title) + '</h3><p>' + e(value) + '</p></article>';
  }

  function badge(label, gold) {
    return '<span class="private-badge' + (gold ? ' private-badge--gold' : '') + '">' + e(label) + '</span>';
  }

  function formatScore(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1).replace(/\.0$/, '') : 'TBD';
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
})();
