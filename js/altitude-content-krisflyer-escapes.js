/* KrisFlyer Escapes render module — a monthly editorial issue: masthead +
   overview, curated "Skyfare Picks" destinations, a collapsed full route
   grid (reference appendix), and an optional newsletter link card.
   Registers into window.AltitudeContent.renderers. */
(function () {
  var app = window.AltitudeContent = window.AltitudeContent || {};
  var u = app.utils;
  // Standard cabin hierarchy, low to high.
  var CABIN_SECTIONS = [
    { key: 'economy', label: 'Economy' },
    { key: 'premium_economy', label: 'Premium Economy' },
    { key: 'business', label: 'Business' },
  ];

  app.renderers['krisflyer-escapes'] = function (root, records) {
    var initialIndex = Math.max(0, records.findIndex(function (item) { return item.featured; }));

    root.innerHTML = '<div data-escape-issue></div>';
    var issueRoot = root.querySelector('[data-escape-issue]');
    renderIssue(issueRoot, records[initialIndex] || records[0]);

    renderMonthControl(records, initialIndex, function (index) {
      renderIssue(issueRoot, records[index]);
    });
  };

  // Renders into the page-heading slot (outside `root`, in the static
  // HTML shell) rather than the content root, so it sits right-aligned
  // next to the page description instead of stacked above the feed.
  function renderMonthControl(records, activeIndex, onChange) {
    var slot = document.querySelector('[data-escape-month-slot]');
    if (!slot) return;
    if (records.length < 2) { slot.innerHTML = ''; return; }

    slot.innerHTML =
      '<label class="alt-select-field">' +
        '<span class="sr-only">Choose a month</span>' +
        '<select data-month-select>' +
          records.map(function (item, index) {
            return '<option value="' + index + '"' + (index === activeIndex ? ' selected' : '') + '>' +
              u.e(item.dropMonth || item.title || 'Issue ' + (index + 1)) +
            '</option>';
          }).join('') +
        '</select>' +
      '</label>';

    var select = slot.querySelector('[data-month-select]');
    if (select) {
      select.addEventListener('change', function () {
        var index = parseInt(select.value, 10);
        if (records[index]) onChange(index);
      });
    }
  }

  function renderIssue(container, item) {
    if (!container || !item) return;
    var scoreline = [
      u.metric('Book fast', item.bookFastCount),
      u.metric('Consider', item.considerCount),
      u.metric('Skip', item.skipCount),
    ].filter(Boolean).join('');

    container.innerHTML =
      '<article class="alt-escape-issue">' +
        '<div class="alt-escape-masthead-card alt-card">' +
          '<div class="alt-media-hero">' +
            (item.thumbnail
              ? '<div class="alt-media-hero__media"><img src="' + u.e(item.thumbnail) + '" alt="" loading="eager"></div>'
              : '<div class="alt-media-hero__media alt-media-hero__media--placeholder"><i class="fa-solid fa-plane-departure" aria-hidden="true"></i></div>') +
            (item.discount ? '<div class="alt-media-hero__badge">' + u.badge(item.discount, 'gold') + '</div>' : '') +
            u.expandButton(item.thumbnail, item.title || 'KrisFlyer Escapes') +
            '<div class="alt-media-hero__content">' +
              '<h2 class="alt-title alt-escape-masthead__title">' + u.e((item.dropMonth ? item.dropMonth + ' ' : '') + 'KrisFlyer Escapes') + '</h2>' +
              (item.title ? '<p class="alt-card-title alt-escape-masthead__subtitle">' + u.e(item.title) + '</p>' : '') +
            '</div>' +
          '</div>' +

          (item.summaryVerdict || item.shortDescription ? '<p class="alt-body alt-escape-overview">' + u.e(item.summaryVerdict || item.shortDescription) + '</p>' : '') +

          '<div class="alt-escape-window">' +
            (item.bookingWindow ? '<div class="alt-window-item"><i class="fa-regular fa-calendar-check" aria-hidden="true"></i><span><span class="alt-window-item__label">Booking window</span><span class="alt-window-item__value">' + u.e(item.bookingWindow) + '</span></span></div>' : '') +
            (item.travelWindow ? '<div class="alt-window-item"><i class="fa-regular fa-calendar-days" aria-hidden="true"></i><span><span class="alt-window-item__label">Travel window</span><span class="alt-window-item__value">' + u.e(item.travelWindow) + '</span></span></div>' : '') +
          '</div>' +
          (item.routesCount ? '<p class="alt-help">' + u.e(item.routesCount) + ' routes surveyed</p>' : '') +
          (scoreline ? '<div class="alt-escape-scoreline">' + scoreline + '</div>' : '') +
        '</div>' +

        renderPicks(item.routeRows) +
        renderRouteGrid(item.routeGrid, item.gridNote) +
        renderNewsletterCard(item) +
      '</article>';

    wireRouteGridSearch(container);
  }

  function renderPicks(rows) {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) return '';

    return '<section class="alt-escape-picks" aria-label="Skyfare Picks">' +
      '<h3 class="alt-heading">Skyfare Picks</h3>' +
      '<div class="alt-escape-picks__grid">' +
        rows.map(renderPickCard).join('') +
      '</div>' +
    '</section>';
  }

  function renderPickCard(row) {
    var verdict = row.verdict || row.call || row.signal || '';
    var tone = /book/i.test(verdict) ? 'book' : /consider|watch/i.test(verdict) ? 'watch' : verdict ? 'skip' : '';
    return '<article class="alt-pick-card alt-card">' +
      (verdict ? '<span class="alt-pick-card__verdict alt-pick-card__verdict--' + tone + '">' + u.e(verdict) + '</span>' : '') +
      '<strong class="alt-route alt-pick-card__route">' + u.routeStringWithFlags(row.route || 'Route') + '</strong>' +
      '<div class="alt-metadata-row">' +
        (row.cabin ? '<span>' + u.cabinLabel(row.cabin) + '</span>' : '') +
        (row.miles ? '<span>' + u.e(row.miles) + ' mi</span>' : '') +
        (row.discount ? '<span>' + u.e(row.discount) + ' off</span>' : '') +
      '</div>' +
      (row.note || row.travelDates ? '<p class="alt-support">' + u.e(row.note || row.travelDates) + '</p>' : '') +
    '</article>';
  }

  function renderRouteGrid(grid, gridNote) {
    if (!grid || typeof grid !== 'object') return '';
    var sections = CABIN_SECTIONS
      .map(function (section) { return { label: section.label, rows: Array.isArray(grid[section.key]) ? grid[section.key].slice() : [] }; })
      .filter(function (section) { return section.rows.length; });
    if (!sections.length) return '';

    sections.forEach(function (section) {
      section.rows.sort(function (a, b) { return (Number(a.miles) || 0) - (Number(b.miles) || 0); });
    });

    return '<section class="alt-escape-grid alt-card" aria-label="Full route grid">' +
      '<div class="alt-escape-grid__header">' +
        '<h3 class="alt-heading">Full route grid</h3>' +
        '<label class="alt-search-field alt-escape-grid__search">' +
          '<span class="sr-only">Search the route grid</span>' +
          '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
          '<input type="search" data-route-grid-search placeholder="Search by route or flight" autocomplete="off">' +
        '</label>' +
      '</div>' +
      (gridNote ? '<p class="alt-help alt-escape-grid__note">' + u.e(gridNote) + '</p>' : '') +
      sections.map(function (section) {
        return '<details class="alt-escape-grid__section" data-escape-section>' +
          '<summary><span class="alt-card-title">' + u.cabinLabel(section.label) + '</span><span class="alt-meta" data-section-count>' + section.rows.length + ' routes</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>' +
          '<div class="alt-escape-grid__table" role="table">' +
            '<div class="alt-escape-grid__row alt-escape-grid__row--head" role="row">' +
              '<span role="columnheader">Route</span><span role="columnheader">Miles</span><span role="columnheader">Flights</span><span role="columnheader">Blackout</span>' +
            '</div>' +
            section.rows.map(function (row) {
              var searchText = [row.route, row.flights].filter(Boolean).join(' ').toLowerCase();
              return '<div class="alt-escape-grid__row" role="row" data-route-search="' + u.e(searchText) + '">' +
                '<span role="cell" class="alt-escape-grid__route">' + u.routeStringWithFlags(row.route || '') + '</span>' +
                '<span role="cell">' + u.e(row.miles ? Number(row.miles).toLocaleString() : '') + '</span>' +
                '<span role="cell">' + u.e(row.flights || '') + '</span>' +
                '<span role="cell">' + u.e(!row.blackout || row.blackout === 'None' ? 'No blackout dates' : row.blackout) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</details>';
      }).join('') +
      '<div class="alt-empty" data-escape-grid-empty hidden>' +
        '<span class="alt-empty__icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>' +
        '<p class="alt-empty__copy">No routes match that search.</p>' +
      '</div>' +
    '</section>';
  }

  function wireRouteGridSearch(container) {
    var input = container.querySelector('[data-route-grid-search]');
    var grid = container.querySelector('.alt-escape-grid');
    if (!input || !grid) return;

    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      var anyVisible = false;

      grid.querySelectorAll('[data-escape-section]').forEach(function (details) {
        var visibleCount = 0;
        details.querySelectorAll('[data-route-search]').forEach(function (row) {
          var match = !query || row.getAttribute('data-route-search').indexOf(query) !== -1;
          row.hidden = !match;
          if (match) visibleCount++;
        });

        var countEl = details.querySelector('[data-section-count]');
        if (countEl) countEl.textContent = visibleCount + (visibleCount === 1 ? ' route' : ' routes');

        var hasMatch = visibleCount > 0;
        details.hidden = !hasMatch;
        details.open = query ? hasMatch : false;
        if (hasMatch) anyVisible = true;
      });

      var empty = grid.querySelector('[data-escape-grid-empty]');
      if (empty) empty.hidden = !query || anyVisible;
    });
  }

  function renderNewsletterCard(item) {
    if (!item.newsletterUrl) return '';
    return '<a class="alt-escape-newsletter alt-card" href="' + u.e(item.newsletterUrl) + '" target="_blank" rel="noopener">' +
      '<span>' +
        '<strong class="alt-card-title">Read the full ' + u.e(item.dropMonth || 'monthly') + ' breakdown</strong>' +
        '<span class="alt-support">The complete Spontaneous Escapes edition, with our picks, blackout patterns, and booking strategy.</span>' +
      '</span>' +
      '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>' +
    '</a>';
  }
})();
