// File: apps/client_unv/src/system-ui/maintenance/SystemMaintenanceDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "../../../../../packages/core_unv/src/config/env";
import { PhoneMaintenanceDashboard } from "./PhoneMaintenanceDashboard";
import { TabMaintenanceDashboard } from "./TabMaintenanceDashboard";
import { DesktopMaintenanceDashboard } from "./DesktopMaintenanceDashboard";
import { sysToast } from "../../shared-ui/useToastStore";

export default function SystemMaintenanceDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [urgency, setUrgency] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [quarantine, setQuarantine] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Deteksi Ukuran Layar Responsif
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [ovRes, urgRes, devRes, qRes] = await Promise.all([
        fetch(getApiUrl("/api/system-health/overview"))
          .then((r) => r.json())
          .catch(() => null),
        fetch(getApiUrl("/api/system-health/urgency"))
          .then((r) => r.json())
          .catch(() => null),
        fetch(getApiUrl("/api/system-health/devices"))
          .then((r) => r.json())
          .catch(() => null),
        fetch(getApiUrl("/api/system-health/quarantine"))
          .then((r) => r.json())
          .catch(() => null),
      ]);

      if (ovRes) setOverview(ovRes);
      if (urgRes) setUrgency(urgRes);
      if (devRes && devRes.devices) setDevices(devRes.devices);
      if (qRes && qRes.events) setQuarantine(qRes.events);
    } catch (err: any) {
      console.error("[MAINTENANCE FETCH ERROR]:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto polling setiap 15 detik
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleRetryQuarantine = async (eventId: string) => {
    try {
      const res = await fetch(
        getApiUrl("/api/system-health/quarantine/retry"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      sysToast.success("Berhasil", data.message);
      fetchData();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const handlePurgeQuarantine = async (eventId: string, purgeAll = false) => {
    try {
      const res = await fetch(
        getApiUrl("/api/system-health/quarantine/purge"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, purgeAll }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      sysToast.success("Berhasil", data.message);
      fetchData();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  // 1. Smartphone (< 640px)
  if (windowWidth < 640) {
    return (
      <PhoneMaintenanceDashboard
        urgencyData={urgency}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
        onRetryQuarantine={handleRetryQuarantine}
        onPurgeQuarantine={handlePurgeQuarantine}
      />
    );
  }

  // 2. Tablet 11'' (640px - 1024px)
  if (windowWidth < 1024) {
    return (
      <TabMaintenanceDashboard
        overview={overview}
        devices={devices}
        quarantine={quarantine}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
        onRetryQuarantine={handleRetryQuarantine}
        onPurgeQuarantine={handlePurgeQuarantine}
      />
    );
  }

  // 3. Desktop (> 1024px)
  return (
    <DesktopMaintenanceDashboard
      overview={overview}
      devices={devices}
      quarantine={quarantine}
      onRefresh={fetchData}
      isRefreshing={isRefreshing}
      onRetryQuarantine={handleRetryQuarantine}
      onPurgeQuarantine={handlePurgeQuarantine}
    />
  );
}
