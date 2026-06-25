(function () {
  var WORKER_URL     = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var PREMIUM_WA_URL = 'https://api.whatsapp.com/send?phone=6581575306&text=' +
    encodeURIComponent("Hi Skyfare, I'd like to upgrade to Altitude Premium.");

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
      ? '<a href="' + PREMIUM_WA_URL + '" target="_blank" rel="noopener noreferrer"' +
            ' class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors self-start">' +
            'Get Premium Access <i class="fa-solid fa-arrow-right text-[10px]"></i></a>'
      : '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors self-start">' +
            'Read Issue ' + e(issueNum) + ' <i class="fa-solid fa-arrow-right text-[10px]"></i></span>';

    // Wrapper: clickable <a> for free, non-clickable <div> for premium
    var href     = 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug);
    var cardBorder = prem ? 'border-amber-200/60' : 'border-neutral-100 hover:shadow-lg';

    var wrapOpen = prem
      ? '<div class="flex h-52 max-w-5xl mx-auto rounded-2xl overflow-hidden border ' + cardBorder + ' shadow-sm transition-all duration-300 slide-up" style="animation-delay:.05s;">'
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
      ? '<a href="' + PREMIUM_WA_URL + '" target="_blank" rel="noopener noreferrer"' +
            ' class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors">' +
            'Get Premium Access <i class="fa-solid fa-arrow-right text-[10px]"></i></a>' +
            '<p class="text-[10px] text-neutral-400 mt-1 italic">Already have access? Check your email.</p>'
      : '<a href="' + href + '"' +
            ' class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">' +
            'Read <i class="fa-solid fa-arrow-right text-[10px]"></i></a>';

    var cardCls = 'group bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 slide-up ' +
      (prem ? 'border-amber-200/60' : 'border-neutral-100 hover:shadow-md');

    var titleCls = 'text-sm font-display font-bold text-neutral-900 mb-3 transition-colors leading-snug' +
      (prem ? '' : ' group-hover:text-brand-700');

    return '<article class="' + cardCls + '" style="animation-delay:' + delay + 's;">' +
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
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] === 'altitude-premium') return true;
    }
    return false;
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
