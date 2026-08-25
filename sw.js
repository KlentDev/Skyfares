// Skyfare service worker -- installability + reliable repeat visits.
//
// IMPORTANT: this site has no build step, so static filenames never change
// (css/style.css is always css/style.css). Bump CACHE_VERSION any time a
// precached/static file changes (CSS, shared JS, icons, manifest) -- that's
// what forces returning visitors to pick up the new copy. Stale-while-
// revalidate below also self-heals static assets within one extra visit
// even if this bump is forgotten.
const CACHE_VERSION = 'skyfare-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGES_CACHE = CACHE_VERSION + '-pages';
const FONTS_CACHE = CACHE_VERSION + '-fonts';

const OFFLINE_URL = '/offline.html';

// Core app shell -- loaded on (nearly) every page. Precached on install so
// they're available offline from the very first visit.
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/css/style.css',
  '/css/altitude-editorial.css',
  '/js/links.js',
  '/js/header.js',
  '/js/footer.js',
  '/js/cookie-consent.js',
  '/js/error-handler.js',
  '/js/tailwind-config.js',
  '/lib/tailwind/tailwind.min.js',
  '/lib/font-awesome/css/all.min.css',
  '/lib/font-awesome/webfonts/fa-brands-400.woff2',
  '/lib/font-awesome/webfonts/fa-regular-400.woff2',
  '/lib/font-awesome/webfonts/fa-solid-900.woff2',
  '/lib/font-awesome/webfonts/fa-v4compatibility.woff2',
  '/logos/logo.webp',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/images/icons/icon-512-maskable.png',
  '/images/icons/apple-touch-icon.png'
];

// Cross-origin exception list. Everything else cross-origin -- most
// importantly the Worker API at skyfares-altitude.klent-5fa.workers.dev
// (auth, magic-link, Stripe, Airtable, newsletter, entitlements), plus
// analytics/pixel scripts -- is deliberately left untouched below so no
// membership, payment, or account response ever reaches the Cache API.
const CACHEABLE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  // Code/font files anywhere are safe to cache broadly -- small, static,
  // never contain personal or account data.
  if (/\.(css|js|woff2?|ttf)$/.test(pathname)) return true;
  // Images are scoped to icons/logo only -- large marketing photography
  // (images/hero, images/destinations, etc.) is deliberately excluded to
  // avoid bloating the cache for no real "reliable revisit" benefit.
  if (pathname.startsWith('/images/icons/')) return true;
  if (pathname === '/logos/logo.webp') return true;
  return false;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (CACHEABLE_FONT_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(request, FONTS_CACHE));
    }
    return; // Worker API, analytics, pixel, Stripe, etc. -- pass through untouched.
  }

  // Page navigations (all site pages, including the private member portal --
  // safe because portal *data* is fetched client-side from the cross-origin
  // Worker above and is never cached; only the static page shell is).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, OFFLINE_URL));
    return;
  }

  // Static assets (CSS/JS/fonts/icons/logo) anywhere on the site.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Everything else (page photography, etc.) -- default browser HTTP cache.
});
