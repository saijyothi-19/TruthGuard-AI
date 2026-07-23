// Self-destructing PWA Service Worker to prevent stale index.html cache loops

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear all caches
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => {
      // Unregister self
      return self.registration.unregister();
    }).then(() => {
      // Reload all active clients
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        if (client.navigate) {
          client.navigate(client.url);
        }
      });
    })
  );
});
