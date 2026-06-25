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
      renderPublicView();
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
    showSkeleton();
    fetch(WORKER + '/altitude/verify', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.valid) {
          renderMemberView(res.data.email, res.data.member);
        } else {
          clearToken();
          renderPublicView(res.data.status === 'cancelled' ? 'cancelled' : null);
        }
      })
      .catch(function () { renderPublicView(); });
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  function handleCheckout(e) {
    e.preventDefault();
    var btn = document.getElementById('alt-checkout-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to payment…'; }
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
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    if (status) { status.textContent = ''; }

    fetch(WORKER + '/altitude/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.token) {
          setToken(res.data.token);
          verifyAndRender(res.data.token);
        } else {
          var msg = res.data.error || 'No active membership found for this email.';
          if (res.data.status === 'cancelled') {
            msg = 'Your Altitude membership was cancelled. Get Altitude Access to reactivate.';
          }
          if (status) { status.textContent = msg; status.className = 'text-xs text-red-500 mt-2'; }
          if (btn) { btn.disabled = false; btn.textContent = 'Access Altitude'; }
        }
      })
      .catch(function () {
        if (status) { status.textContent = 'Network error. Please try again.'; status.className = 'text-xs text-red-500 mt-2'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Access Altitude'; }
      });
  }

  // ─── Render: skeleton ─────────────────────────────────────────────────────

  function showSkeleton() {
    var main = document.getElementById('alt-main');
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-5xl mx-auto px-4 py-20 text-center">' +
        '<div class="w-12 h-12 rounded-full bg-neutral-100 animate-pulse mx-auto mb-6"></div>' +
        '<div class="h-4 bg-neutral-100 rounded-full w-48 mx-auto animate-pulse mb-3"></div>' +
        '<div class="h-3 bg-neutral-100 rounded-full w-32 mx-auto animate-pulse"></div>' +
      '</div>';
  }

  // ─── Render: Public (non-member) view ─────────────────────────────────────

  function renderPublicView(hint) {
    var main = document.getElementById('alt-main');
    if (!main) return;

    var cancelledNote = hint === 'cancelled'
      ? '<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-300/50 bg-amber-50 text-amber-700 text-xs font-semibold mb-6"><i class="fa-solid fa-circle-info text-[10px]"></i> Your membership was cancelled. Reactivate below.</div>'
      : '';

    main.innerHTML =

      // ── Hero ──
      '<section class="newsletter-hero-bg relative py-24 overflow-hidden">' +
        '<div class="absolute inset-0 pointer-events-none opacity-10" style="background-image:url(\'../images/hero-bg-icons.svg\');background-repeat:repeat;background-size:320px 224px;-webkit-mask-image:linear-gradient(to bottom,black 50%,transparent 100%);mask-image:linear-gradient(to bottom,black 50%,transparent 100%);"></div>' +
        '<div class="container mx-auto px-4 md:px-6 relative z-10 max-w-2xl mx-auto text-center">' +
          cancelledNote +
          '<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-bold uppercase tracking-widest mb-6"><i class="fa-solid fa-crown text-[10px]"></i> Altitude Access</div>' +
          '<h1 class="text-4xl md:text-5xl font-display font-bold text-white leading-tight tracking-tight mb-5">Premium travel intelligence. Delivered.</h1>' +
          '<p class="text-base text-white/60 leading-relaxed mb-8">Award alerts, cabin reviews, routing strategies, and miles guides — the complete Skyfare intelligence brief, every week. Full archive access included.</p>' +
          '<div class="flex flex-col items-center gap-4">' +
            '<form id="alt-checkout-form" class="w-full max-w-sm">' +
              '<input id="alt-checkout-email" type="email" placeholder="Your email address" autocomplete="email" class="w-full mb-3 px-5 py-3.5 rounded-full border border-white/20 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-brand-500 bg-white shadow-sm">' +
              '<button id="alt-checkout-btn" type="submit" class="w-full btn-pill btn-pill-primary text-sm font-bold py-3.5">Get Altitude Access — $4.99/mo</button>' +
            '</form>' +
            '<p class="text-xs text-white/35">Cancel any time &middot; Instant access &middot; Billed monthly</p>' +
            '<div class="flex flex-col items-center gap-2 mt-2">' +
              '<p class="text-[10px] text-white/30 uppercase tracking-widest">or scan to subscribe</p>' +
              '<img src="../images/stripe-QR.png" alt="Scan to subscribe to Altitude Access" class="w-28 h-28 rounded-xl shadow-lg">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ── Benefits ──
      '<section class="py-20 bg-white">' +
        '<div class="container mx-auto px-4 md:px-6 max-w-5xl">' +
          '<div class="flex items-center gap-4 mb-12 slide-up"><p class="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-500 flex-shrink-0">What you get</p><div class="flex-1 h-px bg-neutral-100"></div></div>' +
          '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 slide-up" style="animation-delay:.05s;">' +
            benefit('fa-newspaper', 'Full Archive', 'Every premium newsletter, searchable and readable on-site. No inbox hunting.') +
            benefit('fa-satellite-dish', 'Award Alerts', 'Live award windows before they close — act before the masses.') +
            benefit('fa-route', 'Routing Strategies', 'Premium itineraries that maximise cabin quality on fewer miles.') +
            benefit('fa-crown', 'Members Only', 'Exclusive content, guides, and breakdowns never sent to the free list.') +
          '</div>' +
        '</div>' +
      '</section>' +

      // ── Locked preview ──
      '<section class="py-20 bg-neutral-50">' +
        '<div class="container mx-auto px-4 md:px-6 max-w-5xl">' +
          '<div class="flex items-center gap-4 mb-12 slide-up"><p class="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 flex-shrink-0">Altitude archive</p><div class="flex-1 h-px bg-neutral-200"></div><span class="text-[10px] text-neutral-400 font-medium flex-shrink-0">Members only</span></div>' +
          '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 slide-up" style="animation-delay:.05s;">' +
            lockedCard('Tokyo in First Class', 'Japan Airlines', 'first-class') +
            lockedCard('Singapore → London', 'KrisFlyer Sweet Spot', 'krisflyer') +
            lockedCard('Emirates Business Class', 'Dubai to Athens', 'cabin-review') +
          '</div>' +
          '<div class="text-center mt-10">' +
            '<a href="#checkout" onclick="scrollToCheckout()" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-colors">Unlock the Archive — $4.99/mo <i class="fa-solid fa-arrow-right text-xs"></i></a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ── Already a member ──
      '<section class="py-16 bg-white" id="alt-member-section">' +
        '<div class="container mx-auto px-4 md:px-6 max-w-md text-center">' +
          '<p class="text-sm font-semibold text-neutral-700 mb-1">Already an Altitude member?</p>' +
          '<p class="text-xs text-neutral-400 mb-5">Enter your email to access your membership.</p>' +
          '<form id="alt-login-form">' +
            '<div class="flex gap-2">' +
              '<input id="alt-login-email" type="email" placeholder="member@email.com" autocomplete="email" class="flex-1 px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all">' +
              '<button id="alt-login-btn" type="submit" class="px-4 py-3 rounded-xl bg-neutral-900 text-white font-bold text-sm hover:bg-neutral-800 transition-colors whitespace-nowrap">Access Altitude</button>' +
            '</div>' +
            '<p id="alt-login-status" class="text-xs mt-2"></p>' +
          '</form>' +
        '</div>' +
      '</section>';

    // Wire up events
    var checkoutForm = document.getElementById('alt-checkout-form');
    if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckout);
    var loginForm = document.getElementById('alt-login-form');
    if (loginForm) loginForm.addEventListener('submit', handleMemberLogin);

    // Activate slide-up animations
    document.querySelectorAll('#alt-main .slide-up').forEach(function(el) { el.classList.add('is-visible'); });

    window.scrollToCheckout = function() {
      var el = document.querySelector('#alt-checkout-form');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  function benefit(icon, title, desc) {
    return '<div class="flex items-start gap-3">' +
      '<div class="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fa-solid ' + icon + ' text-brand-500 text-sm"></i></div>' +
      '<div><p class="text-sm font-semibold text-neutral-900 mb-0.5">' + title + '</p><p class="text-xs text-neutral-400 leading-relaxed">' + desc + '</p></div>' +
      '</div>';
  }

  function lockedCard(title, sub, tag) {
    return '<div class="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm relative">' +
      '<div class="h-40 bg-brand-950 relative flex items-center justify-center">' +
        '<div class="absolute inset-0 opacity-20" style="background:linear-gradient(135deg,#0C4A6E,#1d4ed8);"></div>' +
        '<div class="relative z-10 text-center px-4">' +
          '<div class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-lock text-amber-300 text-sm"></i></div>' +
          '<span class="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-black/30 border border-amber-500/30 px-2 py-0.5 rounded-full">Altitude Exclusive</span>' +
        '</div>' +
      '</div>' +
      '<div class="p-5">' +
        '<p class="text-[10px] text-neutral-400 mb-1 font-medium uppercase tracking-widest">' + e(tag) + '</p>' +
        '<h3 class="text-sm font-display font-bold text-neutral-900 mb-1 leading-snug">' + e(title) + '</h3>' +
        '<p class="text-xs text-neutral-400">' + e(sub) + '</p>' +
      '</div>' +
    '</div>';
  }

  // ─── Render: Member view ───────────────────────────────────────────────────

  function renderMemberView(email, member) {
    var main = document.getElementById('alt-main');
    if (!main) return;

    var joined = member && member.joined_at
      ? new Date(member.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : '';
    var renewDate = member && member.current_period_end
      ? new Date(member.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    main.innerHTML =

      // ── Member hero ──
      '<section class="newsletter-hero-bg relative py-14 overflow-hidden">' +
        '<div class="container mx-auto px-4 md:px-6 max-w-5xl">' +
          '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">' +
            '<div>' +
              '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-4"><i class="fa-solid fa-crown text-[9px]"></i> Altitude Member</div>' +
              '<h1 class="text-2xl md:text-3xl font-display font-bold text-white mb-1 tracking-tight">Welcome back.</h1>' +
              '<p class="text-sm text-white/50">' + e(email) + (joined ? ' &middot; Member since ' + joined : '') + '</p>' +
            '</div>' +
            '<div class="flex items-center gap-3 flex-shrink-0">' +
              (renewDate ? '<p class="text-xs text-white/35">Renews ' + renewDate + '</p>' : '') +
              '<button onclick="handleSignOut()" class="text-xs font-semibold text-white/40 hover:text-white/70 transition-colors">Sign out</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ── Premium archive ──
      '<section class="py-20 bg-white">' +
        '<div class="container mx-auto px-4 md:px-6 max-w-5xl">' +
          '<div class="flex items-center gap-4 mb-10">' +
            '<p class="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-500 flex-shrink-0">Altitude Archive</p>' +
            '<div class="flex-1 h-px bg-neutral-100"></div>' +
            '<span id="alt-post-count" class="text-[10px] text-neutral-400 font-medium flex-shrink-0"></span>' +
          '</div>' +
          '<div id="alt-archive-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">' +
            '<div class="col-span-full text-center py-16"><div class="w-8 h-8 rounded-full bg-neutral-100 animate-pulse mx-auto"></div></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    window.handleSignOut = function() {
      clearToken();
      window.location.reload();
    };

    // Load premium posts
    loadPremiumPosts(getToken());
  }

  function loadPremiumPosts(token) {
    fetch(WORKER + '/newsletter/posts', {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.posts) return;
        renderArchiveGrid(data.posts);
      })
      .catch(function() {});
  }

  function renderArchiveGrid(posts) {
    var grid  = document.getElementById('alt-archive-grid');
    var count = document.getElementById('alt-post-count');
    if (!grid) return;

    var altitudePosts = posts; // show all posts; premium ones are fully accessible for members
    if (count) count.textContent = altitudePosts.length + ' issues';

    if (!altitudePosts.length) {
      grid.innerHTML = '<p class="col-span-full text-sm text-neutral-400 text-center py-12">No issues published yet.</p>';
      return;
    }

    grid.innerHTML = altitudePosts.map(function(post, i) {
      var prem     = (post.content_tags || []).indexOf('altitude-premium') !== -1;
      var issueNum = getIssueNum(post);
      var date     = formatDate(post.published_at);
      var type     = (post.content_tags || []).filter(function(t) { return t !== 'altitude-premium'; })[0] || 'Newsletter';
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
