(function () {
  var state = {
    email: '',
    product: '',
    plan: '',
  };

  // ─── Cross-portal verification cache ─────────────────────────────────────
  // A target verified via the modal (or confirmed by a portal page's own
  // load-time check) stays valid for 24h -- same lifetime as the JWT itself
  // -- so a member with both Altitude and Guide access isn't forced through
  // the verify-access modal on every single cross-portal click. This is a
  // pure UX skip: the destination portal page always re-verifies for real on
  // load regardless (see js/altitude-portal.js / js/kf-guide-portal.js), so
  // a stale or tampered cache entry can never grant access on its own.
  var ACCESS_CACHE_KEY = 'skyfare_access_cache';
  var ACCESS_CACHE_TTL = 24 * 60 * 60 * 1000;

  window.SkyfareAccessCache = {
    isValid: function (target) {
      var entry = readAccessCache()[target];
      return !!entry && (Date.now() - entry.at) < ACCESS_CACHE_TTL;
    },
    markVerified: function (target) {
      var data = readAccessCache();
      data[target] = { at: Date.now() };
      try { localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(data)); } catch (_) {}
    },
    // Drops a single target's cached "verified" flag without touching the
    // other one -- called by the portal pages' own real verification when it
    // comes back denied, so a since-revoked entitlement (e.g. a deleted
    // KV/Beehiiv record) can't keep silently skipping the verify-access
    // modal and bouncing the visitor straight to the destination portal and
    // back out again for the rest of the 24h cache window.
    invalidate: function (target) {
      var data = readAccessCache();
      delete data[target];
      try { localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(data)); } catch (_) {}
    },
    clear: function () {
      try { localStorage.removeItem(ACCESS_CACHE_KEY); } catch (_) {}
    },
  };

  function readAccessCache() {
    try { return JSON.parse(localStorage.getItem(ACCESS_CACHE_KEY) || '{}'); } catch (_) { return {}; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectPartial('private-header-slot', 'header-private.html', fallbackHeader)
      .then(function () {
        enhanceHeader();
        applyState();
      });

    injectPartial('private-footer-slot', 'footer-private.html', fallbackFooter)
      .then(function () {
        enhanceFooter();
      });

    setupReveals();
    setupLoader();
  }

  function injectPartial(slotId, url, fallback) {
    var slot = document.getElementById(slotId);
    if (!slot) return Promise.resolve();

    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load ' + url);
        return r.text();
      })
      .then(function (html) {
        slot.innerHTML = html;
      })
      .catch(function () {
        slot.innerHTML = fallback();
      });
  }

  function enhanceHeader() {
    var page = document.body.getAttribute('data-private-page') || '';
    var product = document.body.getAttribute('data-private-product') || '';
    var subtitle = document.body.getAttribute('data-private-subtitle') || '';
    var productEl = document.getElementById('private-member-product');
    var subtitleEl = document.getElementById('private-member-subtitle');
    var manageBtn = document.querySelector('[data-private-manage]');
    var signoutBtn = document.querySelector('[data-private-signout]');

    if (productEl) productEl.textContent = product || 'Member Portal';
    if (subtitleEl) subtitleEl.textContent = subtitle || 'Private access';

    document.querySelectorAll('[data-private-nav]').forEach(function (link) {
      var target = link.getAttribute('data-private-nav');
      var isActive = target === page;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      if (!isActive && (target === 'altitude' || target === 'guide')) {
        link.classList.add('is-locked');
        link.setAttribute('aria-label', 'Verify ' + (target === 'guide' ? 'KrisFlyer Guide' : 'Altitude') + ' access');
        if (!link.querySelector('.private-nav__lock')) {
          link.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-lock private-nav__lock" aria-hidden="true"></i>');
        }
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var href = link.getAttribute('href') || '#';
          if (window.SkyfareAccessCache && window.SkyfareAccessCache.isValid(target)) {
            window.location.href = href;
            return;
          }
          if (window.SkyfareVerifyAccess && window.SkyfareVerifyAccess.open) {
            window.SkyfareVerifyAccess.open({
              target: target,
              href: href,
              email: state.email,
            });
          } else {
            window.location.href = href;
          }
        });
      }
    });

    if (manageBtn) {
      manageBtn.classList.toggle('is-hidden', page !== 'altitude');
      manageBtn.addEventListener('click', function () {
        if (window.handleManageMembership) window.handleManageMembership();
      });
    }

    if (signoutBtn) {
      signoutBtn.addEventListener('click', function () {
        if (window.SkyfareAccessCache) window.SkyfareAccessCache.clear();
        if (page === 'guide' && window.__kfSignOut) return window.__kfSignOut();
        if (window.__altSignOut) return window.__altSignOut();
        try { localStorage.removeItem('altitude_jwt'); } catch (_) {}
        window.location.href = page === 'guide' ? '../krisflyer-guide.html' : '../altitude.html';
      });
    }

    window.dispatchEvent(new CustomEvent('skyfare:private-layout-ready'));
  }

  function enhanceFooter() {
    var yearEl = document.getElementById('private-footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  function applyState() {
    var emailEl = document.getElementById('private-member-email');
    var productEl = document.getElementById('private-member-product');
    var planEl = document.getElementById('private-member-plan');
    if (emailEl && state.email) emailEl.textContent = state.email;
    if (productEl && state.product) productEl.textContent = state.product;
    if (planEl && state.plan) planEl.textContent = state.plan;
  }

  window.SkyfarePrivate = {
    getUser: function () {
      return {
        email: state.email,
        product: state.product,
        plan: state.plan,
      };
    },
    setUser: function (payload) {
      payload = payload || {};
      state.email = payload.email || state.email;
      state.product = payload.product || state.product;
      state.plan = payload.plan || state.plan;
      applyState();
    },
  };

  window.addEventListener('skyfare:private-user', function (event) {
    if (window.SkyfarePrivate) window.SkyfarePrivate.setUser(event.detail || {});
  });

  function setupReveals() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.slide-up'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  function setupLoader() {
    var loader = document.getElementById('page-loader');
    if (!loader) return;

    var shownAt = Date.now();
    var minMs = 450;
    window.addEventListener('load', function () {
      var wait = Math.max(0, minMs - (Date.now() - shownAt));
      setTimeout(function () {
        loader.classList.add('loader-out');
        setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 520);
      }, wait);
    });
  }

  function fallbackHeader() {
    return '' +
      '<header class="private-header">' +
        '<div class="private-header__inner">' +
          '<a class="private-brand" href="../../index.html" aria-label="Skyfare home">' +
            '<img src="../../logos/logo.webp" alt="Skyfare Consulting">' +
            '<span><strong>Skyfare</strong><small>Private access</small></span>' +
          '</a>' +
          '<nav class="private-nav" aria-label="Member navigation">' +
            '<a href="altitude-access-portal.html" data-private-nav="altitude"><i class="fa-solid fa-crown"></i><span>Altitude</span></a>' +
            '<a href="kf-guide-access-portal.html" data-private-nav="guide"><i class="fa-solid fa-book-open"></i><span>Guide</span></a>' +
          '</nav>' +
          '<div class="private-account">' +
            '<span id="private-member-email">Member</span>' +
            '<button type="button" data-private-manage class="private-icon-btn"><i class="fa-solid fa-credit-card"></i></button>' +
            '<button type="button" data-private-signout class="private-icon-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  function fallbackFooter() {
    return '<footer class="private-footer"><div class="private-container private-footer__inner"><p>&copy; <span id="private-footer-year"></span> Skyfare Consulting</p><nav aria-label="Private footer"><a href="../contact">Contact</a><a href="../privacy">Privacy</a><a href="../terms">Terms</a></nav></div></footer>';
  }
})();
