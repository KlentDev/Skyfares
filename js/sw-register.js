/**
 * Service worker registration. Absolute path so it resolves the same
 * regardless of which directory depth the page lives at.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
