// File: apps/client_unv/src/main.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { AnimatePresence } from "framer-motion";
import App from "./App";
import "./index.css";

// 1. IMPORT REGISTRY & CORE ENGINE
import { manager } from "./pluginRegistry";
import {
  globalScheduler,
  StorageHousekeeper,
} from "../../../packages/core_unv/src/runtime";
import { globalLedger } from "../../../packages/core_unv/src/ledger/UniversalLedger";
import { globalBlobManager } from "../../../packages/core_unv/src/io/BlobManager";
import { globalPruningManager } from "../../../packages/core_unv/src/ledger/PruningManager";
import { EventBus } from "../../../packages/core_unv/src/cqrs/EventBus";
import { globalFileDaemon } from "../../../packages/core_unv/src/io/FileDaemon";
import { globalInboxDaemon } from "../../../packages/core_unv/src/ledger/InboxDaemon";
import { setupClientTasks } from "../../../packages/core_unv/src/runtime/clientTasks";
import { TelemetryEngine } from "../../../packages/core_unv/src/runtime/TelemetryEngine";
import { globalCommandBus } from "../../../packages/core_unv/src/cqrs/CommandBus";
import { DictionaryProjection } from "../../../packages/core_unv/src/dictionary/DictionaryProjection";
import { dictionaryCommandHandlers } from "../../../packages/core_unv/src/dictionary/command-handlers";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { IntegrityChecker } from "../../../packages/core_unv/src/ledger/IntegrityChecker";
import { InitialLoadingScreen } from "./shared-ui/InitialLoadingScreen";
import { getApiUrl } from "../../../packages/core_unv/src/config/env";
import { RuntimeSession } from "../../../packages/core_unv/src/config/session";

// =========================================================================
// AUTO-PURGE DATABASE LOKAL (JIKA SERVER DI-RESET / VIRGIN STATE)
// =========================================================================
async function purgeLocalDataAndRedirect(
  targetUrl: string = "https://alma-client-unv.vercel.app/",
) {
  console.warn(
    "[SYSTEM RESET] Terdeteksi server virgin. Membersihkan storage lokal...",
  );
  try {
    const rxdb = globalLedger.getRxDatabase();
    if (rxdb) {
      await rxdb.remove().catch(() => {});
    }
  } catch {}

  // Hapus database lokal secara fisik
  if (typeof window !== "undefined" && window.indexedDB) {
    indexedDB.deleteDatabase("alma_unv_ledger");
    indexedDB.deleteDatabase("alma_demo_ledger");
    indexedDB.deleteDatabase("ALMA_unv_blob_queue");
  }

  // Bersihkan Sesi LocalStorage
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }

  window.location.href = targetUrl;
}

// =========================================================================
// GLOBAL LOG INTERCEPTOR (PRODUKSI BERSIH & ROUTING KE ACTIVITY DRAWER)
// =========================================================================
const originalError = console.error;
const originalWarn = console.warn;

if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

console.error = (...args: any[]) => {
  const errorMsg = args
    .map((a) =>
      typeof a === "object"
        ? a?.message
          ? a.message
          : JSON.stringify(a)
        : String(a),
    )
    .join(" ");

  try {
    const rxdb = globalLedger.getRxDatabase();
    if (
      rxdb &&
      rxdb.collections.sync_logs &&
      !errorMsg.includes("[SYSTEM LOG ERROR]")
    ) {
      rxdb.collections.sync_logs
        .insert({
          id: `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: "Perhatian Sistem",
          message: errorMsg.substring(0, 200),
          status: "FAILED",
          isRead: false,
          createdAt: Date.now(),
        })
        .catch(() => {});
    }
  } catch {}

  if (import.meta.env.DEV) {
    originalError.apply(console, args);
  }
};

console.warn = (...args: any[]) => {
  const warnMsg = args
    .map((a) =>
      typeof a === "object"
        ? a?.message
          ? a.message
          : JSON.stringify(a)
        : String(a),
    )
    .join(" ");

  try {
    const rxdb = globalLedger.getRxDatabase();
    if (rxdb && rxdb.collections.sync_logs && !warnMsg.includes("RxDB")) {
      rxdb.collections.sync_logs
        .insert({
          id: `WRN_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: "Peringatan Transaksi",
          message: warnMsg.substring(0, 200),
          status: "WARNING",
          isRead: false,
          createdAt: Date.now(),
        })
        .catch(() => {});
    }
  } catch {}

  if (import.meta.env.DEV) {
    originalWarn.apply(console, args);
  }
};

// Registrasi Core Dictionary
globalRegistry.register(new DictionaryProjection());
dictionaryCommandHandlers.forEach((h) => globalCommandBus.register(h));

// Registrasi Scheduler Pemeliharaan Storage Klien
globalScheduler.register({
  id: "daily-storage-housekeeping",
  name: "Daily Pruning & Storage Cleanup",
  type: "daily_midnight",
  enabled: true,
  task: async () => {
    await StorageHousekeeper.executeDailyMaintenance(
      globalLedger,
      globalBlobManager,
      globalPruningManager,
    );
  },
});
globalScheduler.start(60000);

function SystemBootstrapper() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const [bootError, setBootError] = useState("");

  const isSetupRoute =
    typeof window !== "undefined" &&
    (window.location.pathname === "/" ||
      window.location.pathname === "/setup" ||
      window.location.pathname === "/pricing" ||
      window.location.pathname === "/billing");

  useEffect(() => {
    const bootEngine = async () => {
      try {
        RuntimeSession.init();
        // ============================================================
        // 1. GUARD PEMBERSIH MODE DEMO (JIKA TAB PERNAH DITUTUP)
        // ============================================================
        const isDemoMarked = localStorage.getItem("__unv_is_demo") === "true";
        const hasActiveDemoSession = sessionStorage.getItem(
          "__alma_demo_session",
        );

        // Jika localStorage bertanda demo tapi tab sebelumnya sudah ditutup
        if (isDemoMarked && !hasActiveDemoSession) {
          console.warn(
            "[DEMO RESET] Sesi demo telah berakhir. Membersihkan database demo...",
          );
          if (typeof window !== "undefined" && window.indexedDB) {
            indexedDB.deleteDatabase("alma_demo_ledger");
          }
          localStorage.clear();
          window.location.href = "/";
          return;
        }

        // ============================================================
        // 2. PENGECEKAN PRESISI: SERVER VIRGIN VS SERVER OFFLINE
        // Hanya dieksekusi untuk aplikasi riil (dilewati saat mode demo)
        // ============================================================
        const localToken = localStorage.getItem("__unv_deviceToken");
        if (!isDemoMarked && localToken && navigator.onLine) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(getApiUrl("/api/provision/system-status"), {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const statusData = await res.json();
              // Server ONLINE dan database-nya kosong (Virgin State)
              if (statusData.isVirgin === true) {
                await purgeLocalDataAndRedirect(
                  "https://alma-client-unv.vercel.app/",
                );
                return;
              }
            }
          } catch (netErr) {
            // Server OFFLINE atau timeout: Jangan hapus data, biarkan mode offline bekerja
            console.info(
              "[BOOT] Server tidak dapat dihubungi, melanjutkan mode OFFLINE-FIRST.",
            );
          }
        }

        // 3. BOOTING ENGINE UTAMA
        await manager.boot();
        await EventBus.bootAndReplay();
        globalFileDaemon.start();
        globalInboxDaemon.start();
        TelemetryEngine.startDaemon();
        setupClientTasks();
        IntegrityChecker.verifyChain();

        // ============================================================
        // 4. SENSOR STEMPEL UNIVERSAL (SYNC EPOCH) OTOMATIS SAAT BOOT
        // ============================================================
        const hasDevice = !!localStorage.getItem("__unv_deviceToken");
        const isDemoMode = localStorage.getItem("__unv_is_demo") === "true";

        // Hanya periksa jika bukan mode demo, perangkat sudah terdaftar, dan ada koneksi
        if (hasDevice && !isDemoMode && navigator.onLine) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const epochRes = await fetch(
              getApiUrl("/api/system-health/sync-epoch"),
              {
                signal: controller.signal,
              },
            );
            clearTimeout(timeoutId);

            if (epochRes.ok) {
              const epochData = await epochRes.json();
              const serverEpoch = Number(epochData.epoch || 0);
              const localEpoch = Number(
                localStorage.getItem("__unv_sync_epoch") || 0,
              );

              // Jika perangkat belum memiliki stempel atau stempel server lebih baru:
              // Otomatis reset total database lokal dan tarik data baru yang sah!
              if (serverEpoch > 0 && serverEpoch > localEpoch) {
                console.log(
                  `[STEMPEL UNIVERSAL] Terdeteksi versi server (${serverEpoch}) lebih baru dari lokal (${localEpoch}). Melakukan sinkronisasi masal otomatis...`,
                );
                await EventBus.executeSafeLocalResync();
                localStorage.setItem("__unv_sync_epoch", String(serverEpoch));
                console.log(
                  "[STEMPEL UNIVERSAL] Database lokal berhasil diperbarui & stempel tersimpan.",
                );
              }
            }
          } catch (epochErr) {
            // Jika koneksi timeout / server offline, jangan hentikan operasional kasir (Offline-First)
            console.info(
              "[STEMPEL UNIVERSAL] Server tidak dapat dihubungi, kasir tetap berjalan dengan data lokal.",
            );
          }
        }

        setIsEngineReady(true);
      } catch (error: any) {
        setBootError(error.message || "Gagal memuat Universal Engine");
      }
    };
    bootEngine();
  }, []);

  if (bootError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans">
        <p className="font-bold text-rose-400">ERROR: {bootError}</p>
      </div>
    );
  }

  // Jika membuka landing page atau setup wizard, langsung tampilkan tanpa loading bar panjang
  if (isSetupRoute) {
    return <App />;
  }

  const showApp = isEngineReady && isIntroFinished;

  return (
    <>
      <AnimatePresence mode="wait">
        {!isIntroFinished && (
          <InitialLoadingScreen
            key="intro-screen"
            onFinish={() => setIsIntroFinished(true)}
            duration={2.5}
          />
        )}
      </AnimatePresence>
      {showApp && <App />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SystemBootstrapper />
  </React.StrictMode>,
);

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker aktif:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Gagal mendaftarkan Service Worker:", err);
      });
  });
}

export { manager };
