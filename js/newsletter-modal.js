/**
 * Free newsletter sign-up modal ("Business Class intel, every {day}.").
 *
 * Markup lives in components/free-newsletter-modal.html (fetched once,
 * injected into <body>) instead of being duplicated inline per page --
 * mirrors the js/magic-modal.js pattern used for the shared login modal.
 *
 * The [data-newsletter-day] placeholders are filled in with today's weekday
 * in Singapore time once the component is injected, so the headline/CTA
 * always reflect the day the visitor is actually looking at the popup.
 *
 * window.openNewsletterModal() is exposed so any on-page trigger (e.g. the
 * "Get the Free Brief" link in the homepage Newsletter Preview section) can
 * reopen the same instance manually, not just the automatic 5s popup.
 *
 * Guarded against double-injection in case this ever loads twice.
 */
(function () {
  if (document.getElementById('altitude-popup') || window.__altitudeModalLoading) return;
  window.__altitudeModalLoading = true;

  var componentUrl = (window.location.pathname.includes('/pages/') ? '../' : '') + 'components/free-newsletter-modal.html';

  // Fills every [data-newsletter-day] placeholder on the page (the popup's
  // headline/CTA once injected, and the static inline "Free Newsletter"
  // section that's in the DOM from the start) with today's weekday in
  // Singapore time, so all newsletter surfaces always agree with each other.
  function fillDayPlaceholders() {
    try {
      var todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Singapore' }).format(new Date());
      document.querySelectorAll('[data-newsletter-day]').forEach(function (el) { el.textContent = todayName; });
    } catch (_) {}
  }
  fillDayPlaceholders();

  // openNewsletterModal() may be called (e.g. from a manual trigger's click
  // handler) before the fetch below resolves -- queue it and replay once the
  // modal DOM actually exists, instead of silently no-opping.
  var pendingOpen = false;

  function _ready() {
    return !!document.getElementById('altitude-popup');
  }

  function openPopup() {
    var popup = document.getElementById('altitude-popup');
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.classList.add('flex');
    document.body.style.overflow = 'hidden';
    var emailInput = popup.querySelector('[data-newsletter-email]');
    if (emailInput) setTimeout(function () { emailInput.focus(); }, 80);
  }

  function closePopup() {
    var popup = document.getElementById('altitude-popup');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.classList.remove('flex');
    document.body.style.overflow = '';
    sessionStorage.setItem('altitudePopupShown', '1');
  }

  window.openNewsletterModal = function () {
    if (!_ready()) { pendingOpen = true; return; }
    openPopup();
  };

  fetch(componentUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      if (document.getElementById('altitude-popup')) return; // guard against a second concurrent load
      document.body.insertAdjacentHTML('beforeend', html);

      var popup    = document.getElementById('altitude-popup');
      var backdrop = document.getElementById('altitude-popup-backdrop');
      var closeBtn = document.getElementById('altitude-popup-close');
      var dismiss  = document.getElementById('altitude-popup-dismiss');

      if (closeBtn) closeBtn.addEventListener('click', closePopup);
      if (dismiss)  dismiss.addEventListener('click', closePopup);
      if (backdrop) backdrop.addEventListener('click', closePopup);

      var form = popup.querySelector('[data-newsletter-form]');
      if (form && window.SkyNewsletter) window.SkyNewsletter.bind(form);

      fillDayPlaceholders();

      if (pendingOpen) {
        pendingOpen = false;
        openPopup();
      } else {
        var popupEnabled = popup.hasAttribute('data-popup-enabled');
        if (popupEnabled && !sessionStorage.getItem('altitudePopupShown') && !localStorage.getItem('altitudeSubscribed')) {
          setTimeout(openPopup, 5000);
        }
      }
    })
    .catch(function () {});

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  document.querySelectorAll('[data-newsletter-modal-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      window.openNewsletterModal();
    });
  });
})();
