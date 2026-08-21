// Shared testimonial rendering — used by both index.html (home-testimonials-grid)
// and pages/testimonials.html (testimonials-archive-grid). One module, one card
// builder, so approvals in Airtable show up identically in both places.
(function () {
  var WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  function starsHtml(rating) {
    var r = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<i class="fa-' + (i <= r ? 'solid' : 'regular') + ' fa-star text-xs"></i>';
    }
    return html;
  }

  function avatarHtml(t) {
    if (t.image) {
      return '<img src="' + esc(t.image) + '" alt="' + esc(t.name) + '" loading="lazy" decoding="async"' +
        ' class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105">';
    }
    return '<div class="w-full h-full flex items-center justify-center bg-brand-50">' +
      '<i class="fa-solid fa-user text-brand-200 text-3xl"></i></div>';
  }

  // variantClass defaults to the original 'card-utility' look so
  // pages/testimonials.html (which calls this with no 3rd argument) renders
  // byte-identical output to before. The homepage grid is the only caller
  // that passes a variant ('card-utility testimonial-card-v2') — see
  // initHomepageGrid() below.
  function buildTestimonialCard(t, index, variantClass) {
    variantClass = variantClass || 'card-utility';
    var quoteMark = variantClass.indexOf('testimonial-card-v2') !== -1
      ? '<span class="tquote-mark-v2">&ldquo;</span>'
      : '<i class="fa-solid fa-quote-left text-brand-500/15 text-2xl"></i>';
    // No .slide-up here: the page's scroll-reveal IntersectionObserver (js/header.js)
    // only observes elements present at initial page load, since these cards are
    // injected later via innerHTML after an async fetch, they'd never be observed
    // and would stay permanently at .slide-up's opacity:0.
    // Instead use .reveal-stagger — a self-triggering CSS animation that fires when
    // the element enters the DOM, with a per-card animation-delay for the cascade.
    return (
      '<div class="' + variantClass + ' reveal-stagger group overflow-hidden flex flex-col" style="animation-delay:' + ((index || 0) * 0.08) + 's;">' +
        '<div class="h-56 flex-shrink-0 overflow-hidden">' + avatarHtml(t) + '</div>' +
        '<div class="flex-1 p-6 flex flex-col">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<div class="flex gap-0.5 text-gold">' + starsHtml(t.rating) + '</div>' +
            quoteMark +
          '</div>' +
          '<blockquote class="text-neutral-600 text-sm leading-relaxed italic flex-1 mb-5">&quot;' + esc(t.quote) + '&quot;</blockquote>' +
          '<div class="pt-4 border-t border-neutral-100">' +
            '<p class="font-semibold text-neutral-900 text-sm">' + esc(t.name) + '</p>' +
            '<p class="text-[10px] text-brand-500 font-bold uppercase tracking-widest mt-0.5">' + esc(t.role) + '</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // Explicit closures around .map (not `testimonials.map(buildTestimonialCard)`)
  // on purpose: Array.map calls its callback with (element, index, array), so
  // passing buildTestimonialCard directly would silently pass the whole array
  // in as variantClass.
  function renderInto(containerId, testimonials, variantClass) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = testimonials.map(function (t, i) { return buildTestimonialCard(t, i, variantClass); }).join('');
  }

  // Resolves { testimonials, offset } — offset is Airtable's opaque pagination
  // token, present when more results exist beyond this page, null otherwise.
  function fetchTestimonials(opts) {
    opts = opts || {};
    var params = new URLSearchParams();
    if (opts.scope) params.set('scope', opts.scope);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', opts.offset);
    var qs = params.toString();
    return fetch(WORKER_URL + '/airtable/testimonials' + (qs ? '?' + qs : ''))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('bad_response')); })
      .then(function (data) {
        return { testimonials: (data && data.testimonials) || [], offset: (data && data.offset) || null };
      });
  }

  function initHomepageGrid() {
    var grid = document.getElementById('home-testimonials-grid');
    if (!grid) return;
    var fallback = document.getElementById('home-testimonials-status');

    function showFallback() {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      if (fallback) fallback.classList.remove('hidden');
    }

    fetchTestimonials({ scope: 'featured', limit: 3 })
      .then(function (result) {
        if (!result.testimonials.length) {
          showFallback();
          return;
        }
        grid.classList.remove('hidden');
        if (fallback) fallback.classList.add('hidden');
        renderInto('home-testimonials-grid', result.testimonials, 'card-utility testimonial-card-v2');
      })
      .catch(showFallback);
  }

  function initHeroSocialProof() {
    var wrap = document.getElementById('hero-social-proof');
    if (!wrap) return;

    function showFallback() {
      var avatars = document.getElementById('hero-social-proof-avatars');
      var stars = document.getElementById('hero-social-proof-stars');
      var text = document.getElementById('hero-social-proof-text');
      if (avatars) {
        avatars.innerHTML = '<div class="w-9 h-9 rounded-full ring-2 ring-white/80 bg-white/15 flex items-center justify-center"><i class="fa-solid fa-user text-white/70 text-xs"></i></div>' +
          '<div class="w-9 h-9 rounded-full ring-2 ring-white/80 bg-white/15 flex items-center justify-center"><i class="fa-solid fa-user text-white/70 text-xs"></i></div>' +
          '<div class="w-9 h-9 rounded-full ring-2 ring-white/80 bg-white/15 flex items-center justify-center"><i class="fa-solid fa-user text-white/70 text-xs"></i></div>';
      }
      if (stars) stars.innerHTML = '<i class="fa-regular fa-star text-xs"></i><i class="fa-regular fa-star text-xs"></i><i class="fa-regular fa-star text-xs"></i><i class="fa-regular fa-star text-xs"></i><i class="fa-regular fa-star text-xs"></i>';
      if (text) text.textContent = 'Client ratings and stories';
      wrap.classList.remove('hidden');
      wrap.classList.add('flex');
    }

    fetchTestimonials({ limit: 100 })
      .then(function (result) {
        var list = result.testimonials;
        if (!list.length) return showFallback();

        var withRating = list.filter(function (t) { return parseInt(t.rating, 10) > 0; });
        var avg = withRating.length
          ? withRating.reduce(function (sum, t) { return sum + parseInt(t.rating, 10); }, 0) / withRating.length
          : 5;
        var avgRounded = (Math.round(avg * 10) / 10).toFixed(1);

        // Clear skeleton placeholders before injecting the real avatars/stars/text.
        // Note: intentionally NOT reusing avatarHtml() here — it bakes in
        // group-hover:scale-105 for the big testimonial cards, which would
        // make these small stacked avatars jump in front of each other on hover.
        var avatars = document.getElementById('hero-social-proof-avatars');
        avatars.innerHTML = '';
        list.slice(0, 5).forEach(function (t) {
          var el = document.createElement('div');
          el.className = 'w-9 h-9 rounded-full ring-2 ring-white/80 overflow-hidden bg-brand-50 flex-shrink-0';
          el.innerHTML = t.image
            ? '<img src="' + esc(t.image) + '" alt="' + esc(t.name) + '" class="w-full h-full object-cover object-center">'
            : '<div class="w-full h-full flex items-center justify-center bg-brand-50"><i class="fa-solid fa-user text-brand-200 text-sm"></i></div>';
          avatars.appendChild(el);
        });

        var stars = document.getElementById('hero-social-proof-stars');
        stars.innerHTML = starsHtml(Math.round(avg));

        var count = list.length + (result.offset ? '+' : '');
        var text = document.getElementById('hero-social-proof-text');
        text.textContent = avgRounded + ' rating · ' + count + ' happy travelers';
      })
      .catch(showFallback);
  }

  function showState(id, show) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
  }

  var ARCHIVE_PAGE_SIZE = 9;

  function initArchivePage() {
    var grid = document.getElementById('testimonials-archive-grid');
    if (!grid) return;

    var loadMoreBtn = document.getElementById('testimonials-load-more');
    var currentOffset = null;

    function loadPage(offset, append) {
      if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading…';
      }

      return fetchTestimonials({ limit: ARCHIVE_PAGE_SIZE, offset: offset })
        .then(function (result) {
          showState('testimonials-loading', false);

          if (!append && !result.testimonials.length) {
            showState('testimonials-empty', true);
            return;
          }

          if (append) {
            grid.insertAdjacentHTML('beforeend', result.testimonials.map(function (t, i) { return buildTestimonialCard(t, i); }).join(''));
          } else {
            renderInto('testimonials-archive-grid', result.testimonials);
            showState('testimonials-archive-grid', true);
          }

          currentOffset = result.offset;
          if (loadMoreBtn) {
            loadMoreBtn.classList.toggle('hidden', !currentOffset);
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More';
          }
        })
        .catch(function () {
          showState('testimonials-loading', false);
          if (!append) showState('testimonials-error', true);
        });
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        loadPage(currentOffset, true);
      });
    }

    showState('testimonials-loading', true);
    showState('testimonials-empty', false);
    showState('testimonials-error', false);
    showState('testimonials-archive-grid', false);
    loadPage(null, false);
  }

  window.SkyTestimonials = {
    fetchTestimonials: fetchTestimonials,
    buildTestimonialCard: buildTestimonialCard,
    renderInto: renderInto,
  };

  document.addEventListener('DOMContentLoaded', function () {
    initHomepageGrid();
    initArchivePage();
    initHeroSocialProof();
  });
})();
