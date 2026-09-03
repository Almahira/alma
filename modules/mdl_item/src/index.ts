// File: modules/mdl_item/src/index.ts
import React from "react";
import { Package, Tags } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ItemProjection } from "./shared/ItemProjection";
import { itemHandlers } from "./server/event-handlers";
import { itemCommandHandlers } from "./client/command-handlers";
import { ItemPage } from "./client/ItemPage";

export const ItemPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_item",
  version: "1.0.0",

  // ---> METADATA AUTO-DISCOVERY UNTUK SETUP WIZARD <---
  displayName: "Katalog & Stok Barang",
  description: "Manajemen Master Produk, SKU, Harga, dan Kategori",
  icon: React.createElement(Package, { className: "w-5 h-5 text-orange-500" }),
  isCore: false, // Modul operasional (dapat dicentang/di-uncheck sesuai peran mesin)

  onRegister: () => {
    globalRegistry.register(new ItemProjection());
    console.log("[MDL_ITEM] Proyeksi Item terdaftar.");
  },

  // Menyediakan daftar proyeksi untuk didaftarkan otomatis oleh PluginManager
  registerProjections: () => [new ItemProjection()],

  // Tiket Menu Navigasi (Sidebar)
  registerUIMenu: () => [
    {
      id: "mdl_item",
      label: "Katalog & Produk",
      icon: React.createElement(Package),
      order: 2,
      children: [
        {
          id: "item_master",
          label: "Master Item",
          path: "/master/item",
          icon: React.createElement(Tags),
        },
      ],
    },
  ],

  // Tiket Rute Router dengan Context ID untuk Lifecycle Memory Manager
  registerUIRoutes: () => [
    {
      path: "/master/item",
      element: React.createElement(ItemPage),
      contextId: "mdl_item",
    },
  ],

  registerCommandHandlers: () => {
    return itemCommandHandlers;
  },

  registerValidationRules: () => [
    {
      commandType: "CREATE_PRODUCT",
      targetAggregate: "ITEM_DOMAIN",
      collectionKey: "products",
      matchFields: ["name"],
      scopeBy: ["companyId"],
      customFilter: (existing, payload) =>
        Boolean(existing.isExpense) === Boolean(payload.isExpense),
      errorMessage:
        "Item/Jasa dengan nama ini sudah terdaftar di katalog perusahaan!",
    },
    {
      commandType: "UPDATE_PRODUCT",
      targetAggregate: "ITEM_DOMAIN",
      collectionKey: "products",
      matchFields: ["name"],
      scopeBy: ["companyId"],
      customFilter: (existing, payload) =>
        Boolean(existing.isExpense) === Boolean(payload.isExpense),
      errorMessage: "Nama produk/jasa tersebut sudah digunakan oleh item lain!",
    },
    {
      commandType: "CREATE_CATEGORY",
      targetAggregate: "ITEM_DOMAIN",
      collectionKey: "categories",
      matchFields: ["name"],
      errorMessage: "Kategori dengan nama ini sudah ada!",
    },
    {
      commandType: "CREATE_UOM",
      targetAggregate: "ITEM_DOMAIN",
      collectionKey: "uoms",
      matchFields: ["name"],
      errorMessage: "Satuan (UOM) dengan nama ini sudah ada!",
    },
  ],

  registerEventHandlers: () => {
    return itemHandlers;
  },

  onEnable: () => {
    console.log("[MDL_ITEM] Modul Aktif.");
  },

  onDisable: () => {
    console.log("[MDL_ITEM] Non-aktif.");
  },
};
