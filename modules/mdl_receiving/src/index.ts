// File: modules/mdl_receiving/src/index.ts
import React from "react";
import { ArrowDownToLine } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ReceivingProjection } from "./shared/ReceivingProjection";
import { receivingHandlers } from "./server/event-handlers";
import { receivingCommandHandlers } from "./client/command-handlers";
import { ReceivingPage } from "./client/ReceivingPage";

export const ReceivingPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_receiving",
  version: "1.0.0",

  // ---> METADATA AUTO-DISCOVERY UNTUK SETUP WIZARD <---
  displayName: "Penerimaan Barang (Receiving)",
  description:
    "Pencatatan Penerimaan Barang, Surat Jalan, dan Validasi Tagihan",
  icon: React.createElement(ArrowDownToLine, {
    className: "w-5 h-5 text-orange-500",
  }),
  isCore: false,

  onRegister: () => {
    globalRegistry.register(new ReceivingProjection());
    console.log("[MDL_RECEIVING] Proyeksi Transaksi Receiving terdaftar.");
  },

  // Menyediakan daftar proyeksi untuk didaftarkan otomatis oleh PluginManager
  registerProjections: () => [new ReceivingProjection()],

  // Tiket Menu Navigasi (Sidebar)
  registerUIMenu: () => [
    {
      id: "mdl_transaksi",
      label: "Transaksi Operasional",
      icon: React.createElement(ArrowDownToLine),
      order: 4,
      children: [
        {
          id: "trx_receiving",
          label: "Penerimaan & Tagihan",
          path: "/transaksi/receiving",
        },
      ],
    },
  ],

  // Tiket Rute Router dengan Context ID untuk Lifecycle Memory Manager
  registerUIRoutes: () => [
    {
      path: "/transaksi/receiving",
      element: React.createElement(ReceivingPage),
      contextId: "mdl_receiving", // Otomasi pembersihan memori RAM saat navigasi
    },
  ],

  registerCommandHandlers: () => {
    return receivingCommandHandlers;
  },

  registerEventHandlers: () => {
    return receivingHandlers;
  },

  onEnable: () => {
    console.log("[MDL_RECEIVING] Modul Aktif.");
  },

  onDisable: () => {
    console.log("[MDL_RECEIVING] Non-aktif.");
  },
};
