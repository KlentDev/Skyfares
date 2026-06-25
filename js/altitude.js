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
    if (token) {
      verifyAndRender(token);
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

  function verifyAndRender(token) {
    // Hide public, reveal member shell immediately (avoids flash of public content)
    showMemberShell();
    fetch(WORKER + '/altitude/verify', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.valid) {
          populateMemberView(res.data.email, res.data.member);
          loadPremiumPosts(token);
        } else {
          clearToken();
          hideMemberShell();
          wirePublicView(res.data.status === 'cancelled' ? 'cancelled' : null);
        }
      })
      .catch(function () {
        clearToken();
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
    // Activate slide-up animations
    document.querySelectorAll('#alt-public .slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  function populateMemberView(email, member) {
    var emailEl = document.getElementById('alt-member-email');
    if (emailEl) emailEl.textContent = email;
    var renewEl = document.getElementById('alt-renews');
    if (renewEl && member && member.current_period_end) {
      renewEl.textContent = 'Renews ' + formatDate(member.current_period_end);
    }
    window.__altSignOut = function () { clearToken(); window.location.reload(); };
    document.querySelectorAll('#alt-member .slide-up').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  function handleCheckout(e) {
    e.preventDefault();
    var btn = document.getElementById('alt-checkout-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Redirecting…'; }
    if (window.SkyUI) SkyUI.toast('Taking you to secure checkout…', { type: 'info', duration: 2500 });
    // Redirect directly to the pre-built Stripe payment link
    window.location.href = PAYMENT_LINK;
  }

  // ─── Member login ──────────────────────────────────────────────────────────

  function handleMemberLogin(e) {
    e.preventDefault();
    var input  = document.getElementById('alt-login-email');
    var btn    = document.getElementById('alt-login-btn');
    var status = document.getElementById('alt-login-status');
    var email  = (input ? input.value : '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'text-xs text-red-500 mt-2'; }
      if (window.SkyUI) SkyUI.toast('Please enter a valid email address.', { type: 'error' });
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    if (status) { status.textContent = ''; }

    fetch(WORKER + '/altitude/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.token) {
          setToken(res.data.token);
          if (window.SkyUI) SkyUI.toast('Welcome back. Access granted.', { type: 'success' });
          showMemberShell();
          populateMemberView(res.data.email, null);
          loadPremiumPosts(res.data.token);
        } else {
          var msg = res.data.error || 'No active membership found for this email.';
          if (res.status === 429) {
            msg = 'Too many attempts. Please try again in a few minutes.';
          } else if (res.data.status === 'cancelled') {
            msg = 'Your Altitude membership was cancelled. Get Altitude Access to reactivate.';
          }
          if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
          if (window.SkyUI) SkyUI.toast(msg, { type: 'error', duration: 6000 });
          if (btn) { btn.disabled = false; btn.textContent = 'Access Altitude'; }
        }
      })
      .catch(function () {
        var msg = 'Network error. Please try again.';
        if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
        if (window.SkyUI) SkyUI.toast(msg, { type: 'error' });
        if (btn) { btn.disabled = false; btn.textContent = 'Access Altitude'; }
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

  function renderArchiveGrid(posts) {
    var grid  = document.getElementById('alt-archive-grid');
    var count = document.getElementById('alt-post-count');
    if (!grid) return;

    if (count) count.textContent = posts.length + (posts.length === 1 ? ' issue' : ' issues');

    if (!posts.length) {
      grid.innerHTML = '<p class="col-span-full text-sm text-neutral-400 text-center py-12">No issues published yet.</p>';
      return;
    }

    grid.innerHTML = posts.map(function (post, i) {
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
    }).join('');
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
