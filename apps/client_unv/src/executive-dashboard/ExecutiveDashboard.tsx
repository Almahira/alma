// File: apps/client_unv/src/executive-dashboard/ExecutiveDashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { usePlusalesStore } from "../../../../modules/mdl_plusales/src/client/store";
import { useReceivingStore } from "../../../../modules/mdl_receiving/src/client/store";
import { useWarehouseStore } from "../../../../modules/mdl_warehouse/src/client/store";
import { useExecutivePanelStore } from "../../../../modules/mdl_executivepanel/src/client/store";
import { useOrgStore } from "../../../../modules/mdl_organization/src/client/store";
import { useVendorStore } from "../../../../modules/mdl_vendor/src/client/store";
import { useItemStore } from "../../../../modules/mdl_item/src/client/store";
import {
  calculateExecutiveFinancials,
  DashboardFilterState,
} from "./utils/dashboardCalculations";
import { DesktopDashboard } from "./desktop_dashboard";
import { TabDashboard } from "./tab_dashboard";
import { PhoneDashboard } from "./phone_dashboard";

export default function ExecutiveDashboard() {
  // 1. Tarik Data Langsung dari In-Memory Projection Store Lokal (Zero HTTP Request)
  const { documents: plusalesDocs } = usePlusalesStore();
  const { documents: receivingDocs } = useReceivingStore();
  const { distributions, spoilWastes } = useWarehouseStore();
  const { targets, allocations, ownerLedgers } = useExecutivePanelStore();
  const { regions, outlets } = useOrgStore();
  const { vendors } = useVendorStore();
  const { categories: itemCategories, products } = useItemStore();

  // 2. Standby Listener untuk Reaktivitas Real-Time
  const [renderTick, setRenderTick] = useState(0);

  useEffect(() => {
    const handleLiveUpdate = () => {
      setRenderTick((tick) => tick + 1);
    };
    // Dengarkan sinyal event bus seketika saat ada transaksi / mutasi baru masuk
    window.addEventListener("UNV_STATE_UPDATED", handleLiveUpdate);
    return () =>
      window.removeEventListener("UNV_STATE_UPDATED", handleLiveUpdate);
  }, []);

  const [filters, setFilters] = useState<DashboardFilterState>({
    month: new Date().toISOString().slice(0, 7),
    regionId: "",
    outletId: "",
    dateStart: "",
    dateEnd: "",
    showTaxService: false,
    devidenPosition: "TOP_NET_SALES",
  });

  // 3. Deteksi Ukuran Layar Otomatis (Responsive Switcher)
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 4. Kalkulasi Finansial Lokal (Otomatis re-kalkulasi setiap state/filter berubah)
  const financials = useMemo(() => {
    return calculateExecutiveFinancials(
      filters,
      plusalesDocs,
      receivingDocs,
      distributions,
      spoilWastes,
      targets,
      allocations,
      ownerLedgers,
      outlets,
      itemCategories,
      products,
    );
  }, [
    renderTick, // Terhitung ulang seketika saat ada event baru
    filters,
    plusalesDocs,
    receivingDocs,
    distributions,
    spoilWastes,
    targets,
    allocations,
    ownerLedgers,
    outlets,
    itemCategories,
    products,
  ]);

  // 5. Tampilan Responsif (Mobile, Tablet, Desktop)
  if (windowWidth < 640) {
    return (
      <PhoneDashboard
        data={financials}
        filters={filters}
        setFilters={setFilters}
        regions={regions}
        outlets={outlets}
        receivingDocs={receivingDocs}
        vendors={vendors}
      />
    );
  }

  if (windowWidth < 1024) {
    return (
      <TabDashboard
        data={financials}
        filters={filters}
        setFilters={setFilters}
        regions={regions}
        outlets={outlets}
        receivingDocs={receivingDocs}
        vendors={vendors}
      />
    );
  }

  return (
    <DesktopDashboard
      data={financials}
      filters={filters}
      setFilters={setFilters}
      regions={regions}
      outlets={outlets}
      receivingDocs={receivingDocs}
      vendors={vendors}
    />
  );
}
