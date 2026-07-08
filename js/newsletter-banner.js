/**
 * Skyfare Altitude — Newsletter Announcement Banner
 *
 * Slides down from beneath the header when a new newsletter is published.
 * Fetches the latest post live from the Worker; shows nothing if that
 * fetch fails (no hardcoded fallback content — never show stale/deleted posts).
 *
 * Free posts  → blue badge, "Read Issue X" CTA → Beehiiv post.
 * Premium posts → amber badge, "Join the Waitlist" CTA → pre-launch sign-up page (Altitude isn't purchasable yet).
 *
 * localStorage tracks dismissed/read state per post ID so the banner
 * never resurfaces for the same issue but always reappears for a new one.
 *
 * Auto-injected by header.js — no per-page setup needed.
 */
(function () {
  var WORKER_URL     = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var STORE_PREFIX   = 'skyfare_banner_v1_';
  var SESSION_KEY    = 'skyfare_banner_dismissed_session';

  // DISABLED (temporarily) -- Altitude Premium isn't purchasable yet (confirmed
  // by Sahej, 2026-07-03). PREMIUM_WA_URL is kept commented, not deleted, so the
  // WhatsApp upgrade path can be restored below once Premium launches.
  // var PREMIUM_WA_URL = 'https://api.whatsapp.com/send?phone=6581575306&text=' +
  //   encodeURIComponent("Hi Skyfare, I'd like to upgrade to Altitude Premium.");

  // No hardcoded fallback post: the Worker is live, so if /newsletter/posts
  // fails or is unreachable (CORS, network blip, Beehiiv hiccup) the correct
  // behavior is to show nothing, not resurface old/possibly-deleted content
  // that no longer matches what's actually published on Beehiiv.

  // Set the instant the user clicks any same-tab, same-page link. Fetch to
  // the Worker is async, so without this a banner can start sliding in for a
  // split second right as the browser is mid-navigation to the next page --
  // a jarring flash that isn't really "part of" the page the user landed on.
  var leaving = false;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    leaving = true;
  }, true);

  // ─── localStorage helpers ─────────────────────────────────────────────────
  // Permanent dismissal only — set exclusively when the user explicitly closes
  // the banner (X) or opens/reads the newsletter (CTA click). Nothing else may
  // hide it: it's expected to reappear on every page until one of those two
  // actions happens, even across separate page loads/navigations.

  function hasSeen(key) {
    try { return !!localStorage.getItem(STORE_PREFIX + key); } catch (e) { return false; }
  }
  function markSeen(key) {
    try { localStorage.setItem(STORE_PREFIX + key, '1'); } catch (e) {}
  }

  // Keyed by id + free/premium status, not just id, so the banner reappears
  // when an existing post's free/premium setting changes (an "update"), not
  // just when a brand-new post is published (a "new entry") -- editing a
  // post never changes its id, so id alone would keep it dismissed forever.
  function postStateKey(post) {
    return post.id + ':' + (post.is_premium ? 'premium' : 'free');
  }

  // Session-level suppression: once the user has closed or engaged with a
  // banner on ANY page, don't show a banner again for the rest of that
  // browsing session (tab), even if Beehiiv publishes a new post in the
  // meantime — this is what stops "I already closed it" from reappearing
  // while navigating the site.
  function dismissedThisSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  function markDismissedThisSession() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    if (dismissedThisSession()) return;
    if (typeof fetch === 'undefined') return;

    fetch(WORKER_URL + '/newsletter/posts')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (leaving) return;
        var post = data && data.posts && data.posts[0];
        if (post && post.id && !hasSeen(postStateKey(post))) {
          showBanner(post);
        }
      })
      .catch(function () {});
  }

  // ─── Show / hide ──────────────────────────────────────────────────────────

  function showBanner(post) {
    var issueNum = getIssueNum(post);
    var date     = formatDate(post.published_at);
    var header   = document.getElementById('main-header');
    var headerH  = header ? header.offsetHeight : 64;

    var banner = buildBanner(post, issueNum, date, headerH);
    document.body.insertBefore(banner, document.body.firstChild);

    requestAnimationFrame(function () {
      // Re-check here, not just in boot(): the user can click a link during
      // the one-frame gap between insertBefore() above and this callback,
      // and that's the last moment we can bail before the slide-down is
      // actually visible on the page they're navigating away from.
      if (leaving) {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
        return;
      }
      var bannerH = banner.offsetHeight;
      pushContentDown(bannerH);
      banner.style.transform = 'translateY(0)';
    });

    function dismiss() {
      markSeen(postStateKey(post));
      markDismissedThisSession();
      hideBanner(banner);
    }

    document.getElementById('nb-close').addEventListener('click', dismiss);

    var cta = document.getElementById('nb-cta');
    if (cta) {
      // 'click' covers left-click and keyboard activation; 'auxclick' covers
      // middle-click (mouse wheel button), which opens the link in a new tab
      // without ever firing a 'click' event in most browsers.
      cta.addEventListener('click', dismiss);
      cta.addEventListener('auxclick', dismiss);
    }
  }

  function hideBanner(banner) {
    var bannerH = banner.offsetHeight;
    banner.style.transition = 'transform 0.22s ease';
    banner.style.transform  = 'translateY(-100%)';
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      pullContentBack(bannerH);
    }, 230);
  }

  // ─── Build HTML ───────────────────────────────────────────────────────────

  function buildBanner(post, issueNum, date, headerH) {
    var prem = isPremium(post);
    var el   = document.createElement('div');
    el.id = 'skyfare-newsletter-banner';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', prem ? 'Altitude Premium newsletter announcement' : 'New newsletter announcement');

    el.style.cssText = [
      'position:fixed;',
      'top:' + headerH + 'px;',
      'left:0;right:0;',
      'z-index:49;',
      'background:#ffffff;',
      'border-bottom:1px solid rgba(15,23,42,0.08);',
      'box-shadow:0 1px 6px rgba(15,23,42,0.06);',
      'transform:translateY(-100%);',
      'transition:transform 0.35s cubic-bezier(.22,.68,0,1.2);',
    ].join('');

    var metaSuffix = date ? ' &middot; ' + e(date) : '';

    // ─── Badge — gold for premium, blue for free ──────────────────────────
    var badgeStyle = prem
      ? 'background:rgba(201,162,39,0.12);border:1px solid rgba(201,162,39,0.35);color:#9E7B0D;'
      : 'background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);color:#1d4ed8;';
    var badgeIcon  = prem ? 'fa-crown' : 'fa-newspaper';
    var badgeText  = prem ? 'Altitude Exclusive' : 'Issue&nbsp;' + e(issueNum);

    // ─── "Already a member?" note — premium only ──────────────────────────
    var memberNote = prem
      ? '<span style="color:rgba(15,23,42,.4);font-size:11px;white-space:nowrap;flex-shrink:0;">' +
          '&nbsp;&middot;&nbsp;Already a member? Check your email.' +
        '</span>'
      : '';

    // ─── CTA — gold waitlist link for premium (not purchasable yet), on-site detail page for free ───
    // Path is relative: pages/ prefix for root-level pages, none for /pages/ pages
    var detailBase = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    // DISABLED (temporarily) -- original WhatsApp upgrade link + label, restore when Premium launches:
    // var ctaHref = prem ? PREMIUM_WA_URL : (detailBase + 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug || ''));
    // var ctaText = prem ? 'Get Premium Access' : 'Read Issue&nbsp;' + e(issueNum);
    var ctaHref  = prem ? (detailBase + 'pre-signup-link.html') : (detailBase + 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug || ''));
    var ctaText  = prem ? 'Join the Waitlist' : 'Read Issue&nbsp;' + e(issueNum);
    var ctaBg    = prem ? '#C9A227' : '#1d4ed8';
    var ctaHover = prem ? '#9E7B0D'  : '#1e40af';

    el.innerHTML =
      '<div style="max-width:1280px;margin:0 auto;padding:0 20px;' +
                  'display:flex;align-items:center;gap:12px;min-height:48px;flex-wrap:wrap;">' +

        '<span style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;' +
               'padding:3px 10px;border-radius:999px;' + badgeStyle +
               'font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;white-space:nowrap;">' +
          '<i class="fa-solid ' + badgeIcon + '" style="font-size:9px;"></i>&nbsp;' + badgeText +
        '</span>' +

        '<p style="flex:1;min-width:0;margin:0;font-size:13px;line-height:1.4;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          '<strong style="color:#0f172a;font-weight:700;">' + e(post.title) + '</strong>' +
          '<span style="color:rgba(15,23,42,.5);">' + metaSuffix + ' &mdash; just published.</span>' +
        '</p>' +

        memberNote +

        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto;padding:8px 0;">' +

          '<a id="nb-cta"' +
             ' href="' + ctaHref + '"' +
             ' target="_blank" rel="noopener noreferrer"' +
             ' style="display:inline-flex;align-items:center;gap:6px;' +
                     'padding:7px 14px;border-radius:8px;' +
                     'background:' + ctaBg + ';color:#fff;' +
                     'font-size:12px;font-weight:700;' +
                     'text-decoration:none;white-space:nowrap;' +
                     'transition:background .15s;"' +
             ' onmouseover="this.style.background=\'' + ctaHover + '\'"' +
             ' onmouseout="this.style.background=\'' + ctaBg + '\'">' +
            ctaText +
            ' <i class="fa-solid fa-arrow-right" style="font-size:10px;"></i>' +
          '</a>' +

          '<button id="nb-close"' +
                  ' aria-label="Dismiss announcement"' +
                  ' style="display:inline-flex;align-items:center;justify-content:center;' +
                          'width:30px;height:30px;border-radius:7px;border:none;cursor:pointer;' +
                          'background:rgba(15,23,42,.06);color:rgba(15,23,42,.45);' +
                          'font-size:13px;transition:background .15s,color .15s;"' +
                  ' onmouseover="this.style.background=\'rgba(15,23,42,.12)\';this.style.color=\'#0f172a\'"' +
                  ' onmouseout="this.style.background=\'rgba(15,23,42,.06)\';this.style.color=\'rgba(15,23,42,.45)\'">' +
            '<i class="fa-solid fa-xmark"></i>' +
          '</button>' +

        '</div>' +

      '</div>';

    return el;
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  // Matches any dark-gradient hero section so the banner pushes it down correctly
  // regardless of which page's hero class is in use. Must stay in sync with the
  // hero selector in header.js (.hero-brand-fade for the homepage, .page-hero-bg
  // for every interior page) — a stale selector here causes the banner to pad
  // document.body instead of the hero element, breaking the transparent header's
  // contrast against the hero image.
  function findHero() {
    return document.querySelector('.hero-brand-fade, .page-hero-bg');
  }

  function pushContentDown(bannerH) {
    var hero = findHero();
    if (hero) {
      hero.style.paddingTop = (parseFloat(hero.style.paddingTop) || 0) + bannerH + 'px';
    } else {
      document.body.style.paddingTop = (parseFloat(document.body.style.paddingTop) || 0) + bannerH + 'px';
    }
    document.body.dataset.bannerH = bannerH;
  }

  function pullContentBack(bannerH) {
    var stored = parseFloat(document.body.dataset.bannerH) || bannerH;
    var hero   = findHero();
    if (hero) {
      hero.style.paddingTop = Math.max(0, (parseFloat(hero.style.paddingTop) || 0) - stored) + 'px';
    } else {
      document.body.style.paddingTop = Math.max(0, (parseFloat(document.body.style.paddingTop) || 0) - stored) + 'px';
    }
    delete document.body.dataset.bannerH;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function isPremium(post) {
    return !!post.is_premium;
  }

  function getIssueNum(post) {
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      var m = String(tags[i]).toLowerCase().match(/issue[-_]?(\d+)/);
      if (m) return m[1].padStart(2, '0');
    }
    return '01';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
