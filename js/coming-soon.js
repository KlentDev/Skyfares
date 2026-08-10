// Reusable "Coming Soon" system -- turns any [data-coming-soon] element into
// a premium locked state instead of a live CTA/card. Loaded like
// js/header.js / js/footer.js (deferred, every page). See docs in the
// design spec for the full authoring contract; short version:
//
//   data-coming-soon                 marks the host element to gate
//   data-coming-soon-mode            "card" | "button" | "badge-only"
//   data-coming-soon-content         (on the inner wrapper, mode="card" only)
//                                     -- which child gets blurred
//   data-coming-soon-feature         "assessment" | "altitude" | "guide"
//                                     -- picks default copy/icon + tags the
//                                     ?utm_content on the waitlist link
//   data-coming-soon-title           overrides the default headline
//   data-coming-soon-desc            overrides the default description
//
// mode="card": blurs [data-coming-soon-content] and injects a full lock
//   overlay (icon, badge, copy, a "Join Our Waitlist" link to
//   pages/pre-signup-link) over it.
// mode="button": disables the CTA in place (aria-disabled, muted style,
//   lock glyph) and adds a small "{title} is coming soon." note beneath it.
//   No separate waitlist CTA here -- the lock + note is the whole treatment.
// mode="badge-only": injects just the shimmering pill badge, no lock/blur.
(function () {
  var FEATURES = {
    assessment: {
      icon: 'fa-phone-volume',
      title: 'Travel Strategy Call',
      desc: "Direct 1-on-1 planning calls are being rebuilt. Join the waitlist and we'll email you the moment booking reopens.",
    },
    altitude: {
      icon: 'fa-crown',
      title: 'Skyfare Altitude',
      desc: "Our premium travel intelligence membership is getting ready for launch. Join the waitlist for early access.",
    },
    guide: {
      icon: 'fa-book',
      title: 'KrisFlyer Guide',
      desc: "The KrisFlyer Guide is still being written. It will open here when ready.",
    },
  };
  var DEFAULT_FEATURE = {
    icon: 'fa-lock',
    title: 'Coming Soon',
    desc: 'This feature is currently being developed. Join the waitlist to be notified when it launches.',
  };

  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + '-' + uid; }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function featureFor(el) {
    var key = el.dataset.comingSoonFeature;
    var base = (key && FEATURES[key]) || DEFAULT_FEATURE;
    return {
      icon: base.icon,
      title: el.dataset.comingSoonTitle || base.title,
      desc: el.dataset.comingSoonDesc || base.desc,
      utmContent: key || '',
    };
  }

  // Any known dark/photo section wrapper -- picks text colors + overlay tint
  // so the lock overlay/note reads correctly on both light and dark tiles.
  function isOnDarkBg(el) {
    return !!el.closest('.tile-dark1, .tile-dark2, .card-dark, .page-hero-bg, .cta-band, .cta-band-v2, .hero-stage-v4, .hero-photo-section');
  }

  // pages/pre-signup-link.html lives in /pages/ -- link relative to whether
  // the current page is already inside /pages/ or at the site root, same
  // pattern js/header.js uses for its own cross-directory links.
  function waitlistHref(feature) {
    var prefix = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    var qs = feature.utmContent ? '?utm_content=' + encodeURIComponent(feature.utmContent) : '';
    return prefix + 'pre-signup-link' + qs;
  }

  // Reveal on next frame -- self-triggering, never .slide-up (the sitewide
  // IntersectionObserver in js/header.js only scans .slide-up once at
  // DOMContentLoaded and would never see anything injected afterward).
  function reveal(el) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-visible'); });
    });
  }

  // ---- mode="card" ----------------------------------------------------
  function setupCard(host) {
    // Prefer an explicit [data-coming-soon-content] marker (for cards where
    // only one inner wrapper should blur, e.g. a ribbon/badge sibling that
    // must stay crisp). Otherwise blur every existing child -- captured
    // *before* the overlay is appended below, so the overlay itself is never
    // included. Avoids forcing a new wrapper <div> onto every card, which
    // would silently break any `.card-class > child` CSS selector (several
    // card systems in this codebase, e.g. .path-card-v5 > p, rely on one).
    var explicit = host.querySelectorAll(':scope > [data-coming-soon-content]');
    var targets = explicit.length ? Array.prototype.slice.call(explicit) : Array.prototype.slice.call(host.children);
    targets.forEach(function (el) {
      el.classList.add('cs-blur');
      el.setAttribute('aria-hidden', 'true');
      try { el.inert = true; } catch (_) { /* older browser: aria-hidden still applies */ }
    });

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    var feature = featureFor(host);
    var dark = isOnDarkBg(host);

    var overlay = document.createElement('div');
    overlay.className = 'cs-overlay ' + (dark ? 'cs-overlay--dark' : 'cs-overlay--light');
    overlay.setAttribute('role', 'group');
    overlay.setAttribute('aria-label', feature.title + ' — Coming Soon');
    var ctaHtml = host.dataset.comingSoonHideCta === 'true' ? '' :
      '<a href="' + waitlistHref(feature) + '" class="btn-pill btn-pill-primary">' +
        '<i class="fa-solid fa-bell text-xs" aria-hidden="true"></i>Join Our Waitlist' +
      '</a>';

    overlay.innerHTML =
      '<div class="icon-chip icon-chip-lg' + (dark ? ' icon-chip-dark' : '') + ' mb-3"><i class="fa-solid fa-lock" aria-hidden="true"></i></div>' +
      '<span class="cs-badge mb-3">Coming Soon</span>' +
      '<h3 class="font-display font-bold text-lg mb-1.5 px-6 ' + (dark ? 'text-white' : 'text-neutral-900') + '">' + escapeHtml(feature.title) + '</h3>' +
      '<p class="text-sm leading-relaxed max-w-xs px-6 mb-5 ' + (dark ? 'text-white/70' : 'text-neutral-600') + '">' + escapeHtml(feature.desc) + '</p>' +
      ctaHtml;

    host.appendChild(overlay);
    reveal(overlay);
  }

  // ---- mode="button" ---------------------------------------------------
  function lockActivation(el) {
    el.setAttribute('aria-disabled', 'true');
    function block(e) {
      if (el.getAttribute('aria-disabled') !== 'true') return;
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.stopPropagation();
    }
    el.addEventListener('click', block);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') block(e);
    });
  }

  function setupButton(cta) {
    var feature = featureFor(cta);
    var noteId = nextId('cs-note');

    cta.classList.add('btn-pill-disabled');
    lockActivation(cta);
    cta.setAttribute('aria-describedby', noteId);
    if (!cta.querySelector('.fa-lock')) {
      cta.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-lock text-[10px] ml-1" aria-hidden="true"></i>');
    }

    // data-coming-soon-hide-note keeps the note for screen readers
    // (aria-describedby still points at it) but suppresses the visible
    // caption -- used where a visible line would clutter a tight layout
    // (e.g. the homepage hero, which already reads "Coming Soon" via the
    // lock icon and the hero copy around it).
    var hideNote = cta.dataset.comingSoonHideNote === 'true';
    var note = document.createElement('p');
    note.id = noteId;
    note.className = hideNote ? 'sr-only' : 'w-full text-xs mt-2 ' + (isOnDarkBg(cta) ? 'text-white/50' : 'text-neutral-400');
    note.textContent = feature.title + ' is coming soon.';
    cta.insertAdjacentElement('afterend', note);
  }

  // ---- mode="badge-only" -----------------------------------------------
  function setupBadgeOnly(host) {
    var badge = document.createElement('span');
    badge.className = 'cs-badge';
    badge.textContent = 'Coming Soon';
    host.appendChild(badge);
  }

  // init() is called again by js/cta-section.js after it injects the shared
  // CTA component (which may itself contain a locked [data-coming-soon]
  // button, added to the DOM after this file's own DOMContentLoaded run
  // already fired) -- guard so re-running never double-processes an element.
  function init() {
    document.querySelectorAll('[data-coming-soon]').forEach(function (el) {
      if (el.dataset.comingSoonDone) return;
      el.dataset.comingSoonDone = 'true';
      var mode = el.dataset.comingSoonMode || 'card';
      if (mode === 'card') setupCard(el);
      else if (mode === 'button') setupButton(el);
      else if (mode === 'badge-only') setupBadgeOnly(el);
    });
  }

  window.SkyComingSoon = { init: init };
  document.addEventListener('DOMContentLoaded', init);
})();
