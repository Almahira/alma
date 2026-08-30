// File: modules/mdl_executivepanel/src/index.ts
import React from "react";
import { Briefcase, Target, Wallet } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ExecutivePanelProjection } from "./shared/ExecutivepanelProjection";
import { executivepanelHandlers } from "./server/event-handlers";
import { executivepanelCommandHandlers } from "./client/command-handlers";

import { TargetConfigPage } from "./client/TargetConfigPage";
import { OwnerLedgerPage } from "./client/OwnerLedgerPage";

export const ExecutivePanelPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_executivepanel",
  version: "1.0.0",
  displayName: "Panel Eksekutif & Owner",
  description:
    "Konfigurasi Target Outlet, Jatah Kuota, Buku Kas Owner, dan Deviden",
  icon: React.createElement(Briefcase, {
    className: "w-5 h-5 text-orange-500",
  }),
  isCore: false,

  onRegister: () => {
    globalRegistry.register(new ExecutivePanelProjection());
    console.log("[MDL_EXECUTIVEPANEL] Proyeksi Executive Panel terdaftar.");
  },
  registerProjections: () => [new ExecutivePanelProjection()],
  registerUIMenu: () => [
    {
      id: "mdl_executivepanel",
      label: "Panel Eksekutif",
      icon: React.createElement(Briefcase),
      order: 1,
      children: [
        {
          id: "executive_target",
          label: "Target & Kuota Outlet",
          path: "/eksekutif/target",
          icon: React.createElement(Target, { className: "w-4 h-4" }),
        },
        {
          id: "executive_owner_ledger",
          label: "Buku Kas Owner & Deviden",
          path: "/eksekutif/owner-ledger",
          icon: React.createElement(Wallet, { className: "w-4 h-4" }),
        },
      ],
    },
  ],
  registerUIRoutes: () => [
    {
      path: "/eksekutif/target",
      element: React.createElement(TargetConfigPage),
      contextId: "mdl_executivepanel",
    },
    {
      path: "/eksekutif/owner-ledger",
      element: React.createElement(OwnerLedgerPage),
      contextId: "mdl_executivepanel",
    },
  ],
  registerCommandHandlers: () => executivepanelCommandHandlers,
  registerEventHandlers: () => executivepanelHandlers,
  onEnable: () => console.log("[MDL_EXECUTIVEPANEL] Aktif."),
  onDisable: () => console.log("[MDL_EXECUTIVEPANEL] Non-aktif."),
};

// Alias export untuk mencegah error casing
export const ExecutivepanelPlugin = ExecutivePanelPlugin;
