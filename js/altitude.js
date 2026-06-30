(function () {
  var WORKER        = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY       = 'altitude_jwt';
  var PUB_BASE      = 'https://skyfarealtitude.beehiiv.com';
  var PAYMENT_LINK  = 'https://buy.stripe.com/test_7sYaEX9Ujd0qbg8gGv3oA00';

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
      wirePublicView();
    }
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
    showMemberShell();
    fetch(WORKER + '/altitude/verify', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.valid) {
          if (fallbackMagic) history.replaceState(null, '', location.pathname);
          populateMemberView(res.data.email, res.data.member);
          loadPremiumPosts(token);
        } else {
          clearToken();
          hideMemberShell();
          if (fallbackMagic) {
            handleMagicCallback(fallbackMagic);
          } else {
            wirePublicView(res.data.status === 'cancelled' ? 'cancelled' : null);
          }
        }
      })
      .catch(function () {
        clearToken();
        hideMemberShell();
        if (fallbackMagic) {
          handleMagicCallback(fallbackMagic);
        } else {
          wirePublicView();
        }
      });
  }

  function handleMagicCallback(magic) {
    showMemberShell();
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
          populateMemberView(res.data.email, null);
          loadPremiumPosts(res.data.token);
          if (window.SkyUI) SkyUI.toast('Welcome back. Access granted.', { type: 'success' });
        } else {
          hideMemberShell();
          wirePublicView();
          window.openLoginModal && window.openLoginModal();
          var status = document.getElementById('alt-login-status');
          if (status) {
            status.textContent = res.data.error || 'This link has expired or has already been used. Please request a new one.';
            status.className = 'text-xs text-red-500 mt-2';
          }
        }
      })
      .catch(function () {
        history.replaceState(null, '', location.pathname);
        hideMemberShell();
        wirePublicView();
      });
  }

  function showMemberShell() {
    var pub = document.getElementById('alt-public');
    var mem = document.getElementById('alt-member');
    if (pub) pub.classList.add('hidden');
    if (mem) mem.classList.remove('hidden');
  }

  function hideMemberShell() {
    var pub = document.getElementById('alt-public');
    var mem = document.getElementById('alt-member');
    if (pub) pub.classList.remove('hidden');
    if (mem) mem.classList.add('hidden');
  }

  function wirePublicView(hint) {
    var checkoutForm = document.getElementById('alt-checkout-form');
    if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
    var loginForm = document.getElementById('alt-login-form');
    if (loginForm) loginForm.addEventListener('submit', handleMemberLogin);
    if (hint === 'cancelled') {
      var note = document.getElementById('alt-cancelled-note');
      if (note) note.classList.remove('hidden');
    }
    document.querySelectorAll('#alt-public .slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ─── Login modal open / close ─────────────────────────────────────────────

  window.openLoginModal = function () {
    var modal = document.getElementById('alt-login-modal');
    if (modal) {
      // Always reset to form state
      var form = document.getElementById('alt-login-form');
      var sent = document.getElementById('alt-login-sent');
      if (form) form.style.display = '';
      if (sent) sent.style.display = 'none';
      var status = document.getElementById('alt-login-status');
      if (status) { status.textContent = ''; }
      var btn = document.getElementById('alt-login-btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      modal.style.display = 'flex';
      var inp = document.getElementById('alt-login-email');
      if (inp) setTimeout(function () { inp.focus(); }, 80);
    }
  };

  window.closeLoginModal = function () {
    var modal = document.getElementById('alt-login-modal');
    if (modal) modal.style.display = 'none';
  };

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeLoginModal && window.closeLoginModal();
  });

  function populateMemberView(email, member) {
    var emailEl = document.getElementById('alt-member-email');
    if (emailEl) emailEl.textContent = email;
    window.__altSignOut = function () { clearToken(); window.location.reload(); };
    document.querySelectorAll('#alt-member .slide-up').forEach(function (el) { el.classList.add('is-visible'); });
    _wireFilters();
    window.handleManageMembership = handleManageMembership;

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
        }, 600); // slight delay so the member view renders first
      }
    } catch (_) {}
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  function handleCheckout(e) {
    e.preventDefault();
    var btn = document.getElementById('alt-checkout-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Redirecting…'; }
    if (window.SkyUI) SkyUI.toast('Taking you to secure checkout…', { type: 'info', duration: 2500 });
    // Pre-fill email in Stripe so it matches what was entered here
    var emailVal = (document.getElementById('alt-checkout-email') || {}).value || '';
    var stripeUrl = PAYMENT_LINK + (emailVal.trim() ? '?prefilled_email=' + encodeURIComponent(emailVal.trim()) : '');
    window.location.href = stripeUrl;
  }

  // ─── Member login ──────────────────────────────────────────────────────────

  // ─── Manage Membership (Stripe Billing Portal) ──────────────────────────────

  function handleManageMembership() {
    var token = getToken();
    if (!token) return;

    var btn = document.getElementById('alt-manage-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }

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
          if (btn) { btn.disabled = false; btn.textContent = 'Manage Membership'; }
        }
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        if (btn) { btn.disabled = false; btn.textContent = 'Manage Membership'; }
      });
  }

  function handleMemberLogin(e) {
    e.preventDefault();
    var input  = document.getElementById('alt-login-email');
    var btn    = document.getElementById('alt-login-btn');
    var status = document.getElementById('alt-login-status');
    var email  = (input ? input.value : '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'text-xs text-red-500 mt-2'; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending link…'; }
    if (status) { status.textContent = ''; }

    fetch(WORKER + '/altitude/magic-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.sent) {
          // Switch modal to sent state
          var form = document.getElementById('alt-login-form');
          var sent = document.getElementById('alt-login-sent');
          var sentEmail = document.getElementById('alt-login-sent-email');
          if (form) form.style.display = 'none';
          if (sent) sent.style.display = 'block';
          if (sentEmail) sentEmail.textContent = email;
        } else {
          var msg = res.data.error || 'No active Altitude membership found for this email.';
          if (res.status === 429) msg = 'Too many requests. Please wait a few minutes before trying again.';
          if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
          if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
        }
      })
      .catch(function () {
        var msg = 'Network error. Please try again.';
        if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      });
  }

  // ─── Member archive (member view is static HTML in altitude.html;
  //      JS only toggles visibility + populates the archive grid) ────────────

  function loadPremiumPosts(token) {
    fetch(WORKER + '/newsletter/posts', {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.posts) return;
        renderArchiveGrid(data.posts);
      })
      .catch(function () {});
  }

  // ─── Archive filters ─────────────────────────────────────────────────────────

  var _altAllPosts = [];

  function renderArchiveGrid(posts) {
    _altAllPosts = posts;
    _applyFilter('all');
  }

  function _renderCard(post, i) {
    var prem     = (post.content_tags || []).indexOf('altitude-premium') !== -1;
    var issueNum = getIssueNum(post);
    var date     = formatDate(post.published_at);
    var type     = (post.content_tags || []).filter(function (t) { return t !== 'altitude-premium'; })[0] || 'Newsletter';
    var delay    = (i * 0.05) + 's';
    var href     = 'newsletter-detail.html?slug=' + encodeURIComponent(post.slug);

    var imgHtml = post.thumbnail_url
      ? '<img src="' + e(post.thumbnail_url) + '" alt="' + e(post.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">'
      : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-plane text-white/15 text-4xl -rotate-12"></i></div>';

    var badge = prem
      ? '<span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 backdrop-blur-sm border border-amber-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-crown text-[7px]"></i> Altitude</span>'
      : '';

    return '<article class="group bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300" style="animation-delay:' + delay + '">' +
      '<a href="' + href + '" class="block">' +
        '<div class="relative h-44 bg-brand-950 overflow-hidden">' +
          imgHtml +
          '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.45) 0%,transparent 60%);"></div>' +
          '<div class="absolute top-3 left-3"><span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/80 backdrop-blur-sm px-2.5 py-1 rounded-full">Issue ' + e(issueNum) + '</span></div>' +
          '<div class="absolute bottom-3 right-3"><span class="text-[10px] font-semibold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">' + e(type) + '</span></div>' +
          (badge ? '<div class="absolute bottom-3 left-3">' + badge + '</div>' : '') +
        '</div>' +
      '</a>' +
      '<div class="p-5">' +
        (date ? '<p class="text-[10px] text-neutral-400 mb-1.5 font-medium">' + e(date) + '</p>' : '') +
        '<h3 class="text-sm font-display font-bold text-neutral-900 mb-3 group-hover:text-brand-700 transition-colors leading-snug">' + e(post.title) + '</h3>' +
        '<a href="' + href + '" class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">Read <i class="fa-solid fa-arrow-right text-[10px]"></i></a>' +
      '</div>' +
    '</article>';
  }

  function _applyFilter(type) {
    var posts = _altAllPosts;
    if (type === 'free') {
      posts = _altAllPosts.filter(function (p) {
        return (p.content_tags || []).indexOf('altitude-premium') === -1;
      });
    } else if (type === 'premium') {
      posts = _altAllPosts.filter(function (p) {
        return (p.content_tags || []).indexOf('altitude-premium') !== -1;
      });
    }

    var count = document.getElementById('alt-post-count');
    if (count) count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');

    var grid = document.getElementById('alt-archive-grid');
    if (!grid) return;

    if (!posts.length) {
      var label = type === 'free' ? 'free ' : type === 'premium' ? 'premium ' : '';
      grid.innerHTML = '<p class="col-span-full text-sm text-neutral-400 text-center py-12">No ' + label + 'issues published yet.</p>';
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
    return '??';
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
})();
