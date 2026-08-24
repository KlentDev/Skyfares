(function () {
  var WORKER_URL    = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var IN_PAGES_DIR = window.location.pathname.indexOf('/pages/') !== -1;
  var PAGE_PREFIX = IN_PAGES_DIR ? '' : 'pages/';
  var ALTITUDE_PRICING_URL = PAGE_PREFIX + 'altitude';

  // "Welcome to Skyfare" is Skyfare's first-ever published issue and acts as
  // the onboarding entry point for new visitors -- it's always pinned to
  // position #1 on the newsletter archive, homepage preview, and the free
  // newsletter modal (js/newsletter-modal.js keeps an identical copy of
  // isPinnedPost/withPinnedFirst since it loads independently on pages that
  // don't include this file).
  var PINNED_POST_ID   = 'post_288fd061-e1ff-485d-ab16-20767b42fde5';
  var PINNED_POST_SLUG = 'welcome-to-skyfare';

  function isPinnedPost(post) {
    if (!post) return false;
    if (post.id && post.id === PINNED_POST_ID) return true;
    if (post.slug && post.slug === PINNED_POST_SLUG) return true;
    return false;
  }

  // Pinned post first (if present in `posts`), then the rest in their
  // existing (newest-first) order. Falls back to a plain slice if the
  // pinned post isn't in the list, so nothing breaks if it's ever
  // unpublished or excluded by a filter.
  function withPinnedFirst(posts, limit) {
    var pinned = posts.filter(isPinnedPost)[0];
    var rest = posts.filter(function (p) { return !isPinnedPost(p); });
    var ordered = pinned ? [pinned].concat(rest) : rest;
    return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
  }

  // The newest issue that isn't the pinned one -- gets its own "Latest"
  // badge so it stays visually distinct from the "Pinned" card next to it.
  // `_latestNonPinnedId` is set right before each render call below, scoped
  // to whatever list (filtered archive vs. homepage preview) is being built.
  var _latestNonPinnedId = null;

  function getLatestNonPinnedId(posts) {
    var latest = posts.filter(function (p) { return !isPinnedPost(p); })[0];
    return latest ? latest.id : null;
  }

  // ─── Altitude Access modal for pages/newsletter.html ───────────────────────

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
        '<p class="text-sm text-neutral-400 mb-6 leading-relaxed">Already have Altitude? Request a magic link. New here? Choose Monthly or Annual to unlock premium issues and the full archive.</p>' +
        '<a href="' + ALTITUDE_PRICING_URL + '" class="w-full btn-pill btn-pill-primary inline-flex items-center justify-center gap-2 mb-4">' +
          '<i class="fa-solid fa-crown text-[10px]"></i> View Altitude Access' +
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
    wireFreeNewsletterChoice();
    if (typeof fetch === 'undefined') return;
    fetch(WORKER_URL + '/newsletter/posts')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.posts || !data.posts.length) {
          renderEmptyState('No issues are published yet.');
          renderHomeEmpty();
          return;
        }
        // Cache post list in sessionStorage so the detail page can use it for related posts
        try { sessionStorage.setItem('skyfare_posts', JSON.stringify(data)); } catch (_) {}
        renderFeatured(data.posts[0]);
        renderHomePreview(withPinnedFirst(data.posts, 3));

        _archiveAllPosts = data.posts;
        _archiveTopic = _initialTopicFromQuery();
        _wireAccessFilters();
        _wireTopicFilters();
        _renderFilteredArchive();
      })
      .catch(function () {
        renderEmptyState('Unable to load issues right now. Please refresh in a moment.');
        renderHomeEmpty();
      });
  }

  // ─── Featured issue (compact horizontal card) ──────────────────────────────

  function renderFeatured(post) {
    var container = document.getElementById('featured-issue-container');
    if (!container) return;

    var prem     = isPremium(post);
    var date     = formatDate(post.published_at);
    var author   = (post.authors || []).join(', ');
    var summary  = getPostSummary(post);

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

    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-gold-dark group-hover:text-gold transition-colors self-start">' +
            'Unlock with Altitude <i class="fa-solid fa-arrow-right text-[10px]"></i></span>'
      : '<span class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors self-start">' +
            'Read Issue <i class="fa-solid fa-arrow-right text-[10px]"></i></span>';

    // Wrapper: clickable <a> for free (opens the issue), clickable <div> for premium (opens the access modal)
    var href     = getPublicPostUrl(post);
    var localHref = getLocalPostUrl(post);
    var beehiivHref = post && post.url ? withBeehiivLoginModal(post.url) : localHref;
    var freeChoiceAttrs = !prem
      ? ' data-free-newsletter-choice="true" data-local-url="' + e(localHref) + '" data-beehiiv-url="' + e(beehiivHref) + '"'
      : '';
    var cardCls  = 'card-utility newsletter-featured-card-v2 group flex max-w-5xl mx-auto overflow-hidden slide-up' +
      (prem ? ' border-gold/30 hover:border-gold/60 cursor-pointer' : '');

    var wrapOpen = prem
      ? '<div onclick="window.openAltitudeAccessModal()" class="' + cardCls + '" style="animation-delay:.05s;">'
      : '<a href="' + e(href) + '"' + freeChoiceAttrs + ' class="' + cardCls + '" style="animation-delay:.05s;">';
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
          '<h3 class="newsletter-featured-title-v2 font-display font-bold text-neutral-900 leading-snug mb-2 ' + (prem ? '' : 'group-hover:text-brand-700') + ' transition-colors">' + e(post.title) + '</h3>' +
          (summary ? '<p class="newsletter-featured-excerpt-v2 mb-3">' + e(summary) + '</p>' : '') +
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

    _latestNonPinnedId = getLatestNonPinnedId(posts);
    grid.innerHTML = posts.map(function (post, index) {
      return buildArchiveCard(post, index);
    }).join('');

    if (count) {
      count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');
    }

    grid.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ─── Access + topic filters (#archive-access-filters, #archive-topic-select) ───
  // data-topic values are the display labels ("Airlines", etc), but Beehiiv
  // always stores/returns a post's content_tags lowercased regardless of the
  // tag's configured display casing -- confirmed live: a post tagged
  // "Airlines" comes back with content_tags containing "airlines". So every
  // content_tags match here is case-insensitive. The two filters (access,
  // topic) are independent and AND-combined, mirroring js/altitude-portal.js's
  // free/premium + topic filtering on the private archive.

  var _archiveAllPosts = [];
  var _archiveAccess = 'all';
  var _archiveTopic = 'all';
  var VALID_TOPICS = ['Credit/Debit Cards', 'Airlines', 'News', 'Redemption Availability'];

  function _initialTopicFromQuery() {
    try {
      var tag = new URLSearchParams(window.location.search).get('tag');
      if (!tag) return 'all';
      var match = VALID_TOPICS.filter(function (t) { return t.toLowerCase() === tag.toLowerCase(); })[0];
      return match || 'all';
    } catch (err) { return 'all'; }
  }

  function _getFilteredArchivePosts() {
    var posts = _archiveAllPosts;
    if (_archiveAccess === 'free') {
      posts = posts.filter(function (p) { return !p.is_premium; });
    } else if (_archiveAccess === 'premium') {
      posts = posts.filter(function (p) { return !!p.is_premium; });
    }
    if (_archiveTopic !== 'all') {
      var topicLower = _archiveTopic.toLowerCase();
      posts = posts.filter(function (p) {
        return (p.content_tags || []).some(function (t) { return t.toLowerCase() === topicLower; });
      });
    }
    return withPinnedFirst(posts);
  }

  function _renderFilteredArchive() {
    renderArchive(_getFilteredArchivePosts());
    document.querySelectorAll('#archive-access-filters [data-access]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.access === _archiveAccess);
    });
    var select = document.getElementById('archive-topic-select');
    if (select) select.value = _archiveTopic;
  }

  function _applyAccessFilter(access) {
    _archiveAccess = access || 'all';
    _renderFilteredArchive();
  }

  function _applyTopicFilter(topic) {
    _archiveTopic = topic || 'all';
    _renderFilteredArchive();
  }

  function _wireAccessFilters() {
    document.querySelectorAll('#archive-access-filters [data-access]').forEach(function (btn) {
      btn.addEventListener('click', function () { _applyAccessFilter(btn.dataset.access); });
    });
  }

  function _wireTopicFilters() {
    var select = document.getElementById('archive-topic-select');
    if (select) select.addEventListener('change', function () { _applyTopicFilter(select.value); });
  }

  function renderHomePreview(posts) {
    var grid = document.getElementById('home-newsletter-grid');
    if (!grid) return;

    if (!posts || !posts.length) {
      grid.innerHTML = '';
      return;
    }

    _latestNonPinnedId = getLatestNonPinnedId(posts);
    grid.innerHTML = buildHomePreview(posts);

    grid.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  function renderHomeEmpty() {
    var grid = document.getElementById('home-newsletter-grid');
    if (grid) {
      grid.innerHTML = '<div class="newsletter-home-v5__empty"><p class="newsletter-home-v5__empty-label">Publication loading</p><p>Browse the <a href="pages/newsletter">full newsletter archive</a> while the latest issues are refreshed.</p></div>';
    }
  }

  // Homepage-only editorial composition. The archive keeps buildArchiveCard()
  // so its filtering and historical browsing remain unchanged; this renderer
  // only changes the way the same three API records are previewed on index.html.
  function buildHomePreview(posts) {
    var featured = posts[0];
    var latest = posts.slice(1, 3);
    return buildHomeFeature(featured) +
      '<div class="newsletter-home-v5__latest" aria-label="Latest newsletter issues">' +
        latest.map(function (post, index) { return buildHomeLatest(post, index); }).join('') +
      '</div>';
  }

  function buildHomeFeature(post) {
    var prem = isPremium(post);
    var image = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '" loading="lazy">'
      : '<div class="newsletter-home-v5__image-empty"><i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i></div>';
    var href = getPublicPostUrl(post);
    var localHref = getLocalPostUrl(post);
    var beehiivHref = post && post.url ? withBeehiivLoginModal(post.url) : localHref;
    var attrs = !prem
      ? ' data-free-newsletter-choice="true" data-local-url="' + e(localHref) + '" data-beehiiv-url="' + e(beehiivHref) + '"'
      : '';
    var wrapper = prem
      ? '<article class="newsletter-home-v5__feature newsletter-home-v5__feature--locked" tabindex="0" role="button" aria-label="Unlock ' + e(post.title) + '" onclick="window.openAltitudeAccessModal()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.openAltitudeAccessModal();}">'
      : '<a href="' + e(href) + '"' + attrs + ' class="newsletter-home-v5__feature">';
    var summary = getPostSummary(post);
    var type = getPostType(post);
    var meta = [type, formatDate(post.published_at)].filter(Boolean).join(' · ');
    var cta = prem ? 'Unlock with Altitude' : 'Read issue';

    return wrapper +
      '<div class="newsletter-home-v5__feature-media">' + image + '<span class="newsletter-home-v5__start-label"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Start here</span></div>' +
      '<div class="newsletter-home-v5__feature-copy">' +
        '<p class="newsletter-home-v5__kicker">Pinned feature</p>' +
        '<h3>' + e(post.title) + '</h3>' +
        (summary ? '<p class="newsletter-home-v5__summary">' + e(summary) + '</p>' : '') +
        (meta ? '<p class="newsletter-home-v5__meta">' + e(meta) + '</p>' : '') +
        '<span class="newsletter-home-v5__read-link">' + cta + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>' +
      '</div>' +
    (prem ? '</article>' : '</a>');
  }

  function buildHomeLatest(post, index) {
    var prem = isPremium(post);
    var image = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="" loading="lazy">'
      : '<div class="newsletter-home-v5__latest-image-empty"><i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i></div>';
    var href = getPublicPostUrl(post);
    var localHref = getLocalPostUrl(post);
    var beehiivHref = post && post.url ? withBeehiivLoginModal(post.url) : localHref;
    var attrs = !prem
      ? ' data-free-newsletter-choice="true" data-local-url="' + e(localHref) + '" data-beehiiv-url="' + e(beehiivHref) + '"'
      : '';
    var wrapper = prem
      ? '<article class="newsletter-home-v5__latest-item newsletter-home-v5__latest-item--locked" tabindex="0" role="button" aria-label="Unlock ' + e(post.title) + '" onclick="window.openAltitudeAccessModal()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.openAltitudeAccessModal();}">'
      : '<a href="' + e(href) + '"' + attrs + ' class="newsletter-home-v5__latest-item">';
    var summary = getPostSummary(post);
    var meta = [getPostType(post), formatDate(post.published_at)].filter(Boolean).join(' · ');
    var label = index === 0 ? 'Latest issue' : 'Recent issue';
    var cta = prem ? 'Unlock' : 'Read';

    return wrapper +
      '<div class="newsletter-home-v5__latest-media">' + image + '</div>' +
      '<div class="newsletter-home-v5__latest-copy">' +
        '<p class="newsletter-home-v5__latest-label">' + e(label) + '</p>' +
        '<h3>' + e(post.title) + '</h3>' +
        (summary ? '<p class="newsletter-home-v5__latest-summary">' + e(summary) + '</p>' : '') +
        '<div class="newsletter-home-v5__latest-footer">' +
          (meta ? '<span class="newsletter-home-v5__meta">' + e(meta) + '</span>' : '') +
          '<span class="newsletter-home-v5__read-link">' + cta + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>' +
        '</div>' +
      '</div>' +
    (prem ? '</article>' : '</a>');
  }

  function getPostType(post) {
    return (post.content_tags || []).filter(function (t) {
      return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/i);
    })[0] || 'Newsletter';
  }

  function getPostSummary(post) {
    var summary = String(post.subtitle || post.excerpt || post.description || '').trim();
    if (summary) return summary;
    if (isPinnedPost(post)) {
      return 'Start with the first Skyfare briefing: how the newsletter helps you spot better routes, cabin opportunities, and smarter ways to use miles.';
    }
    return '';
  }

  function renderEmptyState(message) {
    var featured = document.getElementById('featured-issue-container');
    var grid = document.getElementById('archive-grid');
    var count = document.getElementById('archive-count');
    var dateEl = document.querySelector('[data-section="latest-issue"] [data-issue-date]');

    if (dateEl) dateEl.textContent = 'Unavailable';
    if (count) count.textContent = '0 issues';
    if (featured) {
      featured.innerHTML =
        '<div class="card-utility h-52 max-w-5xl mx-auto flex items-center justify-center text-center slide-up is-visible">' +
          '<div>' +
            '<p class="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Archive Unavailable</p>' +
            '<p class="mt-2 text-sm text-neutral-400">' + e(message) + '</p>' +
          '</div>' +
        '</div>';
    }
    if (grid) {
      grid.innerHTML =
        '<div class="card-utility p-6 text-center text-sm text-neutral-400 slide-up is-visible sm:col-span-2 lg:col-span-3">' +
          e(message) +
        '</div>';
    }
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

    var href = getPublicPostUrl(post);
    var localHref = getLocalPostUrl(post);
    var beehiivHref = post && post.url ? withBeehiivLoginModal(post.url) : localHref;
    var freeChoiceAttrs = !prem
      ? ' data-free-newsletter-choice="true" data-local-url="' + e(localHref) + '" data-beehiiv-url="' + e(beehiivHref) + '"'
      : '';

    var ctaHtml = prem
      ? '<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark group-hover:text-gold transition-colors">' +
            'Unlock with Altitude <i class="fa-solid fa-arrow-right text-[10px]"></i></span>' +
            '<p class="text-[10px] text-neutral-400 mt-1 italic">Already a member? Request a magic link.</p>'
      : '<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 group-hover:text-brand-800 transition-colors">' +
            'Read <i class="fa-solid fa-arrow-right text-[10px]"></i></span>';

    var pinned = isPinnedPost(post);
    // The card at index 0 (whatever post is currently first -- the pinned
    // post whenever one survives the active filter, otherwise just the
    // newest match) gets a wider "lead" layout so the archive isn't a wall
    // of identical cards. Purely layout/shadow, never color-coded, since
    // index 0 isn't always the actual pinned post once filters are applied.
    var isLead = index === 0;
    // Only the lead card shows an excerpt -- its wider column otherwise
    // reads as an empty gap next to the title (getPostSummary() falls back
    // to the pinned post's own onboarding blurb when there's no
    // subtitle/excerpt/description on the post itself).
    var leadSummary = isLead ? getPostSummary(post) : '';

    var cardCls = 'group card-utility overflow-hidden slide-up' +
      (prem ? ' border-gold/30 hover:border-gold/60 cursor-pointer' : '') +
      (pinned ? ' newsletter-pinned-v2' : '') +
      (isLead ? ' newsletter-archive-lead-v2' : '');

    var titleCls = (isLead ? 'newsletter-archive-lead-v2__title ' : 'text-sm ') +
      'font-display font-bold text-neutral-900 mb-3 transition-colors leading-snug' +
      (prem ? '' : ' group-hover:text-brand-700');

    var pinnedBadge = pinned
      ? '<span class="newsletter-pinned-badge-v2"><i class="fa-solid fa-thumbtack text-[9px]"></i> Pinned &middot; Start Here</span>'
      : '';
    var latestBadge = (!pinned && post.id && post.id === _latestNonPinnedId)
      ? '<span class="newsletter-latest-badge-v2"><i class="fa-solid fa-bolt text-[9px]"></i> Latest</span>'
      : '';

    var wrapOpen = prem
      ? '<article class="' + cardCls + '" onclick="window.openAltitudeAccessModal()" style="animation-delay:' + delay + 's;">'
      : '<a href="' + e(href) + '"' + freeChoiceAttrs + ' class="' + cardCls + ' block" style="animation-delay:' + delay + 's;">';
    var wrapClose = prem ? '</article>' : '</a>';

    return wrapOpen +
      '<div class="relative h-44 bg-brand-950 overflow-hidden' + (isLead ? ' newsletter-archive-lead-v2__media' : '') + '">' +
        imgHtml +
        '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.45) 0%,transparent 60%);"></div>' +
        '<div class="absolute top-3 left-3">' + accessBadge + '</div>' +
        '<div class="absolute bottom-3 right-3">' +
          '<span class="text-[10px] font-semibold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">' + e(type) + '</span>' +
        '</div>' +
        lockIcon +
      '</div>' +
      pinnedBadge + latestBadge +
      '<div class="p-5' + (isLead ? ' newsletter-archive-lead-v2__body' : '') + '">' +
        (metaLine ? '<p class="text-[10px] text-neutral-400 mb-1.5 font-medium">' + e(metaLine) + '</p>' : '') +
        (isLead
          ? '<div class="newsletter-archive-lead-v2__center">' +
              '<h3 class="' + titleCls + '">' + e(post.title) + '</h3>' +
              (leadSummary ? '<p class="newsletter-featured-excerpt-v2">' + e(leadSummary) + '</p>' : '') +
            '</div>' +
            '<div class="newsletter-archive-lead-v2__cta">' + ctaHtml + '</div>'
          : '<h3 class="' + titleCls + '">' + e(post.title) + '</h3>' + ctaHtml) +
      '</div>' +
    wrapClose;
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

  function getPublicPostUrl(post) {
    if (post && post.url) return post.url;
    return getLocalPostUrl(post);
  }

  function getLocalPostUrl(post) {
    return PAGE_PREFIX + 'newsletter-detail?slug=' + encodeURIComponent(post && post.slug ? post.slug : '');
  }

  function withBeehiivLoginModal(url) {
    if (!url) return '';
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'modal=login';
  }

  function wireFreeNewsletterChoice() {
    if (document.body.dataset.freeNewsletterChoiceWired === 'true') return;
    document.body.dataset.freeNewsletterChoiceWired = 'true';
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[data-free-newsletter-choice="true"]');
      if (!link) return;
      event.preventDefault();
      openFreeNewsletterChoiceModal(
        link.getAttribute('data-local-url') || link.href,
        link.getAttribute('data-beehiiv-url') || link.href
      );
    });
  }

  function openFreeNewsletterChoiceModal(localUrl, beehiivUrl) {
    if (!window.SkyUI || !window.SkyUI.modal) {
      window.location.href = localUrl || beehiivUrl;
      return;
    }

    SkyUI.modal({
      title: 'Choose where to read',
      variant: 'read-choice',
      html:
        '<p><strong>Read on Skyfare</strong> is the fastest way to read this issue — it opens instantly, right here, with nothing else to set up.</p>' +
        '<div class="sky-modal__beehiiv-note">' +
          '<p><strong>Prefer Beehiiv?</strong> You can read it there instead, verify your email, and use native likes and comments.</p>' +
          '<ol class="mt-2 list-decimal pl-5 leading-relaxed">' +
            '<li>Verify your email on Beehiiv if asked.</li>' +
            '<li>Beehiiv sends a one-time code.</li>' +
            '<li>Enter the code to verify your email.</li>' +
            '<li>Then read, like, and comment on the newsletter.</li>' +
          '</ol>' +
        '</div>',
      actions: [
        {
          label: 'Read on Skyfare',
          style: 'primary-lg',
          onClick: function () {
            if (localUrl) window.location.href = localUrl;
          },
        },
        {
          label: 'Read on Beehiiv instead',
          style: 'link',
          onClick: function () {
            window.location.href = beehiivUrl || localUrl;
          },
        },
      ],
    });
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
