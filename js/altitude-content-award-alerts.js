/* Award Alerts render module — a two-pane opportunity feed (scannable
   list + detail read) with search/status controls, relative date
   grouping, and a "Load more" control over the client-side filtered
   set. Registers into window.AltitudeContent.renderers. */
(function () {
  var app = window.AltitudeContent = window.AltitudeContent || {};
  var u = app.utils;
  var PAGE_SIZE = 10;

  app.renderers['award-alerts'] = function (root, records) {
    app.state.alerts = {
      records: records,
      filtered: records.slice(),
      activeIndex: 0,
      query: '',
      status: 'all',
      visibleCount: PAGE_SIZE,
    };

    root.innerHTML =
      '<section class="alt-alerts-workspace" aria-label="Award alert opportunity feed">' +
        '<div class="alt-filter-bar">' +
          '<label class="alt-search-field">' +
            '<span class="sr-only">Search award alerts</span>' +
            '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
            '<input type="search" data-alert-search placeholder="Search alerts" autocomplete="off">' +
          '</label>' +
          '<div class="alt-filter-chips" aria-label="Award alert status filters">' +
            '<button type="button" class="alt-filter-chip active" data-alert-status="all">All</button>' +
            '<button type="button" class="alt-filter-chip" data-alert-status="new">New</button>' +
            '<button type="button" class="alt-filter-chip" data-alert-status="past">Past</button>' +
          '</div>' +
        '</div>' +
        '<div class="alt-alerts-grid">' +
          '<aside class="alt-alert-feed" aria-label="Published award alerts">' +
            '<div class="alt-alert-feed__head"><span class="alt-meta" data-alert-count></span></div>' +
            '<div data-alert-list></div>' +
          '</aside>' +
          '<section class="alt-alert-detail alt-card" data-alert-detail aria-live="polite"></section>' +
        '</div>' +
      '</section>';

    wireAwardControls(root);
    wireStickyFeed(root);
    updateAlertList(root);
  };

  // Keeps the opportunity list visible while the taller detail panel
  // scrolls past it. Uses position:fixed toggled from a scroll listener
  // rather than CSS position:sticky -- html/body's site-wide
  // overflow-x:hidden (css/style.css) computes their overflow-y as auto
  // too (per the CSS overflow spec, one non-visible axis forces the
  // other to auto), which makes <body> register as a scroll container
  // even though <html> is the one actually scrolling. That breaks
  // sticky's nearest-scrolling-ancestor resolution for anything under
  // <body> -- confirmed directly (the element moved 1:1 with scroll
  // instead of sticking) before reaching for this fallback. Desktop
  // two-column layout only; single-column mobile stays static so a
  // fixed list doesn't cover the detail panel underneath it.
  function wireStickyFeed(root) {
    var feed = root.querySelector('.alt-alert-feed');
    var grid = root.querySelector('.alt-alerts-grid');
    if (!feed || !grid) return;

    var OFFSET = 24;
    var placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.display = 'none';
    feed.parentNode.insertBefore(placeholder, feed);
    var naturalWidth = 0;

    function isDesktop() {
      return window.matchMedia('(min-width: 901px)').matches;
    }

    function unfix() {
      feed.classList.remove('alt-alert-feed--fixed');
      feed.style.width = '';
      placeholder.style.display = 'none';
    }

    function update() {
      if (!isDesktop()) { unfix(); return; }
      if (!feed.classList.contains('alt-alert-feed--fixed')) {
        naturalWidth = feed.getBoundingClientRect().width;
      }

      var gridRect = grid.getBoundingClientRect();
      var shouldFix = gridRect.top < OFFSET && gridRect.bottom > OFFSET + 200;

      if (shouldFix) {
        feed.classList.add('alt-alert-feed--fixed');
        feed.style.width = naturalWidth + 'px';
        placeholder.style.width = naturalWidth + 'px';
        placeholder.style.height = feed.offsetHeight + 'px';
        placeholder.style.display = 'block';
      } else {
        unfix();
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function wireAwardControls(root) {
    var search = root.querySelector('[data-alert-search]');
    var state = app.state.alerts;

    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value.trim().toLowerCase();
        state.activeIndex = 0;
        state.visibleCount = PAGE_SIZE;
        updateAlertList(root);
      });
    }

    root.addEventListener('click', function (event) {
      var statusBtn = event.target.closest && event.target.closest('[data-alert-status]');
      if (statusBtn && root.contains(statusBtn)) {
        state.status = statusBtn.getAttribute('data-alert-status') || 'all';
        state.activeIndex = 0;
        state.visibleCount = PAGE_SIZE;
        root.querySelectorAll('[data-alert-status]').forEach(function (button) {
          button.classList.toggle('active', button === statusBtn);
        });
        updateAlertList(root);
        return;
      }

      var loadMoreBtn = event.target.closest && event.target.closest('[data-alert-load-more]');
      if (loadMoreBtn && root.contains(loadMoreBtn)) {
        state.visibleCount += PAGE_SIZE;
        updateAlertList(root);
        return;
      }

      var alertBtn = event.target.closest && event.target.closest('[data-altitude-alert-index]');
      if (alertBtn && root.contains(alertBtn)) {
        var index = parseInt(alertBtn.getAttribute('data-altitude-alert-index'), 10);
        var visible = state.filtered.slice(0, state.visibleCount);
        if (!visible[index]) return;
        state.activeIndex = index;
        updateAlertList(root);
        return;
      }

      var tierBtn = event.target.closest && event.target.closest('[data-calendar-tier]');
      if (tierBtn && root.contains(tierBtn)) {
        var panelGroup = tierBtn.closest('[data-calendar]');
        if (!panelGroup) return;
        var tier = tierBtn.getAttribute('data-calendar-tier');
        panelGroup.querySelectorAll('[data-calendar-tier]').forEach(function (btn) {
          btn.classList.toggle('active', btn === tierBtn);
        });
        panelGroup.querySelectorAll('[data-calendar-panel]').forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-calendar-panel') !== tier;
        });
      }
    });
  }

  function updateAlertList(root) {
    var state = app.state.alerts;
    if (!state) return;

    var filtered = state.records.filter(function (item) {
      var haystack = [
        item.title, item.shortDescription, item.origin, item.destination,
        item.airline, item.program, item.cabinClass, item.urgency,
      ].join(' ').toLowerCase();
      var matchesQuery = !state.query || haystack.indexOf(state.query) !== -1;
      var matchesStatus = state.status === 'all' || alertStatus(item) === state.status;
      return matchesQuery && matchesStatus;
    });

    filtered.sort(function (a, b) {
      return u.dateValue(b.foundAt || b.publishDate) - u.dateValue(a.foundAt || a.publishDate);
    });

    state.filtered = filtered;
    if (state.activeIndex >= Math.min(filtered.length, state.visibleCount)) state.activeIndex = 0;

    var list = root.querySelector('[data-alert-list]');
    var count = root.querySelector('[data-alert-count]');
    var detail = root.querySelector('[data-alert-detail]');

    if (count) count.textContent = filtered.length + (filtered.length === 1 ? ' published alert' : ' published alerts');

    if (!filtered.length) {
      if (list) list.innerHTML = '<div class="alt-empty"><span class="alt-empty__icon"><i class="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i></span><p class="alt-empty__copy">No alerts match these filters right now. Try widening your search.</p></div>';
      if (detail) detail.innerHTML = '<div class="alt-empty"><span class="alt-empty__icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span><p class="alt-empty__copy">Select a different filter to view alert details.</p></div>';
      return;
    }

    var visible = filtered.slice(0, state.visibleCount);

    if (list) {
      list.innerHTML = renderGroupedList(visible, state.activeIndex) +
        (filtered.length > visible.length
          ? '<button type="button" class="alt-load-more private-action" data-alert-load-more>Load more alerts</button>'
          : '');
    }

    renderAwardDetail(detail, visible[state.activeIndex]);
  }

  function renderGroupedList(items, activeIndex) {
    var groups = [];
    var lastLabel = null;
    items.forEach(function (item, index) {
      var label = dateGroupLabel(item.foundAt || item.publishDate);
      if (label !== lastLabel) {
        groups.push({ label: label, items: [] });
        lastLabel = label;
      }
      groups[groups.length - 1].items.push({ item: item, index: index });
    });

    return groups.map(function (group) {
      return '<div class="alt-date-group">' +
        '<div class="alt-date-group__label">' + u.e(group.label) + '</div>' +
        group.items.map(function (entry) {
          var active = entry.index === activeIndex;
          return '<button type="button" class="alt-opportunity-card' + (active ? ' active' : '') + '" data-altitude-alert-index="' + entry.index + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
            '<div class="alt-opportunity-card__top">' +
              statusBadge(entry.item) +
              '<span class="alt-date">' + u.e(u.formatDate(entry.item.foundAt || entry.item.publishDate)) + '</span>' +
            '</div>' +
            '<strong class="alt-route">' + routeLabelHtml(entry.item) + '</strong>' +
            '<span class="alt-meta">' +
              u.cabinLabel(entry.item.cabinClass) +
              (entry.item.cabinClass && entry.item.milesRequired ? ' · ' : '') +
              (entry.item.milesRequired ? '<span class="alt-opportunity-card__miles">' + u.e(entry.item.milesRequired) + '</span>' : '') +
              (!entry.item.cabinClass && !entry.item.milesRequired ? 'Availability details' : '') +
            '</span>' +
          '</button>';
        }).join('') +
      '</div>';
    }).join('');
  }

  function renderAwardDetail(detail, item) {
    if (!detail || !item) return;
    var cabinMetric = item.cabinClass
      ? '<div class="alt-metric"><span class="alt-metric__label">Cabin</span><strong class="alt-metric__value">' + u.cabinLabel(item.cabinClass) + '</strong></div>'
      : '';
    var primaryStats = [
      cabinMetric,
      u.metric('Miles', item.milesRequired, 'alt-metric--miles'),
    ].filter(Boolean).join('');

    var secondaryMetrics = [
      u.metric('Fees', item.taxesFees),
    ].filter(Boolean).join('');

    var dateWindow = u.dateRange(item.travelDateStart, item.travelDateEnd);
    var metaLine = [item.airline, item.program].filter(Boolean).join(' · ');

    detail.innerHTML =
      '<div class="alt-media-hero">' +
        (item.thumbnail
          ? '<div class="alt-media-hero__media"><img src="' + u.e(item.thumbnail) + '" alt="" loading="lazy"></div>'
          : '<div class="alt-media-hero__media alt-media-hero__media--placeholder"><i class="fa-solid fa-plane" aria-hidden="true"></i></div>') +
        '<div class="alt-media-hero__content">' +
          statusBadge(item) +
          '<h2 class="alt-heading">' + u.e(item.title) + '</h2>' +
          (item.shortDescription ? '<p class="alt-body">' + u.e(item.shortDescription) + '</p>' : '') +
        '</div>' +
      '</div>' +
      (metaLine ? '<p class="alt-meta" style="margin-bottom:1rem">' + u.e(metaLine) + '</p>' : '') +
      '<div class="alt-route alt-alert-route">' +
        '<span>' + u.flagFor(item.origin) + u.e(item.origin || 'Origin') + '</span>' +
        '<i class="fa-solid fa-plane" aria-hidden="true"></i>' +
        '<span>' + u.flagFor(item.destination) + u.e(item.destination || 'Destination') + '</span>' +
      '</div>' +
      (dateWindow ? '<div class="alt-window-item" style="margin-bottom:1.75rem"><i class="fa-regular fa-calendar" aria-hidden="true"></i><span><span class="alt-window-item__label">Travel window</span><span class="alt-window-item__value">' + u.e(dateWindow) + '</span></span></div>' : '') +
      (primaryStats ? '<div class="alt-alert-stats">' + primaryStats + '</div>' : '') +
      (secondaryMetrics ? '<div class="alt-alert-meta">' + secondaryMetrics + '</div>' : '') +
      renderAvailabilityCalendar(item.availabilityCalendar) +
      '<div class="alt-alert-notes">' +
        u.note('Availability notes', item.availabilityNotes) +
        u.note('Booking notes', item.bookingNotes) +
        u.note('Fallback strategy', item.fallbackStrategy) +
      '</div>';
  }

  function renderAvailabilityCalendar(calendar) {
    if (!calendar || typeof calendar !== 'object') return '';
    var tiers = Object.keys(calendar).filter(function (key) {
      return calendar[key] && calendar[key].months && Object.keys(calendar[key].months).length;
    });
    if (!tiers.length) return '';

    var tabs = tiers.map(function (tier, index) {
      var miles = calendar[tier].miles_one_way;
      var label = capitalize(tier) + (miles ? ' · ' + Number(miles).toLocaleString() + ' miles one way' : '');
      return '<button type="button" class="alt-filter-chip' + (index === 0 ? ' active' : '') + '" data-calendar-tier="' + u.e(tier) + '">' + u.e(label) + '</button>';
    }).join('');

    var panels = tiers.map(function (tier, index) {
      var months = calendar[tier].months || {};
      var monthBlocks = Object.keys(months).map(function (monthLabel) {
        var days = months[monthLabel];
        if (!Array.isArray(days) || !days.length) return '';
        return '<div class="alt-calendar-month">' +
          '<div class="alt-label">' + u.e(monthLabel) + '</div>' +
          '<div class="alt-calendar-days">' +
            days.map(function (day) { return '<span class="alt-calendar-day">' + u.e(day) + '</span>'; }).join('') +
          '</div>' +
        '</div>';
      }).join('');
      return '<div class="alt-calendar-panel" data-calendar-panel="' + u.e(tier) + '"' + (index === 0 ? '' : ' hidden') + '>' + monthBlocks + '</div>';
    }).join('');

    return '<details class="alt-alert-calendar" data-calendar>' +
      '<summary><span class="alt-heading" style="font-size: var(--alt-size-card-title)">Availability calendar</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>' +
      (tiers.length > 1 ? '<div class="alt-filter-chips alt-calendar-tiers">' + tabs + '</div>' : '') +
      panels +
    '</details>';
  }

  function capitalize(value) {
    value = String(value || '');
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function routeLabel(item) {
    return [item.origin, item.destination].filter(Boolean).join(' – ') || item.airline || 'Route';
  }

  function routeLabelHtml(item) {
    if (!item.origin && !item.destination) return u.e(item.airline || 'Route');
    return u.flagFor(item.origin) + u.e(item.origin || '') + ' – ' + u.flagFor(item.destination) + u.e(item.destination || '');
  }

  // Simple two-state model: Past once the travel window has closed,
  // New otherwise (freshly found, or explicitly featured/tagged new).
  function alertStatus(item) {
    var endMs = u.dateValue(item.travelDateEnd);
    if (endMs && endMs < Date.now()) return 'past';
    var textValue = String(item.urgency || '').toLowerCase();
    if (/new|fresh|found/.test(textValue)) return 'new';
    return item.featured ? 'new' : 'published';
  }

  function alertStatusLabel(item) {
    var status = alertStatus(item);
    if (status === 'past') return 'Past';
    if (status === 'new') return 'New';
    return item.urgency || 'Published';
  }

  function statusBadge(item) {
    var status = alertStatus(item);
    var tone = status === 'new' ? 'gold' : null;
    return u.badge(alertStatusLabel(item), tone);
  }

  function dateGroupLabel(value) {
    if (!value) return 'Earlier';
    var ms = u.dateValue(value);
    if (!ms) return 'Earlier';
    var days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 7) return 'This week';
    if (days <= 30) return 'Earlier this month';
    return 'Older';
  }
})();
