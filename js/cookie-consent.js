(function () {
  if (window._skyCC) return;
  window._skyCC = true;

  var BASE        = window.location.pathname.includes('/pages/') ? '../' : '';
  var STORAGE_KEY = 'sc_consent';
  var pixelLoaded = false;

  // ─── Storage ──────────────────────────────────────────────────────────────────

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return (d && d.v === 1 && d.categories) ? d : null;
    } catch (_) { return null; }
  }

  function saveConsent(cats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ts: Date.now(), categories: cats }));
    } catch (_) {}
  }

  // ─── Script loading ───────────────────────────────────────────────────────────

  function loadMarketing() {
    if (pixelLoaded) return;
    pixelLoaded = true;
    var s = document.createElement('script');
    s.src = BASE + 'js/meta-pixel.js';
    s.async = true;
    document.head.appendChild(s);
  }

  function applyConsent(cats) {
    if (cats.marketing) loadMarketing();
  }

  // ─── Toggle CSS (needed for ::before pseudo-element) ─────────────────────────

  function injectToggleCSS() {
    if (document.getElementById('cc-tcss')) return;
    var st = document.createElement('style');
    st.id  = 'cc-tcss';
    st.textContent =
      '.cc-t{-webkit-appearance:none;appearance:none;width:44px;min-width:44px;height:24px;' +
      'border-radius:12px;background:#e2e8f0;border:1.5px solid #cbd5e1;cursor:pointer;' +
      'position:relative;flex-shrink:0;transition:background .2s,border-color .2s;}' +
      '.cc-t::before{content:"";position:absolute;width:18px;height:18px;border-radius:50%;' +
      'background:#fff;top:2px;left:2px;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:transform .2s;}' +
      '.cc-t:checked{background:#0066cc !important;border-color:#0066cc !important;}' +
      '.cc-t:checked::before{transform:translateX(20px);}' +
      '.cc-t:disabled{background:#0066cc !important;border-color:#0066cc !important;opacity:.55;cursor:not-allowed;}' +
      '.cc-t:disabled::before{transform:translateX(20px);}' +
      '.cc-t:focus-visible{outline:2px solid #0066cc;outline-offset:2px;}' +
      '@keyframes cc-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
      '.cc-banner-in{animation:cc-slide-up .35s cubic-bezier(.16,1,.3,1) both;}';
    document.head.appendChild(st);
  }

  // ─── Bottom Banner ────────────────────────────────────────────────────────────

  function showBanner() {
    if (document.getElementById('cc-banner')) return;
    injectToggleCSS();

    var bar = document.createElement('div');
    bar.id = 'cc-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.className = 'cc-banner-in';
    bar.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;z-index:10000;' +
      'background:#1A2437;border-top:1px solid rgba(255,255,255,.10);' +
      'padding:1rem 1.5rem;font-family:Manrope,ui-sans-serif,system-ui,sans-serif;' +
      'box-shadow:0 -8px 40px rgba(0,0,0,.25);';

    bar.innerHTML =
      '<div style="max-width:1280px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1.5rem;">' +

        /* Icon + text */
        '<div style="display:flex;align-items:flex-start;gap:.75rem;flex:1;min-width:220px;">' +
          '<i class="fa-solid fa-shield-halved" style="color:#0066cc;font-size:1.125rem;margin-top:2px;flex-shrink:0;"></i>' +
          '<div>' +
            '<p style="margin:0 0 2px;font-size:.8125rem;font-weight:700;color:#fff;">We use cookies</p>' +
            '<p style="margin:0;font-size:.75rem;color:rgba(255,255,255,.55);line-height:1.5;">' +
              'Essential cookies keep the site working. With your consent, we also use marketing cookies. ' +
              '<a href="' + BASE + 'pages/privacy" style="color:rgba(255,255,255,.45);text-decoration:underline;">Privacy Policy</a>' +
            '</p>' +
          '</div>' +
        '</div>' +

        /* Buttons */
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;">' +
          '<button id="cc-accept" style="padding:.625rem 1.25rem;background:#0066cc;color:#fff;border:none;border-radius:9999px;font-size:.8125rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">Accept All</button>' +
          '<button id="cc-reject" style="padding:.625rem 1.25rem;background:transparent;color:rgba(255,255,255,.75);border:1.5px solid rgba(255,255,255,.2);border-radius:9999px;font-size:.8125rem;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;">Reject Non-Essential</button>' +
          '<button id="cc-manage" style="padding:.625rem 1rem;background:transparent;border:none;color:rgba(255,255,255,.45);font-size:.8125rem;cursor:pointer;font-family:inherit;text-decoration:underline;white-space:nowrap;">Manage Preferences</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(bar);

    document.getElementById('cc-accept').addEventListener('click', function () {
      var cats = { necessary: true, functional: true, analytics: true, marketing: true };
      saveConsent(cats);
      applyConsent(cats);
      hideBanner();
    });

    document.getElementById('cc-reject').addEventListener('click', function () {
      saveConsent({ necessary: true, functional: false, analytics: false, marketing: false });
      hideBanner();
    });

    document.getElementById('cc-manage').addEventListener('click', function () {
      showPreferences();
    });
  }

  function hideBanner() {
    var el = document.getElementById('cc-banner');
    if (!el) return;
    el.style.transition = 'transform .3s ease-in,opacity .3s ease-in';
    el.style.transform  = 'translateY(100%)';
    el.style.opacity    = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }

  // ─── Preferences Modal ────────────────────────────────────────────────────────

  function showPreferences() {
    if (document.getElementById('cc-modal')) return;
    injectToggleCSS();

    var saved = getConsent();
    var cats  = saved ? saved.categories : { necessary: true, functional: false, analytics: false, marketing: false };

    var overlay = document.createElement('div');
    overlay.id  = 'cc-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Cookie preferences');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;' +
      'padding:1rem;background:rgba(0,13,26,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';

    function catRow(id, label, desc, checked, disabled) {
      return (
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;' +
               'padding:.875rem 1rem;background:#f8fafc;border:1px solid rgba(0,102,204,.08);' +
               'border-radius:14px;margin-bottom:.5rem;">' +
          '<div style="flex:1;">' +
            '<p style="margin:0 0 2px;font-size:.8125rem;font-weight:700;color:#0f172a;">' + label + '</p>' +
            '<p style="margin:0;font-size:.6875rem;color:#64748b;line-height:1.5;">' + desc + '</p>' +
          '</div>' +
          '<input type="checkbox" class="cc-t"' +
            (id       ? ' id="'  + id  + '"' : '') +
            (checked  ? ' checked'           : '') +
            (disabled ? ' disabled'          : '') +
            ' role="switch" aria-checked="' + (checked ? 'true' : 'false') + '"' +
            ' aria-label="' + label + '">' +
        '</div>'
      );
    }

    var card = document.createElement('div');
    card.style.cssText =
      'position:relative;width:100%;max-width:480px;background:#fff;border-radius:2.5rem;' +
      'box-shadow:0 25px 80px rgba(0,0,0,.28);padding:2rem 2.5rem;overflow-y:auto;max-height:90dvh;' +
      'font-family:Manrope,ui-sans-serif,system-ui,sans-serif;';

    card.innerHTML =
      '<button id="cc-modal-close" style="position:absolute;top:1.25rem;right:1.25rem;width:2.25rem;height:2.25rem;' +
        'display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f1f5f9;' +
        'border:none;cursor:pointer;color:#64748b;" aria-label="Close">' +
        '<i class="fa-solid fa-xmark" style="font-size:.875rem;"></i>' +
      '</button>' +

      '<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(0,102,204,.08);' +
        'border:1px solid rgba(0,102,204,.18);border-radius:9999px;font-size:10px;font-weight:700;' +
        'letter-spacing:.08em;text-transform:uppercase;color:#0066cc;margin-bottom:1.25rem;">' +
        '<i class="fa-solid fa-shield-halved" style="font-size:9px;"></i> Cookie Preferences' +
      '</div>' +

      '<h3 style="margin:0 0 .5rem;font-size:1.25rem;font-weight:800;color:#0f172a;">Manage Preferences</h3>' +
      '<p style="margin:0 0 1.25rem;font-size:.8125rem;color:#64748b;line-height:1.65;">' +
        'Choose which cookies you allow. Strictly necessary cookies are always enabled.' +
      '</p>' +

      catRow('', 'Strictly Necessary', 'Session management, security, and core site functionality. Always enabled.', true, true) +
      catRow('cc-p-functional', 'Functional', 'Saved preferences and enhanced website features.', cats.functional, false) +
      catRow('cc-p-analytics',  'Analytics',  'Helps us understand how visitors use the site. No analytics currently active.', cats.analytics, false) +
      catRow('cc-p-marketing',  'Marketing',  'Personalised advertising via Facebook Pixel and future ad integrations.', cats.marketing, false) +

      '<button id="cc-save" style="display:block;width:100%;margin-top:1.25rem;padding:.875rem 1.5rem;' +
        'background:#0066cc;color:#fff;border:none;border-radius:9999px;font-size:.875rem;font-weight:700;' +
        'cursor:pointer;font-family:inherit;">Save Preferences</button>' +

      '<p style="text-align:center;font-size:.6875rem;color:#cbd5e1;margin-top:1rem;">' +
        '<a href="' + BASE + 'pages/privacy" style="color:#94a3b8;text-decoration:underline;">Privacy Policy</a>' +
        ' &nbsp;&middot;&nbsp; ' +
        '<a href="' + BASE + 'pages/terms" style="color:#94a3b8;text-decoration:underline;">Terms &amp; Conditions</a>' +
      '</p>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function closeModal() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', modalEsc);
    }

    function modalEsc(e) { if (e.key === 'Escape') closeModal(); }

    document.getElementById('cc-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', modalEsc);

    ['functional', 'analytics', 'marketing'].forEach(function (cat) {
      var t = document.getElementById('cc-p-' + cat);
      if (t) t.addEventListener('change', function () {
        this.setAttribute('aria-checked', this.checked.toString());
      });
    });

    document.getElementById('cc-save').addEventListener('click', function () {
      var chosen = {
        necessary:  true,
        functional: document.getElementById('cc-p-functional').checked,
        analytics:  document.getElementById('cc-p-analytics').checked,
        marketing:  document.getElementById('cc-p-marketing').checked,
      };
      saveConsent(chosen);
      applyConsent(chosen);
      closeModal();
      hideBanner();
    });

    setTimeout(function () {
      var cb = document.getElementById('cc-modal-close');
      if (cb) cb.focus();
    }, 60);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  window.SkyConsent = {
    openPreferences: function () { showPreferences(); }
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────

  var saved = getConsent();
  if (saved) applyConsent(saved.categories);

  function showAfterLoader() {
    var loader = document.getElementById('page-loader');
    if (!loader) { setTimeout(showBanner, 350); return; }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        for (var j = 0; j < muts[i].removedNodes.length; j++) {
          if (muts[i].removedNodes[j].id === 'page-loader') {
            obs.disconnect();
            setTimeout(showBanner, 350);
            return;
          }
        }
      }
    });
    obs.observe(document.body, { childList: true });
  }

  // Show the consent banner only when the visitor has not chosen yet.
  // (Prior consent is already applied above via applyConsent.)
  if (!saved) showAfterLoader();

})();
