// Hero background video — plays forward, then reverses back to the start
// instead of jump-cutting to 0 (boomerang loop), then plays forward again.
// Native <video> has no reverse playback support (negative playbackRate is
// ignored by every major browser), so reverse is simulated by seeking
// currentTime backward repeatedly while paused.
//
// The backward seeks are paced off the video's own `seeked` event (fired
// once the browser finishes landing a seek) rather than blindly firing a new
// seek every animation frame. Video seeking is comparatively expensive
// (decode forward from the nearest keyframe), so issuing new seek requests
// faster than the browser can complete them just queues up a backlog and
// shows as stutter/buffering -- waiting for each seek to actually land
// before requesting the next one keeps it running at whatever pace the
// browser can smoothly sustain, instead of overwhelming it.
(function () {
  var video = document.getElementById('hero-bg-video');
  if (!video) return;

  var reversing = false;
  var lastStepTime = null;

  function onSeeked() {
    if (!reversing) return;

    var now = performance.now();
    var deltaSeconds = (now - lastStepTime) / 1000;
    lastStepTime = now;

    var next = video.currentTime - deltaSeconds;
    if (next <= 0.05) {
      reversing = false;
      video.currentTime = 0;
      video.play();
      return;
    }
    video.currentTime = next;
  }

  video.addEventListener('seeked', onSeeked);

  video.addEventListener('ended', function () {
    if (reversing) return;
    reversing = true;
    video.pause();
    lastStepTime = performance.now();
    // Kick off the first backward seek; onSeeked takes over chaining
    // subsequent steps once this one lands.
    video.currentTime = Math.max(0, video.currentTime - 0.05);
  });

  window.addEventListener('pagehide', function () {
    reversing = false;
  });
})();
