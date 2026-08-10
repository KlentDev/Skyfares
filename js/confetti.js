// js/confetti.js — shared success-modal confetti burst, used by
// js/magic-modal.js, js/krisflyer-guide.js, and js/assessment-checkout.js.
// Same lazy CDN-load-on-first-use pattern and in-modal burst config already
// proven in js/newsletter.js's #altitude-popup branch -- js/newsletter.js
// and js/contact.js keep their own separate confetti (page-level cannon vs
// this modal-level single burst) and are not changed by this file.
(function () {
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

  window.fireBrandConfetti = function () {
    loadConfetti(function () {
      if (typeof confetti !== 'function') return;
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { x: 0.5, y: 0.55 },
        colors: ['#0C4A6E', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff'],
        zIndex: 9999,
      });
    });
  };
})();
