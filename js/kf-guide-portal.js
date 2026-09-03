(function () {
  var WORKER = window.KFGuideAuth.WORKER;

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    window.KFGuideAuth.init({ onUnlocked: unlockGuideContent });
  }

  function unlockGuideContent(email) {
    var emailEl = document.getElementById('kf-member-email');
    if (emailEl) emailEl.textContent = email || '';
    window.__kfSignOut = window.KFGuideAuth.signOut;
    updatePrivateChrome(email);

    // Only the redemption-conditions table has real content to unlock today.
    var content = document.getElementById('kf-redemption-content');
    if (content) { content.classList.remove('kf-blur'); content.removeAttribute('aria-hidden'); }
    var lock = document.getElementById('kf-redemption-lock');
    if (lock) lock.style.display = 'none';

    renderLibrary();
    wireToolbar(email);

    document.querySelectorAll('.slide-up').forEach(function (el) { el.classList.add('is-visible'); });
    if (window.SkyUI) SkyUI.toast('Welcome back. Your Guide content is unlocked.', { type: 'success' });
  }

  // ─── Library grid ─────────────────────────────────────────────────────────
  // Fetches published chapters from the Worker (backed by the "Guide
  // Chapters" Airtable table) once per page load and renders one card per
  // chapter (model: js/newsletter-archive.js's buildArchiveCard /
  // js/altitude-portal.js's _renderCard). A chapter either exists (and is
  // readable) or hasn't been published yet -- there's no "Coming soon" state
  // anymore, since unpublished chapters simply aren't in the response.
  // Reading itself happens on a dedicated page (kf-guide-reader.html) now,
  // not a modal/overlay on this one -- this page just links out to it.

  function renderLibrary() {
    var grid = document.getElementById('kf-library-grid');
    if (!grid) return;
    var token = window.KFGuideAuth.getToken();
    if (!token) return;

    fetch(WORKER + '/guide/chapters', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.chapters) {
          grid.innerHTML = '<p class="private-note">Couldn\'t load chapters right now. Please refresh to try again.</p>';
          return;
        }
        if (!res.data.chapters.length) {
          grid.innerHTML = '<p class="private-note">Chapters are being finalised and will appear here as they\'re published.</p>';
          return;
        }
        grid.innerHTML = res.data.chapters.map(_renderChapterCard).join('');
      })
      .catch(function () {
        grid.innerHTML = '<p class="private-note">Couldn\'t load chapters right now. Please refresh to try again.</p>';
      });
  }

  function _renderChapterCard(chapter, i) {
    var delay = (i * 0.05) + 's';
    return '<article class="private-resource-card private-resource-card--locked reveal-stagger" style="animation-delay:' + delay + '">' +
      '<div class="private-resource-card__media flex items-center justify-center">' +
        '<div class="private-resource-card__badge-row"><span class="private-badge">Chapter ' + chapter.number + '</span></div>' +
        '<i class="fa-solid fa-book-open text-white/35 text-3xl relative z-10" aria-hidden="true"></i>' +
      '</div>' +
      '<div class="private-resource-card__body">' +
        '<p class="private-resource-card__meta">Guide chapter</p>' +
        '<h3>' + e(chapter.title) + '</h3>' +
        '<a class="private-resource-card__link" href="kf-guide-reader?chapter=' + i + '">Read chapter <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
      '</div>' +
    '</article>';
  }

  // ─── Toolbar: Send to My Email ────────────────────────────────────────────
  // Single plain button (Download was removed -- same underlying pipeline,
  // just two ways to get it, so keeping only email is the clearer product).
  // Calls the Worker's secure PDF pipeline (cloudflare/orchestration/
  // guidePdfHandlers.js) -- entitlement is re-verified server-side on every
  // request, never trusted from this page. Feedback is a dialog, not a
  // toast -- deliberately never auto-dismisses, so "is my guide actually on
  // its way" is never something a user can miss by looking away.

  var PDF_BUSY = false; // guards against double-click firing two requests at once

  function wireToolbar(email) {
    var btn = document.getElementById('kf-send-email-btn');
    if (btn) btn.addEventListener('click', function () { confirmSendGuidePdf(email); });
  }

  // Confirmation step before anything actually sends -- clicking the
  // toolbar button shouldn't immediately fire a real email to the user's
  // inbox with no chance to back out.
  function confirmSendGuidePdf(email) {
    if (!window.SkyUI) return;
    SkyUI.modal({
      title: 'Send to My Email',
      html: '<p class="text-sm text-neutral-600 leading-relaxed">We are about to send the KrisFlyer guide to your email <strong>' + e(email) + '</strong>.</p>',
      dismissible: true,
      actions: [
        { label: 'Cancel' },
        { label: 'Send now', style: 'primary', onClick: function () { requestGuidePdf(); } },
      ],
    });
  }

  function requestGuidePdf() {
    if (PDF_BUSY || !window.SkyUI) return;
    var token = window.KFGuideAuth.getToken();
    if (!token) { window.KFGuideAuth.redirectToPublic('invalid'); return; }

    PDF_BUSY = true;
    var handle = SkyUI.modal({
      title: 'Sending your guide',
      dismissible: true,
      html: _dialogPendingHtml('Sending your guide…'),
    });

    fetch(WORKER + '/guide/pdf/email', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (res) {
        if (res.status === 409) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.message || 'You already downloaded the guide! Please check your email for access. If something is wrong or you have other concerns, contact us.');
          });
        }
        if (res.status === 429) {
          throw new Error('You\'ve hit the request limit for now — please try again in a little while.');
        }
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || 'Something went wrong. Please try again.');
          });
        }
        return res.json().then(function (d) {
          _renderDialogDone(handle, 'success', d.message || 'Check your inbox — your guide and password are on the way.');
        });
      })
      .catch(function (err) {
        _renderDialogDone(handle, 'error', err.message || 'Something went wrong. Please try again.');
      })
      .finally(function () {
        PDF_BUSY = false;
      });
  }

  function _dialogPendingHtml(message) {
    return '<div class="flex flex-col items-center gap-3 py-4 text-center">' +
      '<i class="fa-solid fa-spinner fa-spin text-2xl text-brand-500" aria-hidden="true"></i>' +
      '<p class="text-sm text-neutral-500">' + e(message) + '</p>' +
    '</div>';
  }

  // Swaps the modal's body in place (no close/reopen flicker) into a
  // success or error end-state, each requiring an explicit click to
  // dismiss -- no state here ever auto-closes on its own.
  function _renderDialogDone(handle, kind, message) {
    var body = handle.el.querySelector('.sky-modal__body');
    if (!body) return;
    var isError = kind === 'error';
    body.innerHTML =
      '<div class="flex flex-col items-center gap-3 text-center py-2">' +
        '<div class="w-12 h-12 rounded-full flex items-center justify-center ' + (isError ? 'bg-red-50' : 'bg-brand-50') + '">' +
          '<i class="fa-solid ' + (isError ? 'fa-circle-exclamation text-red-500' : 'fa-circle-check text-brand-600') + ' text-lg" aria-hidden="true"></i>' +
        '</div>' +
        '<p class="text-sm text-neutral-600 leading-relaxed">' + e(message) + '</p>' +
        '<button type="button" class="btn-pill btn-pill-primary w-full justify-center mt-2" data-dialog-dismiss>' + (isError ? 'Close' : 'Done') + '</button>' +
      '</div>';
    var dismissBtn = body.querySelector('[data-dialog-dismiss]');
    if (dismissBtn) dismissBtn.addEventListener('click', function () { handle.close(); });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  function updatePrivateChrome(email) {
    var detail = { email: email || '', product: 'KrisFlyer Guide', plan: 'Guide access' };
    if (window.SkyfarePrivate) window.SkyfarePrivate.setUser(detail);
    window.dispatchEvent(new CustomEvent('skyfare:private-user', { detail: detail }));
  }
})();
