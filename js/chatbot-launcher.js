/**
 * Skyfare Concierge — site-wide chat launcher + guided-menu drawer.
 *
 * Tier 1 of the chatbot rollout: a button-driven guided menu (no free text,
 * no AI, no backend calls) that routes visitors to real pages or WhatsApp.
 * Later tiers (free-text AI, member lookups) extend this same drawer shell
 * rather than replacing it — see docs/superpowers/specs for the phased plan.
 *
 * Follows the same singleton-injection idiom as js/footer.js / js/ui.js:
 * guarded against double-init, builds its markup as one template string,
 * and is injected on DOMContentLoaded. Loaded via <script defer> on every
 * public page, placed BEFORE footer.js's own tag -- footer.js does a
 * one-time sweep on DOMContentLoaded that appends a prefilled ?text= to any
 * WhatsApp link already in the DOM (see footer.js's WhatsApp pre-fill
 * section), so every WhatsApp link this file renders must exist before
 * that sweep runs.
 */
(function () {
  if (window.__skyChatInit) return;
  window.__skyChatInit = true;

  // Kill switch — not ready for production yet. Flip to true to launch;
  // every page already includes <script src="js/chatbot-launcher.js">, so
  // this is the single place that controls whether it's live, rather than
  // pulling the script tag from every page individually.
  var CHATBOT_ENABLED = false;
  if (!CHATBOT_ENABLED) return;

  document.addEventListener('DOMContentLoaded', function () {
    var prefix = window.location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    var WA_PHONE = 'https://api.whatsapp.com/send?phone=6581575306';
    var WA_DEFAULT = (window.SKYFARE_LINKS && window.SKYFARE_LINKS.whatsapp) || WA_PHONE;

    var html =
      '<button type="button" id="chat-launcher-btn" class="chat-launcher-btn" ' +
        'aria-haspopup="dialog" aria-expanded="false" aria-controls="chat-drawer" ' +
        'aria-label="Chat with Skyfare Concierge">' +
        '<span class="chat-launcher-btn__face" aria-hidden="true">' +
          '<span class="chat-launcher-btn__eye"></span>' +
          '<span class="chat-launcher-btn__eye"></span>' +
        '</span>' +
        '<span class="chat-launcher-btn__face chat-launcher-btn__face--happy" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M3 14c3-7 15-7 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>' +
          '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M3 14c3-7 15-7 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>' +
        '</span>' +
        '<i class="fa-solid fa-xmark chat-launcher-btn__icon-close" aria-hidden="true"></i>' +
      '</button>' +

      '<div id="chat-drawer-overlay" class="chat-drawer-overlay" aria-hidden="true">' +
        '<div class="chat-drawer-scrim" data-chat-close></div>' +
        '<div id="chat-drawer" class="chat-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="chat-drawer-title">' +
          '<header class="chat-drawer__header">' +
            '<div class="chat-drawer__identity">' +
              '<span class="chat-drawer__avatar" aria-hidden="true">' +
                '<span class="chat-drawer__avatar-eye"></span>' +
                '<span class="chat-drawer__avatar-eye"></span>' +
              '</span>' +
              '<div>' +
                '<h2 id="chat-drawer-title">Skyfare Concierge</h2>' +
                '<p class="chat-drawer__status"><span class="chat-drawer__status-dot"></span>Guided answers, no waiting</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="chat-drawer__close" data-chat-close aria-label="Close chat">' +
              '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
            '</button>' +
          '</header>' +
          '<div class="chat-drawer__body" id="chat-drawer-body">' +

            '<section class="chat-step is-active" data-step="opening">' +
              '<div class="chat-bubble chat-bubble--bot">Hi, I’m the Skyfare Concierge. What are you looking for today?</div>' +
              '<div class="chat-quick-replies">' +
                '<button type="button" class="chat-quick-reply" data-goto="altitude">Altitude Membership</button>' +
                '<button type="button" class="chat-quick-reply" data-goto="krisflyer">KrisFlyer Guide</button>' +
                '<button type="button" class="chat-quick-reply" data-goto="routes">Routes &amp; Cabin Compare</button>' +
                '<button type="button" class="chat-quick-reply" data-goto="strategy-call">Book a Strategy Call</button>' +
                '<button type="button" class="chat-quick-reply" data-goto="something-else">Something else</button>' +
              '</div>' +
            '</section>' +

            '<section class="chat-step" data-step="altitude">' +
              '<div class="chat-bubble chat-bubble--user">Altitude Membership</div>' +
              '<div class="chat-bubble chat-bubble--bot">Altitude unlocks full route intelligence, award-alert monitoring, and our premium newsletter archive. It’s $4.99/month, or $39.99/year (vs. $55 billed monthly) if you’re ready to commit.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-primary" href="' + prefix + 'pages/altitude#pricing">Ready to join</a>' +
                '<button type="button" class="chat-quick-reply" data-goto="altitude-wa">Not yet</button>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

            '<section class="chat-step" data-step="altitude-wa">' +
              '<div class="chat-bubble chat-bubble--user">Not yet</div>' +
              '<div class="chat-bubble chat-bubble--bot">No problem at all — message us on WhatsApp any time and we’ll help you decide, no pressure.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-whatsapp" href="' + WA_PHONE + '" data-wa-message="Hi Skyfare, I’d like to learn more about Altitude Membership before joining."><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Continue on WhatsApp</a>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

            '<section class="chat-step" data-step="krisflyer">' +
              '<div class="chat-bubble chat-bubble--user">KrisFlyer Guide</div>' +
              '<div class="chat-bubble chat-bubble--bot">The KrisFlyer Guide walks you through nominee redemptions and transfer timing step by step. It’s launching soon — for now, our team can walk you through it directly.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-whatsapp" href="' + WA_PHONE + '" data-wa-message="Hi Skyfare, I’m interested in the KrisFlyer Guide."><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Continue on WhatsApp</a>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

            '<section class="chat-step" data-step="routes">' +
              '<div class="chat-bubble chat-bubble--user">Routes &amp; Cabin Compare</div>' +
              '<div class="chat-bubble chat-bubble--bot">Compare cabins and explore our curated route library here.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-primary" href="' + prefix + 'pages/cabin-compare">Open Cabin Compare</a>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

            '<section class="chat-step" data-step="strategy-call">' +
              '<div class="chat-bubble chat-bubble--user">Book a Strategy Call</div>' +
              '<div class="chat-bubble chat-bubble--bot">A 1-on-1, $99 planning session with a Skyfare consultant — book a time that works for you.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-primary" href="' + prefix + 'pages/assessment">Book the $99 Call</a>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

            '<section class="chat-step" data-step="something-else">' +
              '<div class="chat-bubble chat-bubble--user">Something else</div>' +
              '<div class="chat-bubble chat-bubble--bot">Of course — tell us what’s on your mind on WhatsApp and we’ll take it from there.</div>' +
              '<div class="chat-quick-replies">' +
                '<a class="btn-pill btn-pill-whatsapp" href="' + WA_DEFAULT + '"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Continue on WhatsApp</a>' +
              '</div>' +
              '<button type="button" class="chat-step__restart" data-goto="opening">&larr; Start over</button>' +
            '</section>' +

          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);

    var launcher = document.getElementById('chat-launcher-btn');
    var overlay = document.getElementById('chat-drawer-overlay');
    var drawer = document.getElementById('chat-drawer');
    var body = document.getElementById('chat-drawer-body');
    var FOCUSABLE_SEL = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function revealStep(id) {
      var target = body.querySelector('.chat-step[data-step="' + id + '"]');
      if (!target) return;
      if (id === 'opening') {
        body.querySelectorAll('.chat-step').forEach(function (s) {
          s.classList.toggle('is-active', s === target);
        });
        body.scrollTop = 0;
      } else {
        target.classList.add('is-active');
        requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
      }
    }

    body.addEventListener('click', function (e) {
      var goto = e.target.closest('[data-goto]');
      if (goto) { e.preventDefault(); revealStep(goto.getAttribute('data-goto')); }
    });

    function onKeydown(e) {
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key === 'Tab') {
        var focusables = drawer.querySelectorAll(FOCUSABLE_SEL);
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }

    function openDrawer() {
      lastFocused = document.activeElement;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('chat-drawer-overlay--in');
      launcher.setAttribute('aria-expanded', 'true');
      launcher.classList.add('chat-launcher-btn--open');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown);
      var focusable = drawer.querySelector(FOCUSABLE_SEL);
      if (focusable) focusable.focus();
    }

    function closeDrawer() {
      overlay.classList.remove('chat-drawer-overlay--in');
      launcher.setAttribute('aria-expanded', 'false');
      launcher.classList.remove('chat-launcher-btn--open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      setTimeout(function () { overlay.setAttribute('aria-hidden', 'true'); }, 220);
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      else launcher.focus();
    }

    launcher.addEventListener('click', function () {
      if (overlay.classList.contains('chat-drawer-overlay--in')) closeDrawer();
      else openDrawer();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-chat-close]')) closeDrawer();
    });
  });
})();
