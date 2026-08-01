(function () {
  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';

  // Wires homepage pricing buttons to their designated Stripe Checkout
  // endpoint -- each button maps to exactly one price:
  //   Monthly -> POST /altitude/checkout {plan:'monthly'} -> STRIPE_PRICE_ID
  //   Annual  -> POST /altitude/checkout {plan:'annual'}  -> STRIPE_PRICE_ID_ANNUAL
  //   Guide   -> POST /guide/checkout    {}               -> STRIPE_GUIDE_PRICE_ID
  // `plan` is sent explicitly (not left to default) so each card's mapping
  // stays unambiguous even if the backend's default ever changes.
  var BUTTONS = [
    { id: 'pricing-monthly-btn', endpoint: '/altitude/checkout', body: { plan: 'monthly' } },
    { id: 'pricing-annual-btn',  endpoint: '/altitude/checkout', body: { plan: 'annual' } },
    { id: 'pricing-guide-btn',   endpoint: '/guide/checkout',    body: {} },
  ];

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    BUTTONS.forEach(function (cfg) {
      var btn = document.getElementById(cfg.id);
      if (!btn) return;
      btn.addEventListener('click', function (e) { handleClick(e, btn, cfg); });
    });

    initAltitudeTabs();
  }

  function initAltitudeTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-pricing-plan-tab]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-pricing-plan-panel]'));
    if (!tabs.length || !panels.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var plan = tab.getAttribute('data-pricing-plan-tab');

        tabs.forEach(function (candidate) {
          var isActive = candidate === tab;
          candidate.classList.toggle('is-active', isActive);
          candidate.setAttribute('aria-selected', isActive ? 'true' : 'false');
          candidate.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-pricing-plan-panel') !== plan;
        });
      });
    });
  }

  function handleClick(e, btn, cfg) {
    e.preventDefault();
    var originalHtml = btn.innerHTML;
    btn.classList.add('pointer-events-none', 'opacity-70');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Redirecting…';

    fetch(WORKER + cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg.body),
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
