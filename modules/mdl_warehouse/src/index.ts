// File: modules/mdl_warehouse/src/index.ts
import React from "react";
import { Store, ArrowRightLeft, Scale, Flame, CookingPot } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { WarehouseProjection } from "./shared/WarehouseProjection";
import { warehouseHandlers } from "./server/event-handlers";
import { warehouseCommandHandlers } from "./client/command-handlers";

import { WarehousePage } from "./client/WarehousePage";
import { StockOpnamePage } from "./client/StockOpnamePage";
import { SpoilWastePage } from "./client/SpoilWastePage";
import { RecipePage } from "./client/RecipePage";

export const WarehousePlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_warehouse",
  version: "1.0.0",
  displayName: "Inventori & Gudang",
  description: "Distribusi Divisi, Stok Opname, Spoil & Waste, dan Resep BOM",
  icon: React.createElement(Store, { className: "w-5 h-5 text-orange-500" }),
  isCore: false,

  onRegister: () => {
    globalRegistry.register(new WarehouseProjection());
    console.log("[MDL_WAREHOUSE] Proyeksi Warehouse & Resep terdaftar.");
  },
  registerProjections: () => [new WarehouseProjection()],
  registerUIMenu: () => [
    {
      id: "mdl_warehouse",
      label: "Gudang & Inventori",
      icon: React.createElement(Store),
      order: 6,
      children: [
        {
          id: "warehouse_distribution",
          label: "Distribusi Divisi",
          path: "/gudang/distribusi",
          icon: React.createElement(ArrowRightLeft, { className: "w-4 h-4" }),
        },
        {
          id: "warehouse_opname",
          label: "Stok Opname",
          path: "/gudang/opname",
          icon: React.createElement(Scale, { className: "w-4 h-4" }),
        },
        {
          id: "warehouse_spoil_waste",
          label: "Spoil & Waste",
          path: "/gudang/spoil-waste",
          icon: React.createElement(Flame, { className: "w-4 h-4" }),
        },
        {
          id: "warehouse_recipe",
          label: "Resep Menu (BOM)",
          path: "/gudang/resep",
          icon: React.createElement(CookingPot, { className: "w-4 h-4" }),
        },
      ],
    },
  ],
  registerUIRoutes: () => [
    {
      path: "/gudang/distribusi",
      element: React.createElement(WarehousePage),
      contextId: "mdl_warehouse",
    },
    {
      path: "/gudang/opname",
      element: React.createElement(StockOpnamePage),
      contextId: "mdl_warehouse",
    },
    {
      path: "/gudang/spoil-waste",
      element: React.createElement(SpoilWastePage),
      contextId: "mdl_warehouse",
    },
    {
      path: "/gudang/resep",
      element: React.createElement(RecipePage),
      contextId: "mdl_warehouse",
    },
  ],
  registerCommandHandlers: () => warehouseCommandHandlers,
  registerEventHandlers: () => warehouseHandlers,
  onEnable: () => console.log("[MDL_WAREHOUSE] Aktif."),
  onDisable: () => console.log("[MDL_WAREHOUSE] Non-aktif."),
};
