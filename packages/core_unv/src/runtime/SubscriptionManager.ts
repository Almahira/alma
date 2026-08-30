// File: packages/core_unv/src/runtime/SubscriptionManager.ts

interface Unsubscribable {
  unsubscribe?: () => void;
  off?: string | any;
}

export class SubscriptionManager {
  private registry = new Map<string, Unsubscribable[]>();

  /**
   * Mendaftarkan fungsi pembersihan (unsubscribe) ke dalam konteks modul/komponen tertentu
   * @param ownerContext ID konteks (misal nama modul: 'mdl_organization' atau id komponen)
   * @param sub Objek langganan dari RxDB (RxSubscription) atau fungsi penutup kustom
   */
  public track(ownerContext: string, sub: Unsubscribable | (() => void)): void {
    if (!this.registry.has(ownerContext)) {
      this.registry.set(ownerContext, []);
    }

    if (typeof sub === "function") {
      this.registry.get(ownerContext)!.push({ unsubscribe: sub });
    } else {
      this.registry.get(ownerContext)!.push(sub);
    }
  }

  /**
   * Memotong dan membersihkan seluruh langganan memori dari konteks tertentu hingga bersih (0 leak)
   */
  public releaseAll(ownerContext: string): void {
    const subs = this.registry.get(ownerContext);
    if (!subs || subs.length === 0) return;

    console.log(
      `[SUBSCRIPTION MANAGER] Membersihkan sampah RAM memori untuk konteks: ${ownerContext} (${subs.length} subs)`,
    );

    subs.forEach((sub) => {
      try {
        if (typeof sub.unsubscribe === "function") {
          sub.unsubscribe();
        } else if (typeof sub.off === "function") {
          sub.off();
        }
      } catch (err) {
        console.error(
          `[SUBSCRIPTION MANAGER] Gagal melepas subs untuk ${ownerContext}:`,
          err,
        );
      }
    });

    this.registry.delete(ownerContext);
  }
}

export const globalSubscriptionManager = new SubscriptionManager();
