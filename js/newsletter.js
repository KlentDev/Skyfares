(function () {
  var ENDPOINT = 'https://skyfares-altitude.klent-5fa.workers.dev';

  // Variant map: bundles the 3 things that change together for a given form
  // (destination path, localStorage suppression key, toast copy) into one
  // atomic switch set via data-newsletter-variant, so they can never drift
  // out of sync across usages. Omitting the attribute (every existing usage
  // today) falls through to "default", reproducing today's exact behavior.
  var VARIANTS = {
    default: {
      path: '',
      storageKey: 'altitudeSubscribed',
      successToast: "You're subscribed — welcome aboard!",
      dupToast: "You're already on the list! Check your inbox for our latest issue.",
    },
    waitlist: {
      path: '/altitude/waitlist',
      storageKey: 'altitudeWaitlistJoined',
      successToast: "You're on the waitlist — we'll email you the moment early access opens!",
      dupToast: "You're already on the waitlist!",
    },
  };

  function getVariant(wrapperEl) {
    var key = (wrapperEl && wrapperEl.dataset.newsletterVariant) || 'default';
    return VARIANTS[key] || VARIANTS.default;
  }

  // Load canvas-confetti from CDN on first use
  var confettiReady = false;
  function loadConfetti(cb) {
    if (typeof confetti === 'function') { cb(); return; }
    if (confettiReady) return; // already loading
    confettiReady = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function fireConfetti(wrapperEl) {
    loadConfetti(function () {
      if (typeof confetti !== 'function') return;
      var inModal = wrapperEl && wrapperEl.closest('#altitude-popup');
      if (inModal) {
        confetti({
          particleCount: 90,
          spread: 65,
          origin: { x: 0.5, y: 0.55 },
          colors: ['#0C4A6E', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff'],
          zIndex: 9999,
        });
      } else {
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { x: 0.5, y: 0.4 },
          colors: ['#0C4A6E', '#38bdf8', '#7dd3fc', '#C9A227', '#ffffff'],
          zIndex: 9999,
        });
        setTimeout(function () {
          confetti({
            particleCount: 55,
            spread: 55,
            origin: { x: 0.25, y: 0.5 },
            colors: ['#0C4A6E', '#bae6fd', '#ffffff'],
            zIndex: 9999,
          });
        }, 180);
        setTimeout(function () {
          confetti({
            particleCount: 55,
            spread: 55,
            origin: { x: 0.75, y: 0.5 },
            colors: ['#C9A227', '#7dd3fc', '#0C4A6E'],
            zIndex: 9999,
          });
        }, 340);
      }
    });
  }

  function showSuccessState(wrapperEl) {
    var parent = wrapperEl.parentElement;
    if (!parent) return;
    var successEl = parent.querySelector('[data-newsletter-success]');
    if (successEl) {
      wrapperEl.style.display = 'none';
      successEl.classList.remove('hidden');
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'text-sm font-medium mt-3 ' + (
      type === 'error' ? 'text-red-500' : 'text-brand-600'
    );
    el.classList.remove('hidden');
    el.setAttribute('aria-live', 'polite');
  }

  function closeSkyPopup() {
    var popup = document.getElementById('altitude-popup');
    if (popup && !popup.classList.contains('hidden')) {
      popup.classList.add('hidden');
      popup.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  async function subscribeEmail(email, name, statusEl, btnEl, wrapperEl) {
    var originalText = btnEl ? btnEl.textContent : '';
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Subscribing…'; }
    if (statusEl) statusEl.classList.add('hidden');

    var variant = getVariant(wrapperEl);

    var payload = { email: email.trim() };
    var firstName = (name || '').trim();
    if (firstName) payload.first_name = firstName;

    // Forward UTM params from the URL so a campaign landing page can pass
    // through real attribution (instagram / altitude_prelaunch / etc.)
    // instead of relying on the Worker's hardcoded defaults.
    try {
      var qs = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
        var v = qs.get(k);
        if (v) payload[k] = v;
      });
    } catch (_) {}

    // Honeypot passthrough -- no-op unless the form markup includes one.
    var honeypot = wrapperEl && wrapperEl.querySelector('[data-newsletter-honeypot]');
    if (honeypot && honeypot.value) payload['bot-field'] = honeypot.value;

    try {
      var res = await fetch(ENDPOINT + variant.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      var data = {};
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data.success) {
        if (data.already_premium) {
          var alreadyMsg = "You already have full Altitude Access — no need to join the waitlist!";
          setStatus(statusEl, alreadyMsg, 'error');
          if (window.SkyUI) SkyUI.toast(alreadyMsg, { type: 'info', duration: 6000 });
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = originalText; }
          return;
        }
        fireConfetti(wrapperEl);
        showSuccessState(wrapperEl);
        try { localStorage.setItem(variant.storageKey, '1'); } catch (_) {}
        if (window.SkyUI) SkyUI.toast(variant.successToast, { type: 'success' });
        if (wrapperEl && wrapperEl.closest('#altitude-popup')) {
          setTimeout(closeSkyPopup, 3500);
        }
        return;
      }

      if (res.status === 409 || data.error === 'already_subscribed') {
        try { localStorage.setItem(variant.storageKey, '1'); } catch (_) {}
        setStatus(statusEl, variant.dupToast, 'error');
        if (window.SkyUI) SkyUI.toast(variant.dupToast, { type: 'info', duration: 5000 });
      } else if (res.status === 429 || data.error === 'rate_limited') {
        var rlMsg = 'Too many requests. Please wait a few minutes before trying again.';
        setStatus(statusEl, rlMsg, 'error');
        if (window.SkyUI) SkyUI.toast(rlMsg, { type: 'error' });
      } else {
        var errMsg = data.error || 'Something went wrong. Please try again.';
        setStatus(statusEl, errMsg, 'error');
        if (window.SkyUI) SkyUI.toast(errMsg, { type: 'error' });
      }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = originalText; }

    } catch (_) {
      var netMsg = 'Network error. Please check your connection and try again.';
      setStatus(statusEl, netMsg, 'error');
      if (window.SkyUI) SkyUI.toast(netMsg, { type: 'error' });
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = originalText; }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-newsletter-form]').forEach(function (wrapper) {
      var input  = wrapper.querySelector('[data-newsletter-email]');
      var nameEl = wrapper.querySelector('[data-newsletter-name]');
      var btn    = wrapper.querySelector('[data-newsletter-btn]');
      var status = wrapper.querySelector('[data-newsletter-status]');

      if (!input || !btn) return;

      function submit() {
        var email = input.value;
        if (!validateEmail(email)) {
          setStatus(status, 'Please enter a valid email address.', 'error');
          input.focus();
          return;
        }
        subscribeEmail(email, nameEl ? nameEl.value : '', status, btn, wrapper);
      }

      btn.addEventListener('click', submit);
      [input, nameEl].forEach(function (el) {
        if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      });
    });
  });
})();
