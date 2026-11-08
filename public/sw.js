// DBIT PageCraft - Service Worker
// Strategy:
//   - App shell (HTML, CSS, JS, assets) -> Cache first, then network
//   - CDN libraries -> Cache first (they are versioned and won't change)
//   - /api/* -> Network only (analytics + admin must reach the server)
//   - Google Fonts -> Cache first
//
// Bump CACHE_NAME whenever a precached file (or its ?v= version) changes.

const CACHE_NAME = 'dbit-pagecraft-v5';
const OFFLINE_PAGE = '/404.html';

// Resources to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/project-report',
  '/project-report.html',
  '/admin',
  '/admin.html',
  '/404.html',
  // Keep these ?v= values identical to the <script>/<link> tags in the HTML,
  // otherwise the precached entry is never matched.
  '/css/styles.css?v=17',
  '/css/project-report-styles.css?v=4',
  '/js/script.js?v=18',
  '/js/project-report-script.js?v=6',
  '/js/admin.js?v=1',
  '/js/analytics.js?v=1',
  '/js/word-export.js?v=2',
  '/js/form-cache.js?v=1',
  '/js/email-gate.js?v=1',
  '/js/pwa.js?v=1',
  '/assets/dblogo.png',
  '/assets/VTU.png',
  '/assets/wayanamac.jpg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable.png',
  '/manifest.json',
  // CDN libraries - cache on install so the app works offline
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/html-docx-js@0.3.1/dist/html-docx.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual adds so one 404 doesn't fail the whole install
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to pre-cache:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Our own API - always go to network, never cache
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return; // let browser handle it normally
  }

  // 2. Non-GET requests (POST, etc.) - pass through
  if (request.method !== 'GET') {
    return;
  }

  // 3. Google Fonts CSS - network first, fall back to cache
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // 4. Google Fonts files + CDN libraries - cache first
  if (
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com' ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. Same-origin navigation requests (HTML pages) - network first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 6. All other same-origin assets (CSS, JS, images) - cache first
  event.respondWith(cacheFirst(request));
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

// Cache first: serve from cache if available, otherwise fetch and cache
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Resource unavailable offline.', { status: 503 });
  }
}

// Network first: try network, fall back to cache
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Resource unavailable offline.', { status: 503 });
  }
}

// Network first for navigations, offline fallback page on failure
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: serve the 404/offline page
    return caches.match(OFFLINE_PAGE) ||
      new Response('<h1>You are offline</h1><p>Open DBIT PageCraft when you have a connection to use it.</p>', {
        headers: { 'Content-Type': 'text/html' }
      });
  }
}

// ── Message handler: allow the update toast to trigger skipWaiting ────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
