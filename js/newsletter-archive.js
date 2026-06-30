(function () {
  var WORKER_URL    = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var PAYMENT_LINK  = 'https://buy.stripe.com/test_7sYaEX9Ujd0qbg8gGv3oA00';

  // ─── Altitude Access modal (shared by index.html and pages/newsletter.html) ──

  function ensureModal() {
    if (document.getElementById('altitude-access-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'altitude-access-modal';
    modal.className = 'fixed inset-0 z-[300] items-center justify-center p-4';
    modal.style.display = 'none';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-brand-950/65 backdrop-blur-sm" onclick="window.closeAltitudeAccessModal()"></div>' +
      '<div class="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">' +
        '<button onclick="window.closeAltitudeAccessModal()" ' +
          'class="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:bg-neutral-200 transition-colors">' +
          '<i class="fa-solid fa-xmark text-xs"></i>' +
        '</button>' +
        '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-5">' +
          '<i class="fa-solid fa-crown text-[9px]"></i> Altitude Exclusive' +
        '</div>' +
        '<h2 class="text-xl font-display font-bold text-neutral-900 mb-2 tracking-tight">This issue is for Altitude members</h2>' +
        '<p class="text-sm text-neutral-400 mb-6 leading-relaxed">Unlock this issue and the full archive — award alerts, cabin reviews, and routing strategies, delivered weekly.</p>' +
        '<a href="' + PAYMENT_LINK + '" class="w-full btn-pill btn-pill-primary inline-flex items-center justify-center gap-2 mb-4">' +
          '<i class="fa-solid fa-crown text-[10px]"></i> Get Altitude Access — $4.99/mo' +
        '</a>' +
        '<p class="text-xs text-neutral-400">Already a member? ' +
          '<button type="button" onclick="window.switchToMemberAccessModal()" class="text-brand-600 underline underline-offset-2 hover:text-brand-800">Enter your email for a magic link</button>' +
        '</p>' +
      '</div>';

    document.body.appendChild(modal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.closeAltitudeAccessModal();
    });
  }

  window.openAltitudeAccessModal = function () {
    ensureModal();
    document.getElementById('altitude-access-modal').style.display = 'flex';
  };

  window.closeAltitudeAccessModal = function () {
    var modal = document.getElementById('altitude-access-modal');
    if (modal) modal.style.display = 'none';
  };

  // ─── Member Access modal (magic link request) ────────────────────────────────

  function ensureMemberAccessModal() {
    if (document.getElementById('member-access-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'member-access-modal';
    modal.className = 'fixed inset-0 z-[300] items-center justify-center p-4';
    modal.style.display = 'none';
    modal.innerHTML =
      '<div class="absolute inset-0 bg-brand-950/65 backdrop-blur-sm" onclick="window.closeMemberAccessModal()"></div>' +
      '<div class="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">' +
        '<button onclick="window.closeMemberAccessModal()" ' +
          'class="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:bg-neutral-200 transition-colors">' +
          '<i class="fa-solid fa-xmark text-xs"></i>' +
        '</button>' +
        '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-100 bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-widest mb-5">' +
          '<i class="fa-solid fa-key text-[9px]"></i> Member Access' +
        '</div>' +
        '<h2 class="text-xl font-display font-bold text-neutral-900 mb-1.5 tracking-tight">Access your membership</h2>' +
        '<p class="text-sm text-neutral-400 mb-6 leading-relaxed">Enter your member email and we\'ll send you a secure login link.</p>' +
        '<form id="member-access-form">' +
          '<input id="member-access-email" type="email" autocomplete="email" placeholder="member@email.com" ' +
            'class="w-full mb-2 px-5 py-3.5 rounded-full border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' +
          '<p class="text-[11px] text-neutral-400 mb-4 px-1 leading-relaxed">' +
            '<i class="fa-solid fa-circle-info text-[9px] mr-1"></i>One link gets you in and lets you manage your billing too.' +
          '</p>' +
          '<button id="member-access-btn" type="submit" class="w-full btn-pill btn-pill-primary">Send Login Link</button>' +
          '<p id="member-access-status" class="text-xs mt-3 text-center min-h-[1.25rem]"></p>' +
        '</form>' +
        '<div id="member-access-sent" style="display:none;">' +
          '<div class="flex flex-col items-center text-center gap-3 py-2">' +
            '<div class="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">' +
              '<i class="fa-solid fa-envelope-circle-check text-brand-600 text-lg"></i>' +
            '</div>' +
            '<div>' +
              '<p class="text-sm font-semibold text-neutral-900 mb-1">Check your inbox</p>' +
              '<p class="text-xs text-neutral-400 leading-relaxed">We sent a login link to <strong id="member-access-sent-email" class="text-neutral-700"></strong>. It\'s valid for 1 hour and you can use it as many times as you need during that window.</p>' +
            '</div>' +
            '<button type="button" onclick="window.openMemberAccessModal()" class="text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800 transition-colors mt-1">Use a different email</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.getElementById('member-access-form').addEventListener('submit', handleMemberAccessSubmit);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.closeMemberAccessModal();
    });
  }

  function handleMemberAccessSubmit(e) {
    e.preventDefault();
    var input  = document.getElementById('member-access-email');
    var btn    = document.getElementById('member-access-btn');
    var status = document.getElementById('member-access-status');
    var email  = (input ? input.value : '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'text-xs text-red-500 mt-2'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending link…'; }
    if (status) { status.textContent = ''; }

    fetch(WORKER_URL + '/altitude/magic-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.sent) {
          var form = document.getElementById('member-access-form');
          var sent = document.getElementById('member-access-sent');
          var sentEmail = document.getElementById('member-access-sent-email');
          if (form) form.style.display = 'none';
          if (sent) sent.style.display = 'block';
          if (sentEmail) sentEmail.textContent = email;
        } else {
          var msg = res.data.error || 'No active Altitude membership found for this email.';
          if (res.status === 429) msg = 'Too many requests. Please wait a few minutes before trying again.';
          if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
          if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
        }
      })
      .catch(function () {
        if (status) { status.textContent = 'Network error. Please try again.'; status.className = 'text-xs text-red-500 mt-2'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      });
  }

  window.openMemberAccessModal = function () {
    ensureMemberAccessModal();
    var form = document.getElementById('member-access-form');
    var sent = document.getElementById('member-access-sent');
    if (form) form.style.display = '';
    if (sent) sent.style.display = 'none';
    var status = document.getElementById('member-access-status');
    if (status) status.textContent = '';
    var btn = document.getElementById('member-access-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
    document.getElementById('member-access-modal').style.display = 'flex';
    setTimeout(function () {
      var inp = document.getElementById('member-access-email');
      if (inp) inp.focus();
    }, 80);
  };

  window.closeMemberAccessModal = function () {
    var modal = document.getElementById('member-access-modal');
    if (modal) modal.style.display = 'none';
  };

  window.switchToMemberAccessModal = function () {
    window.closeAltitudeAccessModal();
    window.openMemberAccessModal();
  };

  // ─── Entry point ───────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (typeof fetch === 'undefined') return;
    fetch(WORKER_URL + '/newsletter/posts')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.posts || !data.posts.length) return;
        // Cache post list in sessionStorage so the detail page can use it for related posts
        try { sessionStorage.setItem('skyfare_posts', JSON.stringify(data)); } catch (_) {}
        renderFeatured(data.posts[0]);
        renderArchive(data.posts);
      })
      .catch(function () {
        // Fetch failed — static fallback HTML remains in place.
      });
  }

  // ─── Featured issue (compact horizontal card) ──────────────────────────────

  function renderFeatured(post) {
    var container = document.getElementById('featured-issue-container');
    if (!container) return;

    var prem     = isPremium(post);
    var issueNum = getIssueNum(post);
    var date     = formatDate(post.published_at);

    var tags = (post.content_tags || []).filter(function (t) {
      return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/);
    }).slice(0, 2);

    var tagHtml = tags.map(function (t, i) {
      var cls = i === 0
        ? 'text-[10px] font-bold uppercase tracking-widest text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full'
        : 'text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full';
      return '<span class="' + cls + '">' + e(t) + '</span>';
    }).join('');

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '"' +
          ' class="w-full h-full object-cover' + (prem ? '' : ' group-hover:scale-[1.03] transition-transform duration-500') + '">'
      : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-plane text-white/15 text-4xl -rotate-12"></i></div>';

    // Access badge (bottom-left of image)
    var accessBadge = prem
      ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 backdrop-blur-sm border border-amber-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-crown text-[8px]"></i> Altitude</span>'
      : '<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-black/30 backdrop-blur-sm border border-emerald-500/20 px-2 py-0.5 rounded-full"><i class="fa-solid fa-unlock text-[8px]"></i> Free</span>';

    // Lock icon (top-right, premium only)
    var lockOverlay = prem
      ? '<div class="absolute top-3 right-3"><div class="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm border border-amber-500/30 flex items-center justify-center"><i class="fa-solid fa-lock text-amber-300 text-[8px]"></i></div></div>'
      : '';

    // CTA — bottom of content panel
    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 group-hover:text-amber-800 transition-colors self-start">' +
            'Get Altitude Access <i class="fa-solid fa-arrow-right text-[10px]"></i></span>'
      : '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors self-start">' +
            'Read Issue ' + e(issueNum) + ' <i class="fa-solid fa-arrow-right text-[10px]"></i></span>';

    // Wrapper: clickable <a> for free (opens the issue), clickable <div> for premium (opens the access modal)
    var href     = 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug);
    var cardBorder = prem ? 'border-amber-200/60 hover:shadow-lg' : 'border-neutral-100 hover:shadow-lg';

    var wrapOpen = prem
      ? '<div onclick="window.openAltitudeAccessModal()" class="group flex h-52 max-w-5xl mx-auto rounded-2xl overflow-hidden border ' + cardBorder + ' shadow-sm transition-all duration-300 slide-up cursor-pointer" style="animation-delay:.05s;">'
      : '<a href="' + href + '" class="group flex h-52 max-w-5xl mx-auto rounded-2xl overflow-hidden border ' + cardBorder + ' shadow-sm transition-all duration-300 slide-up" style="animation-delay:.05s;">';
    var wrapClose = prem ? '</div>' : '</a>';

    container.innerHTML =
      wrapOpen +

        '<div class="relative w-2/5 md:w-72 flex-shrink-0 bg-brand-950 overflow-hidden">' +
          imgHtml +
          '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.5) 0%,transparent 55%);"></div>' +
          '<div class="absolute top-3 left-3">' +
            '<span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full">Issue ' + e(issueNum) + '</span>' +
          '</div>' +
          lockOverlay +
          '<div class="absolute bottom-3 left-3">' + accessBadge + '</div>' +
        '</div>' +

        '<div class="flex-1 bg-white p-5 md:p-7 flex flex-col justify-center min-w-0">' +
          (tagHtml ? '<div class="flex flex-wrap gap-1 mb-3">' + tagHtml + '</div>' : '') +
          '<h2 class="text-base md:text-lg font-display font-bold text-neutral-900 leading-snug mb-2 ' + (prem ? '' : 'group-hover:text-brand-700') + ' transition-colors">' + e(post.title) + '</h2>' +
          (post.subtitle ? '<p class="text-xs text-neutral-400 mb-3 font-medium truncate">' + e(post.subtitle) + '</p>' : '') +
          (date ? '<div class="flex items-center gap-2 text-xs text-neutral-400 mb-4"><i class="fa-regular fa-calendar text-[10px]"></i><span>' + e(date) + '</span></div>' : '') +
          ctaHtml +
        '</div>' +

      wrapClose;

    container.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });

    var dateEl = document.querySelector('[data-section="latest-issue"] [data-issue-date]');
    if (dateEl && date) dateEl.textContent = date;
  }

  // ─── Archive grid ──────────────────────────────────────────────────────────

  function renderArchive(posts) {
    var grid  = document.getElementById('archive-grid');
    var count = document.getElementById('archive-count');
    if (!grid) return;

    grid.innerHTML = posts.map(function (post, index) {
      return buildArchiveCard(post, index);
    }).join('');

    if (count) {
      count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');
    }

    grid.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  function buildArchiveCard(post, index) {
    var prem     = isPremium(post);
    var issueNum = getIssueNum(post);
    var date     = formatDate(post.published_at);
    var delay    = index * 0.05;

    var type = (post.content_tags || []).filter(function (t) {
      return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/);
    })[0] || 'Newsletter';

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '"' +
          ' class="w-full h-full object-cover' + (prem ? '' : ' group-hover:scale-105 transition-transform duration-500') + '">'
      : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-plane text-white/15 text-4xl -rotate-12"></i></div>';

    var altitudeBadge = prem
      ? '<div class="absolute bottom-3 left-3"><span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 backdrop-blur-sm border border-amber-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-crown text-[7px]"></i> Altitude</span></div>'
      : '';

    var lockIcon = prem
      ? '<div class="absolute top-3 right-3"><div class="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm border border-amber-500/30 flex items-center justify-center"><i class="fa-solid fa-lock text-amber-300 text-[8px]"></i></div></div>'
      : '';

    var href = 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug);

    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 group-hover:text-amber-800 transition-colors">' +
            'Get Altitude Access <i class="fa-solid fa-arrow-right text-[10px]"></i></span>' +
            '<p class="text-[10px] text-neutral-400 mt-1 italic">Already a member? Check your email.</p>'
      : '<a href="' + href + '"' +
            ' class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">' +
            'Read <i class="fa-solid fa-arrow-right text-[10px]"></i></a>';

    var cardCls = 'group bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 slide-up ' +
      (prem ? 'border-amber-200/60 hover:shadow-md cursor-pointer' : 'border-neutral-100 hover:shadow-md');

    var titleCls = 'text-sm font-display font-bold text-neutral-900 mb-3 transition-colors leading-snug' +
      (prem ? '' : ' group-hover:text-brand-700');

    var clickAttr = prem ? ' onclick="window.openAltitudeAccessModal()"' : '';

    return '<article class="' + cardCls + '"' + clickAttr + ' style="animation-delay:' + delay + 's;">' +
      '<div class="relative h-44 bg-brand-950 overflow-hidden">' +
        imgHtml +
        '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.45) 0%,transparent 60%);"></div>' +
        '<div class="absolute top-3 left-3">' +
          '<span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/80 backdrop-blur-sm px-2.5 py-1 rounded-full">Issue ' + e(issueNum) + '</span>' +
        '</div>' +
        '<div class="absolute bottom-3 right-3">' +
          '<span class="text-[10px] font-semibold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">' + e(type) + '</span>' +
        '</div>' +
        altitudeBadge +
        lockIcon +
      '</div>' +
      '<div class="p-5">' +
        (date ? '<p class="text-[10px] text-neutral-400 mb-1.5 font-medium">' + e(date) + '</p>' : '') +
        '<h3 class="' + titleCls + '">' + e(post.title) + '</h3>' +
        ctaHtml +
      '</div>' +
    '</article>';
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function isPremium(post) {
    return !!post.is_premium;
  }

  function getIssueNum(post) {
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      var m = String(tags[i]).toLowerCase().match(/issue[-_]?(\d+)/);
      if (m) return m[1].padStart(2, '0');
    }
    return '01';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (err) { return ''; }
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
