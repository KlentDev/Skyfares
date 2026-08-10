(function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt'; // shared with js/altitude.js / js/krisflyer-guide.js -- one login covers both products
  var _altMemberEmail = '';

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var token = getToken();
    var magic = new URLSearchParams(location.search).get('magic');
    if (token) {
      // JWT first — skip magic verification if already logged in.
      // Pass magic as fallback so if the JWT is expired we still try the link.
      verifyAndRender(token, magic);
    } else if (magic) {
      handleMagicCallback(magic);
    } else {
      redirectToPublic();
    }
  }

  // No JWT and no magic token at all -- this page has nothing to show an
  // anonymous visitor (unlike the old hybrid altitude.html, there's no public
  // shell here anymore), so bounce straight back to the marketing page.
  function redirectToPublic(reason) {
    window.location.replace('../altitude.html' + (reason ? '?loginError=' + encodeURIComponent(reason) : ''));
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function setToken(t) {
    try { localStorage.setItem(JWT_KEY, t); } catch (_) {}
  }

  function clearToken() {
    try { localStorage.removeItem(JWT_KEY); } catch (_) {}
  }

  function verifyAndRender(token, fallbackMagic) {
    fetch(WORKER + '/altitude/verify?target=altitude', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.granted) {
          if (fallbackMagic) history.replaceState(null, '', location.pathname);
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.markVerified('altitude');
          populateMemberView(res.data.email, res.data.member);
          loadPremiumPosts(token);
        } else {
          // Drop any cached "altitude verified" flag on a real denial -- it's
          // demonstrably stale now, and leaving it would keep letting the
          // header's locked-nav click skip the verify-access modal and land
          // straight back here on every future click for the rest of its 24h
          // window (the exact bug this fixed for the Guide side).
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.invalidate('altitude');
          var authFailed = res.data.reason === 'not_authenticated' || res.data.reason === 'session_expired';
          if (authFailed) clearToken();
          if (authFailed && fallbackMagic) {
            handleMagicCallback(fallbackMagic);
          } else {
            redirectToPublic(res.data.reason || (res.data.status === 'cancelled' ? 'cancelled' : 'expired'));
          }
        }
      })
      .catch(function () {
        clearToken();
        if (fallbackMagic) {
          handleMagicCallback(fallbackMagic);
        } else {
          redirectToPublic('network');
        }
      });
  }

  function handleMagicCallback(magic) {
    fetch(WORKER + '/altitude/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magic }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        history.replaceState(null, '', location.pathname);
        if (res.ok && res.data.token) {
          setToken(res.data.token);
          if (window.SkyUI) SkyUI.toast('Welcome back. Access granted.', { type: 'success' });
          // Re-verify against /altitude/verify instead of rendering with
          // member:null -- only /altitude/verify returns the real member
          // record. No magic fallback here -- the token that got us this far
          // is already consumed/single-use.
          verifyAndRender(res.data.token, null);
        } else {
          redirectToPublic('invalid');
        }
      })
      .catch(function () {
        redirectToPublic('network');
      });
  }

  // ─── Member view population ──────────────────────────────────────────────

  function populateMemberView(email, member) {
    _altMemberEmail = email || '';
    var emailEl = document.getElementById('alt-member-email');
    if (emailEl) emailEl.textContent = email;
    window.__altSignOut = function () { clearToken(); window.location.href = '../altitude.html'; };
    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
    _wireFilters();
    window.handleManageMembership = handleManageMembership;
    window.handleUpgradeToAnnual = handleUpgradeToAnnual;

    _populateMembershipCard(member);
    updatePrivateChrome(email, member);
    // js/altitude-portal-extras.js listens for this to render the
    // Membership Plans section (replaces the old #alt-upgrade-section
    // state-toggling block that used to live here) -- kept out of this
    // auth-critical file.
    window.dispatchEvent(new CustomEvent('skyfare:altitude-member', { detail: member }));

    // Show welcome message after a successful payment redirect
    try {
      if (sessionStorage.getItem('altitude_welcome')) {
        sessionStorage.removeItem('altitude_welcome');
        setTimeout(function () {
          if (window.SkyUI) {
            SkyUI.toast(
              'Welcome to Altitude! Your access is now active. Check your email for a welcome message with everything you need to know.',
              { type: 'success', duration: 9000 }
            );
          }
        }, 600);
      }
    } catch (_) {}
  }

  // ─── Membership summary card ─────────────────────────────────────────────

  function _daysRemaining(iso) {
    if (!iso) return null;
    var end = new Date(iso).getTime();
    if (isNaN(end)) return null;
    var days = Math.ceil((end - Date.now()) / 86400000);
    return days > 0 ? days : 0;
  }

  var PLAN_LABELS = { monthly: 'Altitude Monthly', annual: 'Altitude Annual', guide_bundle: 'KrisFlyer Guide Bundle' };

  function _formatRenewalDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _populateMembershipCard(member) {
    var planEl = document.getElementById('alt-membership-plan');
    var daysEl = document.getElementById('alt-membership-days');
    if (!planEl || !daysEl) return;
    if (!member) return; // stays on placeholder text until the next full /altitude/verify

    planEl.textContent = PLAN_LABELS[member.plan] || 'Altitude';
    var days = _daysRemaining(member.current_period_end);
    var renewDate = _formatRenewalDate(member.current_period_end);
    if (days == null) {
      daysEl.textContent = 'Renewal date unavailable';
    } else if (days === 0) {
      daysEl.textContent = 'Renews today';
    } else {
      daysEl.textContent = days + ' day' + (days === 1 ? '' : 's') + ' remaining'
        + (renewDate ? ' · Renews ' + renewDate : '');
    }

    var renewNote = document.getElementById('alt-membership-renew-note');
    if (renewNote) {
      var isBilled = member.plan === 'monthly' || member.plan === 'annual';
      renewNote.classList.toggle('hidden', !isBilled);
    }
  }

  // ─── Manage Membership (Stripe Billing Portal) ──────────────────────────────

  function handleManageMembership() {
    var token = getToken();
    if (!token) return;

    var btn = document.getElementById('alt-manage-btn');
    var originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Opening'; }

    fetch(WORKER + '/altitude/portal', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.url) {
          window.location.href = res.data.url;
        } else {
          if (window.SkyUI) SkyUI.toast(res.data.error || 'Could not open billing portal.', { type: 'error' });
          if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
      });
  }

  // ─── Upgrade to Annual ───────────────────────────────────────────────────────

  function handleUpgradeToAnnual() {
    var token = getToken();
    if (!token) return;

    var btn = document.getElementById('alt-upgrade-btn');
    var originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Upgrading…'; }

    fetch(WORKER + '/altitude/upgrade', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.success) {
          if (window.SkyUI) SkyUI.toast('Your upgrade to Annual is scheduled — it’ll take effect when your current Monthly period ends.', { type: 'success', duration: 7000 });
          verifyAndRender(token, null); // re-fetch so the card shows the "takes effect" state
        } else {
          if (window.SkyUI) SkyUI.toast(res.data.error || 'Could not upgrade your plan. Please try again.', { type: 'error' });
          if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
      });
  }

  // ─── Member archive ──────────────────────────────────────────────────────

  function loadPremiumPosts(token) {
    fetch(WORKER + '/newsletter/posts', {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.posts) {
          renderArchiveGrid([]);
          return;
        }
        renderArchiveGrid(data.posts);
      })
      .catch(function () { renderArchiveGrid([]); });
  }

  var _altAllPosts = [];

  function renderArchiveGrid(posts) {
    _altAllPosts = posts;
    _applyFilter('all');
  }

  function _renderCard(post, i) {
    var prem     = !!post.is_premium;
    var issueNum = getIssueNum(post);
    var date     = formatDate(post.published_at);
    var type     = (post.content_tags || []).filter(function (t) { return t !== 'altitude-premium'; })[0] || 'Newsletter';
    var delay    = (i * 0.05) + 's';
    var href     = getBeehiivPostUrl(post, prem);
    var localHref = getLocalPostUrl(post);
    var handoffAttrs = post.url
      ? ' data-beehiiv-handoff="true" data-premium="' + (prem ? 'true' : 'false') + '" data-local-url="' + e(localHref) + '" data-beehiiv-url="' + e(withBeehiivLoginModal(post.url)) + '"'
      : '';

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '">'
      : '<div class="w-full h-full flex items-center justify-center"><span class="text-[11px] font-bold uppercase tracking-widest text-white/45">No Thumbnail</span></div>';

    var badge = prem
      ? '<span class="private-badge private-badge--gold"><i class="fa-solid fa-crown" aria-hidden="true"></i> Altitude</span>'
      : '';

    return '<article class="private-resource-card reveal-stagger" style="animation-delay:' + delay + '">' +
      '<a href="' + e(href) + '"' + handoffAttrs + ' class="private-resource-card__media" aria-label="Read ' + e(post.title) + '">' +
          imgHtml +
          '<div class="private-resource-card__badge-row">' +
            (issueNum ? '<span class="private-badge">Issue ' + e(issueNum) + '</span>' : '') +
            (badge || '<span class="private-badge private-badge--muted">' + e(type) + '</span>') +
          '</div>' +
      '</a>' +
      '<div class="private-resource-card__body">' +
        '<p class="private-resource-card__meta">' + e(date || type) + '</p>' +
        '<h3>' + e(post.title) + '</h3>' +
        '<a href="' + e(href) + '"' + handoffAttrs + ' class="private-resource-card__link">Read issue <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
      '</div>' +
    '</article>';
  }

  function _applyFilter(type) {
    var posts = _altAllPosts;
    if (type === 'free') {
      posts = _altAllPosts.filter(function (p) { return !p.is_premium; });
    } else if (type === 'premium') {
      posts = _altAllPosts.filter(function (p) { return !!p.is_premium; });
    }

    var count = document.getElementById('alt-post-count');
    if (count) count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');

    var grid = document.getElementById('alt-archive-grid');
    if (!grid) return;

    if (!posts.length) {
      var label = type === 'free' ? 'free ' : type === 'premium' ? 'premium ' : '';
      grid.innerHTML = '<div class="private-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><p>No ' + label + 'issues published yet.</p></div>';
    } else {
      grid.innerHTML = posts.map(_renderCard).join('');
    }

    document.querySelectorAll('.alt-filter-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === type);
    });
  }

  function _wireFilters() {
    document.querySelectorAll('.alt-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { _applyFilter(btn.dataset.filter); });
    });
    _wireBeehiivHandoff();
  }

  function _wireBeehiivHandoff() {
    var grid = document.getElementById('alt-archive-grid');
    if (!grid || grid.dataset.beehiivHandoffWired === 'true') return;
    grid.dataset.beehiivHandoffWired = 'true';
    grid.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[data-beehiiv-handoff="true"]');
      if (!link || !grid.contains(link)) return;
      event.preventDefault();
      openBeehiivHandoffModal(
        link.getAttribute('data-beehiiv-url') || link.href,
        link.getAttribute('data-local-url') || '',
        link.getAttribute('data-premium') === 'true'
      );
    });
  }

  function openBeehiivHandoffModal(beehiivUrl, localUrl, isPremium) {
    if (!beehiivUrl) return;
    if (!window.SkyUI || !window.SkyUI.modal) {
      window.location.href = beehiivUrl;
      return;
    }

    var emailLine = _altMemberEmail
      ? '<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">' +
          '<p class="text-[10px] font-bold uppercase tracking-widest text-amber-700">Use this email</p>' +
          '<p class="mt-1 text-sm font-bold text-neutral-900 break-all">' + e(_altMemberEmail) + '</p>' +
        '</div>'
      : '';

    var actions = [{
      label: 'Read on Skyfare',
      onClick: function () {
        if (localUrl) window.location.href = localUrl;
      },
    }, {
      label: 'Read on Beehiiv',
      style: 'primary',
      onClick: function () {
        window.location.href = beehiivUrl;
      },
    }];

    var skyfareCopy = isPremium
      ? '<p><strong>Read on Skyfare</strong> opens the premium issue here. It is the fastest way to read.</p>'
      : '<p><strong>Read on Skyfare</strong> opens the free issue here. It is the fastest way to read.</p>';
    var note = isPremium
      ? '<p class="mt-3 text-xs text-neutral-400">Beehiiv manages its own login session, so it may ask for this email again even after you are signed into the Skyfare portal.</p>'
      : '<p class="mt-3 text-xs text-neutral-400">Beehiiv may ask you to verify your email before likes and comments are available.</p>';

    SkyUI.modal({
      title: 'Choose where to read',
      html:
        skyfareCopy +
        '<p class="mt-3"><strong>Read on Beehiiv</strong> opens the published newsletter on Beehiiv so you can use native <strong>likes and comments</strong>.</p>' +
        '<ol class="mt-3 list-decimal pl-5 text-sm text-neutral-500 leading-relaxed">' +
          '<li>Verify your email on Beehiiv if asked.</li>' +
          '<li>Beehiiv sends a one-time code.</li>' +
          '<li>Enter the code to verify your email.</li>' +
          '<li>Then read, <strong>like</strong>, and <strong>comment</strong> on the newsletter.</li>' +
        '</ol>' +
        (isPremium ? emailLine : '') +
        note,
      actions: actions,
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function getIssueNum(post) {
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      var m = String(tags[i]).toLowerCase().match(/issue[-_]?(\d+)/);
      if (m) return m[1].padStart(2, '0');
    }
    return '';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (_) { return ''; }
  }

  function getBeehiivPostUrl(post, requireLogin) {
    if (post && post.url) return requireLogin ? withBeehiivLoginModal(post.url) : post.url;
    return getLocalPostUrl(post);
  }

  function withBeehiivLoginModal(url) {
    if (!url) return '';
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'modal=login';
  }

  function getLocalPostUrl(post) {
    return '../newsletter-detail?slug=' + encodeURIComponent(post && post.slug ? post.slug : '');
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  function updatePrivateChrome(email, member) {
    var plan = member && member.plan ? (PLAN_LABELS[member.plan] || 'Altitude') : 'Altitude';
    var detail = { email: email || '', product: 'Altitude', plan: plan };
    if (window.SkyfarePrivate) window.SkyfarePrivate.setUser(detail);
    window.dispatchEvent(new CustomEvent('skyfare:private-user', { detail: detail }));
  }
})();
