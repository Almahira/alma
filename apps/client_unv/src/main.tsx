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
        await manager.boot();
        await EventBus.bootAndReplay();
        globalFileDaemon.start();
        globalInboxDaemon.start();
        TelemetryEngine.startDaemon();
        setupClientTasks();
        IntegrityChecker.verifyChain();
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

export { manager };
