// Self-destructing Service Worker to immediately clear active cache and loops
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Reload all opened clients to ensure clean state
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.navigate(client.url);
        });
      });
    })
  );
});

// Fallback fetch: straight to network
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
