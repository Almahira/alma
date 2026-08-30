// File: packages/core_unv/src/plugin/PluginManager.ts
import { globalCommandBus } from "../cqrs/CommandBus";
import { ClientPlugin, UniversalPlugin } from "./types";
import { globalUpcaster } from "../cqrs/UpcasterRegistry";
import { globalRegistry } from "../cqrs/UniversalRegistry";

export class PluginManager<T extends UniversalPlugin> {
  private plugins = new Map<string, T>();
  private activePlugins = new Set<string>();

  /**
   * Mendaftarkan plugin ke dalam registry (Belum diaktifkan)
   */
  public register(plugin: T): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(
        `[PLUGIN MANAGER] Plugin ${plugin.name} sudah terdaftar. Mengabaikan...`,
      );
      return;
    }
    this.plugins.set(plugin.name, plugin);
    console.log(
      `[PLUGIN MANAGER] Registered: ${plugin.name} v${plugin.version}`,
    );
  }

  /**
   * Mengambil SELURUH plugin yang sudah terdaftar di registry
   * (Digunakan oleh Setup Wizard untuk Auto-Discovery modul)
   */
  public getAllPlugins(): T[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Booting seluruh plugin yang sudah terdaftar.
   * Melakukan dependency resolution dan soft-graceful degradation.
   */
  public async boot(): Promise<void> {
    console.log("[PLUGIN MANAGER] Memulai proses booting modul...");

    // 1. Eksekusi onRegister untuk semua plugin
    for (const plugin of this.plugins.values()) {
      if (plugin.onRegister) {
        await plugin.onRegister();
      }
      const clientPlugin = plugin as ClientPlugin;
      if (clientPlugin.registerCommandHandlers) {
        const cmdHandlers = clientPlugin.registerCommandHandlers();
        cmdHandlers.forEach((h) => globalCommandBus.register(h));
      }

      if (clientPlugin.registerUpcasters) {
        clientPlugin
          .registerUpcasters()
          .forEach((u) => globalUpcaster.register(u));
      }
      if (clientPlugin.registerProjections) {
        clientPlugin
          .registerProjections()
          .forEach((p) => globalRegistry.register(p));
      }
    }

    // 2. Evaluasi Dependency dan Enable Plugin
    for (const plugin of this.plugins.values()) {
      if (this.canEnable(plugin)) {
        await this.enablePlugin(plugin);
      } else {
        console.warn(
          `[PLUGIN MANAGER] SKIPPED: ${plugin.name} karena dependency tidak terpenuhi.`,
        );
      }
    }
  }

  /**
   * Mengupgrade plugin yang sedang berjalan ke versi baru secara dinamis (Hot-Upgrade)
   */
  public async upgrade(newPlugin: T): Promise<void> {
    console.log(
      `[PLUGIN MANAGER] Menerima proposal upgrade untuk: ${newPlugin.name} ke v${newPlugin.version}`,
    );

    const oldPlugin = this.plugins.get(newPlugin.name);

    // 1. Jika plugin sedang aktif, nonaktifkan versi lama terlebih dahulu secara aman
    if (this.activePlugins.has(newPlugin.name)) {
      console.log(
        `[PLUGIN MANAGER] Menonaktifkan versi lama ${newPlugin.name} v${oldPlugin?.version || "unknown"}...`,
      );
      if (oldPlugin && oldPlugin.onDisable) {
        await oldPlugin.onDisable();
      }
      this.activePlugins.delete(newPlugin.name);
    }

    // 2. Timpa registrasi data plugin lama dengan cetakan baru
    this.plugins.set(newPlugin.name, newPlugin);

    // 3. Jalankan fase onRegister untuk plugin baru
    if (newPlugin.onRegister) {
      await newPlugin.onRegister();
    }

    // Re-registrasi Command Handlers & Upcasters khusus untuk tipe ClientPlugin jika ada struktur baru
    const clientPlugin = newPlugin as ClientPlugin;
    if (clientPlugin.registerCommandHandlers) {
      clientPlugin
        .registerCommandHandlers()
        .forEach((h) => globalCommandBus.register(h));
    }
    if (clientPlugin.registerUpcasters) {
      clientPlugin
        .registerUpcasters()
        .forEach((u) => globalUpcaster.register(u));
    }

    // 4. Evaluasi ulang kelayakan dependensi dan aktifkan kembali
    if (this.canEnable(newPlugin)) {
      await this.enablePlugin(newPlugin);
      console.log(
        `[PLUGIN MANAGER] Sukses melakukan HOT-UPGRADE: ${newPlugin.name} kini berjalan di v${newPlugin.version}`,
      );
    } else {
      console.error(
        `[PLUGIN MANAGER] FATAL UPGRADE CRASH: ${newPlugin.name} v${newPlugin.version} gagal diaktifkan karena dependensi rusak!`,
      );
    }
  }

  /**
   * Mengembalikkan true jika sebuah plugin siap diaktifkan berdasarkan dependensinya
   */
  private canEnable(plugin: T): boolean {
    if (!plugin.dependencies) return true;

    for (const dep of plugin.dependencies) {
      const isDepRegistered = this.plugins.has(dep.name);

      if (dep.required && !isDepRegistered) {
        console.error(
          `[PLUGIN MANAGER] ERROR: ${plugin.name} membutuhkan modul kritikal '${dep.name}' yang tidak ditemukan!`,
        );
        return false;
      }

      if (!dep.required && !isDepRegistered) {
        console.info(
          `[PLUGIN MANAGER] INFO: ${plugin.name} tidak menemukan modul opsional '${dep.name}'. Menjalankan mode Graceful Degradation.`,
        );
      }
    }
    return true;
  }

  private async enablePlugin(plugin: T): Promise<void> {
    if (this.activePlugins.has(plugin.name)) return;

    if (plugin.onEnable) {
      await plugin.onEnable();
    }

    this.activePlugins.add(plugin.name);
    console.log(`[PLUGIN MANAGER] ENABLED: ${plugin.name}`);
  }

  /**
   * Mengambil semua plugin yang aktif untuk diekstrak fiturnya (Route, Projection, dll)
   */
  public getActivePlugins(): T[] {
    return Array.from(this.activePlugins).map(
      (name) => this.plugins.get(name)!,
    );
  }

  /**
   * Mematikan sistem dan membersihkan memory (Disposal)
   */
  public async shutdown(): Promise<void> {
    console.log("[PLUGIN MANAGER] Shutting down modules...");
    for (const name of this.activePlugins) {
      const plugin = this.plugins.get(name);
      if (plugin && plugin.onDisable) {
        await plugin.onDisable();
      }
    }
    this.activePlugins.clear();
  }
}

export const globalPluginManager = new PluginManager<UniversalPlugin>();
