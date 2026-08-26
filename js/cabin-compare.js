/**
 * Cabin Compare — route/cabin data + table rendering.
 *
 * Route, seat, and pricing data is fetched live from the Skyfare Consulting
 * Airtable base (Cabin Compare Routes / Seat Products / Cabin Compare
 * Options) via the Worker -- see
 * cloudflare/services/airtable.js#handleGetCabinCompare. Every row is shown
 * regardless of Airtable's per-row Verified checkbox; that's an internal
 * "confirmed by Sahej" marker for the team, not a display filter -- treat
 * the figures the same way the old hardcoded placeholder data was treated.
 */
document.addEventListener('DOMContentLoaded', () => {
  const WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';

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

  // Destination-country flag per route — self-hosted image files (not emoji;
  // Windows Chrome/Edge falls back to plain two-letter codes for flag emoji,
  // so images are the only way to get consistent rendering across all visitors).
  const ROUTE_FLAGS = {
    LHR: 'united-kingdom.png', CDG: 'france.png', FRA: 'germany.png', ZRH: 'switzerland.png', AMS: 'netherlands.png', FCO: 'italy.png',
    MXP: 'italy.png', IST: 'turkey.png', BCN: 'spain.png',
    JFK: 'united-states.png', EWR: 'united-states.png', LAX: 'united-states.png', SFO: 'united-states.png', SEA: 'united-states.png',
    SYD: 'australia.png', MEL: 'australia.png', BNE: 'australia.png', PER: 'australia.png', AKL: 'new-zealand.png',
    NRT: 'japan.png', HND: 'japan.png', ICN: 'south-korea.png', HKG: 'hong-kong.png', TPE: 'taiwan.png', PVG: 'china.png', PEK: 'china.png',
    DEL: 'india.png', BOM: 'india.png', CMB: 'sri-lanka.png',
    BKK: 'thailand.png', CGK: 'indonesia.png', DPS: 'indonesia.png', MNL: 'philippines.png', SGN: 'vietnam.png', HAN: 'vietnam.png', KUL: 'malaysia.png',
    DXB: 'united-arab-emirates.png', DOH: 'qatar.png', JNB: 'south-africa.png',
  };

  function flagImg(file, cls) {
    return file ? `<img src="../logos/flags/${file}" alt="" class="${cls || 'inline-block w-5 h-5 rounded-full object-cover align-[-5px]'}">` : '';
  }

  const REGION_ORDER = ['Europe', 'North America', 'Australia & NZ', 'North Asia', 'South Asia', 'Southeast Asia', 'Middle East & Africa'];

  const routeSel = document.getElementById('cc-route');
  const table = document.getElementById('cc-table');
  if (!routeSel || !table) return;

  // Populated once the Worker fetch below resolves; render() and the change
  // listener both close over this same reference.
  let DATA = {};

  // Vertical divider (border-l) on every data cell except the first (label)
  // column — gives the grid real column structure without turning it into a
  // harsh spreadsheet look.
  function cell(html) {
    const td = document.createElement('td');
    td.className = 'px-6 py-5 border-t border-l border-neutral-100 text-[15px] leading-snug text-neutral-700';
    td.innerHTML = html;
    return td;
  }

  // Cash/miles arrive from the Worker as structured numbers (cashLow/cashHigh,
  // milesAmount/milesProgram), not pre-formatted strings — formatted here so
  // Airtable stays the single source of truth for the raw figures.
  function formatCash(a) {
    if (a.cashLow == null || a.cashHigh == null) return '';
    return `SGD ${Number(a.cashLow).toLocaleString()}–${Number(a.cashHigh).toLocaleString()}`;
  }

  function formatMiles(a) {
    if (a.milesAmount == null) return '';
    return `from ${Number(a.milesAmount).toLocaleString()}${a.milesProgram ? ' ' + a.milesProgram : ''} each way`;
  }

  function render(dest) {
    const d = DATA[dest];
    if (!d) return;

    const flag = flagImg(ROUTE_FLAGS[dest]);
    document.getElementById('cc-dest-code').innerHTML = dest + (flag ? ' ' + flag : '');
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
          ${a.verified ? '<span class="savings-badge-gold mt-2"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified</span>' : ''}
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
      'cc-row-cash': (a) => cell(`<span class="cc-num font-bold text-neutral-900">${formatCash(a)}</span><span class="block text-xs font-medium text-neutral-500 mt-0.5">${a.cashNote}</span>`),
      'cc-row-miles': (a) => cell(`<span class="cc-num font-medium">${formatMiles(a)}</span>`),
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

  fetch(WORKER_URL + '/airtable/cabin-compare')
    .then((r) => {
      if (!r.ok) throw new Error('Cabin Compare data unavailable');
      return r.json();
    })
    .then((data) => {
      DATA = data.routes || {};
      const routeCount = document.getElementById('cc-route-count');
      const n = Object.keys(DATA).length;
      if (routeCount) routeCount.textContent = n + (n === 1 ? ' route displayed' : ' routes displayed');
      if (!n) return;

      /* Build the grouped route selector (region optgroups) */
      REGION_ORDER.forEach((region) => {
        const og = document.createElement('optgroup');
        og.label = region;
        Object.entries(DATA).filter(([, d]) => d.region === region).forEach(([code, d]) => {
          const opt = document.createElement('option');
          opt.value = code;
          // Native <option> elements can't render <img> tags, so no flag icon
          // here — the destination flag still shows in the flight-strip header.
          opt.textContent = d.name + ' (' + code + ')';
          og.appendChild(opt);
        });
        routeSel.appendChild(og);
      });

      routeSel.addEventListener('change', (e) => render(e.target.value));

      // Deep-link support: ?route=CODE (e.g. from the homepage hero search
      // modal's "Compare cabins on this route" link) selects that route on
      // load and scrolls the comparison card into view. Falls back to LHR,
      // or the first available route if LHR isn't in the live data.
      const requestedRoute = new URLSearchParams(location.search).get('route');
      const fallbackRoute = DATA.LHR ? 'LHR' : Object.keys(DATA)[0];
      const initialRoute = requestedRoute && DATA[requestedRoute.toUpperCase()] ? requestedRoute.toUpperCase() : fallbackRoute;
      routeSel.value = initialRoute;
      render(initialRoute);
      if (initialRoute !== 'LHR') {
        document.getElementById('cc-compare-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    })
    .catch((err) => {
      console.error('Cabin Compare: failed to load route data.', err);
      const routeCount = document.getElementById('cc-route-count');
      if (routeCount) routeCount.textContent = 'Routes unavailable';
    });
});
