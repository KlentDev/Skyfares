(function () {
  var WORKER_URL    = 'https://skyfares-altitude.klent-5fa.workers.dev';

  // DISABLED (temporarily) -- Altitude Premium isn't purchasable yet (confirmed
  // by Sahej, 2026-07-03). PAYMENT_LINK is kept commented, not deleted, so real
  // checkout can be restored below by uncommenting once Premium launches.
  // var PAYMENT_LINK = 'https://buy.stripe.com/test_7sYaEX9Ujd0qbg8gGv3oA00';

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
        // DISABLED (temporarily) -- original copy + real checkout link, restore when Premium launches:
        // '<p class="text-sm text-neutral-400 mb-6 leading-relaxed">Unlock this issue and the full archive — award alerts, cabin reviews, and routing strategies, delivered weekly.</p>' +
        // '<a href="' + PAYMENT_LINK + '" class="w-full btn-pill btn-pill-primary inline-flex items-center justify-center gap-2 mb-4">' +
        //   '<i class="fa-solid fa-crown text-[10px]"></i> Get Altitude Access — $4.99/mo' +
        // '</a>' +
        '<p class="text-sm text-neutral-400 mb-6 leading-relaxed">Altitude isn\'t open for purchase yet — join the waitlist and we\'ll email you the moment it is.</p>' +
        '<a href="pre-signup-link" class="w-full btn-pill btn-pill-primary inline-flex items-center justify-center gap-2 mb-4">' +
          '<i class="fa-solid fa-bell text-[10px]"></i> Join the Waitlist' +
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

  // Member Access (magic link request) now lives entirely in the shared
  // modal -- components/magic-modal.html, loaded globally by header.js as
  // js/magic-modal.js. This used to be a private copy (member-access-modal
  // + its own fetch/submit handling, byte-for-byte duplicated from
  // index.html's copy); removed in favor of the one shared instance.
  window.switchToMemberAccessModal = function () {
    window.closeAltitudeAccessModal();
    window.openLoginModal && window.openLoginModal();
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
    var date     = formatDate(post.published_at);
    var author   = (post.authors || []).join(', ');

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
      : '<div class="w-full h-full flex items-center justify-center"><span class="text-[11px] font-bold uppercase tracking-widest text-white/25">No Thumbnail</span></div>';

    // Access badge (top-left of image) — Free (blue) or Premium (gold)
    var accessBadge = prem
      ? '<span class="text-[10px] font-bold uppercase tracking-widest text-gold-light bg-black/50 backdrop-blur-sm border border-gold/40 px-2.5 py-1 rounded-full"><i class="fa-solid fa-crown text-[8px]"></i> Premium</span>'
      : '<span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full"><i class="fa-solid fa-unlock text-[8px]"></i> Free</span>';

    // Lock icon (top-right, premium only)
    var lockOverlay = prem
      ? '<div class="absolute top-3 right-3"><div class="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm border border-gold/30 flex items-center justify-center"><i class="fa-solid fa-lock text-gold-light text-[8px]"></i></div></div>'
      : '';

    // CTA — bottom of content panel
    // DISABLED (temporarily) -- original label, restore when Premium launches:
    // 'Get Altitude Access <i class="fa-solid fa-arrow-right text-[10px]"></i></span>'
    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-gold-dark group-hover:text-gold transition-colors self-start">' +
            'Coming Soon <i class="fa-solid fa-arrow-right text-[10px]"></i></span>'
      : '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors self-start">' +
            'Read Issue <i class="fa-solid fa-arrow-right text-[10px]"></i></span>';

    // Wrapper: clickable <a> for free (opens the issue), clickable <div> for premium (opens the access modal)
    var href     = 'newsletter-detail?slug=' + encodeURIComponent(post.slug);
    var cardCls  = 'card-utility group flex h-52 max-w-5xl mx-auto overflow-hidden slide-up' +
      (prem ? ' border-gold/30 hover:border-gold/60 cursor-pointer' : '');

    var wrapOpen = prem
      ? '<div onclick="window.openAltitudeAccessModal()" class="' + cardCls + '" style="animation-delay:.05s;">'
      : '<a href="' + href + '" class="' + cardCls + '" style="animation-delay:.05s;">';
    var wrapClose = prem ? '</div>' : '</a>';

    container.innerHTML =
      wrapOpen +

        '<div class="relative w-2/5 md:w-72 flex-shrink-0 bg-brand-950 overflow-hidden">' +
          imgHtml +
          '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.5) 0%,transparent 55%);"></div>' +
          '<div class="absolute top-3 left-3">' + accessBadge + '</div>' +
          lockOverlay +
        '</div>' +

        '<div class="flex-1 bg-white p-5 md:p-7 flex flex-col justify-center min-w-0">' +
          (tagHtml ? '<div class="flex flex-wrap gap-1 mb-3">' + tagHtml + '</div>' : '') +
          '<h3 class="text-base md:text-lg font-display font-bold text-neutral-900 leading-snug mb-2 ' + (prem ? '' : 'group-hover:text-brand-700') + ' transition-colors">' + e(post.title) + '</h3>' +
          (post.subtitle ? '<p class="text-xs text-neutral-400 mb-3 font-medium truncate">' + e(post.subtitle) + '</p>' : '') +
          (author ? '<div class="flex items-center gap-2 text-xs text-neutral-400 mb-1.5"><i class="fa-regular fa-user text-[10px]"></i><span>' + e(author) + '</span></div>' : '') +
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
    var date     = formatDate(post.published_at);
    var author   = (post.authors || []).join(', ');
    var metaLine = [author ? 'By ' + author : '', date].filter(Boolean).join(' · ');
    var delay    = index * 0.05;

    var type = (post.content_tags || []).filter(function (t) {
      return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/);
    })[0] || 'Newsletter';

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '"' +
          ' class="w-full h-full object-cover' + (prem ? '' : ' group-hover:scale-105 transition-transform duration-500') + '">'
      : '<div class="w-full h-full flex items-center justify-center"><span class="text-[11px] font-bold uppercase tracking-widest text-white/25">No Thumbnail</span></div>';

    // Access badge (top-left of image) — Free (blue) or Premium (gold)
    var accessBadge = prem
      ? '<span class="text-[10px] font-bold uppercase tracking-widest text-gold-light bg-black/50 backdrop-blur-sm border border-gold/40 px-2.5 py-1 rounded-full"><i class="fa-solid fa-crown text-[8px]"></i> Premium</span>'
      : '<span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/80 backdrop-blur-sm px-2.5 py-1 rounded-full"><i class="fa-solid fa-unlock text-[8px]"></i> Free</span>';

    var lockIcon = prem
      ? '<div class="absolute top-3 right-3"><div class="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm border border-gold/30 flex items-center justify-center"><i class="fa-solid fa-lock text-gold-light text-[8px]"></i></div></div>'
      : '';

    var href = 'newsletter-detail?slug=' + encodeURIComponent(post.slug);

    // DISABLED (temporarily) -- original label, restore when Premium launches:
    // 'Get Altitude Access <i class="fa-solid fa-arrow-right text-[10px]"></i></span>' +
    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark group-hover:text-gold transition-colors">' +
            'Coming Soon <i class="fa-solid fa-arrow-right text-[10px]"></i></span>' +
            '<p class="text-[10px] text-neutral-400 mt-1 italic">Already a member? Check your email.</p>'
      : '<a href="' + href + '"' +
            ' class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">' +
            'Read <i class="fa-solid fa-arrow-right text-[10px]"></i></a>';

    var cardCls = 'group card-utility overflow-hidden slide-up' +
      (prem ? ' border-gold/30 hover:border-gold/60 cursor-pointer' : '');

    var titleCls = 'text-sm font-display font-bold text-neutral-900 mb-3 transition-colors leading-snug' +
      (prem ? '' : ' group-hover:text-brand-700');

    var clickAttr = prem ? ' onclick="window.openAltitudeAccessModal()"' : '';

    return '<article class="' + cardCls + '"' + clickAttr + ' style="animation-delay:' + delay + 's;">' +
      '<div class="relative h-44 bg-brand-950 overflow-hidden">' +
        imgHtml +
        '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.45) 0%,transparent 60%);"></div>' +
        '<div class="absolute top-3 left-3">' + accessBadge + '</div>' +
        '<div class="absolute bottom-3 right-3">' +
          '<span class="text-[10px] font-semibold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">' + e(type) + '</span>' +
        '</div>' +
        lockIcon +
      '</div>' +
      '<div class="p-5">' +
        (metaLine ? '<p class="text-[10px] text-neutral-400 mb-1.5 font-medium">' + e(metaLine) + '</p>' : '') +
        '<h3 class="' + titleCls + '">' + e(post.title) + '</h3>' +
        ctaHtml +
      '</div>' +
    '</article>';
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function isPremium(post) {
    return !!post.is_premium;
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
