/**
 * Global magic-link modal (rename of the old js/member-login-modal.js).
 *
 * Markup lives in components/magic-modal.html (fetched once, injected into
 * <body>) instead of a JS template string, so both modal variants stay in
 * one shared, human-editable file. Injected on every page via header.js so
 * every trigger site opens the exact same modal instance.
 *
 * Two variants sharing one overlay:
 *  - window.openLoginModal()         -- "Member Access" request form (default)
 *  - window.openStarterSuccessModal(email) -- post-purchase confirmation,
 *    used by pages/altitude-success.html once a fresh subscription's magic
 *    link has already been emailed (no auto-login -- see subscribe-worker.js
 *    handleActivate).
 *  - window.closeLoginModal()        -- closes whichever panel is open
 *
 * Guarded against double-injection in case this ever loads twice.
 */
(function () {
  if (document.getElementById('magic-modal') || window.__magicModalLoading) return;
  window.__magicModalLoading = true;

  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var componentUrl = (window.location.pathname.includes('/pages/') ? '../' : '') + 'components/magic-modal.html';

  // openLoginModal/openStarterSuccessModal may be called before the fetch
  // below resolves (e.g. altitude-success.html calling openStarterSuccessModal
  // right after activation). Queue the most recent request and replay it
  // once the modal DOM actually exists, instead of silently no-opping.
  var pendingOpen = null;

  window.openLoginModal = function () {
    if (!_ready()) { pendingOpen = { panel: 'default' }; return; }
    _open('default');
  };

  window.openStarterSuccessModal = function (email) {
    if (!_ready()) { pendingOpen = { panel: 'starter', email: email }; return; }
    _open('starter', email);
  };

  window.closeLoginModal = function () {
    var modal = document.getElementById('magic-modal');
    if (modal) modal.style.display = 'none';
  };

  function _ready() {
    return !!document.getElementById('magic-modal');
  }

  function _open(panel, email) {
    var modal   = document.getElementById('magic-modal');
    var deflt   = document.getElementById('magic-modal-panel-default');
    var starter = document.getElementById('magic-modal-panel-starter');
    if (!modal) return;

    if (panel === 'starter') {
      if (deflt) deflt.classList.add('hidden');
      if (starter) starter.classList.remove('hidden');
      var emailEl = document.getElementById('magic-modal-starter-email');
      if (emailEl) emailEl.textContent = email || '';
      if (window.fireBrandConfetti) window.fireBrandConfetti();
    } else {
      if (starter) starter.classList.add('hidden');
      if (deflt) deflt.classList.remove('hidden');
      var f = document.getElementById('alt-login-form');
      var sent = document.getElementById('alt-login-sent');
      if (f) f.style.display = '';
      if (sent) sent.style.display = 'none';
      var status = document.getElementById('alt-login-status');
      if (status) status.textContent = '';
      var btn = document.getElementById('alt-login-btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      var inp = document.getElementById('alt-login-email');
      if (inp) setTimeout(function () { inp.focus(); }, 80);
    }

    modal.style.display = 'flex';
  }

  fetch(componentUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      if (document.getElementById('magic-modal')) return; // guard against a second concurrent load
      document.body.insertAdjacentHTML('beforeend', html);

      var form = document.getElementById('alt-login-form');
      if (form) form.addEventListener('submit', handleMemberLogin);

      document.querySelectorAll('#magic-modal [data-magic-modal-close]').forEach(function (el) {
        el.addEventListener('click', function () { window.closeLoginModal(); });
      });

      if (pendingOpen) {
        _open(pendingOpen.panel, pendingOpen.email);
        pendingOpen = null;
      }
    })
    .catch(function () {});

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeLoginModal && window.closeLoginModal();
  });

  function handleMemberLogin(e) {
    e.preventDefault();
    var input  = document.getElementById('alt-login-email');
    var btn    = document.getElementById('alt-login-btn');
    var status = document.getElementById('alt-login-status');
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
      body: JSON.stringify({ email: email, product: 'altitude' }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.sent) {
          var f = document.getElementById('alt-login-form');
          var sent = document.getElementById('alt-login-sent');
          var sentEmail = document.getElementById('alt-login-sent-email');
          if (f) f.style.display = 'none';
          if (sent) sent.style.display = 'block';
          if (sentEmail) sentEmail.textContent = email;
        } else {
          var msg = res.data.error || 'No active Altitude membership found for this email.';
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
})();
