(function () {
  if (window.SkyfareVerifyAccess || window.__verifyAccessLoading) return;
  window.__verifyAccessLoading = true;

  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var state = {
    target: '',
    href: '',
    email: '',
    verifying: false,
  };

  var PRODUCT = {
    guide: {
      label: 'KrisFlyer Guide',
      icon: 'fa-book-open',
      description: 'To continue, we will verify whether your account includes KrisFlyer Guide access.',
    },
    altitude: {
      label: 'Altitude',
      icon: 'fa-crown',
      description: 'To continue, we will verify whether your account includes an active Altitude membership.',
    },
  };

  window.SkyfareVerifyAccess = {
    open: function (opts) {
      opts = opts || {};
      ensureInjected(function () {
        state.target = opts.target === 'guide' ? 'guide' : 'altitude';
        state.href = opts.href || '';
        state.email = opts.email || getCurrentEmail();
        renderInitial();
        showModal();
      });
    },
    close: closeModal,
  };

  function ensureInjected(done) {
    if (document.getElementById('verify-access-modal')) {
      done();
      return;
    }

    var prefix = location.pathname.indexOf('/pages/private-pages/') !== -1
      ? '../../'
      : location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    fetch(prefix + 'components/modal-verify-access.html')
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load verification modal.');
        return r.text();
      })
      .then(function (html) {
        if (!document.getElementById('verify-access-modal')) {
          document.body.insertAdjacentHTML('beforeend', html);
          wireModal();
        }
        done();
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Could not open access verification. Please try again.', { type: 'error' });
      });
  }

  function wireModal() {
    document.querySelectorAll('#verify-access-modal [data-verify-access-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    var verifyBtn = document.getElementById('verify-access-check-btn');
    if (verifyBtn) verifyBtn.addEventListener('click', verifyAccess);

    var guideBtn = document.getElementById('verify-access-guide-btn');
    if (guideBtn) guideBtn.addEventListener('click', function () {
      startCheckout(guideBtn, '/guide/checkout', {});
    });

    var monthlyBtn = document.getElementById('verify-access-monthly-btn');
    if (monthlyBtn) monthlyBtn.addEventListener('click', function () {
      startCheckout(monthlyBtn, '/altitude/checkout', { plan: 'monthly' });
    });

    var annualBtn = document.getElementById('verify-access-annual-btn');
    if (annualBtn) annualBtn.addEventListener('click', function () {
      startCheckout(annualBtn, '/altitude/checkout', { plan: 'annual' });
    });
  }

  function renderInitial() {
    var cfg = PRODUCT[state.target] || PRODUCT.altitude;
    setText('verify-access-title', 'Verify ' + cfg.label + ' access');
    setText('verify-access-description', cfg.description);
    setText('verify-access-email', state.email || 'Signed in');

    var kicker = document.getElementById('verify-access-kicker');
    if (kicker) {
      kicker.innerHTML = '<i class="fa-solid ' + cfg.icon + ' text-[9px]" aria-hidden="true"></i> Verify Access';
    }

    setStatus('', '');
    setPurchaseVisibility(true);
    setVerifyLoading(false);
  }

  function showModal() {
    var modal = document.getElementById('verify-access-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeModal() {
    var modal = document.getElementById('verify-access-modal');
    if (modal) modal.style.display = 'none';
  }

  function verifyAccess() {
    if (state.verifying) return;
    var token = getToken();
    if (!token) {
      setStatus('Please sign in again to verify access.', 'error');
      return;
    }

    setVerifyLoading(true);
    setStatus('Checking your membership record...', 'info');

    fetch(WORKER + '/altitude/verify?target=' + encodeURIComponent(state.target), {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
      })
      .then(function (res) {
        state.email = res.data.email || state.email;
        setText('verify-access-email', state.email || 'Signed in');

        if (res.ok && res.data.granted) {
          setStatus(res.data.message || 'Access verified. Opening...', 'success');
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.markVerified(state.target);
          closeModal();
          if (state.href) window.location.href = state.href;
          return;
        }

        setDeniedState(res.data || {}, res.status);
      })
      .catch(function () {
        setStatus('Network error verifying access. Please try again.', 'error');
      })
      .finally(function () {
        setVerifyLoading(false);
      });
  }

  function setDeniedState(data, status) {
    var reason = data.reason || '';
    var message = data.message || 'Access could not be verified.';
    if (status === 429) message = 'Too many verification attempts. Please wait a few minutes before trying again.';
    setStatus(message, 'error');

    if (reason === 'not_authenticated' || reason === 'session_expired') {
      setPurchaseVisibility(false);
      return;
    }

    setPurchaseVisibility(true);
  }

  function setPurchaseVisibility(show) {
    var guide = document.getElementById('verify-access-guide-purchase');
    var altitude = document.getElementById('verify-access-altitude-purchase');
    if (guide) guide.classList.toggle('hidden', !(show && state.target === 'guide'));
    if (altitude) altitude.classList.toggle('hidden', !(show && state.target === 'altitude'));
  }

  function startCheckout(btn, endpoint, body) {
    body = body || {};
    if (state.email && !body.email) body.email = state.email;
    var originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.classList.add('pointer-events-none', 'opacity-70');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]" aria-hidden="true"></i> Redirecting';
    }

    fetch(WORKER + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, data: d }; });
      })
      .then(function (res) {
        if (res.ok && res.data.url) {
          window.location.href = res.data.url;
          return;
        }
        setStatus(res.data.error || 'Could not start checkout. Please try again.', 'error');
        resetCheckoutButton(btn, originalHtml);
      })
      .catch(function () {
        setStatus('Network error starting checkout. Please try again.', 'error');
        resetCheckoutButton(btn, originalHtml);
      });
  }

  function resetCheckoutButton(btn, html) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('pointer-events-none', 'opacity-70');
    btn.innerHTML = html;
  }

  function setVerifyLoading(loading) {
    state.verifying = loading;
    var btn = document.getElementById('verify-access-check-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('pointer-events-none', loading);
    btn.classList.toggle('opacity-70', loading);
    btn.innerHTML = loading
      ? '<i class="fa-solid fa-spinner fa-spin text-[10px]" aria-hidden="true"></i> Verifying'
      : '<i class="fa-solid fa-shield-halved text-[10px]" aria-hidden="true"></i> Verify Access';
  }

  function setStatus(message, type) {
    var el = document.getElementById('verify-access-status');
    if (!el) return;
    if (!message) {
      el.className = 'mb-5 hidden rounded-xl border px-4 py-3 text-sm leading-relaxed';
      el.textContent = '';
      return;
    }

    var cls = 'mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed ';
    if (type === 'success') cls += 'border-emerald-100 bg-emerald-50 text-emerald-700';
    else if (type === 'info') cls += 'border-brand-100 bg-brand-50 text-brand-700';
    else cls += 'border-red-100 bg-red-50 text-red-600';
    el.className = cls;
    el.textContent = message;
  }

  function getCurrentEmail() {
    if (window.SkyfarePrivate && window.SkyfarePrivate.getUser) {
      var user = window.SkyfarePrivate.getUser();
      if (user && user.email) return user.email;
    }
    var emailEl = document.getElementById('private-member-email');
    var text = emailEl ? emailEl.textContent.trim() : '';
    return text && text !== 'Signed in' && text !== 'Member' ? text : '';
  }

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
})();
