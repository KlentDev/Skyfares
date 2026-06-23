(function () {
  var ENDPOINT = 'https://skyfares-altitude.klent-5fa.workers.dev';

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

    var payload = { email: email.trim() };
    var firstName = (name || '').trim();
    if (firstName) payload.first_name = firstName;

    try {
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      var data = {};
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data.success) {
        fireConfetti(wrapperEl);
        showSuccessState(wrapperEl);
        if (wrapperEl && wrapperEl.closest('#altitude-popup')) {
          setTimeout(closeSkyPopup, 3500);
        }
        return;
      }

      if (res.status === 409 || data.error === 'already_subscribed') {
        setStatus(statusEl, "You're already on the list! Check your inbox for our latest issue.", 'error');
      } else {
        setStatus(statusEl, data.error || 'Something went wrong. Please try again.', 'error');
      }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = originalText; }

    } catch (_) {
      setStatus(statusEl, 'Network error. Please check your connection and try again.', 'error');
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
