// File: apps/client_unv/public/sw.js
const CACHE_NAME = "alma-erp-cache-v2"; // Naik ke v2 agar otomatis membersihkan cache lama

// 1. Install Event (Pre-cache index.html agar rute SPA selalu siap offline)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/index.html"]).catch(() => {});
    }),
  );
  self.skipWaiting();
});

// 2. Activate Event (Bersihkan cache usang jika ada pembaruan versi)
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

// 3. Fetch Event (Network First dengan Jaminan Return Objek Response Sah)
self.addEventListener("fetch", (event) => {
  // Abaikan protokol non-http (seperti chrome-extension)
  if (!event.request.url.startsWith("http")) return;

  // Abaikan socket.io dan panggilan API backend agar langsung ke jaringan nyata
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
        // Simpan salinan response statis yang valid ke cache
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);

        // 1. Coba cari file yang diminta di cache lokal
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Jika rute navigasi SPA (seperti /integrasi/whatsapp), sajikan index.html
        if (event.request.mode === "navigate") {
          const cachedIndex =
            (await cache.match("/index.html")) || (await cache.match("/"));
          if (cachedIndex) {
            return cachedIndex;
          }
        }

        // 3. JARING PENGAMAN: Wajib selalu mengembalikan objek Response (Anti-Crash)
        return new Response("Mode Offline ALMA - Halaman belum ter-cache.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
