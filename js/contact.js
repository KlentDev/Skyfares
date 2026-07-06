document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  function loadConfetti(cb) {
    if (typeof confetti === 'function') { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function fireConfetti() {
    loadConfetti(() => {
      if (typeof confetti !== 'function') return;
      confetti({ particleCount: 110, spread: 75, origin: { x: 0.5, y: 0.4 }, colors: ['#0C4A6E', '#38bdf8', '#7dd3fc', '#C9A227', '#ffffff'], zIndex: 9999 });
      setTimeout(() => { confetti({ particleCount: 55, spread: 55, origin: { x: 0.25, y: 0.5 }, colors: ['#0C4A6E', '#bae6fd', '#ffffff'], zIndex: 9999 }); }, 180);
      setTimeout(() => { confetti({ particleCount: 55, spread: 55, origin: { x: 0.75, y: 0.5 }, colors: ['#C9A227', '#7dd3fc', '#0C4A6E'], zIndex: 9999 }); }, 340);
    });
  }

  function setBtnState(btn, state, originalText) {
    btn.classList.remove('btn-contact-success', 'btn-contact-error');
    if (state === 'success') {
      btn.classList.add('btn-contact-success');
      btn.textContent = '✓ Message sent!';
      btn.disabled = true;
      setTimeout(() => {
        btn.classList.remove('btn-contact-success');
        btn.textContent = originalText;
        btn.disabled = false;
      }, 4000);
    } else if (state === 'error') {
      btn.classList.add('btn-contact-error');
      btn.textContent = 'Something went wrong — try again';
      btn.disabled = false;
      setTimeout(() => {
        btn.classList.remove('btn-contact-error');
        btn.textContent = originalText;
      }, 3000);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const payload = {};
    new FormData(form).forEach((v, k) => { payload[k] = v; });

    try {
      const response = await fetch(
        'https://skyfares-altitude.klent-5fa.workers.dev/airtable/contact',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();

      if (result.success) {
        fireConfetti();
        setBtnState(btn, 'success', originalText);
        form.reset();
      } else {
        throw new Error(result.error || 'unknown');
      }
    } catch {
      setBtnState(btn, 'error', originalText);
    }
  });
});
