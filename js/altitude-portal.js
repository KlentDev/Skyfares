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
      verifyAndRender(token, magic);
    } else if (magic) {
      handleMagicCallback(magic, null);
    } else {
      redirectToPublic();
    }
  }

  // No JWT and no magic token at all -- this page has nothing to show an
  // anonymous visitor (unlike the old hybrid altitude.html, there's no public
  // shell here anymore), so bounce straight back to the marketing page.
  function redirectToPublic(reason) {
    window.location.replace(getPublicPagePrefix() + 'altitude.html' + (reason ? '?loginError=' + encodeURIComponent(reason) : ''));
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
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.granted) {
          renderVerifiedSession(token, res.data, !!fallbackMagic);
        } else {
          // Drop any cached "altitude verified" flag on a real denial -- it's
          // demonstrably stale now, and leaving it would keep letting the
          // header's locked-nav click skip the verify-access modal and land
          // straight back here on every future click for the rest of its 24h
          // window (the exact bug this fixed for the Guide side).
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.invalidate('altitude');
          var authFailed = res.data.reason === 'not_authenticated' || res.data.reason === 'session_expired';
          if (authFailed && !fallbackMagic) clearToken();
          if (fallbackMagic) {
            handleMagicCallback(fallbackMagic, token);
          } else {
            redirectToPublic(res.data.reason || (res.data.status === 'cancelled' ? 'cancelled' : 'expired'));
          }
        }
      })
      .catch(function () {
        if (fallbackMagic) {
          handleMagicCallback(fallbackMagic, token);
        } else {
          showPortalNetworkError();
        }
      });
  }

  function renderVerifiedSession(token, data, stripMagicUrl) {
    if (stripMagicUrl) history.replaceState(null, '', location.pathname);
    document.body.classList.add('private-auth-ready');
    if (window.SkyfareAccessCache) window.SkyfareAccessCache.markVerified('altitude');
    populateMemberView(data.email, data.member);
    if (document.getElementById('alt-latest-grid') || document.getElementById('alt-archive-grid') || document.getElementById('alt-post-count')) {
      loadPremiumPosts(token);
    }
  }

  function verifyMagicSession(newToken, previousToken) {
    fetch(WORKER + '/altitude/verify?target=altitude', {
      headers: { 'Authorization': 'Bearer ' + newToken },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.granted) {
          setToken(newToken);
          if (window.SkyUI) SkyUI.toast('Welcome back. Access granted.', { type: 'success' });
          renderVerifiedSession(newToken, res.data, true);
          return;
        }

        if (window.SkyfareAccessCache) window.SkyfareAccessCache.invalidate('altitude');
        if (previousToken) {
          verifyAndRender(previousToken, null);
        } else {
          clearToken();
          redirectToPublic(res.data.reason || (res.data.status === 'cancelled' ? 'cancelled' : 'expired'));
        }
      })
      .catch(function () {
        if (previousToken) {
          verifyAndRender(previousToken, null);
        } else {
          showPortalNetworkError();
        }
      });
  }

  function handleMagicCallback(magic, previousToken) {
    fetch(WORKER + '/altitude/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magic }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        history.replaceState(null, '', location.pathname);
        if (res.ok && res.data.token) {
          // Re-verify against /altitude/verify instead of rendering with
          // member:null -- only /altitude/verify returns the real member
          // record. Keep the JWT pending until entitlement passes so a bad
          // or stale link cannot overwrite a working shared session.
          verifyMagicSession(res.data.token, previousToken);
        } else if (previousToken) {
          verifyAndRender(previousToken, null);
        } else {
          redirectToPublic(getMagicErrorReason(res));
        }
      })
      .catch(function () {
        if (previousToken) {
          verifyAndRender(previousToken, null);
        } else {
          showPortalNetworkError();
        }
      });
  }

  function showPortalNetworkError() {
    document.body.classList.add('private-auth-ready');
    var loader = document.getElementById('page-loader');
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);

    var main = document.getElementById('main-content');
    if (!main) {
      redirectToPublic('network');
      return;
    }

    main.innerHTML =
      '<section class="altitude-member-page" aria-labelledby="alt-network-title">' +
        '<div class="private-container">' +
          '<div class="private-panel altitude-access-error">' +
            '<div class="icon-chip icon-chip-lg"><i class="fa-solid fa-wifi" aria-hidden="true"></i></div>' +
            '<div>' +
              '<h1 id="alt-network-title">We could not verify your session.</h1>' +
              '<p>The portal could not reach Skyfare access right now. Your saved login was not removed. Refresh this page once your connection or local server is stable.</p>' +
              '<div class="private-actions">' +
                '<button type="button" class="private-action private-action--primary" data-alt-network-retry><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again</button>' +
                '<a href="' + getPublicPagePrefix() + 'altitude.html" class="private-action"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Altitude</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var retry = main.querySelector('[data-alt-network-retry]');
    if (retry) retry.addEventListener('click', function () { window.location.reload(); });
  }

  function getMagicErrorReason(res) {
    if (res && res.status === 429) return 'rate_limited';
    if (res && (res.status === 404 || res.status === 410)) return 'expired';
    return 'invalid';
  }

  // ─── Member view population ──────────────────────────────────────────────

  function populateMemberView(email, member) {
    _altMemberEmail = email || '';
    var emailEl = document.getElementById('alt-member-email');
    if (emailEl) emailEl.textContent = email;
    window.__altSignOut = function () { clearToken(); window.location.href = getPublicPagePrefix() + 'altitude.html'; };
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
  var ARCHIVE_PAGE_SIZE = 8;
  var _altArchiveFilter = 'all';
  var _altArchivePage = 1;

  function _formatRenewalDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _formatCompactDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _firstMemberDate(member, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (member && member[keys[i]]) return member[keys[i]];
    }
    return '';
  }

  function _inferPeriodStart(member) {
    var direct = _firstMemberDate(member, [
      'purchased_at',
      'purchase_date',
      'started_at',
      'created_at',
      'joined_at',
      'member_since',
      'subscription_created_at',
      'access_started_at',
      'current_period_start',
      'currentPeriodStart',
    ]);
    if (direct) return direct;
    if (!member || !member.current_period_end) return '';

    var end = new Date(member.current_period_end);
    if (isNaN(end.getTime())) return '';
    if (member.plan === 'annual') {
      end.setFullYear(end.getFullYear() - 1);
    } else if (member.plan === 'guide_bundle') {
      end.setDate(end.getDate() - 90);
    } else {
      end.setMonth(end.getMonth() - 1);
    }
    return end.toISOString();
  }

  function _populateMembershipCard(member) {
    var planEl = document.getElementById('alt-membership-plan');
    var daysEl = document.getElementById('alt-membership-days');
    if (!planEl || !daysEl) return;
    if (!member) return; // stays on placeholder text until the next full /altitude/verify

    planEl.textContent = PLAN_LABELS[member.plan] || 'Altitude';
    var days = _daysRemaining(member.current_period_end);
    var renewDate = _formatRenewalDate(member.current_period_end);
    var compactRenewDate = _formatCompactDate(member.current_period_end);
    var purchaseDate = _formatCompactDate(_inferPeriodStart(member));

    var purchasedEl = document.getElementById('alt-membership-purchased');
    var expiresEl = document.getElementById('alt-membership-expires');
    if (purchasedEl) purchasedEl.textContent = purchaseDate || 'Not available';
    if (expiresEl) expiresEl.textContent = compactRenewDate || 'Not available';

    if (days == null) {
      daysEl.textContent = 'Renewal date unavailable';
    } else if (days === 0) {
      daysEl.textContent = 'Renews today';
    } else {
      daysEl.textContent = days + ' day' + (days === 1 ? '' : 's') + ' remaining';
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
    renderLatestGrid(posts);
    _applyFilter('all');
  }

  function renderLatestGrid(posts) {
    var grid = document.getElementById('alt-latest-grid');
    if (!grid) return;

    var latest = (posts || []).slice(0, 3);
    if (!latest.length) {
      grid.innerHTML = '<div class="private-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><p>No issues published yet.</p></div>';
      return;
    }

    grid.innerHTML = latest.map(_renderCard).join('');
    _wireBeehiivHandoffForGrid(grid);
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
    _altArchiveFilter = type || 'all';
    _altArchivePage = 1;
    _renderArchivePage();
  }

  function _getFilteredPosts() {
    var posts = _altAllPosts;
    if (_altArchiveFilter === 'free') {
      posts = _altAllPosts.filter(function (p) { return !p.is_premium; });
    } else if (_altArchiveFilter === 'premium') {
      posts = _altAllPosts.filter(function (p) { return !!p.is_premium; });
    }
    return posts;
  }

  function _renderArchivePage() {
    var posts = _getFilteredPosts();
    var totalPages = Math.max(1, Math.ceil(posts.length / ARCHIVE_PAGE_SIZE));
    if (_altArchivePage > totalPages) _altArchivePage = totalPages;

    var start = (_altArchivePage - 1) * ARCHIVE_PAGE_SIZE;
    var visiblePosts = posts.slice(start, start + ARCHIVE_PAGE_SIZE);

    var count = document.getElementById('alt-post-count');
    if (count) count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');

    var grid = document.getElementById('alt-archive-grid');
    if (!grid) {
      _renderPagination(posts.length, totalPages);
      return;
    }

    if (!visiblePosts.length) {
      var label = _altArchiveFilter === 'free' ? 'free ' : _altArchiveFilter === 'premium' ? 'premium ' : '';
      grid.innerHTML = '<div class="private-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><p>No ' + label + 'issues published yet.</p></div>';
    } else {
      grid.innerHTML = visiblePosts.map(_renderCard).join('');
    }

    document.querySelectorAll('.alt-filter-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === _altArchiveFilter);
    });

    _renderPagination(posts.length, totalPages);
  }

  function _renderPagination(totalItems, totalPages) {
    var el = document.getElementById('alt-archive-pagination');
    if (!el) return;

    if (totalItems <= ARCHIVE_PAGE_SIZE) {
      el.innerHTML = '';
      return;
    }

    var buttons = '';
    for (var i = 1; i <= totalPages; i++) {
      buttons += '<button type="button" data-page="' + i + '" class="' + (i === _altArchivePage ? 'active' : '') + '" aria-label="Go to archive page ' + i + '">' + i + '</button>';
    }

    el.innerHTML =
      '<button type="button" data-page="prev" ' + (_altArchivePage === 1 ? 'disabled' : '') + ' aria-label="Previous archive page"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>' +
      '<div class="altitude-pagination__pages">' + buttons + '</div>' +
      '<button type="button" data-page="next" ' + (_altArchivePage === totalPages ? 'disabled' : '') + ' aria-label="Next archive page"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
  }

  function _wireFilters() {
    document.querySelectorAll('.alt-filter-btn').forEach(function (btn) {
      if (btn.dataset.filterWired === 'true') return;
      btn.dataset.filterWired = 'true';
      btn.addEventListener('click', function () { _applyFilter(btn.dataset.filter); });
    });
    var pager = document.getElementById('alt-archive-pagination');
    if (pager && pager.dataset.paginationWired !== 'true') {
      pager.dataset.paginationWired = 'true';
      pager.addEventListener('click', function (event) {
        var btn = event.target.closest && event.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        var action = btn.getAttribute('data-page');
        var totalPages = Math.max(1, Math.ceil(_getFilteredPosts().length / ARCHIVE_PAGE_SIZE));
        if (action === 'prev') _altArchivePage = Math.max(1, _altArchivePage - 1);
        else if (action === 'next') _altArchivePage = Math.min(totalPages, _altArchivePage + 1);
        else _altArchivePage = Math.max(1, Math.min(totalPages, parseInt(action, 10) || 1));
        _renderArchivePage();
        var grid = document.getElementById('alt-archive-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    _wireBeehiivHandoff();
  }

  function _wireBeehiivHandoff() {
    var grid = document.getElementById('alt-archive-grid');
    _wireBeehiivHandoffForGrid(grid);
  }

  function _wireBeehiivHandoffForGrid(grid) {
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
    return getPublicPagePrefix() + 'newsletter-detail?slug=' + encodeURIComponent(post && post.slug ? post.slug : '');
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

  function isNestedAltitudePage() {
    return /\/pages\/private-pages\/altitude-access\//.test(location.pathname.replace(/\\/g, '/'));
  }

  function getPublicPagePrefix() {
    return isNestedAltitudePage() ? '../../' : '../';
  }
})();
