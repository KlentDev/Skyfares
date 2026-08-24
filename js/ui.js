/**
 * Skyfare UI — shared toast / modal / alert / confirm components.
 *
 * Exposes window.SkyUI. Loaded globally (injected by header.js), so every page
 * can call SkyUI.toast(...) / SkyUI.modal(...) with no per-page setup.
 *
 *   SkyUI.toast('Saved', { type: 'success', duration: 4000 });
 *   SkyUI.modal({ title, body, actions: [{ label, style, onClick }], dismissible });
 *   SkyUI.alert('Message', { title, okLabel });
 *   SkyUI.confirm('Are you sure?', { onConfirm, onCancel, confirmLabel });
 */
(function () {
  if (window.SkyUI) return; // guard against double-injection

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function getToastWrap() {
    var wrap = document.getElementById('sky-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'sky-toast-wrap';
      wrap.className = 'sky-toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      wrap.setAttribute('aria-atomic', 'false');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  var TOAST_ICONS = {
    success: 'fa-circle-check',
    error:   'fa-circle-exclamation',
    info:    'fa-circle-info',
  };

  function toast(message, opts) {
    opts = opts || {};
    var type     = opts.type || 'info';
    var duration = typeof opts.duration === 'number' ? opts.duration : 4000;
    var wrap     = getToastWrap();

    var el = document.createElement('div');
    el.className = 'sky-toast sky-toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<i class="fa-solid ' + (TOAST_ICONS[type] || TOAST_ICONS.info) + ' sky-toast__icon"></i>' +
      '<span class="sky-toast__msg"></span>' +
      '<button class="sky-toast__close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
    el.querySelector('.sky-toast__msg').textContent = String(message || '');

    wrap.appendChild(el);
    // Trigger enter transition on next frame
    requestAnimationFrame(function () { el.classList.add('sky-toast--in'); });

    var timer;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.classList.remove('sky-toast--in');
      el.classList.add('sky-toast--out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }

    el.querySelector('.sky-toast__close').addEventListener('click', dismiss);
    if (duration > 0) timer = setTimeout(dismiss, duration);

    return { dismiss: dismiss };
  }

  // ─── Modal ──────────────────────────────────────────────────────────────────

  var openModals = [];

  var FOCUSABLE_SEL = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function modal(opts) {
    opts = opts || {};
    var dismissible = opts.dismissible !== false;
    var triggerEl = document.activeElement; // restored on close -- see focus trap below

    var overlay = document.createElement('div');
    overlay.className = 'sky-modal' + (opts.variant ? ' sky-modal--' + opts.variant : '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var actionsHtml = '';
    var actions = opts.actions || [];
    if (actions.length) {
      actionsHtml = '<div class="sky-modal__actions">' +
        actions.map(function (a, i) {
          var cls = a.style === 'primary'    ? 'btn-pill btn-pill-primary'
                  : a.style === 'primary-lg' ? 'btn-pill btn-pill-primary btn-pill-v2--lg btn-glow-v2'
                  : a.style === 'danger'     ? 'sky-modal__btn sky-modal__btn--danger'
                  : a.style === 'link'       ? 'sky-modal__btn sky-modal__btn--link'
                  : 'sky-modal__btn';
          return '<button data-sky-action="' + i + '" class="' + cls + '">' +
            escapeHtml(a.label || 'OK') + '</button>';
        }).join('') +
      '</div>';
    }

    overlay.innerHTML =
      '<div class="sky-modal__backdrop"></div>' +
      '<div class="sky-modal__card" role="document">' +
        (dismissible ? '<button class="sky-modal__x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' : '') +
        (opts.title ? '<h2 class="sky-modal__title"></h2>' : '') +
        '<div class="sky-modal__body"></div>' +
        actionsHtml +
      '</div>';

    if (opts.title) overlay.querySelector('.sky-modal__title').textContent = opts.title;
    var bodyEl = overlay.querySelector('.sky-modal__body');
    if (opts.html) { bodyEl.innerHTML = opts.html; }
    else { bodyEl.textContent = String(opts.body || ''); }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { overlay.classList.add('sky-modal--in'); });

    // Focus trap -- first real multi-field form used inside SkyUI.modal, so
    // this was never needed before now. Initial focus + Tab/Shift+Tab wrap
    // apply regardless of `dismissible` (a non-dismissible modal is still a
    // modal); only Escape-to-close is gated on it.
    var card = overlay.querySelector('.sky-modal__card');
    var firstFocusable = card.querySelector(FOCUSABLE_SEL);
    if (firstFocusable) firstFocusable.focus();

    function close() {
      overlay.classList.remove('sky-modal--in');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        openModals = openModals.filter(function (m) { return m !== handle; });
        if (!openModals.length) document.body.style.overflow = '';
      }, 220);
      document.removeEventListener('keydown', onKey);
      if (triggerEl && typeof triggerEl.focus === 'function') triggerEl.focus();
    }

    function onKey(e) {
      if (e.key === 'Escape' && dismissible) { close(); return; }
      if (e.key === 'Tab') {
        var focusables = card.querySelectorAll(FOCUSABLE_SEL);
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);

    // Wire action buttons
    actions.forEach(function (a, i) {
      var btn = overlay.querySelector('[data-sky-action="' + i + '"]');
      if (btn) btn.addEventListener('click', function () {
        var keepOpen = a.onClick && a.onClick() === false;
        if (!keepOpen) close();
      });
    });

    if (dismissible) {
      overlay.querySelector('.sky-modal__backdrop').addEventListener('click', close);
      var x = overlay.querySelector('.sky-modal__x');
      if (x) x.addEventListener('click', close);
    }

    var handle = { close: close, el: overlay };
    openModals.push(handle);
    return handle;
  }

  // ─── Alert / Confirm (built on modal) ────────────────────────────────────────

  function alertBox(message, opts) {
    opts = opts || {};
    return modal({
      title: opts.title || 'Notice',
      body: message,
      dismissible: opts.dismissible !== false,
      actions: [{ label: opts.okLabel || 'OK', style: 'primary' }],
    });
  }

  function confirmBox(message, opts) {
    opts = opts || {};
    return modal({
      title: opts.title || 'Please confirm',
      body: message,
      dismissible: opts.dismissible !== false,
      actions: [
        { label: opts.cancelLabel || 'Cancel', onClick: function () { if (opts.onCancel) opts.onCancel(); } },
        { label: opts.confirmLabel || 'Confirm', style: opts.danger ? 'danger' : 'primary',
          onClick: function () { if (opts.onConfirm) opts.onConfirm(); } },
      ],
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  window.SkyUI = {
    toast:   toast,
    modal:   modal,
    alert:   alertBox,
    confirm: confirmBox,
  };
})();
