// File: apps/client_unv/src/shared-ui/ModuleLifecycleWrapper.tsx
import React, { useEffect, useId } from "react";
import { globalSubscriptionManager } from "../../../../packages/core_unv/src/runtime/SubscriptionManager";
import { TelemetryEngine } from "../../../../packages/core_unv/src/runtime/TelemetryEngine";
import { UILifecycle } from "../../../../packages/core_unv/src/runtime/types";

interface ModuleLifecycleWrapperProps {
  contextId: string;
  lifecycle?: UILifecycle;
  children: React.ReactNode;
}

export const ModuleLifecycleWrapper: React.FC<ModuleLifecycleWrapperProps> = ({
  contextId,
  lifecycle,
  children,
}) => {
  useEffect(() => {
    const startTime = performance.now();
    console.log(`[LIFECYCLE] MOUNT: Membuka konteks modul [${contextId}]`);

    // 1. Eksekusi Hook onMount jika disediakan oleh modul
    if (lifecycle?.onMount) {
      try {
        lifecycle.onMount(contextId);
      } catch (err) {
        console.error(
          `[LIFECYCLE ERROR] Gagal menjalankan onMount pada ${contextId}:`,
          err,
        );
      }
    }

    // 2. Cleanup Function (Dijalankan saat komponen unmount / berpindah rute)
    return () => {
      console.log(
        `[LIFECYCLE] UNMOUNT: Meninggalkan konteks modul [${contextId}]`,
      );

      // A. Eksekusi Hook onUnmount kustom modul (jika ada)
      if (lifecycle?.onUnmount) {
        try {
          lifecycle.onUnmount(contextId);
        } catch (err) {
          console.error(
            `[LIFECYCLE ERROR] Gagal menjalankan onUnmount pada ${contextId}:`,
            err,
          );
        }
      }

      // B. SAPU BERSIH MEMORI (0 Memory Leak Policy)
      globalSubscriptionManager.releaseAll(contextId);

      // C. Catat Durasi Penggunaan Modul ke Telemetry Engine
      const activeDuration = Math.round(performance.now() - startTime);
      TelemetryEngine.trace("MODULE_VIEW_SESSION", contextId, () => {}, {
        durationMs: activeDuration,
      });
    };
  }, [contextId, lifecycle]);

  return <>{children}</>;
};

/**
 * Hook Helper: Memudahkan komponen di dalam modul untuk mendaftarkan
 * listener RxDB/Socket ke dalam siklus pembersihan otomatis tanpa repot.
 */
export function useModuleLifecycle(moduleContextId: string) {
  const instanceId = useId();
  const fullContext = `${moduleContextId}#${instanceId}`;

  const trackSubscription = (
    sub: { unsubscribe?: () => void; off?: any } | (() => void),
  ) => {
    globalSubscriptionManager.track(moduleContextId, sub);
  };

  return {
    contextId: fullContext,
    trackSubscription,
  };
}
