/* global self, caches, clients */

// The production build stamps this token with build-info.json's buildId.
// Changing the worker bytes on every release is what makes installed PWAs
// discover the new worker instead of remaining on an older application shell.
const CACHE_VERSION = '2026-07-18-r31-r34-ds17-__REPTRACK_BUILD_ID__';
const STATIC_CACHE = `reptrack-static-v${CACHE_VERSION}`;
const PAGES_CACHE = `reptrack-pages-v${CACHE_VERSION}`;
const CACHE_NAMES = [STATIC_CACHE, PAGES_CACHE];
const SHELL_PATHS = [
  './',
  './index.html',
  './manifest.json',
  './reptrack-192.png',
  './reptrack-512.png',
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  return (
    host.includes('supabase') ||
    path.includes('/supabase/') ||
    path.includes('/api/') ||
    path.includes('/auth/v1/') ||
    path.includes('/rest/v1/') ||
    path.includes('/storage/v1/') ||
    path.includes('/functions/v1/') ||
    request.headers.has('authorization')
  );
}

function isHashedAssetRequest(request) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    isSameOrigin(url) &&
    /\/static\/(?:js|css|media)\/[^/]+\.[a-f0-9]{8,}\./i.test(url.pathname)
  );
}

function isBuildInfoRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && isSameOrigin(url) && url.pathname.endsWith('/build-info.json');
}

function isHtmlResponse(response) {
  return Boolean(response?.ok && response.headers.get('Content-Type')?.includes('text/html'));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName, { requireHtml = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && (!requireHtml || isHtmlResponse(response))) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && (!requireHtml || isHtmlResponse(cached))) return cached;

    if (requireHtml) {
      const shell = await cache.match('./index.html') || await caches.match('./index.html');
      if (shell && isHtmlResponse(shell)) return shell;
    }
    throw error;
  }
}

async function deleteOldCaches() {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith('reptrack-') && !CACHE_NAMES.includes(name))
    .map((name) => caches.delete(name)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then((cache) => cache.addAll(SHELL_PATHS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteOldCaches()
      .then(() => clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'REPTRACK_SW_KILL_SWITCH') {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names
          .filter((name) => name.startsWith('reptrack-'))
          .map((name) => caches.delete(name))))
        .then(() => self.registration.unregister())
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || isApiRequest(request)) return;

  if (isHashedAssetRequest(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isBuildInfoRequest(request)) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, { requireHtml: true }));
  }
});
