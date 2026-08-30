// File: modules/mdl_plusales/src/index.ts
import React from "react";
import { Wallet } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { PlusalesProjection } from "./shared/PlusalesProjection";
import { plusalesHandlers } from "./server/event-handlers";
import { plusalesCommandHandlers } from "./client/command-handlers";
import { PlusalesPage } from "./client/PlusalesPage";

export const PlusalesPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_plusales",
  version: "1.0.0",
  displayName: "Rekap Penjualan & Timbangan POS",
  description: "Rekonsiliasi Omset, Settlement Non-Tunai, dan Kas Harian MOD",
  icon: React.createElement(Wallet, { className: "w-5 h-5 text-orange-500" }),
  isCore: false,

  onRegister: () => {
    globalRegistry.register(new PlusalesProjection());
    console.log("[MDL_PLUSALES] Proyeksi Rekap Penjualan terdaftar.");
  },
  registerProjections: () => [new PlusalesProjection()],
  registerUIMenu: () => [
    {
      id: "mdl_plusales",
      label: "Rekap Penjualan",
      icon: React.createElement(Wallet),
      order: 5,
      children: [
        {
          id: "plusales_main",
          label: "Timbangan Kas POS",
          path: "/transaksi/plusales",
        },
      ],
    },
  ],
  registerUIRoutes: () => [
    {
      path: "/transaksi/plusales",
      element: React.createElement(PlusalesPage),
      contextId: "mdl_plusales",
    },
  ],
  registerCommandHandlers: () => plusalesCommandHandlers,
  registerEventHandlers: () => plusalesHandlers,
  onEnable: () => console.log("[MDL_PLUSALES] Modul Aktif."),
  onDisable: () => console.log("[MDL_PLUSALES] Non-aktif."),
};
