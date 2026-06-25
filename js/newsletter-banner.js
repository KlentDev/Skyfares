/**
 * Skyfare Altitude — Newsletter Announcement Banner
 *
 * Slides down from beneath the header when a new newsletter is published.
 * Tries the Worker endpoint first; falls back to hardcoded Issue 01 data
 * so the banner works even before the Worker is deployed.
 *
 * Free posts  → blue badge, "Read Issue X" CTA → Beehiiv post.
 * Premium posts → amber badge, "Get Premium Access" CTA → WhatsApp.
 *
 * localStorage tracks dismissed/read state per post ID so the banner
 * never resurfaces for the same issue but always reappears for a new one.
 *
 * Auto-injected by header.js — no per-page setup needed.
 */
(function () {
  var WORKER_URL     = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var STORE_PREFIX   = 'skyfare_banner_v1_';
  var PREMIUM_WA_URL = 'https://api.whatsapp.com/send?phone=6581575306&text=' +
    encodeURIComponent("Hi Skyfare, I'd like to upgrade to Altitude Premium.");

  // Static fallback — used when Worker is unreachable (e.g. not yet deployed)
  var FALLBACK_POST = {
    id:           'post_e8512d1b-d2a9-45f9-bec9-db9e794022a5',
    title:        'Emirates Business Class — Dubai to Athens',
    subtitle:     'Boeing 777-300ER · Seat 9J · 29 May 2025 · 4.5 hrs',
    url:          'https://skyfarealtitude.beehiiv.com/p/emirates-business-class-dubai-to-athens',
    published_at: '2026-06-24T07:27:38Z',
    content_tags: ['issue-01', 'cabin-review', 'emirates', 'business-class'],
  };

  // ─── localStorage helpers ─────────────────────────────────────────────────

  function hasSeen(id) {
    try { return !!localStorage.getItem(STORE_PREFIX + id); } catch (e) { return false; }
  }
  function markSeen(id) {
    try { localStorage.setItem(STORE_PREFIX + id, '1'); } catch (e) {}
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    if (typeof fetch === 'undefined') { tryFallback(); return; }

    fetch(WORKER_URL + '/newsletter/posts')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var post = data && data.posts && data.posts[0];
        if (post && post.id && !hasSeen(post.id)) {
          showBanner(post);
        } else if (!post) {
          tryFallback();
        }
      })
      .catch(tryFallback);
  }

  function tryFallback() {
    if (!hasSeen(FALLBACK_POST.id)) showBanner(FALLBACK_POST);
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
      var bannerH = banner.offsetHeight;
      pushContentDown(bannerH);
      banner.style.transform = 'translateY(0)';
    });

    document.getElementById('nb-close').addEventListener('click', function () {
      markSeen(post.id);
      hideBanner(banner);
    });

    var cta = document.getElementById('nb-cta');
    if (cta) {
      cta.addEventListener('click', function () {
        markSeen(post.id);
        hideBanner(banner);
      });
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
      'background:#071829;',
      'border-bottom:1px solid rgba(255,255,255,0.07);',
      'transform:translateY(-100%);',
      'transition:transform 0.35s cubic-bezier(.22,.68,0,1.2);',
    ].join('');

    var metaSuffix = date ? ' &middot; ' + e(date) : '';

    // ─── Badge — amber for premium, blue for free ─────────────────────────
    var badgeStyle = prem
      ? 'background:rgba(217,119,6,0.2);border:1px solid rgba(217,119,6,0.4);color:#fcd34d;'
      : 'background:rgba(37,99,235,.2);border:1px solid rgba(37,99,235,.35);color:#93c5fd;';
    var badgeIcon  = prem ? 'fa-crown' : 'fa-newspaper';
    var badgeText  = prem ? 'Altitude Exclusive' : 'Issue&nbsp;' + e(issueNum);

    // ─── "Already a member?" note — premium only ──────────────────────────
    var memberNote = prem
      ? '<span style="color:rgba(255,255,255,.35);font-size:11px;white-space:nowrap;flex-shrink:0;">' +
          '&nbsp;&middot;&nbsp;Already a member? Check your email.' +
        '</span>'
      : '';

    // ─── CTA — amber WhatsApp link for premium, on-site detail page for free ───
    // Path is relative: pages/ prefix for root-level pages, none for /pages/ pages
    var detailBase = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    var ctaHref  = prem ? PREMIUM_WA_URL : (detailBase + 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug || ''));
    var ctaText  = prem ? 'Get Premium Access' : 'Read Issue&nbsp;' + e(issueNum);
    var ctaBg    = prem ? '#d97706' : '#1d4ed8';
    var ctaHover = prem ? '#b45309'  : '#1e40af';

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
          '<strong style="color:#fff;font-weight:700;">' + e(post.title) + '</strong>' +
          '<span style="color:rgba(255,255,255,.45);">' + metaSuffix + ' &mdash; just published.</span>' +
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
                          'background:rgba(255,255,255,.07);color:rgba(255,255,255,.45);' +
                          'font-size:13px;transition:background .15s,color .15s;"' +
                  ' onmouseover="this.style.background=\'rgba(255,255,255,.14)\';this.style.color=\'#fff\'"' +
                  ' onmouseout="this.style.background=\'rgba(255,255,255,.07)\';this.style.color=\'rgba(255,255,255,.45)\'">' +
            '<i class="fa-solid fa-xmark"></i>' +
          '</button>' +

        '</div>' +

      '</div>';

    return el;
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  function pushContentDown(bannerH) {
    var hero = document.querySelector('.hero-brand-fade');
    if (hero) {
      hero.style.paddingTop = (parseFloat(hero.style.paddingTop) || 0) + bannerH + 'px';
    } else {
      document.body.style.paddingTop = (parseFloat(document.body.style.paddingTop) || 0) + bannerH + 'px';
    }
    document.body.dataset.bannerH = bannerH;
  }

  function pullContentBack(bannerH) {
    var stored = parseFloat(document.body.dataset.bannerH) || bannerH;
    var hero   = document.querySelector('.hero-brand-fade');
    if (hero) {
      hero.style.paddingTop = Math.max(0, (parseFloat(hero.style.paddingTop) || 0) - stored) + 'px';
    } else {
      document.body.style.paddingTop = Math.max(0, (parseFloat(document.body.style.paddingTop) || 0) - stored) + 'px';
    }
    delete document.body.dataset.bannerH;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function isPremium(post) {
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] === 'altitude-premium') return true;
    }
    return false;
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
