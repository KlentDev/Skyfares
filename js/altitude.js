(function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var DENIED_TOKEN_KEY = 'altitude_denied_jwt';

  // ─── RE-ENABLED for testing 2026-07-22 ────────────────────────────────────
  // Was disabled pending launch (confirmed by Sahej, 2026-07-03). Real
  // checkout is back on via handleCheckout below, rewritten to hit the
  // modern POST /altitude/checkout worker endpoint (same pattern as
  // js/index-pricing.js and js/krisflyer-guide.js) instead of the old
  // static Payment Link, which is stale and superseded:
  //
  // var PAYMENT_LINK = 'https://buy.stripe.com/test_7sYaEX9Ujd0qbg8gGv3oA00';

  // ─── Boot ─────────────────────────────────────────────────────────────────
  // This page is public-marketing-only -- the member view lives at
  // private-pages/altitude-access-portal.html (js/altitude-portal.js owns
  // the full verify/render lifecycle). A visitor with an existing JWT, or
  // one arriving via a magic-link `?magic=` param, gets sent straight there
  // instead of anything being toggled in place here.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var params = new URLSearchParams(location.search);
    var token  = getToken();
    var magic  = params.get('magic');
    var deniedToken = getDeniedToken();

    // A loginError param means the portal already tried this token/link and
    // bounced back here -- redirecting to the portal again would just bounce
    // right back and loop forever (this is exactly what happened before this
    // fix: the portal can deny access for reasons that don't invalidate the
    // JWT itself, e.g. "valid login, no Altitude membership", so the token
    // was still present and immediately sent straight back). Show the error
    // instead of retrying.
    if (!params.get('loginError') && (magic || (token && token !== deniedToken))) {
      var dest = 'private-pages/altitude-access-portal';
      if (magic) dest += '?magic=' + encodeURIComponent(magic);
      window.location.replace(dest);
      return;
    }
    wirePublicView();
    handleLoginError();
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function clearToken() {
    try { localStorage.removeItem(JWT_KEY); } catch (_) {}
  }

  function getDeniedToken() {
    try { return sessionStorage.getItem(DENIED_TOKEN_KEY) || null; } catch (_) { return null; }
  }

  function rememberDeniedToken(token) {
    if (!token) return;
    try { sessionStorage.setItem(DENIED_TOKEN_KEY, token); } catch (_) {}
  }

  function clearDeniedToken() {
    try { sessionStorage.removeItem(DENIED_TOKEN_KEY); } catch (_) {}
  }

  // Surfaces the portal's redirect-back reason (invalid/expired link, no
  // membership, network error, etc.) in the shared login modal, since the
  // actual verify attempt happened on the portal page, not here.
  function handleLoginError() {
    var params = new URLSearchParams(location.search);
    var err = params.get('loginError');
    if (!err) return;
    history.replaceState(null, '', location.pathname);

    // Entitlement denials mean "this account cannot open Altitude right now",
    // not necessarily "this shared JWT is invalid". Keep the token for other
    // private products and remember it only for this tab so the marketing
    // page does not bounce straight back to the portal.
    if (isAltitudeEntitlementError(err)) {
      rememberDeniedToken(getToken());
    } else if (err !== 'network' && err !== 'rate_limited') {
      clearDeniedToken();
      clearToken();
    }

    if (err === 'cancelled') {
      var note = document.getElementById('alt-cancelled-note');
      if (note) note.classList.remove('hidden');
      return;
    }

    var messages = {
      expired: 'This link has expired or has already been used. Please request a new one.',
      invalid: 'This link has expired or has already been used. Please request a new one.',
      rate_limited: 'Too many magic link attempts. Please wait a few minutes, then request a new link.',
      network: 'Network error verifying your link. Please try again.',
      altitude_missing: 'No active Altitude membership was found for this email.',
      altitude_inactive: 'This Altitude membership is not currently active.',
      altitude_expired: 'This Altitude membership appears to have expired.',
      bundle_expired: 'Your complimentary Altitude membership has expired. Choose a plan below to continue.',
      bundle_missing_dates: 'We could not verify your complimentary Altitude access dates. Please contact support.',
    };
    window.openLoginModal && window.openLoginModal();
    var status = document.getElementById('alt-login-status');
    if (status) {
      status.textContent = messages[err] || 'Please log in again.';
      status.className = 'text-xs text-red-500 mt-2';
    }
  }

  function wirePublicView() {
    var checkoutForm = document.getElementById('alt-checkout-form');
    if (checkoutForm) checkoutForm.addEventListener('submit', function (e) { handleCheckout(e, 'monthly', 'alt-checkout-btn'); });
    wirePricingModal();
    loadAltitudePreview();
    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  function isAltitudeEntitlementError(err) {
    return [
      'altitude_missing',
      'altitude_inactive',
      'altitude_expired',
      'bundle_expired',
      'bundle_missing_dates',
      'cancelled',
    ].indexOf(err) !== -1;
  }

  // Login modal (open/close, the login form, and its submit handler) lives
  // globally in js/magic-modal.js, loaded by header.js on every page --
  // shared with the header's "Altitude Access" button. window.openLoginModal
  // calls elsewhere in this file just resolve to the global version.

  // ─── Checkout -- RE-ENABLED for testing 2026-07-22 ──────────────────────────
  // Uses the modern worker-generated Checkout Session (POST /altitude/checkout),
  // same pattern as js/index-pricing.js and js/krisflyer-guide.js -- not the
  // old static PAYMENT_LINK above, which is stale and no longer used here.

  function handleCheckout(e, plan, btnId, btnEl) {
    e.preventDefault();
    var btn = btnEl || document.getElementById(btnId || 'alt-checkout-btn');
    var originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Redirecting…'; }

    fetch(WORKER + '/altitude/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan || 'monthly' }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.url) {
          window.location.href = res.data.url;
        } else {
          if (window.SkyUI) SkyUI.toast(res.data.error || 'Could not start checkout. Please try again.', { type: 'error' });
          if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
      });
  }

  function wirePricingModal() {
    document.addEventListener('click', function (event) {
      var directPlan = event.target.closest && event.target.closest('[data-altitude-direct-plan]');
      if (directPlan) {
        handleCheckout(event, directPlan.getAttribute('data-altitude-direct-plan') || 'monthly', null, directPlan);
        return;
      }

      var opener = event.target.closest && event.target.closest('[data-altitude-pricing-open], #cta-section-primary');
      if (opener) {
        event.preventDefault();
        openPricingModal();
        return;
      }

      var memberLink = event.target.closest && event.target.closest('#cta-section-secondary');
      if (memberLink) {
        event.preventDefault();
        window.openLoginModal && window.openLoginModal();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closePricingModal();
    });
  }

  function openPricingModal() {
    ensurePricingModal(function (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
  }

  function closePricingModal() {
    var modal = document.getElementById('altitude-pricing-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function ensurePricingModal(done) {
    var existing = document.getElementById('altitude-pricing-modal');
    if (existing) {
      if (done) done(existing);
      return;
    }

    var prefix = window.location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    fetch(prefix + 'components/altitude-pricing.html')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html.trim();
        var modal = tmp.firstElementChild;
        if (!modal) return;
        document.body.appendChild(modal);

        modal.addEventListener('click', function (event) {
          if (event.target.closest('[data-altitude-pricing-close]')) {
            event.preventDefault();
            closePricingModal();
            return;
          }

          var planBtn = event.target.closest('[data-altitude-plan]');
          if (!planBtn) return;
          handleCheckout(event, planBtn.getAttribute('data-altitude-plan') || 'monthly', null, planBtn);
        });

        if (done) done(modal);
      })
      .catch(function () {});
  }

  function loadAltitudePreview() {
    var titleEl = document.querySelector('[data-altitude-preview-title]');
    var dateEl = document.querySelector('[data-altitude-preview-date]');
    var blurEl = document.querySelector('[data-altitude-preview-blur]');
    if (!titleEl || typeof fetch === 'undefined') return;

    fetch(WORKER + '/newsletter/posts')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var posts = data && data.posts ? data.posts : [];
        var premium = posts.filter(function (post) {
          return post && post.is_premium === true;
        })[0];
        if (!premium) {
          titleEl.textContent = 'Coming soon';
          if (dateEl) dateEl.textContent = 'Premium issue';
          return;
        }

        titleEl.textContent = premium.title || 'Premium issue';
        if (dateEl) dateEl.textContent = formatDate(premium.published_at) || 'Premium issue';
        if (blurEl) {
          blurEl.innerHTML =
            '<p class="text-sm text-white/75 leading-relaxed">' + e(premium.subtitle || 'Premium member analysis and route intelligence are available inside Altitude.') + '</p>' +
            '<p class="text-sm text-white/45 leading-relaxed">Subscribe to read the full issue, strategy notes, and archive.</p>';
        }
      })
      .catch(function () {});
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return '';
    }
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
