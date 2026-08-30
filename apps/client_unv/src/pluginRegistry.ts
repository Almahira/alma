// File: apps/client_unv/src/pluginRegistry.ts
import { PluginManager } from "../../../packages/core_unv/src/plugin/PluginManager";
import { ClientPlugin } from "../../../packages/core_unv/src/plugin/types";

// Import seluruh manifest modul bisnis
import { OrganizationPlugin } from "../../../modules/mdl_organization/src/index";
import { ItemPlugin } from "../../../modules/mdl_item/src/index";
import { VendorPlugin } from "../../../modules/mdl_vendor/src/index";
import { ReceivingPlugin } from "../../../modules/mdl_receiving/src/index";
import { PlusalesPlugin } from "../../../modules/mdl_plusales/src/index";
import { WarehousePlugin } from "../../../modules/mdl_warehouse/src/index";
import { ExecutivePanelPlugin } from "../../../modules/mdl_executivepanel/src/index";

export const manager = new PluginManager<ClientPlugin>();

// Daftarkan seluruh plugin ke dalam registry
manager.register(OrganizationPlugin);
manager.register(ItemPlugin);
manager.register(VendorPlugin);
manager.register(ReceivingPlugin);
manager.register(PlusalesPlugin);
manager.register(WarehousePlugin);
manager.register(ExecutivePanelPlugin);
