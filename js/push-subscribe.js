/**
 * Skyfare Web Push — subscribe/unsubscribe client, exposing window.SkyfarePush.
 *
 * No path here ever calls Notification.requestPermission() on its own —
 * subscribe() only runs from a real click handler in the pages that use it
 * (award-alerts.html, krisflyer-escapes.html, membership.html). Reads the
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
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
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

  window.SkyfarePush = {
    isSupported: isSupported,
    getStatus: getStatus,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
  };

  // ─── Declarative UI wiring ────────────────────────────────────────────────
  // Pages opt in by including this script plus the right markup -- no
  // per-page inline script needed. Two shapes:
  //   [data-push-banner][data-push-topics="topic_a,topic_b"] -- a dismissible
  //     single-CTA banner (award-alerts.html, krisflyer-escapes.html), hidden
  //     by default in markup and only shown once JS confirms it's worth
  //     showing (supported, not already subscribed, not previously dismissed).
  //   [data-push-prefs] containing [data-push-topic-checkbox] checkboxes,
  //     [data-push-save], and an optional [data-push-disable] -- the full
  //     preferences panel (membership.html).

  function bannerDismissKey(topics) {
    return 'push_banner_dismissed:' + topics.join(',');
  }

  function wireBanners() {
    var banners = document.querySelectorAll('[data-push-banner]');
    if (!banners.length) return;

    getStatus().then(function (status) {
      banners.forEach(function (banner) {
        var topics = (banner.getAttribute('data-push-topics') || '').split(',').filter(Boolean);
        var dismissed = false;
        try { dismissed = localStorage.getItem(bannerDismissKey(topics)) === '1'; } catch (_) {}

        if (status !== 'not-subscribed' || dismissed) return; // stays hidden
        banner.hidden = false;

        var enableBtn = banner.querySelector('[data-push-enable]');
        var dismissBtn = banner.querySelector('[data-push-dismiss]');

        if (enableBtn) {
          var originalLabel = enableBtn.textContent;
          enableBtn.addEventListener('click', function () {
            enableBtn.disabled = true;
            enableBtn.textContent = 'Enabling…';
            subscribe(topics).then(function () {
              if (window.SkyUI) SkyUI.toast('Notifications enabled.', { type: 'success' });
              banner.hidden = true;
            }).catch(function (err) {
              enableBtn.disabled = false;
              enableBtn.textContent = originalLabel;
              var msg = err && err.message === 'permission-denied'
                ? 'Notifications are blocked for this site. Enable them in your browser settings to turn this on.'
                : 'Could not enable notifications. Please try again.';
              if (window.SkyUI) SkyUI.toast(msg, { type: 'error' });
            });
          });
        }

        if (dismissBtn) {
          dismissBtn.addEventListener('click', function () {
            banner.hidden = true;
            try { localStorage.setItem(bannerDismissKey(topics), '1'); } catch (_) {}
          });
        }
      });
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
    wireBanners();
    wirePrefsPanels();
  });
})();
