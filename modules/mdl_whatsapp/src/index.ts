// File: modules/mdl_whatsapp/src/index.ts
import React from "react";
import { MessageSquare } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { WhatsAppPage } from "./client/WhatsAppPage";

export const WhatsAppPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_whatsapp",
  version: "1.0.0",
  displayName: "WhatsApp Gateway",
  description: "Integrasi Chat WhatsApp Multi-Device Realtime",
  icon: React.createElement(MessageSquare, {
    className: "w-5 h-5 text-emerald-500",
  }),
  isCore: false,

  onRegister: () => {
    console.log("[MDL_WHATSAPP] Modul diregistrasi (Mode Standalone Chat).");
  },

  registerUIMenu: () => [
    {
      id: "mdl_whatsapp",
      label: "WhatsApp Gateway",
      icon: React.createElement(MessageSquare),
      order: 7,
      children: [
        {
          id: "wa_main",
          label: "Pusat Pesan WA",
          path: "/integrasi/whatsapp",
        },
      ],
    },
  ],

  registerUIRoutes: () => [
    {
      path: "/integrasi/whatsapp",
      element: React.createElement(WhatsAppPage),
      contextId: "mdl_whatsapp",
    },
  ],

  // Kosongkan hook CQRS karena modul ini beroperasi menggunakan arsitektur service standar
  registerProjections: () => [],
  registerCommandHandlers: () => [],
  registerValidationRules: () => [],
  registerEventHandlers: () => ({}),

  onEnable: () => console.log("[MDL_WHATSAPP] Modul Aktif."),
  onDisable: () => console.log("[MDL_WHATSAPP] Non-aktif."),
};
