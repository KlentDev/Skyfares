(function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt'; // shared with js/altitude.js / js/krisflyer-guide.js -- one login covers both products

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
    var emailEl = document.getElementById('alt-member-email');
    if (emailEl) emailEl.textContent = email;
    window.__altSignOut = function () { clearToken(); window.location.href = '../altitude.html'; };
    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
    _wireFilters();
    window.handleManageMembership = handleManageMembership;
    window.handleUpgradeToAnnual = handleUpgradeToAnnual;

    _populateMembershipCard(member);
    updatePrivateChrome(email, member);

    // Upgrade card only makes sense for an active Monthly member -- hidden
    // for Annual (nothing to upgrade to) and Guide-bundle recipients (no
    // real Stripe subscription to modify). `member` is null right after a
    // fresh magic-link login (handleMagicCallback doesn't have it yet) --
    // the card just stays hidden until the next full /altitude/verify.
    var upgradeSection = document.getElementById('alt-upgrade-section');
    if (upgradeSection) {
      if (member && member.plan === 'monthly') {
        upgradeSection.classList.remove('hidden');
        var ctaCard = document.getElementById('alt-upgrade-cta-card');
        var pendingCard = document.getElementById('alt-upgrade-pending-card');
        var unavailableCard = document.getElementById('alt-upgrade-unavailable-card');
        if (member.pending_plan === 'annual') {
          if (ctaCard) ctaCard.classList.add('hidden');
          if (unavailableCard) unavailableCard.classList.add('hidden');
          if (pendingCard) pendingCard.classList.remove('hidden');
          var pendingText = document.getElementById('alt-upgrade-pending-text');
          if (pendingText) {
            var days = _daysRemaining(member.upgrade_effective_at || member.current_period_end);
            pendingText.textContent = days != null
              ? 'Annual Subscription will automatically take effect after the ' + days + ' day' + (days === 1 ? '' : 's') + ' remaining expires.'
              : 'Annual Subscription will automatically take effect once your current period expires.';
          }
        } else if (!member.current_period_end) {
          if (ctaCard) ctaCard.classList.add('hidden');
          if (pendingCard) pendingCard.classList.add('hidden');
          if (unavailableCard) unavailableCard.classList.remove('hidden');
        } else {
          if (ctaCard) ctaCard.classList.remove('hidden');
          if (pendingCard) pendingCard.classList.add('hidden');
          if (unavailableCard) unavailableCard.classList.add('hidden');
        }
      } else {
        upgradeSection.classList.add('hidden');
      }
    }

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

  var PLAN_LABELS = { monthly: 'Altitude Monthly', annual: 'Altitude Annual', guide: 'KrisFlyer Guide Bundle' };

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
    var href     = 'newsletter-detail?slug=' + encodeURIComponent(post.slug);

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '">'
      : '<div class="w-full h-full flex items-center justify-center"><span class="text-[11px] font-bold uppercase tracking-widest text-white/45">No Thumbnail</span></div>';

    var badge = prem
      ? '<span class="private-badge private-badge--gold"><i class="fa-solid fa-crown" aria-hidden="true"></i> Altitude</span>'
      : '';

    return '<article class="private-resource-card reveal-stagger" style="animation-delay:' + delay + '">' +
      '<a href="../' + href + '" class="private-resource-card__media" aria-label="Read ' + e(post.title) + '">' +
          imgHtml +
          '<div class="private-resource-card__badge-row">' +
            (issueNum ? '<span class="private-badge">Issue ' + e(issueNum) + '</span>' : '') +
            (badge || '<span class="private-badge private-badge--muted">' + e(type) + '</span>') +
          '</div>' +
      '</a>' +
      '<div class="private-resource-card__body">' +
        '<p class="private-resource-card__meta">' + e(date || type) + '</p>' +
        '<h3>' + e(post.title) + '</h3>' +
        '<a href="../' + href + '" class="private-resource-card__link">Read issue <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
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
