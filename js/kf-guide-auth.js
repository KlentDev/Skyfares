// kf-guide-auth.js — the JWT/magic-link/entitlement dance shared by every
// KrisFlyer Guide private page (the dashboard, and now the reader page).
// Extracted out of js/kf-guide-portal.js (which had this logic private to
// itself) so a second page doesn't need to duplicate ~90 lines of auth flow.
// Pure extraction -- no behavior change from what kf-guide-portal.js already did.
window.KFGuideAuth = (function () {
  var WORKER  = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var JWT_KEY = 'altitude_jwt'; // shared with js/altitude.js / js/altitude-portal.js -- one login covers both products

  function getToken() {
    try { return localStorage.getItem(JWT_KEY) || null; } catch (_) { return null; }
  }

  function setToken(t) {
    try { localStorage.setItem(JWT_KEY, t); } catch (_) {}
  }

  function clearToken() {
    try { localStorage.removeItem(JWT_KEY); } catch (_) {}
  }

  // No JWT and no magic token at all -- nothing to show an anonymous
  // visitor, bounce back to the marketing page. Every private page in this
  // guide lives in the same pages/private-pages/ directory, so the relative
  // path back out is identical regardless of which page called this.
  function redirectToPublic(reason) {
    window.location.replace('../krisflyer-guide.html' + (reason ? '?loginError=' + encodeURIComponent(reason) : ''));
  }

  function signOut() {
    clearToken();
    window.location.href = '../krisflyer-guide.html';
  }

  function handleMagicCallback(magic, callbacks) {
    fetch(WORKER + '/altitude/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magic }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        history.replaceState(null, '', location.pathname + location.search.replace(/[?&]magic=[^&]*/, '').replace(/^&/, '?'));
        if (res.ok && res.data.token) {
          setToken(res.data.token);
          checkGuideAccess(res.data.token, null, callbacks);
        } else {
          redirectToPublic('invalid');
        }
      })
      .catch(function () {
        redirectToPublic('network');
      });
  }

  function checkGuideAccess(token, fallbackMagic, callbacks) {
    fetch(WORKER + '/altitude/verify?target=guide', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.granted) {
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.markVerified('guide');
          callbacks.onUnlocked(res.data.email, token);
        } else if ((res.data.reason === 'not_authenticated' || res.data.reason === 'session_expired') && fallbackMagic) {
          handleMagicCallback(fallbackMagic, callbacks);
        } else if (res.data.reason === 'not_authenticated' || res.data.reason === 'session_expired') {
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.invalidate('guide');
          redirectToPublic('invalid');
        } else {
          // Valid login, but this account has no Guide purchase (e.g. an
          // Altitude-only member who reused a shared token) -- don't clear
          // their token, just send them back, they may still be a valid
          // Altitude member elsewhere. Do drop the cached "guide verified"
          // flag though, if one exists -- it's demonstrably wrong now (this
          // real check just denied it), and leaving it would keep skipping
          // straight past the verify-access modal into this same silent
          // bounce on every future click for the rest of its 24h window.
          if (window.SkyfareAccessCache) window.SkyfareAccessCache.invalidate('guide');
          redirectToPublic('noaccess');
        }
      })
      .catch(function () {
        if (fallbackMagic) {
          handleMagicCallback(fallbackMagic, callbacks);
        } else {
          redirectToPublic('network');
        }
      });
  }

  /**
   * @param {{ onUnlocked: function(email, token) }} callbacks
   */
  function init(callbacks) {
    var token = getToken();
    var magic = new URLSearchParams(location.search).get('magic');
    if (token) {
      checkGuideAccess(token, magic, callbacks);
    } else if (magic) {
      handleMagicCallback(magic, callbacks);
    } else {
      redirectToPublic();
    }
  }

  return {
    WORKER: WORKER,
    init: init,
    getToken: getToken,
    clearToken: clearToken,
    signOut: signOut,
    redirectToPublic: redirectToPublic,
  };
})();
