/**
 * Beehiiv manual page -- click-to-enlarge lightbox for step screenshots,
 * plus a "Before you start" panel that stays in view while the step list
 * scrolls past it. Everything here is scoped to this page's own elements
 * and no-ops on every other page.
 */
(function () {
  wireStickyNote();
  wireLightbox();

  // Keeps the "Before you start" note visible while the taller step list
  // scrolls past it. Uses position:fixed toggled from a scroll listener
  // rather than CSS position:sticky -- html/body's site-wide
  // overflow-x:hidden (css/style.css) computes their overflow-y as auto
  // too (per the CSS overflow spec, one non-visible axis forces the other
  // to auto), which makes <body> register as a scroll container even
  // though <html> is the one actually scrolling. That breaks sticky's
  // nearest-scrolling-ancestor resolution for anything under <body> --
  // same fallback already used for the Award Alerts feed panel
  // (js/altitude-content-award-alerts.js). Desktop two-column layout
  // only; single-column mobile stays static.
  function wireStickyNote() {
    var note = document.querySelector('.altitude-manual-note');
    var layout = document.querySelector('.altitude-manual-layout');
    if (!note || !layout) return;

    var OFFSET = 150; // clears the sticky private header + altitude subnav
    var placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.display = 'none';
    note.parentNode.insertBefore(placeholder, note);
    var naturalWidth = 0;

    function isDesktop() {
      return window.matchMedia('(min-width: 1081px)').matches;
    }

    function unfix() {
      note.classList.remove('altitude-manual-note--fixed');
      note.style.width = '';
      note.style.top = '';
      placeholder.style.display = 'none';
    }

    function update() {
      if (!isDesktop()) { unfix(); return; }
      if (!note.classList.contains('altitude-manual-note--fixed')) {
        naturalWidth = note.getBoundingClientRect().width;
      }

      var layoutRect = layout.getBoundingClientRect();
      var noteHeight = note.offsetHeight;
      var shouldFix = layoutRect.top < OFFSET && layoutRect.bottom > OFFSET + noteHeight;

      if (shouldFix) {
        note.classList.add('altitude-manual-note--fixed');
        note.style.width = naturalWidth + 'px';
        note.style.top = OFFSET + 'px';
        placeholder.style.width = naturalWidth + 'px';
        placeholder.style.height = noteHeight + 'px';
        placeholder.style.display = 'block';
      } else {
        unfix();
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Click-to-enlarge lightbox for the step screenshots.
  function wireLightbox() {
    var triggers = document.querySelectorAll('[data-manual-lightbox]');
    if (!triggers.length) return;

    var overlay, imgEl, captionEl, closeBtn, lastTrigger;

    function build() {
      overlay = document.createElement('div');
      overlay.className = 'altitude-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML =
        '<div class="altitude-lightbox__backdrop"></div>' +
        '<figure class="altitude-lightbox__card">' +
          '<button type="button" class="altitude-lightbox__close" aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
          '<img class="altitude-lightbox__img" alt="" />' +
          '<figcaption class="altitude-lightbox__caption"></figcaption>' +
        '</figure>';
      document.body.appendChild(overlay);
      imgEl = overlay.querySelector('.altitude-lightbox__img');
      captionEl = overlay.querySelector('.altitude-lightbox__caption');
      closeBtn = overlay.querySelector('.altitude-lightbox__close');

      overlay.querySelector('.altitude-lightbox__backdrop').addEventListener('click', close);
      closeBtn.addEventListener('click', close);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('altitude-lightbox--in')) close();
      });
    }

    function open(trigger) {
      if (!overlay) build();
      lastTrigger = trigger;
      var src = trigger.getAttribute('data-img');
      var alt = trigger.getAttribute('data-alt') || '';
      imgEl.src = src;
      imgEl.alt = alt;
      captionEl.textContent = alt;
      document.body.style.overflow = 'hidden';
      overlay.classList.add('altitude-lightbox--in');
      requestAnimationFrame(function () { closeBtn.focus(); });
    }

    function close() {
      overlay.classList.remove('altitude-lightbox--in');
      document.body.style.overflow = '';
      if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () { open(btn); });
    });
  }
})();
