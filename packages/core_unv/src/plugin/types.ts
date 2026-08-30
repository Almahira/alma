// File: packages/core_unv/src/plugin/types.ts
import { CommandHandler, EventUpcaster } from "../cqrs/types";
import { UILifecycle } from "../runtime/types";

export interface PluginDependency {
  name: string;
  required: boolean;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
}

export interface MenuConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  group?: string;
  order?: number;
  path?: string;
  children?: MenuItemConfig[];
}

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  contextId?: string;
  lifecycle?: UILifecycle;
}

export interface DictionaryCategory {
  id: string;
  label: string;
}

export interface UniversalPlugin {
  name: string;
  version: string;
  dependencies?: PluginDependency[];
  onRegister?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
}

export interface ClientPlugin extends UniversalPlugin {
  /** Nama ramah pengguna untuk tampilan kartu di Setup Wizard (Contoh: "Katalog & Stok Barang") */
  displayName?: string;
  /** Deskripsi singkat fungsi modul */
  description?: string;
  /** Ikon React untuk modul (Lucide Icon) */
  icon?: React.ReactNode;
  /** Jika true, modul wajib aktif dan tidak bisa di-uncheck (misal: mdl_organization) */
  isCore?: boolean;

  registerUIRoutes?: () => RouteConfig[];
  registerUIMenu?: () => MenuConfig[];
  registerProjections?: () => any[];
  registerCommandHandlers?: () => CommandHandler[];
  registerDictionaries?: () => DictionaryCategory[];
  registerUpcasters?: () => EventUpcaster[];
}

export interface ServerPlugin extends UniversalPlugin {
  registerApiRoutes?: () => any;
  registerDrizzleSchema?: () => any;
  registerEventHandlers?: () => any;
}
