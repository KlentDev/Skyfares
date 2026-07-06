(function () {
  var carousel = document.querySelector('.fly-carousel');
  var track    = document.querySelector('.fly-carousel-track');
  if (!carousel || !track) return;

  // Same 6 hold positions the old CSS keyframe animation used (percent of
  // track width to shift left). Index 6 loops back to 0 -- the track's
  // content repeats after -50%, so the wrap is seamless.
  var STEPS = [0, 11.111, 18.056, 25, 36.111, 43.056];
  var STEP_MS = 1500;
  var index = 0;
  var timer = null;

  function apply(i) {
    track.style.transform = 'translateX(-' + STEPS[i] + '%)';
  }

  function advance() {
    index++;
    if (index >= STEPS.length) {
      // One extra step past the last hold to -50%, then an instant
      // (no-transition) snap back to 0% -- visually identical since the
      // track's second half duplicates the first.
      track.style.transform = 'translateX(-50%)';
      window.setTimeout(function () {
        track.classList.add('no-transition');
        index = 0;
        apply(0);
        track.offsetHeight; // force reflow so the no-transition jump applies immediately
        track.classList.remove('no-transition');
      }, 600);
      return;
    }
    apply(index);
  }

  function retreat() {
    if (index === 0) {
      // Mirror image of the forward wrap: there's no content to the right
      // of 0%, so instantly jump to the duplicate-content position one
      // full cycle ahead of the last step (visually identical to it),
      // then transition to the canonical coordinate for that same step --
      // imperceptible since both positions render the same images.
      track.classList.add('no-transition');
      index = STEPS.length - 1;
      track.style.transform = 'translateX(-' + (50 + STEPS[index]) + '%)';
      track.offsetHeight;
      track.classList.remove('no-transition');
      window.requestAnimationFrame(function () { apply(index); });
      return;
    }
    index--;
    apply(index);
  }

  function start() {
    stop();
    timer = window.setInterval(advance, STEP_MS);
  }

  function stop() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }

  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);

  var prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'fly-carousel-prev';
  prevBtn.setAttribute('aria-label', 'Previous photo');
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  prevBtn.addEventListener('click', function () {
    retreat();
    start(); // reset the auto-advance timer so it doesn't double-step right after
  });
  carousel.appendChild(prevBtn);

  var nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'fly-carousel-next';
  nextBtn.setAttribute('aria-label', 'Next photo');
  nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  nextBtn.addEventListener('click', function () {
    advance();
    start(); // reset the auto-advance timer so it doesn't double-step right after
  });
  carousel.appendChild(nextBtn);

  start();
})();
