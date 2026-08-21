// Shared testimonial rendering — used by both index.html (the Client Stories
// showcase) and pages/testimonials.html (testimonials-archive-grid). One
// module, one card builder, so approvals in Airtable show up identically
// in both places.
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
  // byte-identical output to before. The homepage showcase uses its own
  // buildFeaturedCard()/buildLatestItemCard() instead of this variant path.
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

  // The single large center card in the homepage showcase. Background photo
  // is the reviewer's own Profile Image when Airtable has one; falls back to
  // real Skyfare photography (never a stock/fabricated image) otherwise.
  function buildFeaturedCard(t) {
    var img = t.image || 'images/page-images/our-flights.jpg';
    var labelParts = [];
    if (t.route && t.route.length) labelParts.push(t.route[0]);
    if (t.airline) labelParts.push(t.airline);
    var context = esc(labelParts.join(' · '));
    var roleText = esc(t.role || labelParts.join(', '));
    return (
      '<div class="testimonials-featured-card__media"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async"></div>' +
      '<span class="testimonials-featured-card__label"><i class="fa-solid fa-quote-left" aria-hidden="true"></i>' + esc(t.name) + (context ? ' · ' + context : '') + '</span>' +
      '<div class="testimonials-featured-card__stars">' + starsHtml(t.rating) + '</div>' +
      '<blockquote class="testimonials-featured-card__quote">&quot;' + esc(t.quote) + '&quot;</blockquote>' +
      '<p class="testimonials-featured-card__byline"><strong>' + esc(t.name) + '</strong>' + (roleText ? '<span>' + roleText + '</span>' : '') + '</p>'
    );
  }

  // Compact card for the vertical "latest reviews" marquee. hidden=true marks
  // the duplicated second copy of the list as aria-hidden, same convention as
  // the horizontal airline-logo marquee's "Set 2" duplicate (index.html).
  function buildLatestItemCard(t, hidden) {
    var avatar = t.image
      ? '<img src="' + esc(t.image) + '" alt="" loading="lazy" decoding="async">'
      : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-user text-brand-200 text-xs"></i></div>';
    return (
      '<div class="testimonials-latest-item"' + (hidden ? ' aria-hidden="true"' : '') + '>' +
        '<div class="testimonials-latest-item__head">' +
          '<div class="testimonials-latest-item__avatar">' + avatar + '</div>' +
          '<div class="testimonials-latest-item__meta">' +
            '<strong>' + esc(t.name) + '</strong>' +
            '<div class="testimonials-latest-item__stars">' + starsHtml(t.rating) + '</div>' +
          '</div>' +
        '</div>' +
        '<blockquote>&quot;' + esc(t.quote) + '&quot;</blockquote>' +
      '</div>'
    );
  }

  // Shared average-rating math — used by the homepage stat card and the hero
  // social-proof strip so the two numbers can never drift apart.
  function computeRatingStats(list) {
    var withRating = list.filter(function (t) { return parseInt(t.rating, 10) > 0; });
    var avg = withRating.length
      ? withRating.reduce(function (sum, t) { return sum + parseInt(t.rating, 10); }, 0) / withRating.length
      : 5;
    return { avg: avg, avgRounded: (Math.round(avg * 10) / 10).toFixed(1) };
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

  function initHomepageShowcase() {
    var showcase = document.getElementById('home-testimonials-showcase');
    if (!showcase) return;
    var fallback = document.getElementById('home-testimonials-status');

    function showFallback() {
      showcase.classList.add('hidden');
      if (fallback) fallback.classList.remove('hidden');
    }

    function renderFeatured(t) {
      var el = document.getElementById('home-testimonial-featured');
      if (!el) return;
      el.classList.remove('animate-pulse');
      el.innerHTML = buildFeaturedCard(t);
    }

    function renderLatest(list) {
      var track = document.getElementById('home-testimonials-latest-track');
      if (!track) return;
      var wrap = track.closest('.testimonials-latest');
      if (!list.length) {
        if (wrap) wrap.classList.add('hidden');
        return;
      }
      var real = list.map(function (t) { return buildLatestItemCard(t, false); }).join('');
      var dup = list.map(function (t) { return buildLatestItemCard(t, true); }).join('');
      track.innerHTML = real + dup;
      if (wrap && window.SkyMarquee) window.SkyMarquee.init(wrap, { axis: 'y' });
    }

    // Rating average + review count — degrades quietly on its own (doesn't
    // hide the already-rendered featured/latest cards if only this call fails).
    function loadStats() {
      return fetchTestimonials({ limit: 100 })
        .then(function (result) {
          var list = result.testimonials;
          if (!list.length) throw new Error('empty');
          var stats = computeRatingStats(list);
          var ratingEl = document.getElementById('home-testimonial-avg-rating');
          var countEl = document.getElementById('home-testimonial-review-count');
          if (ratingEl) ratingEl.textContent = stats.avgRounded;
          if (countEl) {
            var count = list.length + (result.offset ? '+' : '');
            countEl.innerHTML = 'Based on <strong>' + esc(count) + '</strong> verified traveler reviews';
          }
        })
        .catch(function () {
          var ratingWrap = document.querySelector('.testimonials-stat-card__rating');
          if (ratingWrap) ratingWrap.classList.add('hidden');
          var countEl = document.getElementById('home-testimonial-review-count');
          if (countEl) countEl.textContent = 'Trusted by real Skyfare travelers.';
        });
    }

    // Featured (center, exactly one) + the 4 latest reviews minus the featured
    // one. Falls back to the single most recent approved testimonial when
    // nothing is flagged Featured yet, so the layout never breaks on an empty
    // flag — still real data, never fabricated.
    function loadFeaturedAndLatest() {
      return fetchTestimonials({ scope: 'featured', limit: 3 })
        .then(function (result) {
          if (result.testimonials.length) return result.testimonials[0];
          return fetchTestimonials({ limit: 1 }).then(function (r) { return r.testimonials[0] || null; });
        })
        .then(function (featured) {
          if (!featured) throw new Error('no_testimonials');
          renderFeatured(featured);
          return fetchTestimonials({ limit: 6 }).then(function (latestResult) {
            var latest = latestResult.testimonials
              .filter(function (t) { return t.id !== featured.id; })
              .slice(0, 4);
            renderLatest(latest);
          });
        });
    }

    loadFeaturedAndLatest().then(loadStats).catch(showFallback);
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

        var stats = computeRatingStats(list);
        var avg = stats.avg;
        var avgRounded = stats.avgRounded;

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
    initHomepageShowcase();
    initArchivePage();
    initHeroSocialProof();
  });
})();
