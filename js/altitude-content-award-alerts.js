/* Award Alerts render module — a two-pane opportunity feed (scannable
   list + detail read) with search/status controls, relative date
   grouping, and a "Load more" control over the client-side filtered
   set. Registers into window.AltitudeContent.renderers. */
(function () {
  var app = window.AltitudeContent = window.AltitudeContent || {};
  var u = app.utils;
  var PAGE_SIZE = 6;

  // Shared with wireStickyFeed's fixed-position logic and the mobile
  // browse<->focus toggle below -- both need to agree on exactly the same
  // width as the CSS grid's own `@media (max-width: 900px)` collapse
  // (altitude-editorial.css) that switches list+detail from side-by-side
  // to stacked. 901px is the correct complement of that 900px max-width,
  // not an off-by-one: at 900px the grid is already stacked, so "desktop"
  // starts one pixel later, at 901px.
  function isDesktop() {
    return window.matchMedia('(min-width: 901px)').matches;
  }

  // Browse <-> focus for the stacked mobile/tablet layout: shows one pane
  // at a time instead of making the user scroll past the list to reach a
  // freshly-selected detail. No-ops on desktop, where both panes are
  // always visible side by side (see the max-width:900px CSS block).
  function setMobileView(root, view) {
    var grid = root.querySelector('.alt-alerts-grid');
    if (!grid) return;
    grid.classList.toggle('alt-alerts-grid--detail-active', view === 'detail');
    if (view === 'detail' && !isDesktop()) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  app.renderers['award-alerts'] = function (root, records) {
    app.state.alerts = {
      records: records,
      filtered: records.slice(),
      activeIndex: 0,
      query: '',
      status: 'all',
      page: 1,
    };

    // Per-member unread tracking (js/altitude-read-tracker.js) -- silently
    // seeds "seen" on this browser's first-ever visit (no dot flood on
    // rollout), then caches this page's real unread count for the subnav
    // dot. Cards render their own dot below via renderGroupedList's use of
    // window.AltitudeReadTracker.isUnread.
    if (window.AltitudeReadTracker) {
      var allIds = records.map(function (r) { return r.id; });
      window.AltitudeReadTracker.seedIfFirstVisit('award-alerts', allIds);
      window.AltitudeReadTracker.refreshCount('award-alerts', allIds);
    }

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
          '<label class="alt-status-select">' +
            '<i class="fa-solid fa-filter" aria-hidden="true"></i>' +
            '<select data-alert-status-select aria-label="Filter by status">' +
              '<option value="all">All alerts</option>' +
              '<option value="new">New</option>' +
              '<option value="past">Past</option>' +
            '</select>' +
          '</label>' +
        '</div>' +
        '<div class="alt-alerts-grid">' +
          '<aside class="alt-alert-feed" aria-label="Published award alerts">' +
            '<div class="alt-alert-feed__head"><span class="alt-meta" data-alert-count></span></div>' +
            '<div data-alert-list></div>' +
            '<nav class="altitude-pagination" data-alert-pagination aria-label="Award alert pages"></nav>' +
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

    function unfix() {
      feed.classList.remove('alt-alert-feed--fixed');
      feed.style.width = '';
      placeholder.style.display = 'none';
    }

    // position: fixed ignores document flow entirely, so the sidebar has no
    // built-in awareness of the footer (.private-footer, injected async by
    // js/private-layout.js) that follows this grid in the DOM -- the
    // grid-bottom check below alone only tracks the grid's own height, not
    // how close the footer has scrolled up into the space the fixed
    // sidebar would occupy. Without this, the sidebar visually overlaps the
    // footer for a stretch near the bottom of the page.
    function footerTop() {
      var footer = document.querySelector('.private-footer');
      return footer ? footer.getBoundingClientRect().top : Infinity;
    }

    function update() {
      if (!isDesktop()) { unfix(); return; }
      if (!feed.classList.contains('alt-alert-feed--fixed')) {
        naturalWidth = feed.getBoundingClientRect().width;
      }

      var gridRect = grid.getBoundingClientRect();
      var fixedHeight = Math.min(feed.offsetHeight, window.innerHeight - OFFSET * 2);
      var wouldOverlapFooter = footerTop() < OFFSET + fixedHeight;
      var shouldFix = gridRect.top < OFFSET && gridRect.bottom > OFFSET + 200 && !wouldOverlapFooter;

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
        state.page = 1;
        updateAlertList(root);
        setMobileView(root, 'list');
      });
    }

    // Shared by the desktop chip row and the mobile filter <select> (see
    // .alt-status-select) -- both set the same state.status and both need
    // the other control's UI kept in sync, so a resize between the two
    // breakpoints never shows a stale selection.
    function applyStatus(root, status) {
      state.status = status || 'all';
      state.activeIndex = 0;
      state.page = 1;
      root.querySelectorAll('[data-alert-status]').forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-alert-status') === state.status);
      });
      var statusSelect = root.querySelector('[data-alert-status-select]');
      if (statusSelect) statusSelect.value = state.status;
      updateAlertList(root);
      setMobileView(root, 'list');
    }

    root.addEventListener('click', function (event) {
      var statusBtn = event.target.closest && event.target.closest('[data-alert-status]');
      if (statusBtn && root.contains(statusBtn)) {
        applyStatus(root, statusBtn.getAttribute('data-alert-status'));
        return;
      }

      var pageBtn = event.target.closest && event.target.closest('[data-alert-page]');
      if (pageBtn && root.contains(pageBtn) && !pageBtn.disabled) {
        var totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
        var action = pageBtn.getAttribute('data-alert-page');
        if (action === 'prev') state.page = Math.max(1, state.page - 1);
        else if (action === 'next') state.page = Math.min(totalPages, state.page + 1);
        else state.page = Math.max(1, Math.min(totalPages, parseInt(action, 10) || 1));
        state.activeIndex = 0;
        updateAlertList(root);
        var list = root.querySelector('[data-alert-list]');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      var alertBtn = event.target.closest && event.target.closest('[data-altitude-alert-index]');
      if (alertBtn && root.contains(alertBtn)) {
        var index = parseInt(alertBtn.getAttribute('data-altitude-alert-index'), 10);
        var visible = getVisiblePage(state);
        if (!visible[index]) return;
        state.activeIndex = index;
        if (window.AltitudeReadTracker) {
          window.AltitudeReadTracker.markRead('award-alerts', visible[index].id);
          window.AltitudeReadTracker.refreshCount('award-alerts', state.records.map(function (r) { return r.id; }));
        }
        updateAlertList(root);
        setMobileView(root, 'detail');
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

    root.addEventListener('change', function (event) {
      var statusSelect = event.target.closest && event.target.closest('[data-alert-status-select]');
      if (statusSelect && root.contains(statusSelect)) {
        applyStatus(root, statusSelect.value);
        return;
      }

      var select = event.target.closest && event.target.closest('[data-alert-select]');
      if (!select || !root.contains(select)) return;
      var index = parseInt(select.value, 10);
      var visible = getVisiblePage(state);
      if (!visible[index]) return;
      state.activeIndex = index;
      if (window.AltitudeReadTracker) {
        window.AltitudeReadTracker.markRead('award-alerts', visible[index].id);
        window.AltitudeReadTracker.refreshCount('award-alerts', state.records.map(function (r) { return r.id; }));
      }
      updateAlertList(root);
      setMobileView(root, 'detail');
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

    // Sorts by Airtable's own record-creation timestamp, not Found At/
    // Publish Date -- both are hand-typed free text in this table (e.g.
    // "Week of 14 August 2026 (live app pulls)", "2026-08-26 4:36 PM SGT")
    // and never parse as real dates, so u.dateValue() silently returned 0
    // for every record and newest-first ordering had no actual signal to
    // sort by. createdTime always parses. See normalizeBaseContent in
    // cloudflare/services/airtable.js.
    filtered.sort(function (a, b) {
      return u.dateValue(b.createdTime) - u.dateValue(a.createdTime);
    });

    state.filtered = filtered;
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;

    var list = root.querySelector('[data-alert-list]');
    var count = root.querySelector('[data-alert-count]');
    var detail = root.querySelector('[data-alert-detail]');
    var pagination = root.querySelector('[data-alert-pagination]');

    if (count) count.textContent = filtered.length + (filtered.length === 1 ? ' published alert' : ' published alerts');

    if (!filtered.length) {
      if (list) list.innerHTML = '<div class="alt-empty"><span class="alt-empty__icon"><i class="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i></span><p class="alt-empty__copy">No alerts match these filters right now. Try widening your search.</p></div>';
      if (detail) detail.innerHTML = '<div class="alt-empty"><span class="alt-empty__icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span><p class="alt-empty__copy">Select a different filter to view alert details.</p></div>';
      if (pagination) pagination.innerHTML = '';
      return;
    }

    if (state.activeIndex >= PAGE_SIZE) state.activeIndex = 0;
    var visible = getVisiblePage(state);
    if (state.activeIndex >= visible.length) state.activeIndex = 0;

    if (list) list.innerHTML = renderGroupedList(visible, state.activeIndex);
    if (pagination) pagination.innerHTML = renderPagination(state.page, totalPages);

    renderAwardDetail(detail, visible[state.activeIndex], visible, state.activeIndex);
  }

  function getVisiblePage(state) {
    var start = (state.page - 1) * PAGE_SIZE;
    return state.filtered.slice(start, start + PAGE_SIZE);
  }

  // Same markup/class contract as js/altitude-portal.js's newsletter
  // archive pagination (.altitude-pagination, css/style.css) -- reused as-
  // is rather than a second pagination component.
  function renderPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    var buttons = '';
    for (var i = 1; i <= totalPages; i++) {
      buttons += '<button type="button" data-alert-page="' + i + '" class="' + (i === page ? 'active' : '') + '" aria-label="Go to page ' + i + '">' + i + '</button>';
    }
    return '<button type="button" data-alert-page="prev"' + (page === 1 ? ' disabled' : '') + ' aria-label="Previous page"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>' +
      '<div class="altitude-pagination__pages">' + buttons + '</div>' +
      '<button type="button" data-alert-page="next"' + (page === totalPages ? ' disabled' : '') + ' aria-label="Next page"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
  }

  function renderGroupedList(items, activeIndex) {
    var groups = [];
    var lastLabel = null;
    items.forEach(function (item, index) {
      // Grouped on the same basis as the sort above (createdTime) so a
      // card's section (This week/Earlier this month/Older) always agrees
      // with its position in the list.
      var label = dateGroupLabel(item.createdTime);
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
          var unread = window.AltitudeReadTracker && window.AltitudeReadTracker.isUnread('award-alerts', entry.item.id);
          return '<button type="button" class="alt-opportunity-card' + (active ? ' active' : '') + '" data-altitude-alert-index="' + entry.index + '" data-altitude-alert-id="' + u.e(entry.item.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
            '<div class="alt-opportunity-card__top">' +
              statusBadge(entry.item) +
              '<span class="alt-date">' + u.e(u.formatDate(entry.item.foundAt || entry.item.publishDate)) + '</span>' +
            '</div>' +
            '<strong class="alt-route">' + (unread ? '<span class="alt-unread-dot" aria-label="Unread"></span>' : '') + routeLabelHtml(entry.item) + '</strong>' +
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

  // Alert switcher for the detail panel -- lets the reader jump straight
  // to a different alert (mobile's only way back out of the focused
  // detail view once a card's been tapped, and a quick jump on desktop
  // too). Reuses the exact indexing scheme card clicks already use (an
  // index into the same paginated `visible` array, read back by the
  // delegated change handler in wireAwardControls).
  function renderAlertToolbar(visible, activeIndex) {
    if (!Array.isArray(visible) || !visible.length) return '';
    var options = visible.map(function (item, index) {
      var label = routeLabel(item) + ' · ' + (u.formatDate(item.foundAt || item.publishDate) || alertStatusLabel(item));
      return '<option value="' + index + '"' + (index === activeIndex ? ' selected' : '') + '>' + u.e(label) + '</option>';
    }).join('');

    return '<div class="alt-alert-detail__toolbar">' +
      '<label class="alt-select-field">' +
        '<span class="sr-only">Switch to a different award alert</span>' +
        '<select data-alert-select>' + options + '</select>' +
      '</label>' +
    '</div>';
  }

  function renderAwardDetail(detail, item, visible, activeIndex) {
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
      renderAlertToolbar(visible, activeIndex) +
      '<div class="alt-media-hero">' +
        (item.thumbnail
          ? '<div class="alt-media-hero__media"><img src="' + u.e(item.thumbnail) + '" alt="" loading="lazy"></div>'
          : '<div class="alt-media-hero__media alt-media-hero__media--placeholder"><i class="fa-solid fa-plane" aria-hidden="true"></i></div>') +
        '<div class="alt-media-hero__badge">' + statusBadge(item) + '</div>' +
        u.expandButton(item.thumbnail, item.title) +
        '<div class="alt-media-hero__content">' +
          '<h2 class="alt-heading">' + u.e(item.title) + '</h2>' +
        '</div>' +
      '</div>' +
      (item.shortDescription ? '<p class="alt-body alt-alert-overview">' + u.e(item.shortDescription) + '</p>' : '') +
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
