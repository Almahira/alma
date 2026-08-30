// File: modules/mdl_organization/src/index.ts
import React from "react";
import { Building2 } from "lucide-react";
import {
  ClientPlugin,
  ServerPlugin,
} from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { OrganizationProjection } from "./shared/OrganizationProjection";
import { organizationHandlers } from "./server/event-handlers";
import { organizationCommandHandlers } from "./client/command-handlers";
import { OrganizationPage } from "./client/OrganizationPage";
import { EmployeePage } from "./client/EmployeePage";
import { AccountPage } from "./client/AccountPage";

export const OrganizationPlugin: ClientPlugin & ServerPlugin = {
  name: "mdl_organization",
  version: "2.2.0",
  displayName: "Struktur Organisasi & SDM",
  description: "Manajemen Perusahaan, Cabang, dan Karyawan",
  icon: React.createElement(Building2, {
    className: "w-5 h-5 text-orange-500",
  }),
  isCore: true,

  onRegister: () => {
    globalRegistry.register(new OrganizationProjection());
    console.log("[MDL_ORGANIZATION] Proyeksi Organisasi & HR terdaftar.");
  },
  registerProjections: () => [new OrganizationProjection()],
  registerUIMenu: () => [
    {
      id: "mdl_org",
      label: "Struktur Organisasi",
      icon: React.createElement(Building2),
      order: 1,
      children: [
        {
          id: "org_master",
          label: "Master Organisasi",
          path: "/master/organisasi",
        },
        {
          id: "emp_master",
          label: "Master Karyawan",
          path: "/master/karyawan",
        },
        { id: "account_master", label: "Master Akun", path: "/master/akun" },
      ],
    },
  ],
  registerUIRoutes: () => [
    {
      path: "/master/organisasi",
      element: React.createElement(OrganizationPage),
      contextId: "mdl_organization",
    },
    {
      path: "/master/karyawan",
      element: React.createElement(EmployeePage),
      contextId: "mdl_organization",
    },
    {
      path: "/master/akun",
      element: React.createElement(AccountPage),
      contextId: "mdl_organization",
    },
  ],
  registerCommandHandlers: () => organizationCommandHandlers,
  registerDictionaries: () => [
    { id: "INDUSTRY_TYPE", label: "Tipe Industri (Outlet)" },
  ],
  registerEventHandlers: () => organizationHandlers,
  onEnable: () => console.log("[MDL_ORGANIZATION] Aktif."),
  onDisable: () => console.log("[MDL_ORGANIZATION] Non-aktif."),
};
