// --- UTILS ---
    

    

    // Award dataset
    const awards = [
      // SE Asia
      {
        to: 'Brunei (BWN)',
        region: 'SE Asia',
        saver: 22000,
        advantage: 33000
      },
      {
        to: 'Denpasar / Bali (DPS)',
        region: 'SE Asia',
        saver: 22000,
        advantage: 33000
      },
      {
        to: 'Jakarta (CGK)',
        region: 'SE Asia',
        saver: 22000,
        advantage: 33000
      },
      {
        to: 'Kuala Lumpur (KUL)',
        region: 'SE Asia',
        saver: 22000,
        advantage: 33000
      },
      {
        to: 'Bangkok (BKK)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Cebu (CEB)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Da Nang (DAD)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Hanoi (HAN)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Ho Chi Minh (SGN)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Manila (MNL)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Phnom Penh (PNH)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Phuket (HKT)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      {
        to: 'Yangon (RGN)',
        region: 'SE Asia',
        saver: 25000,
        advantage: 37000
      },
      // NE Asia
      {
        to: 'Chengdu (CTU)',
        region: 'NE Asia',
        saver: 35500,
        advantage: 53000
      },
      {
        to: 'Chongqing (CKG)',
        region: 'NE Asia',
        saver: 35500,
        advantage: 53000
      },
      {
        to: 'Guangzhou (CAN)',
        region: 'NE Asia',
        saver: 35500,
        advantage: 53000
      },
      {
        to: 'Hong Kong (HKG)',
        region: 'NE Asia',
        saver: 35500,
        advantage: 53000
      },
      {
        to: 'Taipei (TPE)',
        region: 'NE Asia',
        saver: 35500,
        advantage: 53000
      },
      {
        to: 'Beijing (PEK)',
        region: 'NE Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Shanghai (PVG)',
        region: 'NE Asia',
        saver: 45000,
        advantage: 67500
      },
      // South Asia
      {
        to: 'Ahmedabad (AMD)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Bengaluru (BLR)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Chennai (MAA)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Cochin (COK)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Colombo (CMB)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Delhi (DEL)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Dhaka (DAC)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Hyderabad (HYD)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Kathmandu (KTM)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Kolkata (CCU)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Male / Maldives (MLE)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      {
        to: 'Mumbai (BOM)',
        region: 'South Asia',
        saver: 45000,
        advantage: 67500
      },
      // Japan/Korea
      {
        to: 'Busan (PUS)',
        region: 'Japan/Korea',
        saver: 54500,
        advantage: 82000
      },
      {
        to: 'Fukuoka (FUK)',
        region: 'Japan/Korea',
        saver: 54500,
        advantage: 82000
      },
      {
        to: 'Osaka (KIX)',
        region: 'Japan/Korea',
        saver: 54500,
        advantage: 82000
      },
      {
        to: 'Seoul (ICN)',
        region: 'Japan/Korea',
        saver: 54500,
        advantage: 82000
      },
      {
        to: 'Tokyo (NRT/HND)',
        region: 'Japan/Korea',
        saver: 54500,
        advantage: 82000
      },
      // Oceania
      {
        to: 'Darwin (DRW)',
        region: 'Oceania',
        saver: 42500,
        advantage: 64000
      },
      {
        to: 'Perth (PER)',
        region: 'Oceania',
        saver: 42500,
        advantage: 64000
      },
      {
        to: 'Adelaide (ADL)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Auckland (AKL)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Brisbane (BNE)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Cairns (CNS)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Christchurch (CHC)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Melbourne (MEL)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      {
        to: 'Sydney (SYD)',
        region: 'Oceania',
        saver: 72000,
        advantage: 108000
      },
      // Africa/Middle East
      {
        to: 'Cape Town (CPT)',
        region: 'Africa/Middle East',
        saver: 68000,
        advantage: 102000
      },
      {
        to: 'Dubai (DXB)',
        region: 'Africa/Middle East',
        saver: 68000,
        advantage: 102000
      },
      {
        to: 'Istanbul (IST)',
        region: 'Africa/Middle East',
        saver: 68000,
        advantage: 102000
      },
      {
        to: 'Johannesburg (JNB)',
        region: 'Africa/Middle East',
        saver: 68000,
        advantage: 102000
      },
      // Europe
      {
        to: 'Amsterdam (AMS)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Barcelona (BCN)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Brussels (BRU)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Copenhagen (CPH)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Frankfurt (FRA)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'London (LHR)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Manchester (MAN)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Milan (MXP)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Munich (MUC)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Paris (CDG)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Rome (FCO)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      {
        to: 'Zurich (ZRH)',
        region: 'Europe',
        saver: 108500,
        advantage: 163000
      },
      // N. America
      {
        to: 'Los Angeles (LAX)',
        region: 'N. America',
        saver: 112500,
        advantage: 169000
      },
      {
        to: 'San Francisco (SFO)',
        region: 'N. America',
        saver: 112500,
        advantage: 169000
      },
      {
        to: 'Seattle (SEA)',
        region: 'N. America',
        saver: 112500,
        advantage: 169000
      },
      {
        to: 'Houston (IAH)',
        region: 'N. America',
        saver: 117000,
        advantage: 176000
      },
      {
        to: 'New York (JFK)',
        region: 'N. America',
        saver: 117000,
        advantage: 176000
      },
    ];

    const tbody = document.getElementById('awardBody');
    const filter = document.getElementById('regionFilter');
    const search = document.getElementById('searchRoute');

    function draw(rows) {
      if (!tbody) return;
      tbody.innerHTML = '';
      rows.forEach((r, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-brand-50/60 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 text-sm font-bold text-neutral-300 tabular-nums">${index + 1}</td>
            <td class="px-6 py-4 text-sm font-semibold text-neutral-900">Singapore <span class="text-brand-400">&rarr;</span> ${r.to}</td>
            <td class="px-6 py-4 text-center"><span class="inline-block px-2.5 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold uppercase tracking-wider">${r.region}</span></td>
            <td class="px-6 py-4 text-right text-sm font-bold text-neutral-900 tabular-nums">${r.saver.toLocaleString()}<span class="text-neutral-400 font-medium"> mi</span></td>
            <td class="px-6 py-4 text-right text-sm font-semibold text-neutral-500 tabular-nums">${r.advantage.toLocaleString()}<span class="text-neutral-400 font-normal"> mi</span></td>
          `;
        tbody.appendChild(tr);
      });
    }

    function applyFilters() {
      const region = filter?.value || 'all';
      const q = (search?.value || '').toLowerCase();
      let rows = awards;
      if (region !== 'all') rows = rows.filter(r => r.region === region);
      if (q) rows = rows.filter(r => (r.to + r.region).toLowerCase().includes(q));
      draw(rows);
    }

    filter?.addEventListener('change', applyFilters);
    search?.addEventListener('input', applyFilters);
    draw(awards);