/*
 * Shared route-detail presenter.
 *
 * The in-map route card is the single presentation surface for Hero search,
 * map routes, Popular Routes pills, and the browse directory.
 */
(function (window, document) {
  'use strict';

  var card = document.getElementById('mileage-route-details-card');
  if (!card) return;

  var source = window.SKYFARE_MILEAGE_ROUTES || { origin: { city: 'Singapore', code: 'SIN' }, routes: [] };
  var origin = source.origin;
  var assetPrefix = (document.body && document.body.getAttribute('data-site-prefix')) || '';
  var content = card.querySelector('.mileage-route-card-content');
  var emptyState = card.querySelector('.mileage-route-card-empty');
  var cardImage = document.getElementById('mileage-route-card-image');
  var cardTitle = document.getElementById('mileage-route-card-title');
  var cardRegion = document.getElementById('mileage-route-card-region');
  var cardSaver = document.getElementById('mileage-route-card-saver');
  var cardAdvantage = document.getElementById('mileage-route-card-advantage');
  var cardReturn = document.getElementById('mileage-route-card-return');
  var cardWhatsapp = document.getElementById('mileage-route-card-wa');
  var cardCompare = document.getElementById('mileage-route-card-compare');
  var cardNotes = document.getElementById('mileage-route-card-notes');
  var cardClose = document.getElementById('mileage-route-card-close');
  var activeRoute = null;

  var flags = {
    BWN:'cambodia.png', DPS:'indonesia.png', CGK:'indonesia.png', KUL:'malaysia.png', BKK:'thailand.png', CEB:'philippines.png', DAD:'vietnam.png',
    HAN:'vietnam.png', SGN:'vietnam.png', MNL:'philippines.png', PNH:'cambodia.png', HKT:'thailand.png', RGN:'myanmar.png',
    CTU:'china.png', CKG:'china.png', CAN:'china.png', HKG:'hong-kong.png', SZX:'china.png', TPE:'taiwan.png', PEK:'china.png', PVG:'china.png', PKX:'china.png', XMN:'china.png',
    AMD:'india.png', BLR:'india.png', MAA:'india.png', COK:'india.png', CMB:'sri-lanka.png', DEL:'india.png', DAC:'bangladesh.png',
    HYD:'india.png', KTM:'nepal.png', CCU:'india.png', MLE:'maldives.png', BOM:'india.png',
    PUS:'south-korea.png', FUK:'japan.png', KIX:'japan.png', ICN:'south-korea.png', NRT:'japan.png', HND:'japan.png', NGO:'japan.png',
    DRW:'australia.png', PER:'australia.png', ADL:'australia.png', AKL:'new-zealand.png', BNE:'australia.png', CNS:'australia.png', CHC:'new-zealand.png',
    MEL:'australia.png', SYD:'australia.png', CPT:'south-africa.png', DXB:'united-arab-emirates.png', IST:'turkey.png', JNB:'south-africa.png',
    AMS:'netherlands.png', BCN:'spain.png', BRU:'belgium.png', CPH:'denmark.png', FRA:'germany.png', LHR:'united-kingdom.png', LGW:'united-kingdom.png', MAN:'united-kingdom.png',
    MXP:'italy.png', MUC:'germany.png', CDG:'france.png', FCO:'italy.png', ZRH:'switzerland.png',
    LAX:'united-states.png', SFO:'united-states.png', SEA:'united-states.png', IAH:'united-states.png', JFK:'united-states.png', EWR:'united-states.png',
    PEN:'malaysia.png', SUB:'indonesia.png', SAI:'cambodia.png'
  };

  // Which routes get a "Compare cabins" link -- fetched live from the same
  // Cabin Compare endpoint the comparison page itself uses, instead of a
  // hardcoded code list that would silently drift out of sync with Airtable
  // (the same class of bug already fixed twice elsewhere this session: the
  // region taxonomy and the IATA-code-from-parentheses parsing).
  var WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var cabinCompareRoutes = {};
  fetch(WORKER_URL + '/airtable/cabin-compare')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (data) {
      cabinCompareRoutes = Object.keys(data.routes || {}).reduce(function (acc, code) {
        acc[code] = 1;
        return acc;
      }, {});
      // A route may already be selected (e.g. via deep link) by the time this
      // resolves -- refresh its "Compare cabins" link now that we know.
      if (activeRoute) setRoute(activeRoute);
    })
    .catch(function () {}); // link just stays hidden -- graceful, not broken

  function flagImage(file) {
    return file ? '<img src="' + assetPrefix + 'logos/flags/' + file + '" alt="" class="inline-block w-4 h-4 rounded-full object-cover align-[-3px] mx-0.5">' : '';
  }

  function flagFor(code) {
    return flagImage(flags[code]);
  }

  function destinationCode(route) {
    return route.code || ((/\(([^)]+)\)/.exec(route.to || '') || [])[1] || '');
  }

  function setRoute(route) {
    if (!route) return;
    activeRoute = route;
    var state = window.SKYFARE_ROUTE_STATE || (window.SKYFARE_ROUTE_STATE = {});
    state.selectedRouteId = route.id;
    card.classList.remove('is-empty');
    card.classList.add('is-selected');
    emptyState.hidden = true;
    content.hidden = false;
    var code = destinationCode(route);
    cardTitle.innerHTML = origin.code + ' ' + flagImage('singapore.png') + ' → ' + flagFor(code) + ' ' + route.to;
    cardRegion.textContent = route.region + (route.country ? ' · ' + route.country : '') + ', ' + (route.cabin || 'Business Class');
    cardSaver.textContent = Number(route.saver).toLocaleString();
    cardAdvantage.textContent = Number(route.advantage).toLocaleString();
    if (cardReturn) {
      if (route.saverReturn && route.advantageReturn) {
        cardReturn.textContent = 'Return: ' + Number(route.saverReturn).toLocaleString() + ' Saver · ' + Number(route.advantageReturn).toLocaleString() + ' Advantage miles';
        cardReturn.hidden = false;
      } else {
        cardReturn.hidden = true;
      }
    }
    if (route.imageKey) cardImage.src = assetPrefix + 'images/' + route.imageKey;
    else cardImage.removeAttribute('src');
    cardImage.alt = route.to || route.city || 'Destination';
    cardWhatsapp.href = 'https://api.whatsapp.com/send?phone=6581575306&text=' + encodeURIComponent(
      'Hi Skyfare, I\'d like to enquire about ' + origin.city + ' → ' + route.to + ' in ' + (route.cabin || 'Business Class') + '.'
    );
    if (cardNotes) {
      if (route.notes) { cardNotes.textContent = route.notes; cardNotes.hidden = false; }
      else cardNotes.hidden = true;
    }

    if (cabinCompareRoutes[code]) {
      cardCompare.href = (assetPrefix ? 'cabin-compare.html?route=' : 'pages/cabin-compare.html?route=') + code;
      cardCompare.hidden = false;
    } else {
      cardCompare.hidden = true;
    }
  }

  function clear() {
    activeRoute = null;
    var state = window.SKYFARE_ROUTE_STATE || (window.SKYFARE_ROUTE_STATE = {});
    state.selectedRouteId = null;
    card.classList.remove('is-selected');
    card.classList.add('is-empty');
    emptyState.hidden = false;
    content.hidden = true;
  }

  cardClose.addEventListener('click', function () {
    if (window.SkyfareMileageRouteExplorer && typeof window.SkyfareMileageRouteExplorer.clearSelection === 'function') {
      window.SkyfareMileageRouteExplorer.clearSelection();
    } else {
      clear();
    }
  });

  var api = {
    show: function (route, options) {
      if (!route) return;
      options = options || {};
      if (options.source === 'hero' && window.SkyfareMileageRouteExplorer && typeof window.SkyfareMileageRouteExplorer.revealRoute === 'function') {
        window.SkyfareMileageRouteExplorer.revealRoute(route.id, { focusTarget: options.focusTarget });
        return;
      }
      setRoute(route);
    },
    render: setRoute,
    clear: clear,
    getActiveRoute: function () { return activeRoute; }
  };

  api.open = api.show;
  window.SkyfareRouteDetails = api;
  window.SkyfareRouteModal = api;
}(window, document));
