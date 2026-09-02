// File: apps/client_unv/src/App.tsx
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  MenuConfig,
  RouteConfig,
} from "../../../packages/core_unv/src/plugin/types";
// 1. SINGLETON MANAGER (Single Source of Truth)
import { manager } from "./pluginRegistry";
// 2. KOMPONEN UI INTI & LIFECYCLE
import { UniversalLayout } from "./shared-ui/UniversalLayout";
import { DataManager } from "./system-ui/DataManager";
import { DiagnostikDashboard } from "./system-ui/DiagnostikDashboard";
import { ModuleLifecycleWrapper } from "./shared-ui/ModuleLifecycleWrapper";
import ExecutiveDashboard from "./executive-dashboard/ExecutiveDashboard";
import { LandingPage } from "./system-ui/LandingPage";
import { SetupWizard } from "./system-ui/SetupWizard";

function getAllowedModules(): string[] {
  try {
    const raw = localStorage.getItem("__unv_allowed_modules");
    return raw ? JSON.parse(raw) : ["mdl_organization"];
  } catch {
    return ["mdl_organization"];
  }
}

function getAggregatedMenus(): MenuConfig[] {
  const activePlugins = manager.getActivePlugins();
  const allowedModules = getAllowedModules();
  const menus: MenuConfig[] = [];
  for (const plugin of activePlugins) {
    if (allowedModules.includes(plugin.name) && plugin.registerUIMenu) {
      menus.push(...plugin.registerUIMenu());
    }
  }
  return menus.sort((a, b) => (a.order || 99) - (b.order || 99));
}

function getAggregatedRoutes(): (RouteConfig & { pluginName: string })[] {
  const activePlugins = manager.getActivePlugins();
  const allowedModules = getAllowedModules();
  const routes: (RouteConfig & { pluginName: string })[] = [];
  for (const plugin of activePlugins) {
    if (allowedModules.includes(plugin.name) && plugin.registerUIRoutes) {
      const pluginRoutes = plugin.registerUIRoutes();
      pluginRoutes.forEach((route) => {
        routes.push({
          ...route,
          pluginName: plugin.name,
          contextId: route.contextId || plugin.name,
        });
      });
    }
  }
  return routes;
}

// WADAH UTAMA SELURUH MODUL BISNIS DI DALAM UNIVERSAL LAYOUT
function WorkspaceWrapper() {
  const location = useLocation();
  const isProvisioned = !!localStorage.getItem("__unv_deviceToken");

  // Jika mesin belum terdaftar, arahkan ke Setup Wizard
  if (!isProvisioned) {
    return <Navigate to="/setup" replace />;
  }

  // Khusus Executive Dashboard (Full Screen Mode)
  if (location.pathname.startsWith("/dashboard/executive")) {
    return <ExecutiveDashboard />;
  }

  const dynamicMenus = getAggregatedMenus();
  const dynamicRoutes = getAggregatedRoutes();

  // Tentukan ID menu yang sedang aktif
  const currentActiveMenuId =
    dynamicMenus.find(
      (menu) =>
        menu.path === location.pathname ||
        menu.children?.some((child) => location.pathname.includes(child.path)),
    )?.id ||
    dynamicMenus[0]?.id ||
    "";

  return (
    <UniversalLayout menus={dynamicMenus} activeMenuId={currentActiveMenuId}>
      <Routes>
        {/* Rute Fasilitas Sistem Inti */}
        <Route
          path="/almaApp/diagnostik_log"
          element={
            <ModuleLifecycleWrapper contextId="system:diagnostik_log">
              <DiagnostikDashboard />
            </ModuleLifecycleWrapper>
          }
        />
        <Route
          path="/system/data-manager"
          element={
            <ModuleLifecycleWrapper contextId="system:data_manager">
              <DataManager />
            </ModuleLifecycleWrapper>
          }
        />

        {/* Render Seluruh Rute Modul Dinamis (Tanpa Modifikasi Path) */}
        {dynamicRoutes.map((route, idx) => (
          <Route
            key={idx}
            path={route.path}
            element={
              <ModuleLifecycleWrapper
                contextId={route.contextId || route.pluginName}
                lifecycle={route.lifecycle}
              >
                {route.element}
              </ModuleLifecycleWrapper>
            }
          />
        ))}

        {/* Fallback Redirect untuk Rute /app atau Rute Kosong ke Modul Pertama */}
        <Route
          path="/app"
          element={
            dynamicMenus[0]?.children?.[0]?.path ? (
              <Navigate to={dynamicMenus[0].children[0].path} replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="*"
          element={
            dynamicMenus[0]?.children?.[0]?.path ? (
              <Navigate to={dynamicMenus[0].children[0].path} replace />
            ) : (
              <div className="p-8 text-center text-slate-400 font-bold">
                Halaman tidak ditemukan.
              </div>
            )
          }
        />
      </Routes>
    </UniversalLayout>
  );
}

export default function App() {
  const isProvisioned =
    typeof window !== "undefined" && !!localStorage.getItem("__unv_deviceToken");

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. CLOUD MARKETING & BILLING PORTAL */}
        <Route
          path="/"
          element={
            isProvisioned ? <Navigate to="/app" replace /> : <LandingPage />
          }
        />
        <Route path="/pricing" element={<LandingPage />} />
        <Route path="/billing" element={<LandingPage />} />
        {/* 2. PORTAL AKTIVASI & SETUP PERANGKAT KASIR */}
        <Route
          path="/setup"
          element={
            <SetupWizard
              onComplete={() => (window.location.href = "/master/organization")}
            />
          }
        />
        {/* 3. SEMUA RUANG OPERASIONAL ERP / KASIR (WILDCARD CATCH-ALL) */}
        <Route path="/*" element={<WorkspaceWrapper />} />
      </Routes>
    </BrowserRouter>
  );
}
