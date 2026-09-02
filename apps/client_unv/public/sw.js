// File: apps/client_unv/public/sw.js
const CACHE_NAME = "alma-erp-cache-v1";

// Install Event
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate Event (Bersihkan cache usang jika ada pembaruan versi)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch Event (Network First dengan Offline Fallback)
self.addEventListener("fetch", (event) => {
  // Abaikan request socket.io, chrome-extension, dan API backend agar tidak tertahan cache
  const url = event.request.url;
  if (
    url.includes("/socket.io/") ||
    url.includes("/api/") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Simpan salinan response statis ke cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Jika offline, ambil dari cache lokal
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Jika rute navigasi HTML yang diminta offline, sajikan halaman utama
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      }),
  );
});
