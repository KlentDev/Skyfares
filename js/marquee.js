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

  // Drives one marquee track along either axis using the Web Animations API.
  // outer is the overflow:hidden viewport (hover target); track is the flex
  // strip holding two duplicated copies of the item list (so translating by
  // exactly half its scroll size loops seamlessly). Shared by the horizontal
  // airline-logo strip (axis 'x', auto-initialized below) and any manually
  // triggered vertical track (axis 'y', initialized once its async content
  // exists — see js/testimonials.js).
  function initMarquee(outer, opts) {
    opts = opts || {};
    var axis = opts.axis === 'y' ? 'y' : 'x';
    var normalMs = opts.normalMs || NORMAL_MS;
    var slowMs = opts.slowMs || SLOW_MS;

    var track = outer.querySelector('.marquee-track');
    if (!track) return;

    function loopSize() {
      return (axis === 'y' ? track.scrollHeight : track.scrollWidth) / 2;
    }

    function frame(distance) {
      var from = axis === 'y' ? 'translateY(0)' : 'translateX(0)';
      var to = axis === 'y' ? 'translateY(-' + distance + 'px)' : 'translateX(-' + distance + 'px)';
      return [{ transform: from }, { transform: to }];
    }

    whenImagesReady(track).then(function () {
      var loopDistance = loopSize();
      if (!loopDistance) return;

      track.classList.add('is-js-driven');

      var duration = normalMs;
      var animation = track.animate(frame(loopDistance), {
        duration: duration,
        iterations: Infinity,
        easing: 'linear'
      });

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
        setSpeed(slowMs);
      });

      outer.addEventListener('mouseleave', function () {
        setSpeed(normalMs);
      });

      window.addEventListener('resize', function () {
        var nextLoopDistance = loopSize();
        if (!nextLoopDistance) return;

        var currentTime = animation.currentTime;
        var progress = currentTime === null ? 0 : (currentTime % duration) / duration;

        animation.cancel();
        loopDistance = nextLoopDistance;
        animation = track.animate(frame(loopDistance), {
          duration: duration,
          iterations: Infinity,
          easing: 'linear'
        });
        animation.currentTime = progress * duration;
      });
    });
  }

  window.SkyMarquee = { init: initMarquee };

  document.addEventListener('DOMContentLoaded', function () {
    var outers = document.querySelectorAll('.marquee-outer:not([data-marquee-manual])');
    Array.from(outers).forEach(function (outer) {
      initMarquee(outer, { axis: 'x' });
    });
  });
})();
