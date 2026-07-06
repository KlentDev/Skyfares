(function () {
  'use strict';

  var NORMAL_MS = 30000;
  var SLOW_MS = 80000;

  function whenImagesReady(track) {
    var images = track.querySelectorAll('img');
    return Promise.all(Array.from(images).map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function initMarquee() {
    var outer = document.querySelector('.marquee-outer');
    if (!outer) return;

    var track = outer.querySelector('.marquee-track');
    if (!track) return;

    whenImagesReady(track).then(function () {
      var loopWidth = track.scrollWidth / 2;
      if (!loopWidth) return;

      track.classList.add('is-js-driven');

      var duration = NORMAL_MS;
      var animation = track.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-' + loopWidth + 'px)' }
        ],
        {
          duration: duration,
          iterations: Infinity,
          easing: 'linear'
        }
      );

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation.pause();
        return;
      }

      function setSpeed(nextDuration) {
        if (duration === nextDuration) return;

        var currentTime = animation.currentTime;
        if (currentTime === null) return;

        var progress = (currentTime % duration) / duration;
        duration = nextDuration;
        animation.effect.updateTiming({ duration: duration });
        animation.currentTime = progress * duration;
      }

      outer.addEventListener('mouseenter', function () {
        setSpeed(SLOW_MS);
      });

      outer.addEventListener('mouseleave', function () {
        setSpeed(NORMAL_MS);
      });

      window.addEventListener('resize', function () {
        var nextLoopWidth = track.scrollWidth / 2;
        if (!nextLoopWidth) return;

        var currentTime = animation.currentTime;
        var progress = currentTime === null ? 0 : (currentTime % duration) / duration;

        animation.cancel();
        loopWidth = nextLoopWidth;
        animation = track.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-' + loopWidth + 'px)' }
          ],
          {
            duration: duration,
            iterations: Infinity,
            easing: 'linear'
          }
        );
        animation.currentTime = progress * duration;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initMarquee);
})();
