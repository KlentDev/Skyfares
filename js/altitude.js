(function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';

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

    // A loginError param means the portal already tried this token/link and
    // bounced back here -- redirecting to the portal again would just bounce
    // right back and loop forever (this is exactly what happened before this
    // fix: the portal can deny access for reasons that don't invalidate the
    // JWT itself, e.g. "valid login, no Altitude membership", so the token
    // was still present and immediately sent straight back). Show the error
    // instead of retrying.
    if (!params.get('loginError') && (token || magic)) {
      var dest = 'private-pages/altitude-access-portal.html';
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

  // Surfaces the portal's redirect-back reason (invalid/expired link, no
  // membership, network error, etc.) in the shared login modal, since the
  // actual verify attempt happened on the portal page, not here.
  function handleLoginError() {
    var params = new URLSearchParams(location.search);
    var err = params.get('loginError');
    if (!err) return;
    history.replaceState(null, '', location.pathname);

    // Any reason except a transient network blip means this token has
    // already been given a definitive answer -- clear it so a later plain
    // reload of this page (no loginError in the URL by then) doesn't read a
    // stale token and quietly bounce to the portal and back again.
    if (err !== 'network') clearToken();

    if (err === 'cancelled') {
      var note = document.getElementById('alt-cancelled-note');
      if (note) note.classList.remove('hidden');
      return;
    }

    var messages = {
      expired: 'This link has expired or has already been used. Please request a new one.',
      invalid: 'This link has expired or has already been used. Please request a new one.',
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
    var annualBtn = document.getElementById('alt-checkout-annual-btn');
    if (annualBtn) annualBtn.addEventListener('click', function (e) { handleCheckout(e, 'annual', 'alt-checkout-annual-btn'); });
    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Login modal (open/close, the login form, and its submit handler) lives
  // globally in js/magic-modal.js, loaded by header.js on every page --
  // shared with the header's "Altitude Access" button. window.openLoginModal
  // calls elsewhere in this file just resolve to the global version.

  // ─── Checkout -- RE-ENABLED for testing 2026-07-22 ──────────────────────────
  // Uses the modern worker-generated Checkout Session (POST /altitude/checkout),
  // same pattern as js/index-pricing.js and js/krisflyer-guide.js -- not the
  // old static PAYMENT_LINK above, which is stale and no longer used here.

  function handleCheckout(e, plan, btnId) {
    e.preventDefault();
    var btn = document.getElementById(btnId || 'alt-checkout-btn');
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
})();
