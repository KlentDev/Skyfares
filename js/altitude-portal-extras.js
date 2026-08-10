// js/altitude-portal-extras.js — Membership Plans rendering + Support modal
// for pages/private-pages/altitude-access-portal.html. Kept out of
// js/altitude-portal.js (the auth-critical file) on purpose; listens for
// that file's 'skyfare:altitude-member' CustomEvent rather than fetching
// anything itself. See
// docs/superpowers/specs/2026-08-06-altitude-access-portal-redesign-design.md.
(function () {
  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportModal);
  } else {
    initSupportModal();
  }

  window.addEventListener('skyfare:altitude-member', function (e) {
    renderPlans(e.detail);
  });

  // ─── Membership Plans ───────────────────────────────────────────────────

  function _daysRemaining(iso) {
    if (!iso) return null;
    var end = new Date(iso).getTime();
    if (isNaN(end)) return null;
    var days = Math.ceil((end - Date.now()) / 86400000);
    return days > 0 ? days : 0;
  }

  function renderPlans(member) {
    var section = document.getElementById('alt-plans-section');
    var content = document.getElementById('alt-plans-content');
    if (!section || !content) return;

    if (!member || !member.plan) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    if (member.plan === 'guide_bundle') {
      content.innerHTML = _renderAccessSource(member);
    } else if (member.plan === 'annual') {
      content.innerHTML = '<div class="private-plans-grid">' + _renderMonthlyInformational() + _renderAnnualCurrent(member) + '</div>';
    } else if (member.plan === 'monthly') {
      if (member.pending_plan === 'annual') {
        content.innerHTML = '<div class="private-plans-grid">' + _renderMonthlyCurrent(member, 'pending') + _renderAnnualScheduled(member) + '</div>';
      } else if (!member.current_period_end) {
        content.innerHTML = '<div class="private-plans-grid">' + _renderMonthlyCurrent(member, 'plain') + _renderAnnualUnavailable() + '</div>';
      } else {
        content.innerHTML = '<div class="private-plans-grid">' + _renderMonthlyCurrent(member, 'plain') + _renderAnnualUpgrade() + '</div>';
      }
    } else {
      section.classList.add('hidden');
      return;
    }

    // Newly injected content, not present at DOMContentLoaded -- must skip
    // .slide-up entirely (the sitewide IntersectionObserver in js/header.js
    // only scans .slide-up once at load and would never see this), which is
    // why none of the render functions below add that class.
    _wireDynamicButtons(content);
  }

  function _renderMonthlyCurrent(member, mode) {
    var days = _daysRemaining(member.current_period_end);
    var noteHtml = mode === 'pending'
      ? '<p class="private-summary__note mt-1">Switches to Annual automatically — see the Annual card.</p>'
      : (days != null ? '<p class="private-summary__note mt-1">' + days + ' day' + (days === 1 ? '' : 's') + ' remaining in this period.</p>' : '');
    return (
      '<div class="private-plan-card private-plan-card--current">' +
        '<span class="private-badge private-badge--gold private-plan-card__current-badge">Current Plan</span>' +
        '<div>' +
          '<p class="private-summary__label">Altitude Monthly</p>' +
          '<p class="private-upgrade__price">$4.99 <span class="text-sm text-neutral-500">/month</span></p>' +
        '</div>' +
        noteHtml +
        '<ul class="private-check-list">' +
          '<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>Full Altitude access, billed monthly.</span></li>' +
          '<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>Cancel anytime — access continues until the period ends.</span></li>' +
        '</ul>' +
        '<button id="alt-manage-btn" type="button" data-action="manage" class="private-action private-action--primary">' +
          '<i class="fa-solid fa-gear" aria-hidden="true"></i> Manage Billing' +
        '</button>' +
      '</div>'
    );
  }

  function _renderAnnualUpgrade() {
    return (
      '<div class="private-plan-card">' +
        '<span class="private-badge">Save $15.01/year</span>' +
        '<div>' +
          '<p class="private-summary__label">Altitude Annual</p>' +
          '<p class="private-upgrade__price">$39.99 <span class="text-lg text-neutral-400 line-through">$55</span> <span class="text-sm text-neutral-500">/year</span></p>' +
        '</div>' +
        '<ul class="private-check-list">' +
          '<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>Same full Altitude access; only billing changes.</span></li>' +
          '<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>Your current Monthly access continues until it naturally ends.</span></li>' +
          '<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>Annual starts and charges after the current period expires.</span></li>' +
        '</ul>' +
        '<button id="alt-upgrade-btn" type="button" data-action="upgrade" class="private-action private-action--primary">' +
          '<i class="fa-solid fa-arrow-up-right-dots" aria-hidden="true"></i> Upgrade to Annual' +
        '</button>' +
      '</div>'
    );
  }

  function _renderAnnualScheduled(member) {
    var days = _daysRemaining(member.upgrade_effective_at || member.current_period_end);
    var text = days != null
      ? 'Annual Subscription will automatically take effect after the ' + days + ' day' + (days === 1 ? '' : 's') + ' remaining expires.'
      : 'Annual Subscription will automatically take effect once your current period expires.';
    return (
      '<div class="private-plan-card">' +
        '<div class="flex items-start gap-4">' +
          '<div class="icon-chip icon-chip-lg"><i class="fa-solid fa-clock" aria-hidden="true"></i></div>' +
          '<div>' +
            '<p class="private-summary__label">Upgrade scheduled</p>' +
            '<p class="private-summary__value">' + text + '</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _renderAnnualUnavailable() {
    return (
      '<div class="private-plan-card">' +
        '<div class="flex items-start gap-4">' +
          '<div class="icon-chip icon-chip-lg opacity-60"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></div>' +
          '<div>' +
            '<p class="private-summary__label">Billing status</p>' +
            '<p class="private-summary__value">Upgrade not available yet</p>' +
            '<p class="private-summary__note mt-1">We are still confirming your billing details with Stripe. Refresh in a few minutes, or contact support if it remains unavailable.</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _renderMonthlyInformational() {
    return (
      '<div class="private-plan-card">' +
        '<div>' +
          '<p class="private-summary__label">Altitude Monthly</p>' +
          '<p class="private-upgrade__price">$4.99 <span class="text-sm text-neutral-500">/month</span></p>' +
        '</div>' +
        '<p class="private-summary__note mt-1">No downgrade path exists from Annual today — contact support if you’d like to discuss switching.</p>' +
      '</div>'
    );
  }

  function _renderAnnualCurrent(member) {
    var days = _daysRemaining(member.current_period_end);
    var noteHtml = days != null ? '<p class="private-summary__note mt-1">' + days + ' day' + (days === 1 ? '' : 's') + ' remaining in this period.</p>' : '';
    return (
      '<div class="private-plan-card private-plan-card--current">' +
        '<span class="private-badge private-badge--gold private-plan-card__current-badge">Current Plan</span>' +
        '<div>' +
          '<p class="private-summary__label">Altitude Annual</p>' +
          '<p class="private-upgrade__price">$39.99 <span class="text-sm text-neutral-500">/year</span></p>' +
        '</div>' +
        noteHtml +
        '<button id="alt-manage-btn" type="button" data-action="manage" class="private-action private-action--primary">' +
          '<i class="fa-solid fa-gear" aria-hidden="true"></i> Manage Billing' +
        '</button>' +
      '</div>'
    );
  }

  function _renderAccessSource(member) {
    var days = _daysRemaining(member.current_period_end);
    var note = days != null
      ? days + ' day' + (days === 1 ? '' : 's') + ' remaining on your complimentary access.'
      : 'Access details unavailable right now.';
    return (
      '<div class="private-panel private-access-source">' +
        '<div class="icon-chip icon-chip-lg icon-chip--gold"><i class="fa-solid fa-gift" aria-hidden="true"></i></div>' +
        '<div>' +
          '<p class="private-summary__label">Access Source</p>' +
          '<p class="private-summary__title text-[1.05rem]">KrisFlyer Guide bundle</p>' +
          '<p class="private-summary__note mt-1">Your Altitude access comes from a one-time 90-day bundle included with the KrisFlyer Guide purchase — not a subscription, so there’s nothing to renew or upgrade.</p>' +
          '<p class="private-summary__note mt-2 font-bold">' + note + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function _wireDynamicButtons(content) {
    var manageBtn = content.querySelector('[data-action="manage"]');
    if (manageBtn) manageBtn.addEventListener('click', function () {
      if (window.handleManageMembership) window.handleManageMembership();
    });
    var upgradeBtn = content.querySelector('[data-action="upgrade"]');
    if (upgradeBtn) upgradeBtn.addEventListener('click', function () {
      if (window.handleUpgradeToAnnual) window.handleUpgradeToAnnual();
    });
  }

  // ─── Support modal ──────────────────────────────────────────────────────
  // Trigger is visible immediately, not gated behind verify -- a member with
  // a real problem shouldn't be blocked from reaching support if verify is
  // slow/erroring.

  function initSupportModal() {
    var openBtn = document.getElementById('alt-support-open-btn');
    if (openBtn) openBtn.addEventListener('click', openSupportModal);

    var compareLink = document.getElementById('alt-compare-support-link');
    if (compareLink) compareLink.addEventListener('click', function (e) {
      e.preventDefault();
      openSupportModal();
    });
  }

  function openSupportModal() {
    var tpl = document.getElementById('alt-support-form-template');
    if (!tpl || !window.SkyUI) return;

    var handle = SkyUI.modal({
      title: 'Contact Support',
      html: tpl.innerHTML,
      actions: [
        { label: 'Cancel' },
        { label: 'Send Message', style: 'primary', onClick: function () { return _handleSupportSubmit(handle); } },
      ],
    });

    // Email pre-fill -- reads at click time (not page load), so it
    // self-corrects if /altitude/verify resolves after this modal opens.
    // Field stays editable either way.
    var emailField = handle.el.querySelector('input[name="email"]');
    if (emailField && window.SkyfarePrivate && window.SkyfarePrivate.getUser) {
      var user = window.SkyfarePrivate.getUser();
      if (user && user.email) emailField.value = user.email;
    }
  }

  function _handleSupportSubmit(handle) {
    var form = handle.el.querySelector('#alt-support-form');
    if (!form) return false;

    var nameEl    = form.querySelector('[name="name"]');
    var emailEl   = form.querySelector('[name="email"]');
    var subjectEl = form.querySelector('[name="subject"]');
    var messageEl = form.querySelector('[name="message"]');
    var botEl     = form.querySelector('[name="bot-field"]');
    var statusEl  = form.querySelector('#alt-support-form-status');
    var submitBtn = handle.el.querySelector('[data-sky-action="1"]');

    _clearErrors(form);

    var valid = true;
    var firstInvalid = null;
    if (!nameEl.value.trim()) { _showError(form, 'name'); valid = false; firstInvalid = firstInvalid || nameEl; }
    if (!_isValidEmail(emailEl.value.trim())) { _showError(form, 'email'); valid = false; firstInvalid = firstInvalid || emailEl; }
    if (!messageEl.value.trim()) { _showError(form, 'message'); valid = false; firstInvalid = firstInvalid || messageEl; }
    if (!valid) {
      if (firstInvalid) firstInvalid.focus();
      return false;
    }

    var payload = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      subject: (subjectEl.value || '').trim(),
      message: messageEl.value.trim(),
      'bot-field': botEl ? (botEl.value || '') : '',
    };

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
    _setStatus(statusEl, '', null);

    fetch(WORKER + '/airtable/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.success) {
          _setStatus(statusEl, 'Message sent — we’ll be in touch shortly.', 'success');
          if (window.SkyUI) SkyUI.toast('Message sent.', { type: 'success' });
          setTimeout(function () { handle.close(); }, 900);
        } else {
          _setStatus(statusEl, _mapError(res.data && res.data.error), 'error');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
        }
      })
      .catch(function () {
        _setStatus(statusEl, 'Network error. Please try again.', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
      });

    return false; // keep modal open -- js/ui.js's documented onClick()===false behavior
  }

  function _isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function _clearErrors(form) {
    form.querySelectorAll('.alt-support-form__error').forEach(function (el) { el.classList.remove('is-visible'); });
  }

  function _showError(form, field) {
    var el = form.querySelector('[data-error-for="' + field + '"]');
    if (el) el.classList.add('is-visible');
  }

  function _setStatus(statusEl, text, type) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove('is-visible', 'alt-support-form__status--success', 'alt-support-form__status--error');
    if (type) statusEl.classList.add('is-visible', 'alt-support-form__status--' + type);
  }

  function _mapError(code) {
    switch (code) {
      case 'missing_fields':    return 'Please fill in all required fields.';
      case 'invalid_email':     return 'Please enter a valid email address.';
      case 'invalid_body':      return 'Something went wrong with your submission. Please try again.';
      case 'rate_limited':      return 'Too many requests — please wait a bit and try again.';
      case 'submission_failed': return 'Could not send your message. Please try again or use WhatsApp/email directly.';
      default:                  return 'Something went wrong. Please try again.';
    }
  }
})();
