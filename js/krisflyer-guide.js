(function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt'; // shared with js/altitude.js -- one login covers both products

  // ─── Boot ─────────────────────────────────────────────────────────────────
  // This page is public-marketing-only -- the member view lives at
  // private-pages/kf-guide-access-portal.html (js/kf-guide-portal.js owns
  // the full verify/render lifecycle). A visitor with an existing JWT, or
  // one arriving via a magic-link `?magic=` param, gets sent straight there
  // instead of anything being unlocked in place here.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    wirePurchaseButton();

    var params = new URLSearchParams(location.search);
    var magic  = params.get('magic');

    if (params.get('purchased') === '1') {
      history.replaceState(null, '', location.pathname);
      openGuidePurchaseModal();
      // Don't also redirect to the portal below -- the buyer hasn't clicked
      // their login link yet (fulfillment is async via webhook), and any
      // *pre-existing* shared JWT here (e.g. an Altitude member who just
      // bought the Guide) belongs to a login from before this purchase, not
      // this one. Redirecting immediately would also race the modal's own
      // async fetch() for its markup -- location.replace() firing first
      // means the modal never gets a chance to render at all.
      return;
    }

    // A loginError param means the portal already tried this token and
    // bounced back here -- redirecting to the portal again would just bounce
    // right back and loop forever. Show the error instead of retrying.
    var token = getToken();
    if (!params.get('loginError') && (token || magic)) {
      var dest = 'private-pages/kf-guide-access-portal';
      if (magic) dest += '?magic=' + encodeURIComponent(magic);
      window.location.replace(dest);
      return;
    }

    handleLoginError();
  }

  // Surfaces the portal's redirect-back reason (invalid/expired link, no
  // Guide access, network error, etc.) in the Guide login modal, since the
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

    var messages = {
      invalid: 'This link has expired or has already been used. Check your purchase confirmation email for the original link, or contact us.',
      noaccess: 'No KrisFlyer Guide access found for this email.',
      network: 'Network error verifying your link. Please try again.',
    };
    window.openGuideLoginModal && window.openGuideLoginModal();
    var status = document.getElementById('kf-login-status');
    if (status) {
      status.textContent = messages[err] || 'Please log in again.';
      status.className = 'text-xs text-red-500 mt-2';
    }
  }

  // ─── Guide modal (components/magic-modal-krisflyer.html) ────────────────────
  // Page-local -- not loaded via header.js like the shared Altitude magic-modal,
  // since this page is its only consumer. Fetched/injected once, guarded
  // against double-injection, with its own ids (magic-modal-krisflyer*) so
  // there's no collision with the globally-injected #magic-modal also present
  // on this page. Two panels: #magic-modal-krisflyer-panel-request (login-link
  // request form, Guide-branded copy so it never gets confused with Altitude's
  // "Member Access" modal) and #magic-modal-krisflyer-panel-purchase
  // (post-purchase success, no form).

  function kfReady() {
    return !!document.getElementById('magic-modal-krisflyer');
  }

  function kfEnsureInjected(onReady) {
    if (kfReady()) { onReady(); return; }

    var componentUrl = (location.pathname.includes('/pages/') ? '../' : '') + 'components/magic-modal-krisflyer.html';
    fetch(componentUrl)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        if (document.getElementById('magic-modal-krisflyer')) { onReady(); return; }
        document.body.insertAdjacentHTML('beforeend', html);

        var form = document.getElementById('kf-login-form');
        if (form) form.addEventListener('submit', handleGuideLogin);

        document.querySelectorAll('#magic-modal-krisflyer [data-magic-modal-krisflyer-close]').forEach(function (el) {
          el.addEventListener('click', closeGuideModal);
        });

        onReady();
      })
      .catch(function () {});
  }

  function kfOpenPanel(panel) {
    var modal    = document.getElementById('magic-modal-krisflyer');
    var request  = document.getElementById('magic-modal-krisflyer-panel-request');
    var purchase = document.getElementById('magic-modal-krisflyer-panel-purchase');
    if (!modal) return;

    if (panel === 'purchase') {
      if (request) request.classList.add('hidden');
      if (purchase) purchase.classList.remove('hidden');
      if (window.fireBrandConfetti) window.fireBrandConfetti();
    } else {
      if (purchase) purchase.classList.add('hidden');
      if (request) request.classList.remove('hidden');
      var f = document.getElementById('kf-login-form');
      var sent = document.getElementById('kf-login-sent');
      if (f) f.style.display = '';
      if (sent) sent.style.display = 'none';
      var status = document.getElementById('kf-login-status');
      if (status) status.textContent = '';
      var btn = document.getElementById('kf-login-btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      var inp = document.getElementById('kf-login-email');
      if (inp) setTimeout(function () { inp.focus(); }, 80);
    }

    modal.style.display = 'flex';
  }

  window.openGuidePurchaseModal = function () {
    kfEnsureInjected(function () { kfOpenPanel('purchase'); });
  };

  window.openGuideLoginModal = function () {
    kfEnsureInjected(function () { kfOpenPanel('request'); });
  };

  function openGuidePurchaseModal() { window.openGuidePurchaseModal(); }

  function closeGuideModal() {
    var modal = document.getElementById('magic-modal-krisflyer');
    if (modal) modal.style.display = 'none';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeGuideModal();
  });

  function handleGuideLogin(e) {
    e.preventDefault();
    var input  = document.getElementById('kf-login-email');
    var btn    = document.getElementById('kf-login-btn');
    var status = document.getElementById('kf-login-status');
    var email  = (input ? input.value : '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'text-xs text-red-500 mt-2'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending link…'; }
    if (status) { status.textContent = ''; }

    fetch(WORKER + '/altitude/magic-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, product: 'guide' }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.sent) {
          var f = document.getElementById('kf-login-form');
          var sent = document.getElementById('kf-login-sent');
          var sentEmail = document.getElementById('kf-login-sent-email');
          if (f) f.style.display = 'none';
          if (sent) sent.style.display = 'block';
          if (sentEmail) sentEmail.textContent = email;
        } else {
          var msg = res.data.error || 'No KrisFlyer Guide access found for this email.';
          if (res.status === 429) msg = 'Too many requests. Please wait a few minutes before trying again.';
          if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
          if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
        }
      })
      .catch(function () {
        var msg = 'Network error. Please try again.';
        if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      });
  }

  // ─── Auth (mirrors js/altitude.js's getToken/clearToken) ────────────────

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function clearToken() {
    try { localStorage.removeItem(JWT_KEY); } catch (_) {}
  }

  // ─── Purchase (Stripe Checkout) ──────────────────────────────────────────

  function wirePurchaseButton() {
    var btn = document.getElementById('kf-purchase-btn');
    if (!btn) return;
    btn.addEventListener('click', handlePurchaseClick);
  }

  function handlePurchaseClick(e) {
    e.preventDefault();
    var btn = document.getElementById('kf-purchase-btn');
    var originalHtml = btn.innerHTML;
    btn.classList.add('pointer-events-none', 'opacity-70');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Redirecting…';

    fetch(WORKER + '/guide/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.url) {
          window.location.href = res.data.url;
        } else {
          if (window.SkyUI) SkyUI.toast(res.data.error || 'Could not start checkout. Please try again.', { type: 'error' });
          btn.classList.remove('pointer-events-none', 'opacity-70');
          btn.innerHTML = originalHtml;
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        btn.classList.remove('pointer-events-none', 'opacity-70');
        btn.innerHTML = originalHtml;
      });
  }
})();
