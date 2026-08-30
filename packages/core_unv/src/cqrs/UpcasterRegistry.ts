// File: packages/core_unv/src/cqrs/UpcasterRegistry.ts
import { LedgerEventDoc } from "../ledger/schema";
import { EventUpcaster } from "./types";

export class UpcasterRegistry {
  private upcasters = new Map<string, EventUpcaster[]>();

  public register(upcaster: EventUpcaster): void {
    if (!this.upcasters.has(upcaster.eventType)) {
      this.upcasters.set(upcaster.eventType, []);
    }

    this.upcasters.get(upcaster.eventType)!.push(upcaster);

    // Urutkan dari versi terkecil agar penerjemahan berantai (V1 -> V2 -> V3) berjalan benar
    this.upcasters
      .get(upcaster.eventType)!
      .sort((a, b) => a.fromVersion - b.fromVersion);

    console.log(
      `[UPCASTER] Penerjemah terdaftar untuk ${upcaster.eventType} (v${upcaster.fromVersion} -> v${upcaster.fromVersion + 1})`,
    );
  }

  public process(event: LedgerEventDoc): LedgerEventDoc {
    const upcasterList = this.upcasters.get(event.type);

    // Jika tidak ada upcaster untuk event ini, kembalikan data apa adanya
    if (!upcasterList || upcasterList.length === 0) return event;

    // Kloning event agar tidak merusak data referensi asli dari RxDB
    const upgradedEvent = JSON.parse(JSON.stringify(event)) as LedgerEventDoc;
    let currentVersion = upgradedEvent.dddMetadata.eventVersion || 1;

    for (const upcaster of upcasterList) {
      if (currentVersion === upcaster.fromVersion) {
        // Terjemahkan payload ke versi baru
        upgradedEvent.payload = upcaster.upcast(upgradedEvent.payload);
        currentVersion++;
        upgradedEvent.dddMetadata.eventVersion = currentVersion;

        console.log(
          `[UPCASTER] Menerjemahkan ${event.type} (${event.id}) ke format v${currentVersion}`,
        );
      }
    }

    return upgradedEvent;
  }
}

export const globalUpcaster = new UpcasterRegistry();
