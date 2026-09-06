// File: apps/client_unv/src/App.tsx
import React, { useState, useEffect } from "react";
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

// 2. KOMPONEN UI INTI & LIFECYCLE (DESKTOP & SMARTPHONE)
import { UniversalLayout } from "./shared-ui/UniversalLayout";
import { UniversalLayoutSM } from "./shared-ui/UniversalLayoutSM";

// 3. HALAMAN MOBILE KHUSUS SMARTPHONE ("SM")
import { ReceivingPageSM } from "../../../modules/mdl_receiving/src/client/ReceivingPageSM";
import { ItemPageSM } from "../../../modules/mdl_item/src/client/ItemPageSM";
import { PlusalesPageSM } from "../../../modules/mdl_plusales/src/client/PlusalesPageSM";
import { WarehousePageSM } from "../../../modules/mdl_warehouse/src/client/WarehousePageSM";
import { SpoilWastePageSM } from "../../../modules/mdl_warehouse/src/client/SpoilWastePageSM";
import { StockOpnamePageSM } from "../../../modules/mdl_warehouse/src/client/StockOpnamePageSM";
import { RecipePageSM } from "../../../modules/mdl_warehouse/src/client/RecipePageSM";
import { VendorPageSM } from "../../../modules/mdl_vendor/src/client/VendorPageSM";
import { OrganizationPageSM } from "../../../modules/mdl_organization/src/client/OrganizationPageSM";
import { EmployeePageSM } from "../../../modules/mdl_organization/src/client/EmployeePageSM";
import { AccountPageSM } from "../../../modules/mdl_organization/src/client/AccountPageSM";
import { OwnerLedgerPageSM } from "../../../modules/mdl_executivepanel/src/client/OwnerLedgerPageSM";
import { TargetConfigPageSM } from "../../../modules/mdl_executivepanel/src/client/TargetConfigPageSM";

import { LandingPageSM } from "./system-ui/LandingPageSM";
import { SetupWizardSM } from "./system-ui/SetupWizardSM";
import { LoginPageSM } from "./system-ui/LoginPageSM";
import { DataManagerSM } from "./system-ui/DataManagerSM";
import { DiagnostikDashboardSM } from "./system-ui/DiagnostikDashboardSM";

import { DataManager } from "./system-ui/DataManager";
import { DiagnostikDashboard } from "./system-ui/DiagnostikDashboard";
import { ModuleLifecycleWrapper } from "./shared-ui/ModuleLifecycleWrapper";
import ExecutiveDashboard from "./executive-dashboard/ExecutiveDashboard";
import { LandingPage } from "./system-ui/LandingPage";
import { SetupWizard } from "./system-ui/SetupWizard";
import { LoginPage } from "./system-ui/LoginPage";
import SystemMaintenanceDashboard from "./system-ui/maintenance/SystemMaintenanceDashboard";

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

// WADAH UTAMA SELURUH MODUL BISNIS DI DALAM UNIVERSAL LAYOUT (RESPONSIF SMARTPHONE & PC)
function WorkspaceWrapper() {
  const location = useLocation();
  const isProvisioned = !!localStorage.getItem("__unv_deviceToken");
  const hasActiveUser = !!localStorage.getItem("__unv_activeUser");

  // Deteksi Ukuran Layar Klien (Mobile < 640px)
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1. Jika mesin belum terdaftar, arahkan ke Setup Wizard
  if (!isProvisioned) {
    return <Navigate to="/setup" replace />;
  }

  // 2. Jika mesin sudah terdaftar tapi belum ada aktor yang login / shift kasir:
  if (!hasActiveUser) {
    const LoginComponent = isMobile ? LoginPageSM : LoginPage;
    return <LoginComponent onLoginSuccess={() => window.location.reload()} />;
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

  // Pilih Layout: UniversalLayoutSM untuk Smartphone, UniversalLayout untuk PC/Tablet
  const LayoutComponent = isMobile ? UniversalLayoutSM : UniversalLayout;

  return (
    <LayoutComponent menus={dynamicMenus} activeMenuId={currentActiveMenuId}>
      <Routes>
        {/* Rute Khusus Maintenance & SRE Observability */}
        <Route
          path="/system/maintenance"
          element={<SystemMaintenanceDashboard />}
        />
        {/* Rute Fasilitas Sistem Inti */}
        <Route
          path="/almaApp/diagnostik_log"
          element={
            <ModuleLifecycleWrapper contextId="system:diagnostik_log">
              {isMobile ? <DiagnostikDashboardSM /> : <DiagnostikDashboard />}
            </ModuleLifecycleWrapper>
          }
        />
        <Route
          path="/system/data-manager"
          element={
            <ModuleLifecycleWrapper contextId="system:data_manager">
              {isMobile ? <DataManagerSM /> : <DataManager />}
            </ModuleLifecycleWrapper>
          }
        />

        {/* Render Seluruh Rute Modul Dinamis (Dengan Switcher Halaman Khusus Smartphone) */}
        {dynamicRoutes.map((route, idx) => {
          let pageElement = route.element;

          if (isMobile) {
            // 1. Receiving (Penerimaan Barang)
            if (
              route.path === "/transaksi/receiving" ||
              route.path.includes("receiving")
            ) {
              pageElement = <ReceivingPageSM />;
            }
            // 2. Item Master & Katalog
            else if (
              route.pluginName === "mdl_item" ||
              route.path.includes("item")
            ) {
              pageElement = <ItemPageSM />;
            }
            // 3. Plusales (Rekap Penjualan Kasir)
            else if (
              route.pluginName === "mdl_plusales" ||
              route.path.includes("plusales") ||
              route.path.includes("sales")
            ) {
              pageElement = <PlusalesPageSM />;
            }
            // 4. Spoil & Waste
            else if (
              route.path.includes("spoil") ||
              route.path.includes("waste")
            ) {
              pageElement = <SpoilWastePageSM />;
            }
            // 5. Stok Opname
            else if (route.path.includes("opname")) {
              pageElement = <StockOpnamePageSM />;
            }
            // 6. Master Resep & BOM
            else if (
              route.path.includes("resep") ||
              route.path.includes("recipe")
            ) {
              pageElement = <RecipePageSM />;
            }
            // 7. Distribusi Gudang
            else if (
              route.path.includes("distribusi") ||
              route.path.includes("distribution") ||
              route.pluginName === "mdl_warehouse"
            ) {
              pageElement = <WarehousePageSM />;
            }
            // 8. Vendor Pemasok
            else if (
              route.pluginName === "mdl_vendor" ||
              route.path.includes("vendor")
            ) {
              pageElement = <VendorPageSM />;
            }
            // 9. Karyawan & Penugasan
            else if (route.path.includes("employee")) {
              pageElement = <EmployeePageSM />;
            }
            // 10. Akun Pengguna & PIN
            else if (route.path.includes("account")) {
              pageElement = <AccountPageSM />;
            }
            // 11. Organisasi & Hierarki
            else if (
              route.path.includes("organization") ||
              route.pluginName === "mdl_organization"
            ) {
              pageElement = <OrganizationPageSM />;
            }
            // 12. Target & Kuota Biaya
            else if (
              route.path.includes("target") ||
              route.path.includes("kuota")
            ) {
              pageElement = <TargetConfigPageSM />;
            }
            // 13. Buku Kas Pemilik & Deviden
            else if (
              route.path.includes("owner") ||
              route.path.includes("prive") ||
              route.path.includes("ledger") ||
              route.pluginName === "mdl_executivepanel"
            ) {
              pageElement = <OwnerLedgerPageSM />;
            }
          }

          return (
            <Route
              key={idx}
              path={route.path}
              element={
                <ModuleLifecycleWrapper
                  contextId={route.contextId || route.pluginName}
                  lifecycle={route.lifecycle}
                >
                  {pageElement}
                </ModuleLifecycleWrapper>
              }
            />
          );
        })}

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
    </LayoutComponent>
  );
}

export default function App() {
  const isProvisioned =
    typeof window !== "undefined" &&
    !!localStorage.getItem("__unv_deviceToken");

  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const LandingComponent = isMobile ? LandingPageSM : LandingPage;
  const SetupComponent = isMobile ? SetupWizardSM : SetupWizard;

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. CLOUD MARKETING & BILLING PORTAL */}
        <Route
          path="/"
          element={
            isProvisioned ? (
              <Navigate to="/app" replace />
            ) : (
              <LandingComponent />
            )
          }
        />
        <Route path="/pricing" element={<LandingComponent />} />
        <Route path="/billing" element={<LandingComponent />} />

        {/* 2. PORTAL AKTIVASI & SETUP PERANGKAT KASIR */}
        <Route
          path="/setup"
          element={
            <SetupComponent
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
