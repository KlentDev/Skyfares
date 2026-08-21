/**
 * Free newsletter sign-up modal ("Join our free Newsletter").
 *
 * Markup lives in components/free-newsletter-modal.html (fetched once,
 * injected into <body>) instead of being duplicated inline per page --
 * mirrors the js/magic-modal.js pattern used for the shared login modal.
 *
 * window.openNewsletterModal() is exposed so any on-page trigger (e.g. the
 * "Get the Free Brief" link in the homepage Newsletter Preview section) can
 * reopen the same instance manually from explicit subscribe triggers.
 *
 * Guarded against double-injection in case this ever loads twice.
 */
(function () {
  if (document.getElementById('altitude-popup') || window.__altitudeModalLoading) return;
  window.__altitudeModalLoading = true;

  var componentUrl = (window.location.pathname.includes('/pages/') ? '../' : '') + 'components/free-newsletter-modal.html';
  var WORKER_URL   = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var PAGE_PREFIX  = (window.location.pathname.includes('/pages/') ? '' : 'pages/');

  // "Welcome to Skyfare" is Skyfare's first-ever published issue and acts as
  // the onboarding entry point for new visitors -- always pinned to slide
  // #1 here, and to position #1 on the newsletter archive/homepage preview
  // (js/newsletter-archive.js keeps an identical copy of these two helpers
  // since it loads independently and isn't included on every page this
  // modal appears on).
  var PINNED_POST_ID   = 'post_288fd061-e1ff-485d-ab16-20767b42fde5';
  var PINNED_POST_SLUG = 'welcome-to-skyfare';

  function isPinnedPost(post) {
    if (!post) return false;
    if (post.id && post.id === PINNED_POST_ID) return true;
    if (post.slug && post.slug === PINNED_POST_SLUG) return true;
    return false;
  }

  function withPinnedFirst(posts, limit) {
    var pinned = posts.filter(isPinnedPost)[0];
    var rest = posts.filter(function (p) { return !isPinnedPost(p); });
    var ordered = pinned ? [pinned].concat(rest) : rest;
    return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
  }

  // Same "Latest" concept as js/newsletter-archive.js -- the newest slide
  // that isn't the pinned one, so it reads distinctly from the gold
  // "Pinned" slide.
  function getLatestNonPinnedId(posts) {
    var latest = posts.filter(function (p) { return !isPinnedPost(p); })[0];
    return latest ? latest.id : null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (err) { return ''; }
  }

  // openNewsletterModal() may be called (e.g. from a manual trigger's click
  // handler) before the fetch below resolves -- queue it and replay once the
  // modal DOM actually exists, instead of silently no-opping.
  var pendingOpen = false;

  function _ready() {
    return !!document.getElementById('altitude-popup');
  }

  function openPopup() {
    var popup = document.getElementById('altitude-popup');
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.classList.add('flex');
    document.body.style.overflow = 'hidden';
    var emailInput = popup.querySelector('[data-newsletter-email]');
    if (emailInput) setTimeout(function () { emailInput.focus(); }, 80);
  }

  // Left-rail carousel -- pulls the latest 5 issues from the same Worker
  // endpoint js/newsletter-archive.js uses. Each slide carries its own
  // date/title/description/"Read more" caption (linking to that post's own
  // page), since that copy differs per post -- not one shared CTA over the
  // whole carousel. Leaves the static banner.png slide already in the
  // markup untouched if the fetch fails or returns fewer than 2 thumbnails.
  function initCarousel(popup) {
    var track       = popup.querySelector('#altitude-popup-carousel-track');
    var fallbackCta = popup.querySelector('#altitude-popup-carousel-fallback-cta');
    if (fallbackCta) fallbackCta.href = PAGE_PREFIX + 'newsletter';
    if (!track || typeof fetch === 'undefined') return;

    fetch(WORKER_URL + '/newsletter/posts')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var posts = (data && data.posts) || [];
        var withThumbs = posts.filter(function (p) { return p && p.thumbnail_url; });
        var slides = withPinnedFirst(withThumbs, 5);
        if (slides.length < 2) return;

        var latestNonPinnedId = getLatestNonPinnedId(slides);

        track.innerHTML = '';
        slides.forEach(function (post) {
          var pinned = isPinnedPost(post);
          var isLatest = !pinned && post.id && post.id === latestNonPinnedId;
          var slide = document.createElement('div');
          slide.className = 'relative w-full h-full flex-shrink-0' + (pinned ? ' newsletter-pinned-slide-v2' : '');

          var img = document.createElement('img');
          img.src = post.thumbnail_url;
          img.alt = '';
          img.className = 'w-full h-full object-contain';
          slide.appendChild(img);

          var gradient = document.createElement('div');
          gradient.className = 'absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none';
          slide.appendChild(gradient);

          var caption = document.createElement('div');
          caption.className = 'absolute inset-x-0 bottom-0 z-10 p-5 text-left';

          if (pinned) {
            var pinnedBadge = document.createElement('span');
            pinnedBadge.className = 'newsletter-pinned-badge-v2';
            pinnedBadge.innerHTML = '<i class="fa-solid fa-thumbtack text-[9px]"></i> Pinned &middot; Start Here';
            slide.appendChild(pinnedBadge);
          } else if (isLatest) {
            var latestBadge = document.createElement('span');
            latestBadge.className = 'newsletter-latest-badge-v2';
            latestBadge.innerHTML = '<i class="fa-solid fa-bolt text-[9px]"></i> Latest';
            slide.appendChild(latestBadge);
          }

          var dateText = formatDate(post.published_at);
          if (dateText) {
            var dateEl = document.createElement('p');
            dateEl.className = 'text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1.5';
            dateEl.textContent = dateText;
            caption.appendChild(dateEl);
          }

          var titleEl = document.createElement('h4');
          titleEl.className = 'text-white font-display font-bold text-xl leading-snug line-clamp-2' + (post.subtitle ? ' mb-1.5' : ' mb-3');
          titleEl.textContent = post.title || '';
          caption.appendChild(titleEl);

          if (post.subtitle) {
            var subEl = document.createElement('p');
            subEl.className = 'text-white/70 text-xs mb-3 truncate';
            subEl.textContent = post.subtitle;
            caption.appendChild(subEl);
          }

          var readMore = document.createElement('a');
          readMore.href = post.slug
            ? PAGE_PREFIX + 'newsletter-detail?slug=' + encodeURIComponent(post.slug)
            : PAGE_PREFIX + 'newsletter';
          readMore.className = 'btn-pill btn-pill-ghost uppercase tracking-wider';
          readMore.textContent = 'Read more';
          caption.appendChild(readMore);

          slide.appendChild(caption);
          track.appendChild(slide);
        });

        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) track.style.transitionDuration = '0s';

        var index = 0;
        setInterval(function () {
          index = (index + 1) % slides.length;
          track.style.transform = 'translateX(-' + (index * 100) + '%)';
        }, 3000);
      })
      .catch(function () {});
  }

  function closePopup() {
    var popup = document.getElementById('altitude-popup');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.classList.remove('flex');
    document.body.style.overflow = '';
    sessionStorage.setItem('altitudePopupShown', '1');
  }

  window.openNewsletterModal = function () {
    if (!_ready()) { pendingOpen = true; return; }
    openPopup();
  };

  fetch(componentUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      if (document.getElementById('altitude-popup')) return; // guard against a second concurrent load
      document.body.insertAdjacentHTML('beforeend', html);

      var popup    = document.getElementById('altitude-popup');
      var backdrop = document.getElementById('altitude-popup-backdrop');
      var closeBtn = document.getElementById('altitude-popup-close');
      var dismiss  = document.getElementById('altitude-popup-dismiss');

      if (closeBtn) closeBtn.addEventListener('click', closePopup);
      if (dismiss)  dismiss.addEventListener('click', closePopup);
      if (backdrop) backdrop.addEventListener('click', closePopup);

      var form = popup.querySelector('[data-newsletter-form]');
      if (form && window.SkyNewsletter) window.SkyNewsletter.bind(form);

      initCarousel(popup);

      // Rotates the headline badge through Skyfare's core content pillars
      // every 2s, so the popup keeps signalling breadth (not just Business
      // Class) even though only one word fits in the badge at a time.
      var badge = popup.querySelector('#altitude-popup-badge');
      if (badge) {
        var badgePhrases = ['Business Class', 'First Class', 'Award Seats'];
        var badgeIndex = 0;
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setInterval(function () {
          badgeIndex = (badgeIndex + 1) % badgePhrases.length;
          if (reduceMotion) {
            badge.textContent = badgePhrases[badgeIndex];
            return;
          }
          badge.style.opacity = '0';
          setTimeout(function () {
            badge.textContent = badgePhrases[badgeIndex];
            badge.style.opacity = '1';
          }, 200);
        }, 2000);
      }

      if (pendingOpen) {
        pendingOpen = false;
        openPopup();
      }
    })
    .catch(function () {});

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  document.querySelectorAll('[data-newsletter-modal-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      window.openNewsletterModal();
    });
  });
})();
