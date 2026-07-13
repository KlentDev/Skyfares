/**
 * Central link store — update here to change social links site-wide.
 * Loaded without `defer` so SKYFARE_LINKS is available to all deferred scripts.
 */
window.SKYFARE_LINKS = {
  // Pre-filled so the chat opens with intent. footer.js applies the same
  // default to any WhatsApp link that lacks a ?text= (and supports per-link
  // data-wa-message overrides); baking it here keeps links read from
  // SKYFARE_LINKS (e.g. the founder link) consistent regardless of timing.
  whatsapp: 'https://api.whatsapp.com/send?phone=6581575306&text=' +
    encodeURIComponent("Hi Skyfare, I'd like to speak to a travel consultant."),

  instagram: {
    handle: '@skyfareconsulting',
    url: 'https://www.instagram.com/skyfareconsulting/',
    videos: [
      { shortcode: 'DZjnEc8va83', type: 'reel', title: 'Instagram – Reel 1' },
      { shortcode: 'DZX-bptvaF3', type: 'reel', title: 'Instagram – Reel 2' },
    ],
  },

  facebook: {
    url: 'https://www.facebook.com/profile.php?id=61581879043292',
  },

  tiktok: {
    consulting: {
      handle: '@skyfareconsulting',
      url: 'https://www.tiktok.com/@skyfareconsulting',
    },
    vlogs: {
      handle: '@skyfarevlogs',
      url: 'https://www.tiktok.com/@skyfarevlogs',
    },
    videos: [
      { id: '7652639393630457095', title: 'AAdvantage miles JFK to London Heathrow' },
      { id: '7652317260563975444', title: 'Singapore Airlines Business Class Suite' },
    ],
  },
};

// Populate social section elements in index.html using IDs
document.addEventListener('DOMContentLoaded', function () {
  var L = window.SKYFARE_LINKS;

  // ── TikTok ──────────────────────────────────────────────────────────
  var ttHandle = document.getElementById('tiktok-handle');
  var ttLink   = document.getElementById('tiktok-follow-link');
  if (ttHandle) ttHandle.textContent = L.tiktok.vlogs.handle;
  if (ttLink)   ttLink.href          = L.tiktok.vlogs.url;

  L.tiktok.videos.forEach(function (video, i) {
    var n      = i + 1;
    var card   = document.getElementById('tiktok-card-' + n);
    var iframe = document.getElementById('tiktok-iframe-' + n);
    if (card)   card.dataset.videoId = video.id;
    if (iframe) {
      iframe.src   = 'https://www.tiktok.com/embed/v2/' + video.id + '?autoplay=0&loop=1';
      iframe.title = video.title;
    }
  });

  // ── Instagram ─────────────────────────────────────────────────────────
  // Thumbnail card approach — iframe loads only on click (user gesture),
  // which lets the video autoplay inside the modal and dismisses the
  // "View More on Instagram" overlay naturally.
  var igHandle = document.getElementById('instagram-handle');
  var igLink   = document.getElementById('instagram-follow-link');
  if (igHandle) igHandle.textContent = L.instagram.handle;
  if (igLink)   igLink.href          = L.instagram.url;

  L.instagram.videos.forEach(function (post, i) {
    var container = document.getElementById('instagram-embed-' + (i + 1));
    if (!container) return;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.instagram.com/reel/' + post.shortcode + '/embed/captioned/';
    iframe.title = post.title || 'Instagram Reel';
    iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('loading', 'lazy');
    iframe.style.cssText = 'width:100%;height:739px;border:none;display:block;';
    container.appendChild(iframe);
  });

  // ── TikTok: reset to thumbnail when card leaves viewport ─────────────
  var ttResetObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var card = entry.target;
      if (entry.isIntersecting) {
        card.dataset.seen = '1';
      } else if (card.dataset.seen === '1') {
        var iframe = card.querySelector('iframe');
        if (iframe && iframe.src && iframe.src !== 'about:blank') {
          var src = iframe.src;
          iframe.src = 'about:blank';
          setTimeout(function () { iframe.src = src; }, 60);
        }
      }
    });
  }, { threshold: 0.25 });

  [document.getElementById('tiktok-card-1'), document.getElementById('tiktok-card-2')]
    .forEach(function (card) { if (card) ttResetObserver.observe(card); });

  // ── TikTok: replay from start when video ends (postMessage API) ──────
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    var data;
    try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (_) { return; }
    if (!data || data.type !== 'onStateChange' || data.value !== 'ended') return;
    var iframes = document.querySelectorAll('.tiktok-card iframe');
    for (var j = 0; j < iframes.length; j++) {
      if (iframes[j].contentWindow === e.source) {
        var src = iframes[j].src;
        iframes[j].src = 'about:blank';
        (function (iframe, s) {
          setTimeout(function () { iframe.src = s; }, 80);
        })(iframes[j], src);
        break;
      }
    }
  });

  // ── Founder section social icons (index.html only) ────────────────────
  var founderIg = document.getElementById('founder-instagram-link');
  var founderFb = document.getElementById('founder-facebook-link');
  var founderTt = document.getElementById('founder-tiktok-link');
  var founderWa = document.getElementById('founder-whatsapp-link');
  if (founderIg) founderIg.href = L.instagram.url;
  if (founderFb) founderFb.href = L.facebook.url;
  if (founderTt) founderTt.href = L.tiktok.consulting.url;
  if (founderWa) founderWa.href = L.whatsapp;

  // ── Hero section social icons (index.html only) ────────────────────────
  var heroIg = document.getElementById('hero-instagram-link');
  var heroFb = document.getElementById('hero-facebook-link');
  var heroTt = document.getElementById('hero-tiktok-link');
  var heroWa = document.getElementById('hero-whatsapp-link');
  if (heroIg) heroIg.href = L.instagram.url;
  if (heroFb) heroFb.href = L.facebook.url;
  if (heroTt) heroTt.href = L.tiktok.consulting.url;
  if (heroWa) heroWa.href = L.whatsapp;
});
