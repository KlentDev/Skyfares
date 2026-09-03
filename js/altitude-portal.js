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
    window.location.replace(getPublicPagePrefix() + 'altitude' + (reason ? '?loginError=' + encodeURIComponent(reason) : ''));
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
                '<a href="' + getPublicPagePrefix() + 'altitude" class="private-action"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Altitude</a>' +
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
    window.__altSignOut = function () { clearToken(); window.location.href = getPublicPagePrefix() + 'altitude'; };
    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
    _wireFilters();
    _wireTopicFilters();
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

  // Subscription urgency badge -- reuses the existing .private-badge pill
  // system (css/style.css, already loaded on every private page, unlike
  // css/altitude-editorial.css which only reaches 3 of the 7 -- this needs
  // to render on both the Overview and Membership pages). New tone
  // modifiers --urgent/--warn-orange/--warn-yellow sit alongside the
  // existing --gold/--muted/--teaser ones. Only the single lowest-matching
  // threshold ever renders -- never stacked.
  function _urgencyBadgeHtml(days, plan) {
    if (days == null || days > 7) return null;
    var isBundle = plan === 'guide_bundle';
    var tone = days <= 1 ? 'urgent' : (days <= 5 ? 'warn-orange' : 'warn-yellow');
    var when = days <= 0 ? 'today' : (days === 1 ? 'tomorrow' : 'in ' + days + ' days');
    var text = isBundle
      ? 'Free access ends ' + when + ' — upgrade to keep it'
      : 'Renews ' + when;
    return '<span class="private-badge private-badge--' + tone + '">' + e(text) + '</span>';
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

    var urgencyBadge = _urgencyBadgeHtml(days, member.plan);
    if (urgencyBadge) {
      daysEl.innerHTML = urgencyBadge;
    } else if (days == null) {
      daysEl.textContent = 'Renewal date unavailable';
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
    // Per-member unread tracking (js/altitude-read-tracker.js), scoped to
    // premium issues only -- matches the feature's own "premium newsletter"
    // framing rather than every free post too.
    if (window.AltitudeReadTracker) {
      var premiumIds = posts.filter(function (p) { return p.is_premium; }).map(function (p) { return p.id; });
      window.AltitudeReadTracker.seedIfFirstVisit('newsletter', premiumIds);
      window.AltitudeReadTracker.refreshCount('newsletter', premiumIds);
    }
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
    _wireUnreadTrackingForGrid(grid);
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
    var summary = String(post.subtitle || post.excerpt || post.description || '').trim();
    var unread = prem && window.AltitudeReadTracker && window.AltitudeReadTracker.isUnread('newsletter', post.id);

    return '<article class="private-resource-card reveal-stagger' + (unread ? ' has-unread' : '') + '" style="animation-delay:' + delay + '" data-post-id="' + e(post.id) + '">' +
      '<a href="' + e(href) + '"' + handoffAttrs + ' class="private-resource-card__media" aria-label="Read ' + e(post.title) + '">' +
          imgHtml +
          '<div class="private-resource-card__badge-row">' +
            (issueNum ? '<span class="private-badge">Issue ' + e(issueNum) + '</span>' : '') +
            (badge || '<span class="private-badge private-badge--muted">' + e(type) + '</span>') +
            (post.has_paywall_break ? '<span class="private-badge private-badge--teaser"><i class="fa-solid fa-eye" aria-hidden="true"></i> Teaser</span>' : '') +
          '</div>' +
      '</a>' +
      '<div class="private-resource-card__body">' +
        '<p class="private-resource-card__meta">' + e(date || type) + '</p>' +
        '<h3>' + (unread ? '<span class="alt-unread-dot" aria-label="Unread"></span>' : '') + e(post.title) + '</h3>' +
        (summary ? '<p class="private-resource-card__summary">' + e(summary) + '</p>' : '') +
        '<a href="' + e(href) + '"' + handoffAttrs + ' class="private-resource-card__link">Read issue <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
      '</div>' +
    '</article>';
  }

  function _applyFilter(type) {
    _altArchiveFilter = type || 'all';
    _altArchivePage = 1;
    _renderArchivePage();
  }

  // Topic filter, AND-combined with the free/premium filter above. data-topic
  // values are display labels ("Airlines"), but Beehiiv always stores/returns
  // a post's content_tags lowercased regardless of the tag's display casing
  // -- confirmed live, so matching is case-insensitive.
  var _altArchiveTopic = 'all';
  var _altArchiveSearch = '';

  function _applyTopicFilter(topic) {
    _altArchiveTopic = topic || 'all';
    _altArchivePage = 1;
    _renderArchivePage();
  }

  function _applySearchFilter(value) {
    _altArchiveSearch = (value || '').trim();
    _altArchivePage = 1;
    _renderArchivePage();
  }

  function _wireTopicFilters() {
    var select = document.getElementById('alt-topic-select');
    if (select && select.dataset.filterWired !== 'true') {
      select.dataset.filterWired = 'true';
      select.addEventListener('change', function () { _applyTopicFilter(select.value); });
    }

    var input = document.getElementById('alt-archive-search');
    var clearBtn = document.getElementById('alt-archive-search-clear');
    if (input && input.dataset.filterWired !== 'true') {
      input.dataset.filterWired = 'true';
      var debounceTimer = null;
      input.addEventListener('input', function () {
        if (clearBtn) clearBtn.hidden = !input.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () { _applySearchFilter(input.value); }, 150);
      });
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          input.value = '';
          clearBtn.hidden = true;
          _applySearchFilter('');
          input.focus();
        });
      }
    }
  }

  function _postMatchesSearch(post, needle) {
    if (!needle) return true;
    var haystack = [post.title, post.subtitle, post.excerpt, post.description]
      .concat(post.content_tags || [])
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(needle) !== -1;
  }

  function _getFilteredPosts() {
    var posts = _altAllPosts;
    if (_altArchiveFilter === 'free') {
      posts = posts.filter(function (p) { return !p.is_premium; });
    } else if (_altArchiveFilter === 'premium') {
      posts = posts.filter(function (p) { return !!p.is_premium; });
    }
    if (_altArchiveTopic !== 'all') {
      var topicLower = _altArchiveTopic.toLowerCase();
      posts = posts.filter(function (p) {
        return (p.content_tags || []).some(function (t) { return t.toLowerCase() === topicLower; });
      });
    }
    if (_altArchiveSearch) {
      var needle = _altArchiveSearch.toLowerCase();
      posts = posts.filter(function (p) { return _postMatchesSearch(p, needle); });
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
      var message;
      if (_altArchiveSearch) {
        message = 'No issues match "' + e(_altArchiveSearch) + '".';
      } else {
        var label = _altArchiveFilter === 'free' ? 'free ' : _altArchiveFilter === 'premium' ? 'premium ' : '';
        if (_altArchiveTopic !== 'all') label += _altArchiveTopic + ' ';
        message = 'No ' + label + 'issues published yet.';
      }
      grid.innerHTML = '<div class="private-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><p>' + message + '</p></div>';
    } else {
      grid.innerHTML = visiblePosts.map(_renderCard).join('');
    }

    document.querySelectorAll('#alt-filters [data-filter]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === _altArchiveFilter);
    });
    var topicSelect = document.getElementById('alt-topic-select');
    if (topicSelect) topicSelect.value = _altArchiveTopic;

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
    _wireUnreadTrackingForGrid(grid);
  }

  // Delegated so it survives every grid.innerHTML rewrite (filter/page
  // changes) -- same "wire once, guard with a dataset flag" idiom as
  // _wireBeehiivHandoffForGrid just above. Any click on a card (handoff
  // modal or plain navigation) marks that post read and refreshes the
  // subnav dot; the click itself is never intercepted/prevented here.
  function _wireUnreadTrackingForGrid(grid) {
    if (!grid || grid.dataset.unreadTrackingWired === 'true') return;
    grid.dataset.unreadTrackingWired = 'true';
    grid.addEventListener('click', function (event) {
      if (!window.AltitudeReadTracker) return;
      var card = event.target.closest && event.target.closest('.private-resource-card[data-post-id]');
      if (!card || !grid.contains(card)) return;
      var id = card.getAttribute('data-post-id');
      if (!id) return;
      window.AltitudeReadTracker.markRead('newsletter', id);
      var premiumIds = _altAllPosts.filter(function (p) { return p.is_premium; }).map(function (p) { return p.id; });
      window.AltitudeReadTracker.refreshCount('newsletter', premiumIds);
      card.classList.remove('has-unread');
      var dot = card.querySelector('.alt-unread-dot');
      if (dot) dot.remove();
    });
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

    // Same "read-choice" variant/layout as the public flow's
    // openFreeNewsletterChoiceModal (js/newsletter-archive.js) -- Read on
    // Skyfare as the full-width primary action, Beehiiv de-emphasized as a
    // link beneath a divider. This used to be a separate, older two-button
    // layout that predated that redesign; kept in sync here rather than
    // duplicating a third variant. The premium-only additions below (member
    // email box, premium-aware copy) have no public equivalent -- the
    // public flow only ever handles free articles.
    var emailLine = _altMemberEmail
      ? '<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">' +
          '<p class="text-[10px] font-bold uppercase tracking-widest text-amber-700">Use this email</p>' +
          '<p class="mt-1 text-sm font-bold text-neutral-900 break-all">' + e(_altMemberEmail) + '</p>' +
        '</div>'
      : '';

    var skyfareCopy = isPremium
      ? '<p><strong>Read on Skyfare</strong> is the fastest way to read this premium issue — it opens instantly, right here, using your Altitude membership.</p>'
      : '<p><strong>Read on Skyfare</strong> is the fastest way to read this issue — it opens instantly, right here, with nothing else to set up.</p>';
    var beehiivIntro = isPremium
      ? '<p><strong>Prefer Beehiiv?</strong> You can read it there instead. Beehiiv manages its own login session, so it may ask for this email again even though you are signed into the Skyfare portal.</p>'
      : '<p><strong>Prefer Beehiiv?</strong> You can read it there instead, verify your email, and use native likes and comments.</p>';

    SkyUI.modal({
      title: 'Choose where to read',
      variant: 'read-choice',
      html:
        skyfareCopy +
        '<div class="sky-modal__beehiiv-note">' +
          beehiivIntro +
          '<ol class="mt-2 list-decimal pl-5 leading-relaxed">' +
            '<li>Verify your email on Beehiiv if asked.</li>' +
            '<li>Beehiiv sends a one-time code.</li>' +
            '<li>Enter the code to verify your email.</li>' +
            '<li>Then read, like, and comment on the newsletter.</li>' +
          '</ol>' +
          (isPremium ? emailLine : '') +
        '</div>',
      actions: [
        {
          label: 'Read on Skyfare',
          style: 'primary-lg',
          onClick: function () {
            if (localUrl) window.location.href = localUrl;
          },
        },
        {
          label: 'Read on Beehiiv instead',
          style: 'link',
          onClick: function () {
            window.location.href = beehiivUrl || localUrl;
          },
        },
      ],
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
