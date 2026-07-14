// Subtle hero pointer parallax.
//
// Gives the hero a gentle sense of depth for marketing screen-recordings: the
// background video drifts a few pixels with the cursor over a small overscan
// (so the rounded card edges never reveal anything behind it). Deliberately
// scoped to the background layer only — the foreground text uses the CSS
// entrance animation (.hero-reveal, animation-fill-mode: both), so applying a
// competing inline transform there would fight that animation.
//
// Guards: desktop + fine pointer only, and fully disabled under
// prefers-reduced-motion. Transforms only (GPU), rAF-throttled, eased.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer  = window.matchMedia('(pointer: fine)').matches;
  if (reduceMotion || !finePointer || window.innerWidth < 1024) return;

  var video = document.getElementById('hero-bg-video');
  if (!video) return;

  var section = video.closest('.hero-photo-section');
  if (!section) return;

  var BASE_SCALE = 1.06; // overscan so drift never exposes the card edges
  var MAX = 10;          // px of drift at the pointer extremes
  var tx = 0, ty = 0;    // target offset
  var cx = 0, cy = 0;    // current (eased) offset
  var raf = null;

  function render() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    video.style.transform =
      'scale(' + BASE_SCALE + ') translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
      raf = requestAnimationFrame(render);
    } else {
      raf = null;
    }
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(render);
  }

  function onMove(e) {
    var r = section.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width - 0.5;  // -0.5 .. 0.5
    var ny = (e.clientY - r.top) / r.height - 0.5;
    tx = nx * MAX;
    ty = ny * MAX;
    schedule();
  }

  function onLeave() {
    tx = 0;
    ty = 0;
    schedule();
  }

  // Establish the overscan up front so the first pointer move doesn't jump.
  video.style.transform = 'scale(' + BASE_SCALE + ')';
  video.style.willChange = 'transform';

  section.addEventListener('mousemove', onMove);
  section.addEventListener('mouseleave', onLeave);
})();
