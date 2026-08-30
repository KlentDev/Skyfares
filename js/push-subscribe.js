/**
 * Skyfare Web Push — subscribe/unsubscribe client, exposing window.SkyfarePush.
 *
 * No path here ever calls Notification.requestPermission() on its own — it
 * only ever runs from a real user action: the header bell (wireHeaderBell,
 * wired by js/private-layout.js once the header partial loads), the global
 * toast's own toggle (maybeShowGlobalToast, self-triggered but the
 * subscribe call itself only fires when the member flips the toggle), or
 * the Membership page's full preferences panel (wirePrefsPanels). Reads the
 * Altitude JWT straight out of localStorage, same key js/altitude.js and
 * js/altitude-portal.js already use, so a signed-in member's subscription is
 * tagged 'altitude' server-side (see cloudflare/orchestration/pushHandlers.js)
 * without this file needing its own auth plumbing.
 *
 * Follows the same singleton-injection idiom as js/chatbot-launcher.js.
 */
(function () {
  if (window.SkyfarePush) return;

  var WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt';
  var ALL_TOPICS = ['award_alert', 'krisflyer_escape', 'premium_newsletter', 'skyfare_announcement', 'service_update'];

  var _publicKeyPromise = null;

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function getPublicKey() {
    if (!_publicKeyPromise) {
      _publicKeyPromise = fetch(WORKER + '/api/push/public-key')
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.publicKey; });
    }
    return _publicKeyPromise;
  }

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function getExistingSubscription() {
    if (!isSupported()) return Promise.resolve(null);
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .catch(function () { return null; });
  }

  /** @returns {Promise<'unsupported'|'denied'|'not-subscribed'|'subscribed'>} */
  function getStatus() {
    if (!isSupported()) return Promise.resolve('unsupported');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    return getExistingSubscription().then(function (sub) {
      return sub ? 'subscribed' : 'not-subscribed';
    });
  }

  function postSubscription(subscription, topics) {
    var json = subscription.toJSON();
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(WORKER + '/api/push/subscribe', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        topics: topics || [],
        userAgent: navigator.userAgent,
      }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
  }

  /**
   * Requests permission, creates the PushManager subscription, and registers
   * it with the Worker. Only call this from an explicit user action (a click
   * handler) -- never on page load.
   * @param {string[]} [topics]
   */
  function subscribe(topics) {
    if (!isSupported()) return Promise.reject(new Error('unsupported'));

    return Notification.requestPermission()
      .then(function (permission) {
        if (permission !== 'granted') throw new Error('permission-denied');
        return getPublicKey();
      })
      .then(function (publicKey) {
        return navigator.serviceWorker.ready.then(function (reg) {
          // A subscription created earlier with a different
          // applicationServerKey (an earlier test, a VAPID key rotation)
          // makes pushManager.subscribe() below throw InvalidStateError --
          // clear it first so this call is always safe to retry.
          return reg.pushManager.getSubscription()
            .then(function (existing) { return existing ? existing.unsubscribe() : null; })
            .then(function () {
              return reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
              });
            });
        });
      })
      .then(function (subscription) {
        return postSubscription(subscription, topics).then(function (res) {
          if (!res.ok) throw new Error((res.data && res.data.error) || 'subscribe-failed');
          return res.data;
        });
      });
  }

  function unsubscribe() {
    return getExistingSubscription().then(function (subscription) {
      if (!subscription) return { ok: true };
      var endpoint = subscription.endpoint;
      return subscription.unsubscribe().then(function () {
        return fetch(WORKER + '/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: endpoint }),
        }).catch(function () {});
      }).then(function () { return { ok: true }; });
    });
  }

  /**
   * Wires a single header bell button (see pages/private-pages/header-private.html)
   * into a toggle: click subscribes to every topic when off, unsubscribes
   * entirely when on. Called explicitly by js/private-layout.js's
   * enhanceHeader() once the header partial has actually been injected --
   * this button doesn't exist in the DOM at DOMContentLoaded time (the
   * header is fetched async), so it can't rely on the same auto-wiring the
   * page-level banners/prefs panel use.
   */
  function wireHeaderBell(btn) {
    if (!btn || btn.dataset.pushBellWired === 'true') return;
    btn.dataset.pushBellWired = 'true';

    function refresh() {
      if (!isSupported()) { btn.hidden = true; return; }
      getStatus().then(function (status) {
        if (status === 'unsupported') { btn.hidden = true; return; }
        btn.hidden = false;
        var subscribed = status === 'subscribed';
        btn.classList.toggle('private-icon-btn--active', subscribed);
        btn.setAttribute('aria-label', subscribed ? 'Notifications on — click to turn off' : 'Enable notifications');
        var icon = btn.querySelector('i');
        if (icon) icon.className = subscribed ? 'fa-solid fa-bell' : 'fa-regular fa-bell';
      });
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      getStatus().then(function (status) {
        if (status === 'subscribed') {
          return unsubscribe().then(function () {
            if (window.SkyUI) SkyUI.toast('Notifications turned off.', { type: 'success' });
          });
        }
        return subscribe(ALL_TOPICS).then(function () {
          if (window.SkyUI) SkyUI.toast('Notifications enabled.', { type: 'success' });
        }).catch(function (err) {
          var msg = err && err.message === 'permission-denied'
            ? 'Notifications are blocked for this site. Enable them in your browser settings first.'
            : 'Could not update notifications. Please try again.';
          if (window.SkyUI) SkyUI.toast(msg, { type: 'error' });
        });
      }).then(function () {
        btn.disabled = false;
        refresh();
      });
    });

    refresh();
  }

  window.SkyfarePush = {
    isSupported: isSupported,
    getStatus: getStatus,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    wireHeaderBell: wireHeaderBell,
  };

  // ─── Declarative UI wiring ────────────────────────────────────────────────
  // Pages opt in by including this script plus the right markup -- no
  // per-page inline script needed.
  //   [data-push-prefs] containing [data-push-topic-checkbox] checkboxes,
  //     [data-push-save], and an optional [data-push-disable] -- the full
  //     preferences panel (membership.html).
  // The global toast below isn't markup-driven -- it's built and appended by
  // JS itself, since it needs to appear on any Altitude page, not just one
  // with a specific placeholder element.

  var TOAST_SESSION_KEY = 'push_toast_shown';
  var TOAST_AUTO_DISMISS_MS = 8000;

  function getToastWrap() {
    var wrap = document.getElementById('sky-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'sky-toast-wrap';
      wrap.className = 'sky-toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function showGlobalToast() {
    var wrap = getToastWrap();

    var el = document.createElement('div');
    el.className = 'push-toast';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<i class="fa-solid fa-bell push-toast__icon" aria-hidden="true"></i>' +
      '<span class="push-toast__msg">Get notified the moment a new Award Alert or KrisFlyer Escape lands.</span>' +
      '<label class="push-toggle">' +
        '<input type="checkbox" class="push-toggle__input" aria-label="Enable notifications">' +
        '<span class="push-toggle__track"><span class="push-toggle__thumb"></span></span>' +
      '</label>' +
      '<button type="button" class="push-toast__close" aria-label="Dismiss"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';

    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('push-toast--in'); });

    var timer;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.classList.remove('push-toast--in');
      el.classList.add('push-toast--out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    function resetTimer() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(dismiss, TOAST_AUTO_DISMISS_MS);
    }

    el.querySelector('.push-toast__close').addEventListener('click', dismiss);

    var toggle = el.querySelector('.push-toggle__input');
    var msgEl = el.querySelector('.push-toast__msg');
    toggle.addEventListener('change', function () {
      if (!toggle.checked) return; // this toast has no "turn off" path -- it only ever offers to enable
      toggle.disabled = true;
      if (timer) clearTimeout(timer);
      subscribe(ALL_TOPICS).then(function () {
        msgEl.textContent = 'Notifications enabled.';
        setTimeout(dismiss, 1500);
      }).catch(function (err) {
        toggle.checked = false;
        toggle.disabled = false;
        var msg = err && err.message === 'permission-denied'
          ? 'Notifications are blocked for this site. Enable them in your browser settings first.'
          : 'Could not enable notifications. Please try again.';
        if (window.SkyUI) SkyUI.toast(msg, { type: 'error' });
        resetTimer();
      });
    });

    resetTimer();
    return el;
  }

  /**
   * Shows the global toast at most once per browser session, and only when
   * there's actually something to offer: an Altitude private page, push
   * genuinely supported, and the member not already subscribed. Session-
   * scoped (sessionStorage, not localStorage) on purpose -- reappears in a
   * fresh tab/session if still not subscribed, rather than nagging on every
   * page navigation within one visit or going quiet forever after one dismiss.
   */
  function maybeShowGlobalToast() {
    if (document.body.getAttribute('data-private-page') !== 'altitude') return;

    var alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(TOAST_SESSION_KEY) === '1'; } catch (_) {}
    if (alreadyShown) return;

    getStatus().then(function (status) {
      if (status !== 'not-subscribed') return;
      try { sessionStorage.setItem(TOAST_SESSION_KEY, '1'); } catch (_) {}
      setTimeout(showGlobalToast, 1200);
    });
  }

  function wirePrefsPanels() {
    var panels = document.querySelectorAll('[data-push-prefs]');
    if (!panels.length) return;

    panels.forEach(function (panel) {
      var statusEl = panel.querySelector('[data-push-status]');
      var saveBtn = panel.querySelector('[data-push-save]');
      var disableBtn = panel.querySelector('[data-push-disable]');
      var checkboxes = panel.querySelectorAll('[data-push-topic-checkbox]');

      function refresh() {
        if (!isSupported()) {
          if (statusEl) statusEl.textContent = 'Push notifications are not supported in this browser.';
          if (saveBtn) saveBtn.disabled = true;
          checkboxes.forEach(function (cb) { cb.disabled = true; });
          return;
        }
        getStatus().then(function (status) {
          if (status === 'denied') {
            if (statusEl) statusEl.textContent = 'Notifications are blocked for this site in your browser settings.';
          } else if (status === 'subscribed') {
            if (statusEl) statusEl.textContent = 'Notifications are on for this device.';
            if (disableBtn) disableBtn.hidden = false;
          } else {
            if (statusEl) statusEl.textContent = 'Notifications are off for this device.';
            if (disableBtn) disableBtn.hidden = true;
          }
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var topics = [];
          checkboxes.forEach(function (cb) { if (cb.checked) topics.push(cb.value); });
          if (!topics.length) {
            if (window.SkyUI) SkyUI.toast('Choose at least one topic, or use "Turn off notifications" instead.', { type: 'error' });
            return;
          }
          saveBtn.disabled = true;
          subscribe(topics).then(function () {
            if (window.SkyUI) SkyUI.toast('Notification preferences saved.', { type: 'success' });
            refresh();
          }).catch(function (err) {
            var msg = err && err.message === 'permission-denied'
              ? 'Notifications are blocked for this site. Enable them in your browser settings first.'
              : 'Could not save preferences. Please try again.';
            if (window.SkyUI) SkyUI.toast(msg, { type: 'error' });
          }).then(function () { saveBtn.disabled = false; });
        });
      }

      if (disableBtn) {
        disableBtn.addEventListener('click', function () {
          disableBtn.disabled = true;
          unsubscribe().then(function () {
            checkboxes.forEach(function (cb) { cb.checked = false; });
            if (window.SkyUI) SkyUI.toast('Notifications turned off.', { type: 'success' });
            refresh();
          }).then(function () { disableBtn.disabled = false; });
        });
      }

      refresh();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    maybeShowGlobalToast();
    wirePrefsPanels();
  });
})();
