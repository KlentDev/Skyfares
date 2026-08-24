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
  var cardWhatsapp = document.getElementById('mileage-route-card-wa');
  var cardCompare = document.getElementById('mileage-route-card-compare');
  var cardClose = document.getElementById('mileage-route-card-close');
  var activeRoute = null;

  var flags = {
    BWN:'cambodia.png', DPS:'indonesia.png', CGK:'indonesia.png', KUL:'malaysia.png', BKK:'thailand.png', CEB:'philippines.png', DAD:'vietnam.png',
    HAN:'vietnam.png', SGN:'vietnam.png', MNL:'philippines.png', PNH:'cambodia.png', HKT:'thailand.png', RGN:'myanmar.png',
    CTU:'china.png', CKG:'china.png', CAN:'china.png', HKG:'hong-kong.png', TPE:'taiwan.png', PEK:'china.png', PVG:'china.png',
    AMD:'india.png', BLR:'india.png', MAA:'india.png', COK:'india.png', CMB:'sri-lanka.png', DEL:'india.png', DAC:'bangladesh.png',
    HYD:'india.png', KTM:'nepal.png', CCU:'india.png', MLE:'maldives.png', BOM:'india.png',
    PUS:'south-korea.png', FUK:'japan.png', KIX:'japan.png', ICN:'south-korea.png', 'NRT/HND':'japan.png',
    DRW:'australia.png', PER:'australia.png', ADL:'australia.png', AKL:'new-zealand.png', BNE:'australia.png', CNS:'australia.png', CHC:'new-zealand.png',
    MEL:'australia.png', SYD:'australia.png', CPT:'south-africa.png', DXB:'united-arab-emirates.png', IST:'turkey.png', JNB:'south-africa.png',
    AMS:'netherlands.png', BCN:'spain.png', BRU:'belgium.png', CPH:'denmark.png', FRA:'germany.png', LHR:'united-kingdom.png', MAN:'united-kingdom.png',
    MXP:'italy.png', MUC:'germany.png', CDG:'france.png', FCO:'italy.png', ZRH:'switzerland.png',
    LAX:'united-states.png', SFO:'united-states.png', SEA:'united-states.png', IAH:'united-states.png', JFK:'united-states.png'
  };

  var cabinCompareRoutes = {
    LHR:1, CDG:1, FRA:1, ZRH:1, AMS:1, FCO:1, MXP:1, IST:1, BCN:1,
    JFK:1, EWR:1, LAX:1, SFO:1, SEA:1, SYD:1, MEL:1, BNE:1, PER:1, AKL:1,
    NRT:1, HND:1, ICN:1, HKG:1, TPE:1, PVG:1, PEK:1, DEL:1, BOM:1, CMB:1,
    BKK:1, CGK:1, DPS:1, MNL:1, SGN:1, HAN:1, KUL:1, DXB:1, DOH:1, JNB:1
  };

  function flagImage(file) {
    return file ? '<img src="' + assetPrefix + 'logos/flags/' + file + '" alt="" class="inline-block w-4 h-4 rounded-full object-cover align-[-3px] mx-0.5">' : '';
  }

  function flagFor(destination) {
    var match = /\(([^)]+)\)/.exec(destination || '');
    return flagImage(match && flags[match[1]]);
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
    cardTitle.innerHTML = origin.code + ' ' + flagImage('singapore.png') + ' → ' + flagFor(route.to) + ' ' + route.to;
    cardRegion.textContent = route.region + ', ' + (route.cabin || 'Business Class');
    cardSaver.textContent = Number(route.saver).toLocaleString();
    cardAdvantage.textContent = Number(route.advantage).toLocaleString();
    if (route.imageKey) cardImage.src = assetPrefix + 'images/' + route.imageKey;
    else cardImage.removeAttribute('src');
    cardImage.alt = route.to || route.city || 'Destination';
    cardWhatsapp.href = 'https://api.whatsapp.com/send?phone=6581575306&text=' + encodeURIComponent(
      'Hi Skyfare, I\'d like to enquire about ' + origin.city + ' → ' + route.to + ' in ' + (route.cabin || 'Business Class') + '.'
    );

    var code = destinationCode(route);
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
