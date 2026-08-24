// --- UTILS ---




    // --- AWARD TABLE LOGIC ---
    const awards = (window.SKYFARE_MILEAGE_ROUTES || { routes: [] }).routes;

    const ROUTE_FLAGS = {
      BWN:'cambodia.png', DPS:'indonesia.png', CGK:'indonesia.png', KUL:'malaysia.png', BKK:'thailand.png', CEB:'philippines.png', DAD:'vietnam.png',
      HAN:'vietnam.png', SGN:'vietnam.png', MNL:'philippines.png', PNH:'cambodia.png', HKT:'thailand.png', RGN:'myanmar.png',
      CTU:'china.png', CKG:'china.png', CAN:'china.png', HKG:'hong-kong.png', TPE:'taiwan.png', PEK:'china.png', PVG:'china.png',
      AMD:'india.png', BLR:'india.png', MAA:'india.png', COK:'india.png', CMB:'sri-lanka.png', DEL:'india.png', DAC:'bangladesh.png',
      HYD:'india.png', KTM:'nepal.png', CCU:'india.png', MLE:'maldives.png', BOM:'india.png',
      PUS:'south-korea.png', FUK:'japan.png', KIX:'japan.png', ICN:'south-korea.png', 'NRT/HND':'japan.png',
      DRW:'australia.png', PER:'australia.png', ADL:'australia.png', AKL:'new-zealand.png', BNE:'australia.png', CNS:'australia.png', CHC:'new-zealand.png',
      MEL:'australia.png', SYD:'australia.png',
      CPT:'south-africa.png', DXB:'united-arab-emirates.png', IST:'turkey.png', JNB:'south-africa.png',
      AMS:'netherlands.png', BCN:'spain.png', BRU:'belgium.png', CPH:'denmark.png', FRA:'germany.png', LHR:'united-kingdom.png', MAN:'united-kingdom.png',
      MXP:'italy.png', MUC:'germany.png', CDG:'france.png', FCO:'italy.png', ZRH:'switzerland.png',
      LAX:'united-states.png', SFO:'united-states.png', SEA:'united-states.png', IAH:'united-states.png', JFK:'united-states.png'
    };

    function flagImg(file) {
      return file ? `<img src="../logos/flags/${file}" alt="" class="inline-block w-4 h-4 rounded-full object-cover align-[-3px] mx-0.5">` : '';
    }

    function flagFor(to) {
      const m = /\(([^)]+)\)/.exec(to);
      return flagImg(m && ROUTE_FLAGS[m[1]]);
    }

    const SIN_FLAG = flagImg('singapore.png');
    const tbody = document.getElementById('awardBody');
    const regionFilter = document.getElementById('regionFilter');
    const searchRoute = document.getElementById('searchRoute');

    function drawTable(rows) {
      if (!tbody) return;
      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.className =
          "group hover:bg-brand-50 transition-all duration-200 border-b border-neutral-100 last:border-0";
        tr.innerHTML = `
            <td class="px-8 py-5 text-sm font-bold text-brand-950 transition-colors group-hover:text-brand-600">Singapore ${SIN_FLAG} <span class="text-brand-400">&rarr;</span> ${flagFor(r.to)} ${r.to}</td>
            <td class="px-8 py-5 text-sm font-black text-neutral-400 text-center uppercase tracking-widest"><span class="px-3 py-1 bg-neutral-100 rounded-full text-[10px] transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">${r.region}</span></td>
            <td class="px-8 py-5 text-right font-bold text-neutral-600 font-mono transition-colors group-hover:text-brand-700">${r.saver.toLocaleString()} mi</td>
            <td class="px-8 py-5 text-right font-bold text-neutral-600 font-mono transition-colors group-hover:text-brand-700">${r.advantage.toLocaleString()} mi</td>
          `;
        tbody.appendChild(tr);
      });
    }

    function applyFilters() {
      const region = regionFilter?.value || 'all';
      const q = (searchRoute?.value || '').toLowerCase();
      let rows = awards;
      if (region !== 'all') rows = rows.filter(r => r.region === region);
      if (q) rows = rows.filter(r => (r.to + r.region).toLowerCase().includes(q));
      drawTable(rows);
    }

    regionFilter?.addEventListener('change', applyFilters);
    searchRoute?.addEventListener('input', applyFilters);
    drawTable(awards);
