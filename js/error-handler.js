/**
 * Global error + offline handler.
 * Injected dynamically by js/header.js (same pattern as js/ui.js), so it runs
 * on every page automatically. Self-contained (inline styles) so it renders
 * correctly even if something else on the page is broken.
 */
(function () {
  'use strict';
  if (window._skyErrorHandler) return;
  window._skyErrorHandler = true;

  var prefix = window.location.pathname.includes('/pages/') ? '../' : '';
  var homeHref = prefix + 'index.html';

  var errorShown = false;
  var offlineOverlayEl = null;

  function pillBtn(label, iconClass, isPrimary, onclick, href) {
    var base = 'display:inline-flex;align-items:center;gap:8px;border-radius:9999px;' +
      'padding:11px 22px;font-family:\'Manrope\',sans-serif;font-size:14px;font-weight:600;' +
      'text-decoration:none;cursor:pointer;line-height:1;';
    var style = isPrimary
      ? base + 'background:#0066cc;color:#fff;border:none;'
      : base + 'background:transparent;color:#0066cc;border:1.5px solid #0066cc;';
    if (href) {
      return '<a href="' + href + '" style="' + style + '"><i class="' + iconClass + '"></i> ' + label + '</a>';
    }
    return '<button type="button" onclick="' + onclick + '" style="' + style + '"><i class="' + iconClass + '"></i> ' + label + '</button>';
  }

  function buildOverlay(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'status-overlay';
    overlay.setAttribute('role', opts.role || 'alert');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#ffffff;' +
      'display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem;' +
      'opacity:0;transition:opacity .3s ease-out;';
    overlay.innerHTML =
      '<div style="max-width:26rem;width:100%;text-align:center;">' +
        '<img src="' + prefix + 'images/' + opts.image + '" alt="' + opts.alt + '" ' +
          'class="animate-float" style="width:200px;max-width:60vw;height:auto;margin:0 auto 2rem;display:block;">' +
        '<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3em;color:#0066cc;margin-bottom:12px;">' +
          opts.eyebrow + '</p>' +
        '<h1 style="font-family:\'Lexend\',sans-serif;font-size:1.875rem;font-weight:700;color:#111827;letter-spacing:-0.01em;margin-bottom:12px;">' +
          opts.heading + '</h1>' +
        '<p style="font-family:\'Manrope\',sans-serif;font-weight:500;color:#4b5563;font-size:1rem;line-height:1.65;margin-bottom:' +
          (opts.statusLine ? '24px' : '36px') + ';">' + opts.body + '</p>' +
        (opts.statusLine
          ? '<p id="sky-offline-status" style="display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#6b7280;background:#f5f5f7;padding:8px 16px;border-radius:9999px;margin-bottom:36px;" aria-live="polite">' +
              opts.statusLine + '</p>'
          : '') +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">' + opts.buttons + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
    return overlay;
  }

  // --- Uncaught JS errors / unhandled promise rejections -> error overlay ---
  function showErrorOverlay() {
    if (errorShown) return;
    errorShown = true;
    buildOverlay({
      image: 'server-error.png',
      alt: 'Server error illustration',
      eyebrow: 'Error 500',
      heading: 'Something went wrong on our end.',
      body: 'We hit some turbulence. Our team has been notified — please try again in a moment.',
      buttons:
        pillBtn('Retry', 'fa-solid fa-arrow-rotate-right', true, 'location.reload()') +
        pillBtn('Return to Home', 'fa-solid fa-house', false, null, homeHref)
    });
  }

  window.addEventListener('error', function (e) {
    // Resource-load failures (broken img/script/link) target the failing
    // element, not window -- only react to genuine script execution errors.
    if (e && e.target && e.target !== window) return;
    showErrorOverlay();
  });

  window.addEventListener('unhandledrejection', function () {
    showErrorOverlay();
  });

  // --- Offline / online detection -> offline overlay, auto-hides on reconnect ---
  function showOfflineOverlay() {
    if (offlineOverlayEl) return;
    offlineOverlayEl = buildOverlay({
      role: 'status',
      image: 'no-internet.png',
      alt: 'No internet connection illustration',
      eyebrow: 'No Connection',
      heading: "You're offline.",
      body: "Check your Wi-Fi or mobile data connection. We'll reconnect automatically once you're back online.",
      statusLine: '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:10px;"></i> Waiting for connection…',
      buttons: pillBtn('Return to Home', 'fa-solid fa-house', false, null, homeHref)
    });
  }

  function hideOfflineOverlay() {
    if (!offlineOverlayEl) return;
    var el = offlineOverlayEl;
    offlineOverlayEl = null;
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  window.addEventListener('offline', showOfflineOverlay);
  window.addEventListener('online', hideOfflineOverlay);

  try {
    if (navigator && navigator.onLine === false) showOfflineOverlay();
  } catch (_) {}
})();
