/**
 * Cabin Compare — route/cabin data + table rendering.
 *
 * PLACEHOLDER DATA: fares and partner-programme miles are for design review
 * only and are not fully verified. SQ Saver miles reflect the Nov 2025
 * KrisFlyer chart. Do not treat as live pricing — final figures must come
 * from Sahej before this page ships.
 */
document.addEventListener('DOMContentLoaded', () => {
  /* ---------------------------------------------------------------
     SEAT TEMPLATES — reusable hard-product specs shared across routes.
  ---------------------------------------------------------------- */
  const SEATS = {
    SQ2013:  { seat: '2013 J, 1-2-1',            width: '25–28 in', bed: '78 in', aisle: true,  wifi: 'Free, all passengers' },
    SQ2017:  { seat: '2017 J, 1-2-1',            width: '25 in',    bed: '78 in', aisle: true,  wifi: 'Free, all passengers' },
    SQ2006:  { seat: '2006 J, 1-2-1',            width: '30 in',    bed: '76 in', aisle: true,  wifi: 'Free, all passengers' },
    SQRJ:    { seat: 'Regional J, 1-2-1 (737-8 flat bed)', width: '20 in', bed: '76 in', aisle: false, wifi: 'Free, all passengers' },
    SQRJ359: { seat: 'Regional J, 1-2-1',        width: '20 in',    bed: '76 in', aisle: true,  wifi: 'Free, all passengers' },
    BAclub:  { seat: 'Club Suite, 1-2-1',        width: '20 in',    bed: '79 in', aisle: true,  wifi: 'Paid' },
    QFsuite: { seat: 'Business Suite, 1-2-1',    width: '24 in',    bed: '78 in', aisle: true,  wifi: 'Not on this sector' },
    LHalleg: { seat: 'Allegris rollout mixed',   width: '20–26 in', bed: '78 in', aisle: false, wifi: 'Paid' },
    LXthrone:{ seat: 'Staggered w/ throne, 1-2-1 / 2-2-1', width: '20–32 in', bed: '77 in', aisle: false, wifi: 'Paid' },
    KLworld: { seat: 'World Business, 1-2-1',    width: '21 in',    bed: '78 in', aisle: true,  wifi: 'Messaging free' },
    AFnew:   { seat: 'New J suite, 1-2-1',       width: '21 in',    bed: '77 in', aisle: true,  wifi: 'Messaging free' },
    TKcrys:  { seat: 'Crystal Business, 1-2-1',  width: '22 in',    bed: '77 in', aisle: true,  wifi: 'Free for J' },
    TGstag:  { seat: 'Staggered, 1-2-1',         width: '20 in',    bed: '75 in', aisle: true,  wifi: 'Paid' },
    NHroom:  { seat: 'The Room / staggered',     width: '22–38 in', bed: '76 in', aisle: true,  wifi: 'Paid' },
    JLsky:   { seat: 'Sky Suite, 1-2-1',         width: '22 in',    bed: '74 in', aisle: true,  wifi: 'Paid' },
    CXaria:  { seat: 'Aria Suite / reverse herringbone, 1-2-1', width: '21 in', bed: '77 in', aisle: true, wifi: 'Paid, free for members' },
    KEprest: { seat: 'Prestige Suites, 2-2-2 / 1-2-1', width: '21 in', bed: '75 in', aisle: false, wifi: 'Paid' },
    OZsmart: { seat: 'Business Smartium, 1-2-1', width: '20 in',    bed: '75 in', aisle: true,  wifi: 'Not available' },
    BRroyal: { seat: 'Royal Laurel, 1-2-1',      width: '23 in',    bed: '78 in', aisle: true,  wifi: 'Paid' },
    CIprem:  { seat: 'Premium Business, 1-2-1',  width: '21 in',    bed: '78 in', aisle: true,  wifi: 'Paid' },
    MUnew:   { seat: 'Staggered, 1-2-1',         width: '20 in',    bed: '75 in', aisle: true,  wifi: 'Free with registration' },
    CAcap:   { seat: 'Reverse herringbone, 1-2-1', width: '21 in',  bed: '75 in', aisle: true,  wifi: 'Free with registration' },
    AInew:   { seat: 'Refit J (legacy mixed), 1-2-1 / 2-2-2', width: '20–22 in', bed: '75 in', aisle: false, wifi: 'Paid, rolling out' },
    ULflat:  { seat: 'Flat bed J, 1-2-1 / 2-2-2', width: '20 in',   bed: '75 in', aisle: false, wifi: 'Paid' },
    GAflat:  { seat: 'Flat bed J, 1-2-1',        width: '21 in',    bed: '75 in', aisle: true,  wifi: 'Free for J' },
    PRflat:  { seat: 'Flat bed J, 1-2-1',        width: '21 in',    bed: '78 in', aisle: true,  wifi: 'Paid' },
    VNflat:  { seat: 'Flat bed J, 1-2-1 / recliner (narrowbody)', width: '21 in', bed: '75 in', aisle: false, wifi: 'Limited' },
    MHflat:  { seat: 'Flat bed J (widebody) / recliner (737)', width: '20 in', bed: '76 in', aisle: false, wifi: 'Paid' },
    TGreg:   { seat: 'Regional J, 2-2-2 recliner/angle', width: '20 in', bed: 'n/a recliner', aisle: false, wifi: 'Paid' },
    EKgame:  { seat: '1-2-1 (A380) / 2-3-2 (777)', width: '20 in',  bed: '77 in', aisle: false, wifi: 'Free for members' },
    QRqsuite:{ seat: 'Qsuite, 1-2-1 w/ doors',   width: '21 in',    bed: '79 in', aisle: true,  wifi: 'Free 1hr, paid' },
    NZskynest:{ seat: 'Business Premier, 1-1-1 herringbone', width: '20 in', bed: '79 in', aisle: true, wifi: 'Free' },
    UApolar: { seat: 'Polaris, 1-2-1',           width: '20.5 in',  bed: '78 in', aisle: true,  wifi: 'Paid' },
    DLone:   { seat: 'Delta One Suite, 1-2-1',   width: '21 in',    bed: '78 in', aisle: true,  wifi: 'Free for members' }
  };

  function A(name, sub, aircraft, seatKey, cash, cashNote, miles, pick) {
    return Object.assign({ name, sub, aircraft, cash, cashNote, miles, pick: !!pick }, SEATS[seatKey]);
  }

  /* ---------------------------------------------------------------
     AIRLINE LOGOS — all 29 airlines now have a real asset: the original
     12 in /logos, plus the 16 supplied in /images/airlines-logo-new.
     AIRLINE_CODES stays below as a graceful fallback for any airline
     added later without a logo yet, not because anything needs it now.
  ---------------------------------------------------------------- */
  const AIRLINE_LOGOS = {
    'Singapore Airlines': '../logos/singapore-airlines.webp',
    'British Airways':    '../logos/British_Airways_Logo.webp',
    'Lufthansa':          '../logos/Lufthansa_Logo_2018.webp',
    'SWISS':              '../logos/swiss.webp',
    'Turkish Airlines':   '../logos/turkish-airlines.webp',
    'Qatar Airways':      '../logos/Qatar_Airways_logo.webp',
    'Cathay Pacific':     '../logos/cathay.webp',
    'ANA':                '../logos/ana.webp',
    'United':             '../logos/united.webp',
    'Emirates':           '../logos/emirates.webp',
    'Air India':          '../logos/Air_India_logo.webp',
    'SriLankan':          '../logos/SriLankan_Airlines_logo.webp',
    'JAL':                '../logos/Japan-Airlines-logo.webp',
    'Qantas':              '../images/airlines-logo-new/qantas.svg',
    'Air France':          '../images/airlines-logo-new/Air_France.svg',
    'Thai Airways':        '../images/airlines-logo-new/thai-airways.svg',
    'KLM':                 '../images/airlines-logo-new/KLM.svg',
    'Delta':               '../images/airlines-logo-new/Delta-Air-Lines-Logo-1.svg',
    'Air New Zealand':     '../images/airlines-logo-new/air-new-zealand.svg',
    'Korean Air':          '../images/airlines-logo-new/korean-air.svg',
    'Asiana':              '../images/airlines-logo-new/asiana-airlines.png',
    'EVA Air':             '../images/airlines-logo-new/eva-air.svg',
    'China Airlines':      '../images/airlines-logo-new/china-airlines.svg',
    'China Eastern':       '../images/airlines-logo-new/china-eastern.svg',
    'Air China':           '../images/airlines-logo-new/air-china.svg',
    'Garuda Indonesia':    '../images/airlines-logo-new/garuda-indo.svg',
    'Philippine Airlines': '../images/airlines-logo-new/ph-airlines.svg',
    'Vietnam Airlines':    '../images/airlines-logo-new/vietnam-airlines.svg',
    'Malaysia Airlines':   '../images/airlines-logo-new/malaysia-airlines.svg',
  };

  // Real IATA 2-letter codes — kept only as a graceful fallback badge for any
  // airline that might be added later without a logo yet, not currently used
  // since every airline above now has a real asset.
  const AIRLINE_CODES = {
    'Qantas': 'QF', 'Air France': 'AF', 'Thai Airways': 'TG', 'KLM': 'KL',
    'Delta': 'DL', 'Air New Zealand': 'NZ', 'Korean Air': 'KE', 'Asiana': 'OZ',
    'EVA Air': 'BR', 'China Airlines': 'CI', 'China Eastern': 'MU',
    'Air China': 'CA', 'Garuda Indonesia': 'GA', 'Philippine Airlines': 'PR',
    'Vietnam Airlines': 'VN', 'Malaysia Airlines': 'MH',
  };

  function airlineBadgeHtml(name) {
    const logo = AIRLINE_LOGOS[name];
    if (logo) {
      return `<div class="w-11 h-11 rounded-full overflow-hidden bg-white border border-neutral-100 flex-shrink-0 flex items-center justify-center">
        <img src="${logo}" alt="${name}" class="w-full h-full object-contain p-0.5">
      </div>`;
    }
    const code = AIRLINE_CODES[name] || name.slice(0, 2).toUpperCase();
    return `<div class="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex-shrink-0 flex items-center justify-center text-xs font-bold tracking-tight">${code}</div>`;
  }

  // Destination-country flag per route — emoji, not an image asset, so no new
  // files are needed and it renders natively everywhere.
  const ROUTE_FLAGS = {
    LHR: '🇬🇧', CDG: '🇫🇷', FRA: '🇩🇪', ZRH: '🇨🇭', AMS: '🇳🇱', FCO: '🇮🇹',
    MXP: '🇮🇹', IST: '🇹🇷', BCN: '🇪🇸',
    JFK: '🇺🇸', EWR: '🇺🇸', LAX: '🇺🇸', SFO: '🇺🇸', SEA: '🇺🇸',
    SYD: '🇦🇺', MEL: '🇦🇺', BNE: '🇦🇺', PER: '🇦🇺', AKL: '🇳🇿',
    NRT: '🇯🇵', HND: '🇯🇵', ICN: '🇰🇷', HKG: '🇭🇰', TPE: '🇹🇼', PVG: '🇨🇳', PEK: '🇨🇳',
    DEL: '🇮🇳', BOM: '🇮🇳', CMB: '🇱🇰',
    BKK: '🇹🇭', CGK: '🇮🇩', DPS: '🇮🇩', MNL: '🇵🇭', SGN: '🇻🇳', HAN: '🇻🇳', KUL: '🇲🇾',
    DXB: '🇦🇪', DOH: '🇶🇦', JNB: '🇿🇦',
  };

  // Attaches the Skyfare-editorial highlight tags onto an airline entry (e.g.
  // "Best for sleep"). Kept as a separate enrich step, not baked into A(),
  // because these are Sahej's judgment calls per route/airline — not derivable
  // from specs the way seat/aircraft data is. Only LHR is enriched below as a
  // drafted starting point; every other route intentionally has no tags yet
  // and the render logic just shows nothing extra, no empty/broken cells.
  // NOTE: Value/Comfort/Service scores are NOT part of this — those are real,
  // customer-submitted ratings fetched live from the Worker (see
  // loadSkyfareScores below), never static/hand-typed numbers.
  function E(airline, tags) {
    return Object.assign(airline, { tags });
  }

  /* ---------------------------------------------------------------
     ROUTES — grouped by region. meta = block time · distance.
  ---------------------------------------------------------------- */
  const DATA = {
    /* ---------- EUROPE ---------- */
    // Highlight tags pulled for now — pending Sahej's actual editorial call.
    // Re-wrap the relevant A(...) entries with E(entry, [tags]) once he sends them.
    LHR: { name: 'London', region: 'Europe', meta: '13h 45m nonstop · 10,873 km', airlines: [
      A('Singapore Airlines', 'SQ 306 / SQ 322', 'A380-800', 'SQ2013', 'SGD 9,800–15,000', 'return, J Saver up', 'from 108,500 Saver each way', true),
      A('British Airways', 'BA 12 / BA 16', 'B777-300ER', 'BAclub', 'SGD 7,200–10,500', 'return', 'from 90,000 Avios each way'),
      A('Qantas', 'QF 1', 'A380-800', 'QFsuite', 'SGD 7,000–9,800', 'return', 'from 108,400 Qantas Points each way')
    ]},
    CDG: { name: 'Paris', region: 'Europe', meta: '13h 30m nonstop · 10,732 km', airlines: [
      A('Singapore Airlines', 'SQ 336 / SQ 334', 'B777-300ER', 'SQ2013', 'SGD 9,500–15,000', 'return', 'from 108,500 Saver each way', true),
      A('Air France', 'AF 257', 'B777-300ER', 'AFnew', 'SGD 7,800–11,000', 'return', 'from 90,000 Flying Blue each way'),
      A('Thai Airways', 'via BKK', 'A350-900', 'TGstag', 'SGD 5,900–8,200', 'return, one stop', 'from 95,000 each way')
    ]},
    FRA: { name: 'Frankfurt', region: 'Europe', meta: '12h 55m nonstop · 10,260 km', airlines: [
      A('Singapore Airlines', 'SQ 26 / SQ 326', 'A380-800', 'SQ2013', 'SGD 8,900–13,500', 'return', 'from 108,500 Saver each way', true),
      A('Lufthansa', 'LH 779', 'B747-8', 'LHalleg', 'SGD 6,800–9,900', 'return', 'from 88,000 each way')
    ]},
    ZRH: { name: 'Zurich', region: 'Europe', meta: '13h 05m nonstop · 10,320 km', airlines: [
      A('Singapore Airlines', 'SQ 346', 'A380-800', 'SQ2013', 'SGD 9,200–13,800', 'return', 'from 108,500 Saver each way', true),
      A('SWISS', 'LX 179', 'B777-300ER', 'LXthrone', 'SGD 6,900–10,200', 'return', 'from 88,000 each way')
    ]},
    AMS: { name: 'Amsterdam', region: 'Europe', meta: '13h 20m nonstop · 10,540 km', airlines: [
      A('Singapore Airlines', 'SQ 324 / SQ 338', 'A350-900', 'SQ2013', 'SGD 9,000–13,600', 'return', 'from 108,500 Saver each way', true),
      A('KLM', 'KL 836', 'B777-300ER', 'KLworld', 'SGD 7,100–10,400', 'return', 'from 90,000 Flying Blue each way')
    ]},
    FCO: { name: 'Rome', region: 'Europe', meta: '12h 50m nonstop · 10,050 km', airlines: [
      A('Singapore Airlines', 'SQ 366', 'A350-900', 'SQ2013', 'SGD 8,800–13,200', 'return', 'from 108,500 Saver each way', true),
      A('Turkish Airlines', 'via IST', 'A350 / B787', 'TKcrys', 'SGD 5,600–8,000', 'return, one stop', 'from 90,000 each way')
    ]},
    MXP: { name: 'Milan', region: 'Europe', meta: '13h 00m nonstop · 10,300 km', airlines: [
      A('Singapore Airlines', 'SQ 356', 'A350-900', 'SQ2013', 'SGD 8,800–13,200', 'return', 'from 108,500 Saver each way', true),
      A('Lufthansa', 'via FRA', 'B747-8 + A320', 'LHalleg', 'SGD 6,500–9,400', 'return, one stop', 'from 88,000 each way')
    ]},
    IST: { name: 'Istanbul', region: 'Europe', meta: '11h 25m nonstop · 8,700 km', airlines: [
      A('Turkish Airlines', 'TK 55', 'A350-900', 'TKcrys', 'SGD 5,800–8,600', 'return', 'from 90,000 each way', true),
      A('Singapore Airlines', 'SQ 392', 'A350-900', 'SQ2013', 'SGD 7,800–11,500', 'return', 'from 68,000 Saver each way')
    ]},
    BCN: { name: 'Barcelona', region: 'Europe', meta: '13h 40m · one stop typical', airlines: [
      A('Singapore Airlines', 'via MXP or ZRH', 'A350 / A380', 'SQ2013', 'SGD 8,600–12,800', 'return, one stop', 'from 108,500 Saver each way'),
      A('Turkish Airlines', 'via IST', 'A350 / B787', 'TKcrys', 'SGD 5,500–7,900', 'return, one stop', 'from 90,000 each way', true),
      A('Qatar Airways', 'via DOH', 'B777 / A350', 'QRqsuite', 'SGD 6,200–8,800', 'return, one stop', 'from 85,000 Avios each way')
    ]},

    /* ---------- NORTH AMERICA ---------- */
    JFK: { name: 'New York JFK', region: 'North America', meta: '18h 05m nonstop · 15,349 km', airlines: [
      A('Singapore Airlines', 'SQ 24', 'A350-900ULR', 'SQ2013', 'SGD 12,500–18,000', 'return', 'from 117,000 Saver each way', true),
      A('Cathay Pacific', 'via HKG', 'A350-1000', 'CXaria', 'SGD 8,900–12,500', 'return, one stop', 'from 97,000 Asia Miles each way'),
      A('ANA', 'via HND', 'B777-300ER', 'NHroom', 'SGD 9,200–13,000', 'return, one stop', 'from 95,000 each way')
    ]},
    EWR: { name: 'New York Newark', region: 'North America', meta: '18h 30m nonstop · 15,344 km', airlines: [
      A('Singapore Airlines', 'SQ 22', 'A350-900ULR', 'SQ2013', 'SGD 12,500–18,000', 'return', 'from 117,000 Saver each way', true),
      A('United', 'via SFO', 'B787-9', 'UApolar', 'SGD 8,500–12,000', 'return, one stop', 'from 110,000 MileagePlus each way')
    ]},
    LAX: { name: 'Los Angeles', region: 'North America', meta: '15h 55m nonstop · 14,114 km', airlines: [
      A('Singapore Airlines', 'SQ 38 / SQ 36', 'A350-900ULR', 'SQ2013', 'SGD 10,800–15,500', 'return', 'from 112,500 Saver each way', true),
      A('Cathay Pacific', 'via HKG', 'B777-300ER', 'CXaria', 'SGD 8,200–11,500', 'return, one stop', 'from 97,000 Asia Miles each way'),
      A('Delta', 'via ICN w/ KE', 'A350-900', 'DLone', 'SGD 8,400–11,800', 'return, one stop', 'from 120,000 SkyMiles each way')
    ]},
    SFO: { name: 'San Francisco', region: 'North America', meta: '15h 25m nonstop · 13,593 km', airlines: [
      A('Singapore Airlines', 'SQ 32 / SQ 34', 'A350-900ULR', 'SQ2013', 'SGD 10,500–15,000', 'return', 'from 112,500 Saver each way', true),
      A('United', 'UA 29', 'B787-9', 'UApolar', 'SGD 8,800–12,400', 'return', 'from 110,000 MileagePlus each way')
    ]},
    SEA: { name: 'Seattle', region: 'North America', meta: '14h 55m nonstop · 12,950 km', airlines: [
      A('Singapore Airlines', 'SQ 28', 'A350-900', 'SQ2013', 'SGD 10,200–14,500', 'return', 'from 112,500 Saver each way', true),
      A('ANA', 'via HND', 'B787-9', 'NHroom', 'SGD 8,600–12,000', 'return', 'from 95,000 each way')
    ]},

    /* ---------- AUSTRALIA & NEW ZEALAND ---------- */
    SYD: { name: 'Sydney', region: 'Australia & NZ', meta: '8h 10m nonstop · 6,300 km', airlines: [
      A('Singapore Airlines', 'SQ 221 / SQ 241', 'A380-800', 'SQ2017', 'SGD 5,200–8,000', 'return', 'from 72,000 Saver each way', true),
      A('Qantas', 'QF 2 / QF 82', 'A380 / B787', 'QFsuite', 'SGD 4,900–7,400', 'return', 'from 68,400 Qantas Points each way'),
      A('British Airways', 'BA 15', 'B777-300ER', 'BAclub', 'SGD 4,600–6,900', 'return', 'from 62,000 Avios each way')
    ]},
    MEL: { name: 'Melbourne', region: 'Australia & NZ', meta: '7h 30m nonstop · 6,050 km', airlines: [
      A('Singapore Airlines', 'SQ 227 / SQ 237', 'A380 / A350', 'SQ2017', 'SGD 4,900–7,600', 'return', 'from 72,000 Saver each way', true),
      A('Qantas', 'QF 36 / QF 38', 'A330-300', 'QFsuite', 'SGD 4,500–6,800', 'return', 'from 68,400 Qantas Points each way'),
      A('Emirates', 'EK 405', 'A380-800', 'EKgame', 'SGD 4,300–6,400', 'return', 'from 77,000 Skywards each way')
    ]},
    BNE: { name: 'Brisbane', region: 'Australia & NZ', meta: '7h 55m nonstop · 6,150 km', airlines: [
      A('Singapore Airlines', 'SQ 235 / SQ 245', 'A350-900', 'SQ2017', 'SGD 4,800–7,400', 'return', 'from 72,000 Saver each way', true),
      A('Qantas', 'QF 52', 'A330-300', 'QFsuite', 'SGD 4,400–6,600', 'return', 'from 68,400 Qantas Points each way')
    ]},
    PER: { name: 'Perth', region: 'Australia & NZ', meta: '5h 15m nonstop · 3,910 km', airlines: [
      A('Singapore Airlines', 'SQ 213 / SQ 223', 'B787-10 / A350', 'SQRJ359', 'SGD 3,200–5,000', 'return', 'from 42,500 Saver each way', true),
      A('Qantas', 'QF 78', 'A330-300', 'QFsuite', 'SGD 3,000–4,600', 'return', 'from 41,500 Qantas Points each way')
    ]},
    AKL: { name: 'Auckland', region: 'Australia & NZ', meta: '9h 45m nonstop · 8,400 km', airlines: [
      A('Singapore Airlines', 'SQ 285 / SQ 281', 'A350 / B777', 'SQ2013', 'SGD 5,800–8,800', 'return', 'from 72,000 Saver each way', true),
      A('Air New Zealand', 'NZ 281', 'B787-9', 'NZskynest', 'SGD 5,200–7,800', 'return', 'from 86,000 Airpoints value varies')
    ]},

    /* ---------- NORTH ASIA ---------- */
    NRT: { name: 'Tokyo Narita', region: 'North Asia', meta: '7h 10m nonstop · 5,320 km', airlines: [
      A('Singapore Airlines', 'SQ 638 / SQ 12', 'A380 / B777', 'SQ2013', 'SGD 4,800–7,500', 'return', 'from 54,500 Saver each way', true),
      A('ANA', 'NH 802', 'B787-9', 'NHroom', 'SGD 4,200–6,800', 'return', 'from 45,000 each way'),
      A('JAL', 'JL 712', 'B787-9', 'JLsky', 'SGD 4,000–6,500', 'return', 'from 50,000 Avios each way')
    ]},
    HND: { name: 'Tokyo Haneda', region: 'North Asia', meta: '7h 05m nonstop · 5,330 km', airlines: [
      A('Singapore Airlines', 'SQ 634 / SQ 636', 'A350 / B777', 'SQ2013', 'SGD 4,900–7,600', 'return', 'from 54,500 Saver each way', true),
      A('ANA', 'NH 842 / NH 844', 'B787-10', 'NHroom', 'SGD 4,300–6,900', 'return', 'from 45,000 each way'),
      A('JAL', 'JL 36 / JL 38', 'B787-9', 'JLsky', 'SGD 4,100–6,600', 'return', 'from 50,000 Avios each way')
    ]},
    ICN: { name: 'Seoul', region: 'North Asia', meta: '6h 30m nonstop · 4,670 km', airlines: [
      A('Singapore Airlines', 'SQ 600 / SQ 608', 'A380 / A350', 'SQ2013', 'SGD 4,200–6,600', 'return', 'from 54,500 Saver each way', true),
      A('Korean Air', 'KE 644 / KE 646', 'B777 / A330', 'KEprest', 'SGD 3,800–5,900', 'return', 'from 62,500 Skypass round trip'),
      A('Asiana', 'OZ 752', 'A350-900', 'OZsmart', 'SGD 3,600–5,600', 'return', 'from 60,000 round trip')
    ]},
    HKG: { name: 'Hong Kong', region: 'North Asia', meta: '3h 55m nonstop · 2,570 km', airlines: [
      A('Singapore Airlines', 'SQ 856 / SQ 890', 'A380 / B777', 'SQ2013', 'SGD 2,400–3,800', 'return', 'from 35,500 Saver each way'),
      A('Cathay Pacific', 'CX 636 / CX 710', 'A350 / A330', 'CXaria', 'SGD 2,200–3,500', 'return', 'from 25,000 Asia Miles each way', true)
    ]},
    TPE: { name: 'Taipei', region: 'North Asia', meta: '4h 40m nonstop · 3,230 km', airlines: [
      A('Singapore Airlines', 'SQ 876 / SQ 878', 'B787-10 / A350', 'SQRJ359', 'SGD 2,600–4,000', 'return', 'from 35,500 Saver each way'),
      A('EVA Air', 'BR 226 / BR 216', 'B787-10', 'BRroyal', 'SGD 2,400–3,700', 'return', 'from 45,000 round trip', true),
      A('China Airlines', 'CI 752 / CI 754', 'A350-900', 'CIprem', 'SGD 2,300–3,500', 'return', 'from 44,000 round trip')
    ]},
    PVG: { name: 'Shanghai', region: 'North Asia', meta: '5h 15m nonstop · 3,780 km', airlines: [
      A('Singapore Airlines', 'SQ 830 / SQ 826', 'A380 / A350', 'SQ2013', 'SGD 3,000–4,800', 'return', 'from 45,000 Saver each way', true),
      A('China Eastern', 'MU 546 / MU 568', 'A350 / B777', 'MUnew', 'SGD 2,600–4,000', 'return', 'from 45,000 round trip')
    ]},
    PEK: { name: 'Beijing', region: 'North Asia', meta: '6h 10m nonstop · 4,480 km', airlines: [
      A('Singapore Airlines', 'SQ 802 / SQ 806', 'A350-900', 'SQ2013', 'SGD 3,200–5,000', 'return', 'from 45,000 Saver each way', true),
      A('Air China', 'CA 970 / CA 976', 'A350-900', 'CAcap', 'SGD 2,800–4,300', 'return', 'from 50,000 round trip')
    ]},

    /* ---------- SOUTH ASIA ---------- */
    DEL: { name: 'Delhi', region: 'South Asia', meta: '5h 50m nonstop · 4,150 km', airlines: [
      A('Singapore Airlines', 'SQ 402 / SQ 406', 'A380 / B777', 'SQ2013', 'SGD 3,000–4,800', 'return', 'from 45,000 Saver each way', true),
      A('Air India', 'AI 380 / AI 382', 'B787-8 (refit rolling out)', 'AInew', 'SGD 2,400–3,800', 'return', 'from 40,000 round trip')
    ]},
    BOM: { name: 'Mumbai', region: 'South Asia', meta: '5h 25m nonstop · 3,900 km', airlines: [
      A('Singapore Airlines', 'SQ 424 / SQ 422', 'A350-900', 'SQ2013', 'SGD 2,900–4,600', 'return', 'from 45,000 Saver each way', true),
      A('Air India', 'AI 342 / AI 346', 'B787-8 (refit rolling out)', 'AInew', 'SGD 2,300–3,700', 'return', 'from 40,000 round trip')
    ]},
    CMB: { name: 'Colombo', region: 'South Asia', meta: '4h 20m nonstop · 2,890 km', airlines: [
      A('Singapore Airlines', 'SQ 468 / SQ 452', 'B737-8 / A350', 'SQRJ', 'SGD 2,200–3,400', 'return', 'from 45,000 Saver each way', true),
      A('SriLankan', 'UL 306 / UL 308', 'A330-300', 'ULflat', 'SGD 1,900–3,000', 'return', 'from 40,000 round trip')
    ]},

    /* ---------- SOUTHEAST ASIA ---------- */
    BKK: { name: 'Bangkok', region: 'Southeast Asia', meta: '2h 25m nonstop · 1,430 km', airlines: [
      A('Singapore Airlines', 'SQ 706 / SQ 712', 'A380 / B777', 'SQ2013', 'SGD 1,400–2,200', 'return', 'from 25,000 Saver each way', true),
      A('Thai Airways', 'TG 404 / TG 410', 'A350 / B777', 'TGreg', 'SGD 1,200–1,900', 'return', 'from 30,000 round trip')
    ]},
    CGK: { name: 'Jakarta', region: 'Southeast Asia', meta: '1h 55m nonstop · 900 km', airlines: [
      A('Singapore Airlines', 'SQ 956 / SQ 962', 'B787-10 / A350', 'SQRJ359', 'SGD 1,100–1,800', 'return', 'from 22,000 Saver each way', true),
      A('Garuda Indonesia', 'GA 825 / GA 833', 'B777 / A330', 'GAflat', 'SGD 950–1,500', 'return', 'from 25,000 round trip')
    ]},
    DPS: { name: 'Bali', region: 'Southeast Asia', meta: '2h 40m nonstop · 1,670 km', airlines: [
      A('Singapore Airlines', 'SQ 938 / SQ 942', 'B787-10 / A350', 'SQRJ359', 'SGD 1,300–2,100', 'return', 'from 22,000 Saver each way', true),
      A('Garuda Indonesia', 'GA 843', 'A330-300', 'GAflat', 'SGD 1,100–1,700', 'return', 'from 25,000 round trip')
    ]},
    MNL: { name: 'Manila', region: 'Southeast Asia', meta: '3h 40m nonstop · 2,390 km', airlines: [
      A('Singapore Airlines', 'SQ 910 / SQ 918', 'B787-10 / A350', 'SQRJ359', 'SGD 1,800–2,800', 'return', 'from 25,000 Saver each way', true),
      A('Philippine Airlines', 'PR 508 / PR 512', 'A350 / A321neo', 'PRflat', 'SGD 1,500–2,400', 'return', 'from 30,000 round trip')
    ]},
    SGN: { name: 'Ho Chi Minh City', region: 'Southeast Asia', meta: '2h 10m nonstop · 1,090 km', airlines: [
      A('Singapore Airlines', 'SQ 178 / SQ 186', 'B737-8 / B787', 'SQRJ', 'SGD 1,200–1,900', 'return', 'from 25,000 Saver each way', true),
      A('Vietnam Airlines', 'VN 650 / VN 656', 'A321 / A350', 'VNflat', 'SGD 1,000–1,600', 'return', 'from 25,000 round trip')
    ]},
    HAN: { name: 'Hanoi', region: 'Southeast Asia', meta: '3h 20m nonstop · 2,190 km', airlines: [
      A('Singapore Airlines', 'SQ 192 / SQ 176', 'B737-8', 'SQRJ', 'SGD 1,400–2,200', 'return', 'from 25,000 Saver each way', true),
      A('Vietnam Airlines', 'VN 662', 'A321neo', 'VNflat', 'SGD 1,100–1,800', 'return', 'from 25,000 round trip')
    ]},
    KUL: { name: 'Kuala Lumpur', region: 'Southeast Asia', meta: '1h 05m nonstop · 300 km', airlines: [
      A('Singapore Airlines', 'SQ 106 / SQ 116', 'B737-8', 'SQRJ', 'SGD 700–1,200', 'return', 'from 22,000 Saver each way', true),
      A('Malaysia Airlines', 'MH 604 / MH 612', 'B737-800', 'MHflat', 'SGD 600–1,000', 'return', 'from 15,000 round trip')
    ]},

    /* ---------- MIDDLE EAST & AFRICA ---------- */
    DXB: { name: 'Dubai', region: 'Middle East & Africa', meta: '7h 30m nonstop · 5,840 km', airlines: [
      A('Singapore Airlines', 'SQ 494 / SQ 490', 'A350-900', 'SQ2013', 'SGD 4,600–7,200', 'return', 'from 68,000 Saver each way', true),
      A('Emirates', 'EK 353 / EK 355', 'A380 / B777', 'EKgame', 'SGD 4,200–6,500', 'return', 'from 72,500 Skywards each way')
    ]},
    DOH: { name: 'Doha', region: 'Middle East & Africa', meta: '7h 45m nonstop · 6,000 km', airlines: [
      A('Qatar Airways', 'QR 945 / QR 947', 'A350 / B777', 'QRqsuite', 'SGD 4,400–6,800', 'return', 'from 70,000 Avios each way', true),
      A('Emirates', 'via DXB', 'A380 + B777', 'EKgame', 'SGD 4,100–6,300', 'return, one stop', 'from 72,500 Skywards each way')
    ]},
    JNB: { name: 'Johannesburg', region: 'Middle East & Africa', meta: '10h 35m nonstop · 8,660 km', airlines: [
      A('Singapore Airlines', 'SQ 478', 'A350-900', 'SQ2013', 'SGD 6,200–9,400', 'return', 'from 68,000 Saver each way', true),
      A('Qatar Airways', 'via DOH', 'B777 / A350', 'QRqsuite', 'SGD 5,400–8,000', 'return, one stop', 'from 90,000 Avios each way')
    ]}
  };

  const REGION_ORDER = ['Europe', 'North America', 'Australia & NZ', 'North Asia', 'South Asia', 'Southeast Asia', 'Middle East & Africa'];

  const routeSel = document.getElementById('cc-route');
  const table = document.getElementById('cc-table');
  if (!routeSel || !table) return;

  /* Build the grouped route selector (region optgroups) */
  REGION_ORDER.forEach((region) => {
    const og = document.createElement('optgroup');
    og.label = region;
    Object.entries(DATA).filter(([, d]) => d.region === region).forEach(([code, d]) => {
      const opt = document.createElement('option');
      opt.value = code;
      const flag = ROUTE_FLAGS[code] ? ROUTE_FLAGS[code] + ' ' : '';
      opt.textContent = flag + d.name + ' (' + code + ')';
      og.appendChild(opt);
    });
    routeSel.appendChild(og);
  });

  // Vertical divider (border-l) on every data cell except the first (label)
  // column — gives the grid real column structure without turning it into a
  // harsh spreadsheet look.
  function cell(html) {
    const td = document.createElement('td');
    td.className = 'px-6 py-5 border-t border-l border-neutral-100 text-[15px] leading-snug text-neutral-700';
    td.innerHTML = html;
    return td;
  }

  function render(dest) {
    const d = DATA[dest];
    if (!d) return;

    const flag = ROUTE_FLAGS[dest] ? ' ' + ROUTE_FLAGS[dest] : '';
    document.getElementById('cc-dest-code').textContent = dest + flag;
    document.getElementById('cc-route-meta').textContent = d.meta;

    const rows = {
      'cc-row-airline': (a) => {
        const th = document.createElement('th');
        th.className = 'px-6 py-5 text-left border-l border-neutral-100';
        const tagsHtml = (a.tags || []).map((t) =>
          `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wide mr-1.5 mt-1.5">${t}</span>`
        ).join('');
        th.innerHTML = `
          <div class="flex items-center gap-2.5">
            ${airlineBadgeHtml(a.name)}
            <div>
              <div class="font-display font-bold text-lg text-neutral-900 tracking-tight">${a.name}</div>
              <div class="text-xs font-medium text-neutral-500 mt-0.5">${a.sub}</div>
            </div>
          </div>
          ${a.pick ? '<span class="savings-badge mt-2">Skyfare pick</span>' : ''}
          ${tagsHtml ? `<div class="mt-1">${tagsHtml}</div>` : ''}
        `;
        return th;
      },
      'cc-row-aircraft': (a) => cell(`<span class="cc-num font-medium">${a.aircraft}</span>`),
      'cc-row-seat': (a) => cell(`<span class="font-medium">${a.seat}</span>`),
      'cc-row-width': (a) => cell(`<span class="cc-num font-medium">${a.width}</span>`),
      'cc-row-bed': (a) => cell(`<span class="cc-num font-medium">${a.bed}</span>`),
      'cc-row-aisle': (a) => cell(a.aisle ? '<span class="text-brand-600 font-bold">Yes</span>' : '<span class="text-neutral-500 font-medium">Not all seats</span>'),
      'cc-row-wifi': (a) => cell(`<span class="font-medium">${a.wifi}</span>`),
      'cc-row-cash': (a) => cell(`<span class="cc-num font-bold text-neutral-900">${a.cash}</span><span class="block text-xs font-medium text-neutral-500 mt-0.5">${a.cashNote}</span>`),
      'cc-row-miles': (a) => cell(`<span class="cc-num font-medium">${a.miles}</span>`),
      // Skyfare score and client reviews both load asynchronously from real
      // submitted data — each row starts hidden and only reveals itself once
      // its loader confirms there's something real to show, so a route with
      // no data yet never displays a dead, oversized empty row.
      'cc-row-scores': () => cell(`<span data-score-slot="1"></span>`),
      'cc-row-reviews': () => cell(`<span data-review-slot="1"></span>`)
    };

    Object.entries(rows).forEach(([rowId, fn]) => {
      const tr = document.getElementById(rowId);
      while (tr.children.length > 1) tr.removeChild(tr.lastChild);
      d.airlines.forEach((a) => tr.appendChild(fn(a)));
    });

    // These two rows are entirely data-driven from async fetches — hide them
    // until a loader confirms there's real data, rather than showing an
    // empty row while waiting (or forever, on routes with no data at all).
    document.getElementById('cc-row-scores').classList.add('hidden');
    document.getElementById('cc-row-reviews').classList.add('hidden');

    loadSkyfareScores(dest, d.airlines);
    loadClientReviews(dest, d.airlines);
  }

  // Skyfare score + "From our clients" are both entirely real, submitted-data
  // driven — no static/placeholder numbers. Most routes/airlines will have
  // none yet (only 2 of 6 real testimonials could be backfilled with a route,
  // none with an airline) — each row stays hidden until its loader confirms
  // at least one airline actually has data, rather than showing a dead row
  // of dashes.
  const WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';

  // Same star-icon convention as js/testimonials.js's starsHtml() — filled vs
  // outline fa-star icons, rounded to the nearest whole star.
  function starsHtml(value) {
    const rounded = Math.max(0, Math.min(5, Math.round(value)));
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<i class="fa-${i <= rounded ? 'solid' : 'regular'} fa-star text-gold text-[11px]"></i>`;
    }
    return html;
  }

  function loadSkyfareScores(dest, airlines) {
    const row = document.getElementById('cc-row-scores');
    const cells = row.querySelectorAll('[data-score-slot]');
    const fetches = airlines.map((a, i) => {
      const cellEl = cells[i];
      if (!cellEl) return Promise.resolve(false);
      const params = new URLSearchParams({ route: dest, airline: a.name });
      return fetch(WORKER_URL + '/airtable/testimonial-scores?' + params.toString())
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((s) => {
          if (!s || !s.count) return false;
          // One row per dimension (label + star visual), one shared "from N
          // flight ratings" line at the bottom rather than a repeated count
          // per dimension — simpler to read, and s.count already means "N
          // submissions rated at least one dimension."
          const dims = [
            ['Value', s.value],
            ['Comfort', s.comfort],
            ['Service', s.service],
            ['Food', s.food],
          ].filter(([, v]) => v != null);
          if (!dims.length) return false;
          const rows = dims.map(([label, v]) => `
            <div class="flex items-center justify-between gap-3 max-w-[160px]">
              <span class="text-xs text-neutral-500">${label}</span>
              <span class="flex gap-0.5">${starsHtml(v)}</span>
            </div>
          `).join('');
          cellEl.innerHTML = `<div class="space-y-1">${rows}</div>` +
            `<span class="block text-xs text-neutral-400 mt-2">from ${s.count} flight rating${s.count === 1 ? '' : 's'}</span>`;
          return true;
        })
        .catch(() => false);
    });
    Promise.all(fetches).then((results) => {
      if (results.some(Boolean)) row.classList.remove('hidden');
    });
  }

  function loadClientReviews(dest, airlines) {
    const row = document.getElementById('cc-row-reviews');
    const cells = row.querySelectorAll('[data-review-slot]');
    const fetches = airlines.map((a, i) => {
      const cellEl = cells[i];
      if (!cellEl) return Promise.resolve(false);
      const params = new URLSearchParams({ route: dest, airline: a.name, limit: '2' });
      return fetch(WORKER_URL + '/airtable/testimonials?' + params.toString())
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const quotes = (data && data.testimonials) || [];
          if (!quotes.length) return false;
          cellEl.innerHTML = quotes.slice(0, 2).map((t) => {
            const d = document.createElement('div');
            d.textContent = String(t.quote || '');
            const safeQuote = d.innerHTML;
            const n = document.createElement('div');
            n.textContent = String(t.name || '');
            const safeName = n.innerHTML;
            const im = document.createElement('div');
            im.textContent = String(t.image || '');
            const safeImage = im.innerHTML;
            const avatarHtml = safeImage
              ? `<img src="${safeImage}" alt="" class="w-full h-full object-cover">`
              : `<div class="w-full h-full flex items-center justify-center bg-brand-50"><i class="fa-solid fa-user text-brand-200 text-xs"></i></div>`;
            return `
              <div class="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3 mb-2">
                <div class="flex items-center gap-2 mb-1.5">
                  <div class="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">${avatarHtml}</div>
                  <span class="text-xs font-semibold text-neutral-900">${safeName}</span>
                </div>
                <p class="text-xs text-neutral-600 italic leading-snug">&quot;${safeQuote}&quot;</p>
              </div>
            `;
          }).join('');
          return true;
        })
        .catch(() => false); // network/CORS hiccup — cell stays empty, not broken
    });
    Promise.all(fetches).then((results) => {
      if (results.some(Boolean)) row.classList.remove('hidden');
    });
  }

  routeSel.addEventListener('change', (e) => render(e.target.value));
  routeSel.value = 'LHR';
  render('LHR');
});
