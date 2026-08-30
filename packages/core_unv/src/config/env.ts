// File: packages/core_unv/src/config/env.ts

/**
 * Mengambil URL Server Backend secara dinamis dengan fallback bertingkat:
 * 1. LocalStorage Override (__unv_serverUrl)
 * 2. Vite Environment Variable (VITE_SERVER_URL)
 * 3. Dynamic Hostname & Reverse Proxy Detection
 * 4. Default Localhost Fallback
 */
export function getServerUrl(): string {
  if (typeof window !== "undefined") {
    // 1. Cek konfigurasi manual lokal
    const customUrl = localStorage.getItem("__unv_serverUrl");
    if (customUrl) return customUrl.replace(/\/+$/, "");

    // 2. Cek Vite ENV
    const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");

    // 3. Deteksi Hostname Browser Otomatis
    if (window.location && window.location.hostname) {
      const protocol = window.location.protocol || "http:";
      const hostname = window.location.hostname;
      const port = window.location.port;

      // Jika berjalan di cloud / domain publik (port 80 / 443), gunakan origin saat ini
      if (!port || port === "80" || port === "443") {
        return window.location.origin;
      }

      // Jika mode development lokal (misal: client di port 3010), arahkan ke backend port 5000
      return `${protocol}//${hostname}:5000`;
    }
  }

  // 4. Default Node / SSR / Local Dev Fallback
  return "http://localhost:5000";
}

export function getApiUrl(path: string): string {
  const base = getServerUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
