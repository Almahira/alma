// File: modules/mdl_vendor/src/index.ts
import React from "react";
import { Truck } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { VendorProjection } from "./shared/VendorProjection";
import { vendorHandlers } from "./server/event-handlers";
import { vendorCommandHandlers } from "./client/command-handlers";
import { VendorPage } from "./client/VendorPage";

export const VendorPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_vendor",
  version: "1.0.0",

  // ---> METADATA AUTO-DISCOVERY UNTUK SETUP WIZARD <---
  displayName: "Manajemen Vendor & Supplier",
  description: "Pangkalan Data Pemasok, Kontak Sales, dan Rekening Pembayaran",
  icon: React.createElement(Truck, { className: "w-5 h-5 text-orange-500" }),
  isCore: false,

  onRegister: () => {
    globalRegistry.register(new VendorProjection());
    console.log("[MDL_VENDOR] Proyeksi Vendor terdaftar.");
  },

  // Menyediakan daftar proyeksi untuk didaftarkan otomatis oleh PluginManager
  registerProjections: () => [new VendorProjection()],

  // Tiket Menu Navigasi (Sidebar)
  registerUIMenu: () => [
    {
      id: "mdl_vendor",
      label: "Pemasok & Pembelian",
      icon: React.createElement(Truck),
      order: 3,
      children: [
        {
          id: "vendor_master",
          label: "Data Vendor",
          path: "/master/vendor",
        },
      ],
    },
  ],

  // Tiket Rute Router dengan Context ID untuk Lifecycle Memory Manager
  registerUIRoutes: () => [
    {
      path: "/master/vendor",
      element: React.createElement(VendorPage),
      contextId: "mdl_vendor", // Otomasi pembersihan memori RAM saat navigasi
    },
  ],

  registerCommandHandlers: () => {
    return vendorCommandHandlers;
  },

  registerEventHandlers: () => {
    return vendorHandlers;
  },

  onEnable: () => {
    console.log("[MDL_VENDOR] Modul Aktif.");
  },

  onDisable: () => {
    console.log("[MDL_VENDOR] Non-aktif.");
  },
};
