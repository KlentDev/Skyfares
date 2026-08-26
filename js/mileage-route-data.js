/*
 * Shared source of truth for the KrisFlyer Mileage Route Board and the
 * homepage Mileage Route Explorer. Fetches live route/mileage data from the
 * Skyfare Routes Airtable table via the Worker (see
 * cloudflare/services/airtable.js#handleGetSkyfareRoutes). Coordinates and
 * destination photos are presentation-only local lookups with no Airtable
 * equivalent -- IATA Code, however, IS an Airtable field (added 2026-08-26),
 * since the Destination field's parenthetical suffix is often an
 * airport/terminal name ("Heathrow", "Capital"), not a reliable code.
 *
 * Consumers must not read window.SKYFARE_MILEAGE_ROUTES directly at parse
 * time -- the fetch is async. Use window.SkyfareMileageRoutesData.onReady(fn)
 * instead; it calls back immediately if data has already arrived, or waits
 * for the 'skyfare:mileage-routes-ready' event otherwise.
 */
(function (window) {
  'use strict';

  var WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var READY_EVENT = 'skyfare:mileage-routes-ready';

  var origin = {
    city: 'Singapore',
    code: 'SIN',
    latitude: 1.3644,
    longitude: 103.9915
  };

  // Map-pin coordinates by IATA code -- presentation-only, no Airtable field.
  var coordinates = {
    BWN: [4.9442, 114.9283], DPS: [-8.7482, 115.1672], CGK: [-6.1256, 106.6559], KUL: [2.7456, 101.7099],
    BKK: [13.6900, 100.7501], CEB: [10.3075, 123.9794], DAD: [16.0439, 108.1994], HAN: [21.2212, 105.8072],
    SGN: [10.8188, 106.6519], MNL: [14.5086, 121.0198], PNH: [11.5466, 104.8447], HKT: [8.1132, 98.3169],
    RGN: [16.9073, 96.1332], CTU: [30.5785, 103.9470], CKG: [29.7192, 106.6419], CAN: [23.3924, 113.2988],
    HKG: [22.3080, 113.9185], SZX: [22.6393, 113.8107], TPE: [25.0797, 121.2342], PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083],
    AMD: [23.0772, 72.6347], BLR: [13.1986, 77.7066], MAA: [12.9941, 80.1709], COK: [10.1520, 76.4019],
    CMB: [7.1808, 79.8841], DEL: [28.5562, 77.1000], DAC: [23.8433, 90.3978], HYD: [17.2403, 78.4294],
    KTM: [27.6966, 85.3591], CCU: [22.6547, 88.4467], MLE: [4.1918, 73.5291], BOM: [19.0896, 72.8656],
    PUS: [35.1796, 128.9382], FUK: [33.5859, 130.4507], KIX: [34.4347, 135.2440], ICN: [37.4602, 126.4407],
    NRT: [35.7647, 140.3864], HND: [35.5494, 139.7798],
    DRW: [-12.4140, 130.8760], PER: [-31.9403, 115.9672], ADL: [-34.9450, 138.5306],
    AKL: [-37.0082, 174.7850], BNE: [-27.3842, 153.1175], CNS: [-16.8858, 145.7553], CHC: [-43.4894, 172.5320],
    MEL: [-37.6733, 144.8430], SYD: [-33.9399, 151.1753], CPT: [-33.9715, 18.6021], DXB: [25.2532, 55.3657],
    IST: [41.2753, 28.7519], JNB: [-26.1367, 28.2411], AMS: [52.3105, 4.7683], BCN: [41.2971, 2.0785],
    BRU: [50.9014, 4.4844], CPH: [55.6180, 12.6508], FRA: [50.0379, 8.5622], LHR: [51.4700, -0.4543],
    LGW: [51.1481, -0.1903], MAN: [53.3537, -2.2750], MXP: [45.6300, 8.7231], MUC: [48.3538, 11.7861],
    CDG: [49.0097, 2.5479], FCO: [41.8003, 12.2389], ZRH: [47.4581, 8.5555], LAX: [33.9416, -118.4085],
    SFO: [37.6213, -122.3790], SEA: [47.4502, -122.3088], IAH: [29.9902, -95.3368], JFK: [40.6413, -73.7781],
    EWR: [40.6895, -74.1745], PEN: [5.2971, 100.2769], SUB: [-7.3798, 112.7869], SAI: [13.4104, 103.8130],
    XMN: [24.5440, 118.1277], PKX: [39.5098, 116.4105], NGO: [34.8584, 136.8054]
  };

  // Destination photos by IATA code -- presentation-only, no Airtable field.
  // Destinations without an entry fall back to FALLBACK_IMAGE_KEY at render.
  var IMAGE_KEYS = {
    BWN: 'destinations/brunei.jpg', DPS: 'destinations/bali.jpg', CGK: 'destinations/jakarta.jpg',
    KUL: 'destinations/kuala-lumpur.jpg', BKK: 'destinations/bangkok.jpg', CEB: 'destinations/cebu.jpg',
    DAD: 'destinations/da-nang.jpg', HAN: 'destinations/hanoi.jpg', SGN: 'destinations/ho-chi-minh.jpg',
    MNL: 'destinations/manila.jpg', PNH: 'destinations/phnom-penh.jpg', HKT: 'destinations/phuket.jpg',
    RGN: 'destinations/yangon.jpg', CTU: 'destinations/chengdu.jpg', CKG: 'destinations/chongqing.jpg',
    CAN: 'destinations/guangzhou.jpg', HKG: 'destinations/hong-kong.jpg', TPE: 'destinations/taipei.jpg',
    PEK: 'destinations/beijing.jpg', PVG: 'destinations/shanghai.jpg', AMD: 'destinations/ahmedabad.jpg',
    BLR: 'destinations/bengaluru.jpg', MAA: 'destinations/chennai.jpg', COK: 'destinations/cochin.jpg',
    CMB: 'destinations/colombo.png', DEL: 'destinations/delhi.jpg', DAC: 'destinations/dhaka.jpg',
    HYD: 'destinations/hyderabad.png', KTM: 'destinations/kathmandu.jpg', CCU: 'destinations/kolkata.jpg',
    MLE: 'destinations/maldives.jpg', BOM: 'destinations/mumbai.jpg', PUS: 'destinations/busan.jpg',
    FUK: 'destinations/fukuoka.jpg', KIX: 'destinations/osaka.jpg', ICN: 'destinations/seoul.jpg',
    NRT: 'destinations/tokyo.jpg', HND: 'destinations/tokyo.jpg',
    DRW: 'destinations/darwin.jpg', PER: 'destinations/perth.jpg', ADL: 'destinations/adelaide.jpg',
    AKL: 'destinations/auckland.jpg', BNE: 'destinations/brisbane.jpg', CNS: 'destinations/cairns.jpg',
    CHC: 'destinations/christchurch.jpg', MEL: 'routes-images/melbourne.jpg', SYD: 'destinations/sydney.jpg',
    CPT: 'destinations/cape-town.jpg', DXB: 'routes-images/dubai.jpg', IST: 'destinations/istanbul.jpg',
    JNB: 'destinations/johannesburg.jpg', AMS: 'destinations/amsterdam.png', BCN: 'destinations/barcelona.jpg',
    BRU: 'destinations/brussels.jpg', CPH: 'destinations/copenhagen.jpg', FRA: 'destinations/frankfurt.jpg',
    LHR: 'routes-images/london.jpg', LGW: 'routes-images/london.jpg', MAN: 'destinations/manchester.jpg',
    MXP: 'destinations/milan.jpg', MUC: 'destinations/munich.jpg', CDG: 'routes-images/paris.jpg',
    FCO: 'destinations/rome.jpg', ZRH: 'destinations/zurich.jpg', LAX: 'routes-images/los-angeles.jpg',
    SFO: 'destinations/san-francisco.jpg', SEA: 'destinations/seattle.jpg', IAH: 'destinations/houston.jpg',
    JFK: 'routes-images/new-york.jpg', EWR: 'routes-images/new-york.jpg'
  };
  var FALLBACK_IMAGE_KEY = 'page-images/our-flights.jpg';

  function destinationCity(destination) {
    var match = /^(.+?) \(([^)]+)\)$/.exec(destination || '');
    return match ? match[1] : (destination || '');
  }

  function transform(records) {
    var missingCoordinates = [];
    var missingImages = [];
    var routes = records.map(function (rec) {
      var code = (rec.iataCode || '').toUpperCase();
      var point = code ? coordinates[code] : null;
      if (code && !point) missingCoordinates.push(code);
      var imageKey = code ? IMAGE_KEYS[code] : null;
      if (code && !imageKey) missingImages.push(code);
      return {
        id: 'sin-' + (code || destinationCity(rec.destination)).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        to: rec.destination,
        city: destinationCity(rec.destination),
        code: code,
        region: rec.region,
        country: rec.country,
        krisFlyerZone: rec.krisFlyerZone,
        notes: rec.notes,
        latitude: point ? point[0] : null,
        longitude: point ? point[1] : null,
        saver: rec.saverOneWay,
        advantage: rec.advantageOneWay,
        saverReturn: rec.saverReturn,
        advantageReturn: rec.advantageReturn,
        cabin: 'Business Class',
        airline: null,
        imageKey: imageKey || FALLBACK_IMAGE_KEY
      };
    }).filter(function (route) { return route.saver; }); // a route with no Saver figure can't render the widget's core stat

    if ((missingCoordinates.length || missingImages.length) && window.console && console.warn) {
      if (missingCoordinates.length) console.warn('Mileage route data: no local coordinates for', missingCoordinates.join(', '), '-- these routes will show in lists/table but not on the map.');
      if (missingImages.length) console.warn('Mileage route data: no local image for', missingImages.join(', '), '-- using fallback photo.');
    }
    return routes;
  }

  function publish(routes) {
    window.SKYFARE_MILEAGE_ROUTES = Object.freeze({
      origin: Object.freeze(origin),
      routes: Object.freeze(routes),
      regions: Object.freeze(Array.from(new Set(routes.map(function (route) { return route.region; }))).sort())
    });
    window.SKYFARE_MILEAGE_ROUTES_READY = true;
    window.dispatchEvent(new CustomEvent(READY_EVENT));
  }

  window.SkyfareMileageRoutesData = {
    onReady: function (callback) {
      if (window.SKYFARE_MILEAGE_ROUTES_READY) { callback(window.SKYFARE_MILEAGE_ROUTES); return; }
      window.addEventListener(READY_EVENT, function handler() {
        window.removeEventListener(READY_EVENT, handler);
        callback(window.SKYFARE_MILEAGE_ROUTES);
      });
    }
  };

  fetch(WORKER_URL + '/airtable/skyfare-routes')
    .then(function (response) {
      if (!response.ok) throw new Error('Skyfare Routes unavailable');
      return response.json();
    })
    .then(function (data) {
      publish(transform(data.routes || []));
    })
    .catch(function () {
      publish([]);
    });
}(window));
