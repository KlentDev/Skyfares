/*
 * Shared source of truth for the KrisFlyer Mileage Route Board and the
 * homepage Mileage Route Explorer. The award values below are intentionally
 * kept in the same shape as the board data; coordinates are presentation
 * metadata used only by the map.
 */
(function (window) {
  'use strict';

  var origin = {
    city: 'Singapore',
    code: 'SIN',
    latitude: 1.3644,
    longitude: 103.9915
  };

  var coordinates = {
    BWN: [4.9442, 114.9283], DPS: [-8.7482, 115.1672], CGK: [-6.1256, 106.6559], KUL: [2.7456, 101.7099],
    BKK: [13.6900, 100.7501], CEB: [10.3075, 123.9794], DAD: [16.0439, 108.1994], HAN: [21.2212, 105.8072],
    SGN: [10.8188, 106.6519], MNL: [14.5086, 121.0198], PNH: [11.5466, 104.8447], HKT: [8.1132, 98.3169],
    RGN: [16.9073, 96.1332], CTU: [30.5785, 103.9470], CKG: [29.7192, 106.6419], CAN: [23.3924, 113.2988],
    HKG: [22.3080, 113.9185], TPE: [25.0797, 121.2342], PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083],
    AMD: [23.0772, 72.6347], BLR: [13.1986, 77.7066], MAA: [12.9941, 80.1709], COK: [10.1520, 76.4019],
    CMB: [7.1808, 79.8841], DEL: [28.5562, 77.1000], DAC: [23.8433, 90.3978], HYD: [17.2403, 78.4294],
    KTM: [27.6966, 85.3591], CCU: [22.6547, 88.4467], MLE: [4.1918, 73.5291], BOM: [19.0896, 72.8656],
    PUS: [35.1796, 128.9382], FUK: [33.5859, 130.4507], KIX: [34.4347, 135.2440], ICN: [37.4602, 126.4407],
    'NRT/HND': [35.6762, 139.6503], DRW: [-12.4140, 130.8760], PER: [-31.9403, 115.9672], ADL: [-34.9450, 138.5306],
    AKL: [-37.0082, 174.7850], BNE: [-27.3842, 153.1175], CNS: [-16.8858, 145.7553], CHC: [-43.4894, 172.5320],
    MEL: [-37.6733, 144.8430], SYD: [-33.9399, 151.1753], CPT: [-33.9715, 18.6021], DXB: [25.2532, 55.3657],
    IST: [41.2753, 28.7519], JNB: [-26.1367, 28.2411], AMS: [52.3105, 4.7683], BCN: [41.2971, 2.0785],
    BRU: [50.9014, 4.4844], CPH: [55.6180, 12.6508], FRA: [50.0379, 8.5622], LHR: [51.4700, -0.4543],
    MAN: [53.3537, -2.2750], MXP: [45.6300, 8.7231], MUC: [48.3538, 11.7861], CDG: [49.0097, 2.5479],
    FCO: [41.8003, 12.2389], ZRH: [47.4581, 8.5555], LAX: [33.9416, -118.4085], SFO: [37.6213, -122.3790],
    SEA: [47.4502, -122.3088], IAH: [29.9902, -95.3368], JFK: [40.6413, -73.7781]
  };

  var rawRoutes = [
    { to: 'Brunei (BWN)', region: 'SE Asia', saver: 22000, advantage: 33000, imageKey: 'destinations/brunei.jpg' },
    { to: 'Denpasar / Bali (DPS)', region: 'SE Asia', saver: 22000, advantage: 33000, imageKey: 'destinations/bali.jpg' },
    { to: 'Jakarta (CGK)', region: 'SE Asia', saver: 22000, advantage: 33000, imageKey: 'destinations/jakarta.jpg' },
    { to: 'Kuala Lumpur (KUL)', region: 'SE Asia', saver: 22000, advantage: 33000, imageKey: 'destinations/kuala-lumpur.jpg' },
    { to: 'Bangkok (BKK)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/bangkok.jpg' },
    { to: 'Cebu (CEB)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/cebu.jpg' },
    { to: 'Da Nang (DAD)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/da-nang.jpg' },
    { to: 'Hanoi (HAN)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/hanoi.jpg' },
    { to: 'Ho Chi Minh (SGN)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/ho-chi-minh.jpg' },
    { to: 'Manila (MNL)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/manila.jpg' },
    { to: 'Phnom Penh (PNH)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/phnom-penh.jpg' },
    { to: 'Phuket (HKT)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/phuket.jpg' },
    { to: 'Yangon (RGN)', region: 'SE Asia', saver: 25000, advantage: 37000, imageKey: 'destinations/yangon.jpg' },
    { to: 'Chengdu (CTU)', region: 'NE Asia', saver: 35500, advantage: 53000, imageKey: 'destinations/chengdu.jpg' },
    { to: 'Chongqing (CKG)', region: 'NE Asia', saver: 35500, advantage: 53000, imageKey: 'destinations/chongqing.jpg' },
    { to: 'Guangzhou (CAN)', region: 'NE Asia', saver: 35500, advantage: 53000, imageKey: 'destinations/guangzhou.jpg' },
    { to: 'Hong Kong (HKG)', region: 'NE Asia', saver: 35500, advantage: 53000, imageKey: 'destinations/hong-kong.jpg' },
    { to: 'Taipei (TPE)', region: 'NE Asia', saver: 35500, advantage: 53000, imageKey: 'destinations/taipei.jpg' },
    { to: 'Beijing (PEK)', region: 'NE Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/beijing.jpg' },
    { to: 'Shanghai (PVG)', region: 'NE Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/shanghai.jpg' },
    { to: 'Ahmedabad (AMD)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/ahmedabad.jpg' },
    { to: 'Bengaluru (BLR)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/bengaluru.jpg' },
    { to: 'Chennai (MAA)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/chennai.jpg' },
    { to: 'Cochin (COK)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/cochin.jpg' },
    { to: 'Colombo (CMB)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/colombo.png' },
    { to: 'Delhi (DEL)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/delhi.jpg' },
    { to: 'Dhaka (DAC)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/dhaka.jpg' },
    { to: 'Hyderabad (HYD)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/hyderabad.png' },
    { to: 'Kathmandu (KTM)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/kathmandu.jpg' },
    { to: 'Kolkata (CCU)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/kolkata.jpg' },
    { to: 'Male / Maldives (MLE)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/maldives.jpg' },
    { to: 'Mumbai (BOM)', region: 'South Asia', saver: 45000, advantage: 67500, imageKey: 'destinations/mumbai.jpg' },
    { to: 'Busan (PUS)', region: 'Japan/Korea', saver: 54500, advantage: 82000, imageKey: 'destinations/busan.jpg' },
    { to: 'Fukuoka (FUK)', region: 'Japan/Korea', saver: 54500, advantage: 82000, imageKey: 'destinations/fukuoka.jpg' },
    { to: 'Osaka (KIX)', region: 'Japan/Korea', saver: 54500, advantage: 82000, imageKey: 'destinations/osaka.jpg' },
    { to: 'Seoul (ICN)', region: 'Japan/Korea', saver: 54500, advantage: 82000, imageKey: 'destinations/seoul.jpg' },
    { to: 'Tokyo (NRT/HND)', region: 'Japan/Korea', saver: 54500, advantage: 82000, imageKey: 'destinations/tokyo.jpg' },
    { to: 'Darwin (DRW)', region: 'Oceania', saver: 42500, advantage: 64000, imageKey: 'destinations/darwin.jpg' },
    { to: 'Perth (PER)', region: 'Oceania', saver: 42500, advantage: 64000, imageKey: 'destinations/perth.jpg' },
    { to: 'Adelaide (ADL)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/adelaide.jpg' },
    { to: 'Auckland (AKL)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/auckland.jpg' },
    { to: 'Brisbane (BNE)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/brisbane.jpg' },
    { to: 'Cairns (CNS)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/cairns.jpg' },
    { to: 'Christchurch (CHC)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/christchurch.jpg' },
    { to: 'Melbourne (MEL)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'routes-images/melbourne.jpg' },
    { to: 'Sydney (SYD)', region: 'Oceania', saver: 72000, advantage: 108000, imageKey: 'destinations/sydney.jpg' },
    { to: 'Cape Town (CPT)', region: 'Africa/Middle East', saver: 68000, advantage: 102000, imageKey: 'destinations/cape-town.jpg' },
    { to: 'Dubai (DXB)', region: 'Africa/Middle East', saver: 68000, advantage: 102000, imageKey: 'routes-images/dubai.jpg' },
    { to: 'Istanbul (IST)', region: 'Africa/Middle East', saver: 68000, advantage: 102000, imageKey: 'destinations/istanbul.jpg' },
    { to: 'Johannesburg (JNB)', region: 'Africa/Middle East', saver: 68000, advantage: 102000, imageKey: 'destinations/johannesburg.jpg' },
    { to: 'Amsterdam (AMS)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/amsterdam.png' },
    { to: 'Barcelona (BCN)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/barcelona.jpg' },
    { to: 'Brussels (BRU)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/brussels.jpg' },
    { to: 'Copenhagen (CPH)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/copenhagen.jpg' },
    { to: 'Frankfurt (FRA)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/frankfurt.jpg' },
    { to: 'London (LHR)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'routes-images/london.jpg' },
    { to: 'Manchester (MAN)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/manchester.jpg' },
    { to: 'Milan (MXP)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/milan.jpg' },
    { to: 'Munich (MUC)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/munich.jpg' },
    { to: 'Paris (CDG)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'routes-images/paris.jpg' },
    { to: 'Rome (FCO)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/rome.jpg' },
    { to: 'Zurich (ZRH)', region: 'Europe', saver: 108500, advantage: 163000, imageKey: 'destinations/zurich.jpg' },
    { to: 'Los Angeles (LAX)', region: 'N. America', saver: 112500, advantage: 169000, imageKey: 'routes-images/los-angeles.jpg' },
    { to: 'San Francisco (SFO)', region: 'N. America', saver: 112500, advantage: 169000, imageKey: 'destinations/san-francisco.jpg' },
    { to: 'Seattle (SEA)', region: 'N. America', saver: 112500, advantage: 169000, imageKey: 'destinations/seattle.jpg' },
    { to: 'Houston (IAH)', region: 'N. America', saver: 117000, advantage: 176000, imageKey: 'destinations/houston.jpg' },
    { to: 'New York (JFK)', region: 'N. America', saver: 117000, advantage: 176000, imageKey: 'routes-images/new-york.jpg' }
  ];

  var routes = rawRoutes.map(function (raw) {
    var match = /^(.+?) \(([^)]+)\)$/.exec(raw.to);
    var city = match ? match[1] : raw.to;
    var code = match ? match[2] : '';
    var point = coordinates[code] || coordinates[code.split('/')[0]];
    if (!point) return null;
    return {
      id: 'sin-' + code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      to: raw.to,
      city: city,
      code: code,
      codes: code.split('/'),
      region: raw.region,
      latitude: point[0],
      longitude: point[1],
      saver: raw.saver,
      advantage: raw.advantage,
      cabin: 'Business Class',
      airline: null,
      imageKey: raw.imageKey
    };
  }).filter(Boolean);

  window.SKYFARE_MILEAGE_ROUTES = Object.freeze({
    origin: Object.freeze(origin),
    routes: Object.freeze(routes),
    regions: Object.freeze(Array.from(new Set(routes.map(function (route) { return route.region; }))))
  });
}(window));
