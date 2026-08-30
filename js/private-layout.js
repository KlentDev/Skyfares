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
    var privatePrefix = getPrivateRootPrefix();
    injectPartial('private-header-slot', privatePrefix + 'header-private.html', fallbackHeader)
      .then(function () {
        enhanceHeader();
        applyState();
      });

    injectPartial('private-footer-slot', privatePrefix + 'footer-private.html', fallbackFooter)
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
    var privatePrefix = getPrivateRootPrefix();
    var sitePrefix = getSiteRootPrefix();
    var brandLink = document.querySelector('.private-brand');
    var brandImg = document.querySelector('.private-brand img');
    var productEl = document.getElementById('private-member-product');
    var subtitleEl = document.getElementById('private-member-subtitle');
    var manageBtn = document.querySelector('[data-private-manage]');
    var signoutBtn = document.querySelector('[data-private-signout]');
    var accountMenu = document.querySelector('[data-private-account-menu]');
    var accountTrigger = document.querySelector('[data-private-account-trigger]');
    var signoutModal = document.querySelector('[data-private-signout-modal]');
    var signoutConfirm = document.querySelector('[data-private-signout-confirm]');
    var signoutCancelBtns = document.querySelectorAll('[data-private-signout-cancel]');

    if (brandLink) brandLink.setAttribute('href', sitePrefix + 'index.html');
    if (brandImg) brandImg.setAttribute('src', sitePrefix + 'logos/logo.webp');
    if (productEl) productEl.textContent = product || 'Member Portal';
    if (subtitleEl) subtitleEl.textContent = subtitle || 'Private access';

    // Notifications toggle (account dropdown) — the row itself is already
    // gated to Altitude-only via [data-private-menu-altitude-only] (handled
    // below in setupAccountMenu, same mechanism as Membership/Support/etc.);
    // this only needs to wire the toggle's actual behavior. See
    // js/push-subscribe.js's wireNotificationToggle.
    var pushToggleInput = document.querySelector('[data-push-toggle]');
    if (pushToggleInput && window.SkyfarePush) {
      window.SkyfarePush.wireNotificationToggle(pushToggleInput);
    }

    document.querySelectorAll('[data-private-nav]').forEach(function (link) {
      var target = link.getAttribute('data-private-nav');
      var isActive = target === page;
      if (target === 'altitude') link.setAttribute('href', privatePrefix + 'altitude-access-portal.html');
      if (target === 'guide') link.setAttribute('href', privatePrefix + 'kf-guide-access-portal.html');
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

          // KrisFlyer Guide isn't open yet -- show the coming-soon lock
          // instead of running the real email-verification flow. Altitude is
          // untouched below. To bring Guide verification back once it
          // launches, delete this "if" block (and openGuideComingSoon/
          // closeGuideComingSoon further down) so target === 'guide' falls
          // through to the same SkyfareVerifyAccess.open call Altitude uses.
          if (target === 'guide') {
            openGuideComingSoon();
            return;
          }

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

    setupAccountMenu(page, accountMenu, accountTrigger);

    if (signoutBtn) {
      signoutBtn.addEventListener('click', function () {
        closeAccountMenu(accountMenu, accountTrigger);
        openSignoutModal(signoutModal);
      });
    }

    if (signoutConfirm) {
      signoutConfirm.addEventListener('click', function () {
        performSignout(page);
      });
    }

    signoutCancelBtns.forEach(function (button) {
      button.addEventListener('click', function () {
        closeSignoutModal(signoutModal, accountTrigger);
      });
    });

    window.dispatchEvent(new CustomEvent('skyfare:private-layout-ready'));
  }

  function setupAccountMenu(page, accountMenu, accountTrigger) {
    var isAltitude = page === 'altitude';
    var altitudeAccessPrefix = getAltitudeAccessPrefix();

    document.querySelectorAll('[data-private-menu-altitude-only]').forEach(function (item) {
      item.classList.toggle('is-hidden', !isAltitude);
    });

    var membershipLink = document.querySelector('[data-private-menu-membership]');
    var manualLink = document.querySelector('[data-private-menu-manual]');
    var supportLink = document.querySelector('[data-private-menu-support]');
    if (membershipLink) membershipLink.setAttribute('href', altitudeAccessPrefix + 'membership.html');
    if (manualLink) manualLink.setAttribute('href', altitudeAccessPrefix + 'beehiiv-manual.html');
    if (supportLink) supportLink.setAttribute('href', altitudeAccessPrefix + 'support.html');

    if (!accountMenu || !accountTrigger) return;

    accountTrigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = accountMenu.classList.toggle('is-open');
      accountTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (event) {
      if (!accountMenu.contains(event.target)) closeAccountMenu(accountMenu, accountTrigger);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAccountMenu(accountMenu, accountTrigger);
        closeSignoutModal(document.querySelector('[data-private-signout-modal]'), accountTrigger);
      }
    });
  }

  function closeAccountMenu(accountMenu, accountTrigger) {
    if (!accountMenu || !accountTrigger) return;
    accountMenu.classList.remove('is-open');
    accountTrigger.setAttribute('aria-expanded', 'false');
  }

  function openSignoutModal(signoutModal) {
    if (!signoutModal) return performSignout(document.body.getAttribute('data-private-page') || '');
    signoutModal.hidden = false;
    document.documentElement.classList.add('private-modal-open');
    var confirm = signoutModal.querySelector('[data-private-signout-confirm]');
    if (confirm) confirm.focus();
  }

  function closeSignoutModal(signoutModal, accountTrigger) {
    if (!signoutModal) return;
    signoutModal.hidden = true;
    document.documentElement.classList.remove('private-modal-open');
    if (accountTrigger) accountTrigger.focus();
  }

  // ─── Guide "coming soon" lock ────────────────────────────────────────────
  // Stands in for the real KrisFlyer Guide verify-access flow while the
  // Guide product isn't live. Reuses the same lock/blur visual language as
  // js/coming-soon.js (.icon-chip-lg, .cs-badge) and the same modal shell
  // (backdrop-blur backing, white card) as components/modal-verify-access.html,
  // but built inline here since there's no card/section on this page to
  // blur in place -- this is triggered from a header nav click, not an
  // in-page [data-coming-soon] element.
  function ensureGuideComingSoonModal() {
    var existing = document.getElementById('guide-coming-soon-modal');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.id = 'guide-coming-soon-modal';
    modal.className = 'fixed inset-0 z-[320] items-center justify-center p-4';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'guide-coming-soon-title');
    modal.innerHTML =
      '<div class="absolute inset-0 bg-brand-950/70 backdrop-blur-sm" data-guide-coming-soon-close></div>' +
      '<div class="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl p-8 text-center">' +
        '<button type="button" data-guide-coming-soon-close class="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700" aria-label="Close">' +
          '<i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>' +
        '</button>' +
        '<div class="icon-chip icon-chip-lg mb-4 mx-auto"><i class="fa-solid fa-lock" aria-hidden="true"></i></div>' +
        '<span class="cs-badge mb-3">Coming Soon</span>' +
        '<h2 id="guide-coming-soon-title" class="font-display text-xl font-bold tracking-tight text-neutral-900 mb-2">KrisFlyer Guide</h2>' +
        '<p class="text-sm leading-relaxed text-neutral-500">We’re putting the finishing touches on the KrisFlyer Guide. Always check your email for the latest updates — we’ll let you know the moment it’s ready to unlock.</p>' +
      '</div>';

    document.body.appendChild(modal);
    modal.querySelectorAll('[data-guide-coming-soon-close]').forEach(function (el) {
      el.addEventListener('click', closeGuideComingSoon);
    });
    return modal;
  }

  function openGuideComingSoon() {
    var modal = ensureGuideComingSoonModal();
    modal.style.display = 'flex';
    document.documentElement.classList.add('private-modal-open');
  }

  function closeGuideComingSoon() {
    var modal = document.getElementById('guide-coming-soon-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.documentElement.classList.remove('private-modal-open');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeGuideComingSoon();
  });

  function performSignout(page) {
    if (window.SkyfareAccessCache) window.SkyfareAccessCache.clear();
    if (page === 'guide' && window.__kfSignOut) return window.__kfSignOut();
    if (window.__altSignOut) return window.__altSignOut();
    try { localStorage.removeItem('altitude_jwt'); } catch (_) {}
    window.location.href = getPublicPagePrefix() + (page === 'guide' ? 'krisflyer-guide.html' : 'altitude.html');
  }

  function enhanceFooter() {
    var yearEl = document.getElementById('private-footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    var publicPrefix = getPublicPagePrefix();
    document.querySelectorAll('.private-footer a[href="../contact"]').forEach(function (link) { link.setAttribute('href', publicPrefix + 'contact'); });
    document.querySelectorAll('.private-footer a[href="../privacy"]').forEach(function (link) { link.setAttribute('href', publicPrefix + 'privacy'); });
    document.querySelectorAll('.private-footer a[href="../terms"]').forEach(function (link) { link.setAttribute('href', publicPrefix + 'terms'); });
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
    var privatePrefix = getPrivateRootPrefix();
    var sitePrefix = getSiteRootPrefix();
    return '' +
      '<header class="private-header">' +
        '<div class="private-header__inner">' +
          '<a class="private-brand" href="' + sitePrefix + 'index.html" aria-label="Skyfare home">' +
            '<img src="' + sitePrefix + 'logos/logo.webp" alt="Skyfare Consulting">' +
            '<span><strong>Skyfare</strong><small>Private access</small></span>' +
          '</a>' +
          '<nav class="private-nav" aria-label="Member navigation">' +
            '<a href="' + privatePrefix + 'altitude-access-portal.html" data-private-nav="altitude"><i class="fa-solid fa-crown"></i><span>Altitude</span></a>' +
            '<a href="' + privatePrefix + 'kf-guide-access-portal.html" data-private-nav="guide"><i class="fa-solid fa-book-open"></i><span>Guide</span></a>' +
          '</nav>' +
          '<div class="private-account">' +
            '<span id="private-member-email">Member</span>' +
            '<button type="button" data-private-manage class="private-icon-btn"><i class="fa-solid fa-credit-card"></i></button>' +
            '<div class="private-account-menu" data-private-account-menu>' +
              '<button type="button" class="private-icon-btn private-account-trigger" data-private-account-trigger aria-label="Account menu" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-user-gear"></i></button>' +
              '<div class="private-account-dropdown" data-private-account-dropdown role="menu" aria-label="Account menu">' +
                '<div class="private-menu-row" data-private-menu-altitude-only data-push-toggle-row hidden role="menuitem"><span class="private-menu-row__label"><i class="fa-regular fa-bell"></i> Notifications</span><label class="push-toggle"><input type="checkbox" class="push-toggle__input" data-push-toggle aria-label="Enable notifications"><span class="push-toggle__track"><span class="push-toggle__thumb"></span></span></label></div>' +
                '<a href="' + getAltitudeAccessPrefix() + 'membership.html" data-private-menu-membership data-private-menu-altitude-only role="menuitem"><i class="fa-solid fa-credit-card"></i><span>Membership</span></a>' +
                '<a href="' + getAltitudeAccessPrefix() + 'beehiiv-manual.html" data-private-menu-manual data-private-menu-altitude-only role="menuitem"><i class="fa-solid fa-book-open-reader"></i><span>Beehiiv Manual</span></a>' +
                '<a href="' + getAltitudeAccessPrefix() + 'support.html" data-private-menu-support data-private-menu-altitude-only role="menuitem"><i class="fa-solid fa-headset"></i><span>Support</span></a>' +
                '<button type="button" data-private-signout role="menuitem"><i class="fa-solid fa-arrow-right-from-bracket"></i><span>Sign out</span></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="private-signout-modal" data-private-signout-modal hidden><div class="private-signout-modal__backdrop" data-private-signout-cancel></div><section class="private-signout-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="private-signout-title"><div class="private-signout-modal__icon"><i class="fa-solid fa-arrow-right-from-bracket"></i></div><h2 id="private-signout-title">Sign out?</h2><p>Are you sure you want to sign out of your private access session?</p><div class="private-signout-modal__actions"><button type="button" class="private-action" data-private-signout-cancel>No</button><button type="button" class="private-action private-action--primary" data-private-signout-confirm>Yes, sign out</button></div></section></div>';
  }

  function fallbackFooter() {
    var publicPrefix = getPublicPagePrefix();
    return '<footer class="private-footer"><div class="private-container private-footer__inner"><p>&copy; <span id="private-footer-year"></span> Skyfare Consulting</p><nav aria-label="Private footer"><a href="' + publicPrefix + 'contact">Contact</a><a href="' + publicPrefix + 'privacy">Privacy</a><a href="' + publicPrefix + 'terms">Terms</a></nav></div></footer>';
  }

  function isNestedAltitudePage() {
    return /\/pages\/private-pages\/altitude-access\//.test(location.pathname.replace(/\\/g, '/'));
  }

  function getPrivateRootPrefix() {
    return isNestedAltitudePage() ? '../' : '';
  }

  function getAltitudeAccessPrefix() {
    return isNestedAltitudePage() ? '' : 'altitude-access/';
  }

  function getPublicPagePrefix() {
    return isNestedAltitudePage() ? '../../' : '../';
  }

  function getSiteRootPrefix() {
    return isNestedAltitudePage() ? '../../../' : '../../';
  }
})();
