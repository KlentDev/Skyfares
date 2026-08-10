(function () {
  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    Array.prototype.slice.call(document.querySelectorAll('[data-assessment-checkout]')).forEach(function (btn) {
      btn.addEventListener('click', function (e) { handleClick(e, btn); });
    });

    checkPaymentReturn();
  }

  function handleClick(e, btn) {
    e.preventDefault();
    var originalHtml = btn.innerHTML;
    btn.classList.add('pointer-events-none', 'opacity-70');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Redirecting…';

    fetch(WORKER + '/assessment/checkout', {
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

  // Stripe redirects back to this page with ?purchased=1&session_id=... on
  // success. Never trust that flag alone -- verify the session server-side
  // before showing the success modal (see assessment-call-page.md §7.3's own
  // recommendation, same reasoning as Altitude's existing session-verification
  // pattern). The booking link itself is no longer shown on the page at all --
  // it only ever arrives in the confirmation email now.
  function checkPaymentReturn() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('purchased') !== '1') return;

    var sessionId = params.get('session_id');
    if (!sessionId) return;

    fetch(WORKER + '/assessment/verify?session_id=' + encodeURIComponent(sessionId))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.paid) {
          openTravelStratModal();
        } else if (window.SkyUI) {
          SkyUI.toast('Could not verify your payment. If you were charged, message us on WhatsApp and we\'ll sort it out.', { type: 'error' });
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Could not verify your payment right now. Please refresh this page.', { type: 'error' });
      });
  }

  // Fetches components/travel-strat-modal.html (same fetch-once-inject
  // pattern as js/magic-modal.js) and opens it. Only ever needed on
  // pages/assessment.html, so it's loaded on demand here rather than
  // globally from header.js like the magic-link modal is.
  function openTravelStratModal() {
    if (document.getElementById('travel-strat-modal')) {
      _open();
      return;
    }

    var componentUrl = (window.location.pathname.includes('/pages/') ? '../' : '') + 'components/travel-strat-modal.html';
    fetch(componentUrl)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        if (document.getElementById('travel-strat-modal')) { _open(); return; }
        document.body.insertAdjacentHTML('beforeend', html);
        document.querySelectorAll('#travel-strat-modal [data-travel-strat-modal-close]').forEach(function (el) {
          el.addEventListener('click', _close);
        });
        // js/footer.js's site-wide WhatsApp pre-fill only scans the DOM once,
        // at its own load time -- this modal is injected later, so repeat
        // its exact logic here for the WhatsApp link just added.
        document.querySelectorAll('#travel-strat-modal a[href*="api.whatsapp.com/send"]').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (/[?&]text=/.test(href)) return;
          var msg = a.getAttribute('data-wa-message') || "Hi Skyfare, I'd like to speak to a travel consultant.";
          a.setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(msg));
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') _close();
        });
        _open();
      })
      .catch(function () {});

    function _open() {
      var modal = document.getElementById('travel-strat-modal');
      if (modal) modal.style.display = 'flex';
      if (window.fireBrandConfetti) window.fireBrandConfetti();
    }
    function _close() {
      var modal = document.getElementById('travel-strat-modal');
      if (modal) modal.style.display = 'none';
    }
  }
})();
