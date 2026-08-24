/*
 * Lightweight, dependency-free Mileage Route Explorer.
 * The map outline is loaded only when this section approaches the viewport.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-mileage-explorer]');
  var source = window.SKYFARE_MILEAGE_ROUTES;
  if (!root || !source || !source.routes.length) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VIEWBOX_WIDTH = 1000;
  var VIEWBOX_HEIGHT = 500;
  var DEFAULT_VIEWBOX = { x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT };
  var VIEWBOX_FOCUS_SHIFT = 90;
  var FEATURED_ROUTE_CODES = { JFK:1, LHR:1, MEL:1, DXB:1, CDG:1, LAX:1 };
  var origin = source.origin;
  var routes = source.routes;
  var mapShell = root.querySelector('[data-mileage-map-shell]');
  var svg = root.querySelector('#mileage-map-svg');
  var landPath = root.querySelector('#mileage-map-land');
  var arcsLayer = root.querySelector('#mileage-route-arcs');
  var nodesLayer = root.querySelector('#mileage-route-nodes');
  var signalLayer = root.querySelector('#mileage-route-signal');
  var status = root.querySelector('#mileage-route-status');
  var routeList = root.querySelector('#mileage-route-list');
  var routeSearch = root.querySelector('#mileage-route-search');
  var regionFilter = root.querySelector('#mileage-route-region');
  var routeCount = root.querySelector('#mileage-route-count');
  var routeRange = root.querySelector('#mileage-route-range');
  var browseCount = root.querySelector('#mileage-browse-count');
  var browserResultsCount = root.querySelector('#mileage-browser-results-count');
  var browseTrigger = root.querySelector('#mileage-route-browser-open');
  var browserDialog = root.querySelector('#mileage-route-browser-dialog');
  var popularPills = root.querySelectorAll('[data-route-code]');
  var popover = root.querySelector('#mileage-map-popover');
  var popoverTitle = root.querySelector('#mileage-map-popover-title');
  var popoverMeta = root.querySelector('#mileage-map-popover-meta');
  var mapInitialized = false;
  var selectedId = null;
  var hoverId = null;
  var lastFocusTarget = null;
  var currentViewBox = { x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT };
  var viewBoxFrame = null;
  var routeState = window.SKYFARE_ROUTE_STATE || (window.SKYFARE_ROUTE_STATE = {
    selectedRouteId: null,
    pendingMapRouteId: null
  });

  function createSvgElement(tag, attributes) {
    var element = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function formatMiles(value) {
    return value.toLocaleString() + ' miles';
  }

  function formatCompactMiles(value) {
    var thousands = value / 1000;
    return (thousands % 1 ? thousands.toFixed(1) : thousands.toFixed(0)) + 'k';
  }

  function project(latitude, longitude) {
    return [
      ((longitude + 180) / 360) * VIEWBOX_WIDTH,
      ((90 - latitude) / 180) * VIEWBOX_HEIGHT
    ];
  }

  function routeGeometry(route) {
    var start = project(origin.latitude, origin.longitude);
    var end = project(route.latitude, route.longitude);
    var deltaX = end[0] - start[0];
    var lift = Math.min(105, 22 + Math.abs(deltaX) * 0.12);

    if (Math.abs(deltaX) <= VIEWBOX_WIDTH / 2) {
      return {
        segments: [{
          start: start,
          control: [(start[0] + end[0]) / 2, ((start[1] + end[1]) / 2) - lift],
          end: end
        }]
      };
    }

    var edgeX = deltaX < 0 ? VIEWBOX_WIDTH : 0;
    var edgeY = ((start[1] + end[1]) / 2) - lift;
    var firstControl = [((start[0] + edgeX) / 2), ((start[1] + edgeY) / 2) - lift * 0.35];
    var secondControl = [((edgeX === 0 ? VIEWBOX_WIDTH : 0) + end[0]) / 2, ((edgeY + end[1]) / 2) - lift * 0.35];

    return {
      segments: [
        { start: start, control: firstControl, end: [edgeX, edgeY] },
        { start: [edgeX === 0 ? VIEWBOX_WIDTH : 0, edgeY], control: secondControl, end: end }
      ]
    };
  }

  function routePath(route) {
    return routeGeometry(route).segments.map(function (segment, index) {
      return (index ? ' M' : 'M') + segment.start[0].toFixed(1) + ',' + segment.start[1].toFixed(1) +
        ' Q' + segment.control[0].toFixed(1) + ',' + segment.control[1].toFixed(1) +
        ' ' + segment.end[0].toFixed(1) + ',' + segment.end[1].toFixed(1);
    }).join('');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function focusConfig() {
    var width = window.innerWidth || document.documentElement.clientWidth || VIEWBOX_WIDTH;
    if (width <= 640) {
      return { minWidth: 300, minHeight: 240, paddingX: 80, paddingY: 105, shiftX: 0 };
    }
    if (width <= 1100) {
      return { minWidth: 380, minHeight: 260, paddingX: 120, paddingY: 130, shiftX: 0 };
    }
    return { minWidth: 560, minHeight: 320, paddingX: 260, paddingY: 220, shiftX: VIEWBOX_FOCUS_SHIFT };
  }

  function renderedMapAspect() {
    if (!svg) return VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
    return rect.width / rect.height;
  }

  function focusViewBox(route) {
    var config = focusConfig();
    var points = [];
    routeGeometry(route).segments.forEach(function (segment) {
      points.push(segment.start, segment.control, segment.end);
    });
    var minX = Math.min.apply(null, points.map(function (point) { return point[0]; }));
    var maxX = Math.max.apply(null, points.map(function (point) { return point[0]; }));
    var minY = Math.min.apply(null, points.map(function (point) { return point[1]; }));
    var maxY = Math.max.apply(null, points.map(function (point) { return point[1]; }));
    var width = Math.max(config.minWidth, maxX - minX + config.paddingX);
    var height = Math.max(config.minHeight, maxY - minY + config.paddingY);
    var aspect = renderedMapAspect();

    if (width / height < aspect) width = height * aspect;
    else height = width / aspect;
    width = Math.min(VIEWBOX_WIDTH, width);
    height = Math.min(VIEWBOX_HEIGHT, height);

    var centerX = ((minX + maxX) / 2) - config.shiftX;
    var centerY = (minY + maxY) / 2;
    return {
      x: clamp(centerX - width / 2, 0, VIEWBOX_WIDTH - width),
      y: clamp(centerY - height / 2, 0, VIEWBOX_HEIGHT - height),
      width: width,
      height: height
    };
  }

  function viewBoxString(box) {
    return [box.x, box.y, box.width, box.height].map(function (value) { return value.toFixed(2); }).join(' ');
  }

  function animateViewBox(target) {
    if (!svg) return;
    if (viewBoxFrame) cancelAnimationFrame(viewBoxFrame);
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      currentViewBox = target;
      svg.setAttribute('viewBox', viewBoxString(target));
      return;
    }
    var start = currentViewBox;
    var startedAt = null;
    function tick(timestamp) {
      if (!startedAt) startedAt = timestamp;
      var progress = Math.min(1, (timestamp - startedAt) / 420);
      var eased = 1 - Math.pow(1 - progress, 3);
      currentViewBox = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        width: start.width + (target.width - start.width) * eased,
        height: start.height + (target.height - start.height) * eased
      };
      svg.setAttribute('viewBox', viewBoxString(currentViewBox));
      if (progress < 1) viewBoxFrame = requestAnimationFrame(tick);
      else viewBoxFrame = null;
    }
    viewBoxFrame = requestAnimationFrame(tick);
  }

  function restoreWorldView() {
    animateViewBox(DEFAULT_VIEWBOX);
  }

  function routeById(id) {
    return routes.find(function (route) { return route.id === id; });
  }

  function activeId() {
    return hoverId || selectedId;
  }

  function visibleRoutes() {
    var query = (routeSearch.value || '').trim().toLowerCase();
    var region = regionFilter.value || 'all';
    return routes.filter(function (route) {
      var matchesRegion = region === 'all' || route.region === region;
      var matchesQuery = !query || (route.to + ' ' + route.region + ' ' + route.code).toLowerCase().indexOf(query) !== -1;
      return matchesRegion && matchesQuery;
    });
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function openDialog(dialog, focusTarget, focusSelector) {
    if (!dialog) return;
    lastFocusTarget = focusTarget || document.activeElement;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    var focusable = dialog.querySelector(focusSelector || '[data-mileage-dialog-close]');
    if (focusable) setTimeout(function () { focusable.focus(); }, 40);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    var restoreTarget = lastFocusTarget;
    lastFocusTarget = null;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (restoreTarget && document.contains(restoreTarget)) {
      setTimeout(function () {
        if (document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') restoreTarget.focus();
      }, 40);
    }
  }

  function updatePopover(route, target) {
    if (!route || !target || !popover || !mapShell) return;
    var shellRect = mapShell.getBoundingClientRect();
    var targetRect = target.getBoundingClientRect();
    popoverTitle.textContent = route.city;
    popoverMeta.textContent = route.code + ', from ' + formatMiles(route.saver);
    popover.classList.remove('is-hidden');
    popover.setAttribute('aria-hidden', 'false');
    var left = targetRect.left - shellRect.left + targetRect.width / 2;
    var top = targetRect.top - shellRect.top - 14;
    var popoverWidth = popover.offsetWidth || 190;
    left = Math.max(12 + popoverWidth / 2, Math.min(shellRect.width - 12 - popoverWidth / 2, left));
    popover.style.left = left + 'px';
    popover.style.top = Math.max(12, top) + 'px';
  }

  function hidePopover() {
    if (popover) {
      popover.classList.add('is-hidden');
      popover.setAttribute('aria-hidden', 'true');
    }
  }

  function updateVisualState() {
    var current = activeId();
    [arcsLayer, nodesLayer].forEach(function (layer) {
      if (!layer) return;
      layer.querySelectorAll('[data-route-id]').forEach(function (element) {
        var isCurrent = current && element.getAttribute('data-route-id') === current;
        element.classList.toggle('is-active', Boolean(isCurrent));
        element.classList.toggle('is-dimmed', Boolean(current && !isCurrent));
      });
    });

    popularPills.forEach(function (pill) {
      var pillRoute = routeById('sin-' + pill.getAttribute('data-route-code').toLowerCase());
      var isCurrent = pillRoute && current === pillRoute.id;
      pill.classList.toggle('is-active', Boolean(isCurrent));
      pill.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });

    if (signalLayer) {
      signalLayer.innerHTML = '';
      if (selectedId) {
        var signal = createSvgElement('g', { class: 'mileage-route-plane', 'aria-hidden': 'true' });
        signal.appendChild(createSvgElement('path', {
          class: 'mileage-route-plane-shape',
          d: 'M0,-1.3 L3.3,-1.3 L6.4,-4.4 L7.4,-4.1 L5.1,-1.05 L10,0 L5.1,1.05 L7.4,4.1 L6.4,4.4 L3.3,1.3 L0,1.3 L1.4,0 Z'
        }));
        var motion = createSvgElement('animateMotion', { dur: '2.8s', repeatCount: 'indefinite', rotate: 'auto' });
        var pathRef = createSvgElement('mpath', {
          href: '#mileage-route-arc-' + selectedId,
          'xlink:href': '#mileage-route-arc-' + selectedId
        });
        motion.appendChild(pathRef);
        signal.appendChild(motion);
        signalLayer.appendChild(signal);
      }
    }
  }

  function selectRoute(route, focusTarget, shouldOpen, shouldFocusMap) {
    selectedId = route.id;
    routeState.selectedRouteId = route.id;
    hoverId = null;
    setStatus(route.city + ', ' + route.code + '. Saver award from ' + formatMiles(route.saver) + '.');
    hidePopover();
    if (window.SkyfareRouteDetails && typeof window.SkyfareRouteDetails.render === 'function') {
      window.SkyfareRouteDetails.render(route);
    }
    updateVisualState();
    if (shouldFocusMap) animateViewBox(focusViewBox(route));
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    if (shouldOpen) {
      if (browserDialog && browserDialog.open) closeDialog(browserDialog);
    }
  }

  function clearSelection() {
    selectedId = null;
    hoverId = null;
    routeState.selectedRouteId = null;
    if (window.SkyfareRouteDetails && typeof window.SkyfareRouteDetails.clear === 'function') {
      window.SkyfareRouteDetails.clear();
    }
    setStatus('Choose a destination to see its mileage starting point.');
    hidePopover();
    updateVisualState();
    restoreWorldView();
  }

  function previewRoute(route, target) {
    hoverId = route.id;
    updatePopover(route, target);
    updateVisualState();
  }

  function clearPreview() {
    hoverId = null;
    hidePopover();
    updateVisualState();
  }

  function bindRouteInteraction(element, route) {
    element.addEventListener('click', function () { selectRoute(route, element, true, true); });
    element.addEventListener('focus', function () {
      selectRoute(route, element, false);
      previewRoute(route, element);
    });
    element.addEventListener('blur', function () { clearPreview(); });
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRoute(route, element, true, true);
      }
      if (event.key === 'Escape') {
        clearPreview();
        element.blur();
      }
    });
    element.addEventListener('mouseenter', function () {
      if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) previewRoute(route, element);
    });
    element.addEventListener('mouseleave', function () {
      if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) clearPreview();
    });
  }

  function renderMapRoutes() {
    arcsLayer.innerHTML = '';
    nodesLayer.innerHTML = '';

    var originPoint = project(origin.latitude, origin.longitude);
    var originGroup = createSvgElement('g', { class: 'mileage-origin-marker' });
    originGroup.appendChild(createSvgElement('circle', { cx: originPoint[0], cy: originPoint[1], r: 10 }));
    originGroup.appendChild(createSvgElement('circle', { cx: originPoint[0], cy: originPoint[1], r: 4.5 }));
    var originLabel = createSvgElement('text', { x: originPoint[0] + 13, y: originPoint[1] - 11 });
    originLabel.textContent = 'SIN';
    originGroup.appendChild(originLabel);
    nodesLayer.appendChild(originGroup);

    routes.forEach(function (route) {
      var point = project(route.latitude, route.longitude);
      var path = createSvgElement('path', {
        id: 'mileage-route-arc-' + route.id,
        class: 'mileage-route-arc' + (FEATURED_ROUTE_CODES[route.code] ? ' is-featured' : ''),
        d: routePath(route),
        'marker-end': 'url(#mileage-route-arrow)',
        'data-route-id': route.id,
        'data-route-part': 'arc',
        pathLength: '1',
        tabindex: '0',
        role: 'button',
        'aria-controls': 'mileage-route-details-card',
        'aria-label': 'Route from Singapore to ' + route.city + ', ' + route.code + ', from ' + formatMiles(route.saver)
      });
      arcsLayer.appendChild(path);
      bindRouteInteraction(path, route);

      var group = createSvgElement('g', {
        class: 'mileage-route-node-group' + (FEATURED_ROUTE_CODES[route.code] ? ' is-featured' : ''),
        'data-route-id': route.id,
        tabindex: '0',
        role: 'button',
        'aria-controls': 'mileage-route-details-card',
        'aria-label': route.city + ', ' + route.code + ', from ' + formatMiles(route.saver)
      });
      group.appendChild(createSvgElement('circle', { class: 'mileage-node-hit', cx: point[0], cy: point[1], r: 13 }));
      group.appendChild(createSvgElement('circle', { class: 'mileage-route-node', cx: point[0], cy: point[1], r: 3.2 }));
      var label = createSvgElement('text', { class: 'mileage-route-node-label', x: point[0] + 7, y: point[1] - 6 });
      label.textContent = formatCompactMiles(route.saver);
      group.appendChild(label);
      nodesLayer.appendChild(group);
      bindRouteInteraction(group, route);
    });
    updateVisualState();
  }

  function renderRouteList(rows) {
    routeList.innerHTML = '';
    rows.forEach(function (route) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'mileage-route-list-item';
      button.setAttribute('data-route-id', route.id);
      button.setAttribute('aria-controls', 'mileage-route-details-card');
      button.innerHTML = '<span><strong>' + route.city + '</strong><small>' + route.code + ', ' + route.region + '</small></span><b>' + formatCompactMiles(route.saver) + '</b>';
      button.addEventListener('click', function () { selectRoute(route, button, true, true); });
      routeList.appendChild(button);
    });
  }

  function updateFilters() {
    var rows = visibleRoutes();
    routeCount.textContent = rows.length + (rows.length === 1 ? ' destination shown' : ' destinations shown');
    if (browseCount) browseCount.textContent = rows.length + (rows.length === 1 ? ' destination' : ' destinations');
    if (browserResultsCount) browserResultsCount.textContent = rows.length + (rows.length === 1 ? ' destination' : ' destinations');
    if (rows.length) {
      routeRange.textContent = formatMiles(Math.min.apply(null, rows.map(function (route) { return route.saver; }))) + ' to ' + formatMiles(Math.max.apply(null, rows.map(function (route) { return route.saver; })));
    } else {
      routeRange.textContent = 'No saver awards';
    }
    renderRouteList(rows);
    var visibleIds = new Set(rows.map(function (route) { return route.id; }));
    root.querySelectorAll('[data-route-id]').forEach(function (element) {
      if (element.closest('#mileage-route-list')) return;
      element.classList.toggle('is-filtered', !visibleIds.has(element.getAttribute('data-route-id')));
    });
    if (selectedId && !visibleIds.has(selectedId)) {
      clearSelection();
    }
    updateVisualState();
  }

  function loadWorldMap() {
        fetch(root.getAttribute('data-map-asset') || 'images/world-map-outline.svg', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('World map asset unavailable');
        return response.text();
      })
      .then(function (markup) {
        var parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
        var sourcePath = parsed.querySelector('#world-land');
        if (!sourcePath) throw new Error('World map path unavailable');
        landPath.setAttribute('d', sourcePath.getAttribute('d'));
        root.classList.add('is-map-loaded');
      })
      .catch(function () {
        setStatus('Map outline unavailable. The route list below remains available.');
        root.classList.add('is-map-fallback');
      });
  }

  function initialize() {
    if (mapInitialized) return;
    mapInitialized = true;
    renderMapRoutes();
    renderRouteList(routes);
    routeCount.textContent = routes.length + ' destinations shown';
    if (browseCount) browseCount.textContent = routes.length + ' destinations';
    if (browserResultsCount) browserResultsCount.textContent = routes.length + ' destinations';
    routeRange.textContent = formatMiles(Math.min.apply(null, routes.map(function (route) { return route.saver; }))) + ' to ' + formatMiles(Math.max.apply(null, routes.map(function (route) { return route.saver; })));
    setStatus('Choose a destination to see its mileage starting point.');
    loadWorldMap();
    if (routeState.pendingMapRouteId) {
      var pendingRoute = routeById(routeState.pendingMapRouteId);
      routeState.pendingMapRouteId = null;
      if (pendingRoute) selectRoute(pendingRoute, null, false, true);
    } else if (routeState.selectedRouteId) {
      var selectedRoute = routeById(routeState.selectedRouteId);
      if (selectedRoute) selectRoute(selectedRoute, null, false, true);
    }
  }

  popularPills.forEach(function (pill) {
    var route = routes.find(function (candidate) { return candidate.code === pill.getAttribute('data-route-code'); });
    if (!route) return;
    var pillMiles = pill.querySelector('small');
    if (pillMiles) pillMiles.textContent = formatCompactMiles(route.saver);
    pill.setAttribute('aria-label', 'Explore Singapore to ' + route.city + ', from ' + formatMiles(route.saver));
    pill.addEventListener('click', function () {
      if (!mapInitialized) initialize();
      if (routeSearch.value || regionFilter.value !== 'all') {
        routeSearch.value = '';
        regionFilter.value = 'all';
        updateFilters();
      }
      selectRoute(route, pill, true, true);
    });
  });

  if (browseTrigger) {
    browseTrigger.addEventListener('click', function () {
      if (!mapInitialized) initialize();
      openDialog(browserDialog, browseTrigger, '#mileage-route-search');
    });
  }

  root.querySelectorAll('[data-mileage-dialog-close]').forEach(function (button) {
    button.addEventListener('click', function () { closeDialog(button.closest('dialog')); });
  });

  if (browserDialog) {
    browserDialog.addEventListener('click', function (event) {
      if (event.target === browserDialog) closeDialog(browserDialog);
    });
    browserDialog.addEventListener('close', function () {
      var restoreTarget = lastFocusTarget;
      lastFocusTarget = null;
      if (restoreTarget && document.contains(restoreTarget)) {
        setTimeout(function () {
          if (document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') restoreTarget.focus();
        }, 40);
      }
    });
  }

  routeSearch.addEventListener('input', updateFilters);
  regionFilter.addEventListener('change', updateFilters);
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (!selectedId) return;
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var route = routeById(selectedId);
      if (route) animateViewBox(focusViewBox(route));
    }, 120);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') clearPreview();
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        initialize();
        observer.disconnect();
      }
    }, { rootMargin: '280px 0px' });
    observer.observe(root);
  } else {
    initialize();
  }

  window.SkyfareMileageRouteExplorer = {
    revealRoute: function (routeId) {
      var route = routeById(routeId);
      if (!route) return;
      routeState.pendingMapRouteId = route.id;
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      root.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      if (!mapInitialized) initialize();
      if (routeSearch.value || regionFilter.value !== 'all') {
        routeSearch.value = '';
        regionFilter.value = 'all';
        updateFilters();
      }
      routeState.pendingMapRouteId = null;
      selectRoute(route, null, false, true);
      var pill = root.querySelector('[data-route-code="' + route.code + '"]');
      if (pill) pill.classList.add('is-map-target');
      window.setTimeout(function () {
        if (pill) pill.classList.remove('is-map-target');
      }, 900);
    },
    clearSelection: clearSelection
  };
}());
