// File: packages/core_unv/src/ledger/UniversalLedger.ts
import { addRxPlugin, createRxDatabase, RxCollection, RxDatabase } from "rxdb";
import { isTransactionAggregate } from "../utils/pruningUtils";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateZSchemaStorage } from "rxdb/plugins/validate-z-schema";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { ulid } from "ulidx";
import {
  LedgerEventDoc,
  UniversalEventSchema,
  eventMigrationStrategies,
  OutboxSchema,
  SyncLogSchema,
  InboxSchema,
  SnapshotSchema,
  OutboxDoc,
  SyncLogDoc,
  InboxDoc,
  SystemLogSchema,
  SystemLogDoc,
} from "./schema";
import { CryptoManager, HLC } from "./crypto";
import { io, Socket } from "socket.io-client";
import { disableWarnings } from "rxdb/plugins/dev-mode";
import { globalOutbox } from "./OutboxDaemon";
import { globalInboxDaemon } from "./InboxDaemon";
import { globalCircuitBreaker } from "../io/CircuitBreaker";
import { getServerUrl, getApiUrl } from "../config/env";
import { LicenseManager } from "./licenseManager";
import { notifyStateUpdated } from "../cqrs/EventBus";
import { globalRegistry } from "../cqrs/UniversalRegistry";

if (typeof window !== "undefined" && (import.meta as any).env?.DEV) {
  disableWarnings();
  addRxPlugin(RxDBDevModePlugin);
}

addRxPlugin(RxDBMigrationSchemaPlugin);

export class UniversalLedger {
  private db!: RxDatabase<{
    events: RxCollection<LedgerEventDoc>;
    outbox: RxCollection<OutboxDoc>;
    sync_logs: RxCollection<SyncLogDoc>;
    inbox: RxCollection<InboxDoc>;
    snapshots: RxCollection<any>;
    system_logs: RxCollection<SystemLogDoc>;
  }>;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private nodeId!: string;
  private secretKey!: string;
  private memCurrentSeq: number = 0;
  private memCurrentHash: string = "0";
  private memAggregateVersions = new Map<string, number>();
  private socket!: Socket;
  private isSyncing = false;
  private syncPromise: Promise<void> | null = null;
  private syncRequested = false;
  private syncRecoveryRequested = false;
  private syncExactCursorRequested = false;
  private appendQueue: Promise<unknown> = Promise.resolve();

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.nodeId = localStorage.getItem("__unv_nodeId") || ulid();
      localStorage.setItem("__unv_nodeId", this.nodeId);

      let storedKey = localStorage.getItem("__unv_secretKey");
      if (!storedKey) {
        const keys = CryptoManager.generateKeyPair();
        storedKey = keys.secretKey;
        localStorage.setItem("__unv_secretKey", storedKey);
      }
      this.secretKey = storedKey;

      const isDemo =
        typeof localStorage !== "undefined" &&
        localStorage.getItem("__unv_is_demo") === "true";
      const dbName = isDemo ? "alma_demo_ledger" : "alma_unv_ledger";

      this.db = await createRxDatabase({
        name: dbName,
        storage: wrappedValidateZSchemaStorage({
          storage: getRxStorageDexie(),
        }),
        multiInstance: false,
        ignoreDuplicate: Boolean((import.meta as any).env?.DEV),
      });

      await this.db.addCollections({
        events: {
          schema: UniversalEventSchema,
          migrationStrategies: eventMigrationStrategies,
        },
        outbox: { schema: OutboxSchema },
        sync_logs: { schema: SyncLogSchema },
        inbox: { schema: InboxSchema },
        snapshots: { schema: SnapshotSchema },
        system_logs: { schema: SystemLogSchema },
      });

      const lastEvent = await this.db.collections.events
        .findOne({ sort: [{ seq: "desc" }] })
        .exec();
      if (lastEvent) {
        this.memCurrentSeq = lastEvent.seq;
        this.memCurrentHash = lastEvent.hash;
      }

      this.socket = io(getServerUrl(), {
        transports: ["websocket"],
        query: { deviceId: this.nodeId },
      });

      // 1. REMOTE KILL SWITCH LISTENER
      this.socket.on("DEVICE_FORCE_LOGOUT", (data: any) => {
        if (!data.deviceId || data.deviceId === this.nodeId) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("UNV_SECURITY_ALERT", {
                detail: {
                  title: "PERANGKAT DINONAKTIFKAN",
                  message:
                    "Perangkat ini telah digantikan oleh perangkat baru. Seluruh data sesi lokal akan dibersihkan.",
                },
              }),
            );
          }
        }
      });

      // 2. OVER-THE-AIR (OTA) UPGRADE LISTENER
      this.socket.on("LICENSE_UPGRADED", (data: any) => {
        const localCompanyId = localStorage.getItem("__unv_companyId");
        if (!data.companyId || data.companyId === localCompanyId) {
          console.log(
            `[OTA LICENSE PUSH] Menerima sinyal upgrade lisensi baru: Paket ${data.tier}`,
          );

          if (data.licenseKey) {
            const verification = LicenseManager.verifyLicense(data.licenseKey);
            if (verification.isValid) {
              localStorage.setItem("__unv_license_tier", data.tier);
              localStorage.setItem("__unv_license_token", data.licenseKey);
              localStorage.setItem(
                "__unv_allowed_modules",
                JSON.stringify(
                  data.allowedModules || verification.allowedModules,
                ),
              );

              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("UNV_LICENSE_UPGRADED", {
                    detail: {
                      tier: data.tier,
                      allowedModules: data.allowedModules,
                      validUntil: data.validUntil,
                    },
                  }),
                );
                window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
              }
            }
          }
        }
      });

      // 3. REMOTE OVER-THE-AIR (OTA) RESYNC TRIGGER
      this.socket.on("REMOTE_RESYNC_TRIGGER", (data: any) => {
        console.log(
          `[OTA TRIGGER] Menerima instruksi penyelarasan data dari Server: ${data?.reason || "Pembaruan Pusat"}`,
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("UNV_REMOTE_RESYNC", { detail: data }),
          );
        }
      });

      globalOutbox.attachSocket(this.socket);

      // Fungsi deteksi stempel epoch (Mendeteksi apakah ada broadcast reset saat perangkat offline)
      const verifyServerEpoch = async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        try {
          const res = await fetch(getApiUrl("/api/system-health/sync-epoch"));
          if (res.ok) {
            const data = await res.json();
            const serverEpoch = Number(data.epoch || 0);
            const localEpoch = Number(
              localStorage.getItem("__unv_sync_epoch") || 0,
            );

            if (serverEpoch > 0 && serverEpoch > localEpoch) {
              console.log(
                `[AUTO-EPOCH CATCHUP] Terdeteksi reset masal saat perangkat offline (Server: ${serverEpoch} > Lokal: ${localEpoch}). Melakukan reset lokal otomatis...`,
              );
              localStorage.setItem("__unv_sync_epoch", String(serverEpoch));
              window.dispatchEvent(
                new CustomEvent("UNV_REMOTE_RESYNC", {
                  detail: { epoch: serverEpoch, forceLogout: true },
                }),
              );
              return true;
            }
          }
        } catch (e) {
          // Abaikan jika server belum dapat dijangkau
        }
        return false;
      };

      // Saat socket tersambung kembali pasca-offline:
      this.socket.on("connect", async () => {
        const hasReset = await verifyServerEpoch();
        if (!hasReset) {
          this.syncInitial();
        }
      });

      // Saat browser mendeteksi sinyal internet fisik kembali aktif:
      if (typeof window !== "undefined") {
        window.addEventListener("online", async () => {
          const hasReset = await verifyServerEpoch();
          if (!hasReset) {
            this.syncInitial();
          }
        });
      }

      // Daftarkan room spasial aktif saat ini ke server
      const currentCompId = localStorage.getItem("__unv_companyId");
      const currentRegId = localStorage.getItem("__unv_regionId");
      const currentOutId = localStorage.getItem("__unv_outletId");
      this.socket.emit("UPDATE_SPATIAL_ROOMS", {
        companyId: currentCompId,
        regionId: currentRegId,
        outletId: currentOutId,
      });

      // Kirim detak jantung berkala setiap 60 detik agar server mengetahui perangkat masih online
      setInterval(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit("DEVICE_HEARTBEAT");
        }
      }, 60000);

      this.socket.on("SYNC_NEEDED", async (data: any) => {
        if (data?.originDeviceId !== this.nodeId) {
          console.log(
            `[SOCKET PUSH] Menerima sinyal transaksi baru dari ${data?.originDeviceId || "Server"}. Mengambil delta...`,
          );
          await this.syncInitial();
          notifyStateUpdated();
        }
      });

      this.socket.on("SYNC_COMMITTED", (data: any) => {
        if (
          !data?.eventId ||
          !["SUCCESS", "MERGED", "REJECTED"].includes(data.status)
        ) {
          console.error("[SOCKET SYNC] Konfirmasi commit server tidak valid:", data);
          return;
        }
        void globalOutbox
          .confirmCommittedEvent(data)
          .catch((error) =>
            console.error(
              `[SOCKET SYNC] Gagal menyelesaikan outbox ${data.eventId}:`,
              error,
            ),
          );
      });

      // Listener status sesi dan pesan WhatsApp masuk secara real-time
      this.socket.on("WA_CONNECTION_STATUS", (data: any) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("UNV_WA_STATUS", { detail: data }),
          );
        }
      });

      this.socket.on("WA_NEW_MESSAGE", (data: any) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("UNV_WA_MESSAGE", { detail: data }),
          );
        }
      });

      // JARING PENGAMAN: Cek stempel epoch dan jalankan sinkronisasi delta otomatis setiap 5 menit
      setInterval(
        async () => {
          if (typeof navigator === "undefined" || navigator.onLine) {
            console.log(
              "[HEARTBEAT 5-MIN] Memeriksa stempel epoch server & sinkronisasi data...",
            );
            const hasReset = await verifyServerEpoch();
            if (hasReset) return;

            await this.syncInitial();
          }
        },
        5 * 60 * 1000,
      );

      this.db.collections.outbox.insert$.subscribe(() => {
        globalOutbox.processQueue();
      });

      this.db.collections.inbox.insert$.subscribe(() => {
        globalInboxDaemon.processQueue();
      });

      this.initialized = true;
    })();

    return this.initPromise;
  }

  public async syncInitial(
    options: { recovery?: boolean; exactCursor?: boolean } = {},
  ): Promise<void> {
    if (this.syncPromise) {
      this.syncRequested = true;
      this.syncRecoveryRequested =
        this.syncRecoveryRequested || options.recovery === true;
      this.syncExactCursorRequested =
        this.syncExactCursorRequested || options.exactCursor === true;
      return this.syncPromise;
    }

    const syncPromise = (async () => {
      let recoveryRequested = options.recovery === true;
      let exactCursorRequested = options.exactCursor === true;
      do {
        this.syncRequested = false;
        const recovery = recoveryRequested || this.syncRecoveryRequested;
        const exactCursor =
          exactCursorRequested || this.syncExactCursorRequested;
        recoveryRequested = false;
        exactCursorRequested = false;
        this.syncRecoveryRequested = false;
        this.syncExactCursorRequested = false;
        await this.performInitialSync(recovery, exactCursor);
      } while (this.syncRequested);
    })();
    this.syncPromise = syncPromise;
    try {
      await syncPromise;
    } finally {
      if (this.syncPromise === syncPromise) this.syncPromise = null;
    }
  }

  private async performInitialSync(
    recovery: boolean,
    exactCursor: boolean,
  ): Promise<void> {
    this.isSyncing = true;

    // Pancarkan sinyal ke Footer UI: Mulai Sinkronisasi
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("UNV_SYNC_STATUS", {
          detail: {
            isSyncing: true,
            lastSync:
              localStorage.getItem("__unv_last_sync_datetime") ||
              "Belum pernah",
          },
        }),
      );
    }

    try {
      const companyId = localStorage.getItem("__unv_companyId");
      const regionId = localStorage.getItem("__unv_regionId");
      const outletId = localStorage.getItem("__unv_outletId");

      // Siapkan Query Params Spasial yang Menghargai Wewenang Akun Login
      const queryParams = new URLSearchParams({
        deviceId: this.nodeId,
      });
      if (companyId) queryParams.append("companyId", companyId);
      if (regionId) queryParams.append("regionId", regionId);

      // Cek apakah akun yang login adalah SUPER_ADMIN atau memiliki izin multi-cabang
      let activeRole = "";
      try {
        const rawUser = localStorage.getItem("__unv_activeUser");
        if (rawUser) activeRole = JSON.parse(rawUser).role || "";
      } catch {}

      if (activeRole !== "SUPER_ADMIN") {
        let multiOutlets: string[] = [];
        try {
          const rawAllowed = localStorage.getItem("__unv_user_allowed_outlets");
          if (rawAllowed) multiOutlets = JSON.parse(rawAllowed);
        } catch {}

        if (multiOutlets.length > 1) {
          queryParams.append("outletIds", multiOutlets.join(","));
        } else if (outletId) {
          queryParams.append("outletId", outletId);
        }
      }

      let snapshotCutoffTime: number | null = null;

      try {
        if (recovery) {
          console.log(
            "[SYNC INITIAL] Mengambil Snapshot Ground Truth Fisik dari server...",
          );
        }
        const snapRes = recovery
          ? await fetch(
              getApiUrl(
                `/api/system-health/snapshot/system/latest?companyId=${companyId || ""}`,
              ),
              { cache: "no-store" },
            ).catch(() => null)
          : null;

        if (snapRes && snapRes.ok) {
          const snapJson = await snapRes.json();
          if (snapJson.hasSnapshot && snapJson.snapshot) {
            const s = snapJson.snapshot;
            console.log(
              `[GROUND TRUTH] Berhasil memuat Snapshot Fisik Server (Sequence #${s.lastSeq}). Memulihkan tabel fisik ke memori...`,
            );

            // 1. Simpan snapshot resmi ke IndexedDB lokal
            await this.db.collections.snapshots.upsert({
              id: "GLOBAL_SNAPSHOT",
              lastSeq: s.lastSeq,
              data: s.data,
              updatedAt: s.updatedAt,
            });

            // 2. Pasang Sequence dasar lokal
            this.memCurrentSeq = s.lastSeq;

            // 3. Rehidrasi memori CQRS Read Model seketika dari tabel fisik
            if (s.data) {
              const payload =
                typeof s.data === "string" ? JSON.parse(s.data) : s.data;
              globalRegistry.restoreAllStates(payload);

              // 4. Seeding versi agregat ke ledger lokal
              if (payload.ITEM_DOMAIN?.products) {
                payload.ITEM_DOMAIN.products.forEach((p: any) => {
                  const v = p.aggregateVersion ?? p.aggregate_version ?? 1;
                  this.setAggregateVersion(p.id, Number(v) || 1);
                });
              }
              if (payload.ORGANIZATION?.outlets) {
                payload.ORGANIZATION.outlets.forEach((o: any) => {
                  const v = o.aggregateVersion ?? o.aggregate_version ?? 1;
                  this.setAggregateVersion(o.id, Number(v) || 1);
                });
              }
            }

            // Picu pembaruan antarmuka (UI re-render seketika)
            notifyStateUpdated();

            // Tetapkan batas waktu penarikan delta event hanya setelah snapshot ini dibuat
            if (s.updatedAt) {
              snapshotCutoffTime = new Date(s.updatedAt).getTime();
            }
          }
        }
      } catch (snapErr) {
        console.warn(
          "[SNAPSHOT SYNC] Gagal menghubungi endpoint snapshot server, beralih ke delta sync lokal.",
          snapErr,
        );
      }

      // Siapkan cursor checkpoint inkremental
      const queryParamsSystem = new URLSearchParams(queryParams);
      const queryParamsTx = new URLSearchParams(queryParams);

      if (snapshotCutoffTime) {
        // Jika snapshot berhasil dimuat, hanya tarik event yang lahir SETELAH snapshot dibekukan
        queryParamsSystem.set("since", String(snapshotCutoffTime));
        queryParamsTx.set("since", String(snapshotCutoffTime));
        localStorage.setItem("__unv_cursor_system", String(snapshotCutoffTime));
        localStorage.setItem("__unv_cursor_tx", String(snapshotCutoffTime));
      } else {
        // Fallback jika server snapshot offline: gunakan cursor lokal
        const lastCursorSystem = localStorage.getItem("__unv_cursor_system");
        const lastCursorTx = localStorage.getItem("__unv_cursor_tx");

        if (lastCursorSystem) {
          const safeSystemSince = exactCursor
            ? Number(lastCursorSystem)
            : Math.max(0, Number(lastCursorSystem) - 2000);
          queryParamsSystem.set("since", String(safeSystemSince));
        }
        if (lastCursorTx) {
          const safeTxSince = exactCursor
            ? Number(lastCursorTx)
            : Math.max(0, Number(lastCursorTx) - 2000);
          queryParamsTx.set("since", String(safeTxSince));
        }
      }

      const serverEvents = await globalCircuitBreaker.fire(async () => {
        const [resSystem, resTx] = await Promise.all([
          fetch(
            getApiUrl(
              `/api/events/pull/system?${queryParamsSystem.toString()}`,
            ),
          ).catch(() => null),
          fetch(
            getApiUrl(`/api/events/pull/tx?${queryParamsTx.toString()}`),
          ).catch(() => null),
        ]);

        let eventsSys: any[] = [];
        let eventsTx: any[] = [];
        if (resSystem && resSystem.ok) {
          eventsSys = await resSystem.json();
          if (eventsSys.length > 0) {
            const maxSysTime = Math.max(
              ...eventsSys.map((e: any) =>
                new Date(e.createdAt || Date.now()).getTime(),
              ),
            );
            localStorage.setItem("__unv_cursor_system", String(maxSysTime));
          }
        }
        if (resTx && resTx.ok) {
          eventsTx = await resTx.json();
          if (eventsTx.length > 0) {
            const maxTxTime = Math.max(
              ...eventsTx.map((e: any) =>
                new Date(e.createdAt || Date.now()).getTime(),
              ),
            );
            localStorage.setItem("__unv_cursor_tx", String(maxTxTime));
          }
        }
        return [...(eventsSys || []), ...(eventsTx || [])];
      });

      if (!serverEvents || serverEvents.length === 0) {
        if (recovery && snapshotCutoffTime !== null) {
          await this.reapplyPendingLocalEvents(true);
        }
        this.isSyncing = false;
        return;
      }

      const existingEvents = await this.db.collections.events
        .find({
          selector: {
            id: {
              $in: serverEvents.map(
                (ev: any) =>
                  ev.id || `EVT_${ev.aggregateId}_${ev.aggregateVersion}`,
              ),
            },
          },
        })
        .exec();

      const existingIdSet = new Set(existingEvents.map((doc) => doc.id));
      const newEventsOnly = serverEvents.filter(
        (ev: any) =>
          !existingIdSet.has(
            ev.id || `EVT_${ev.aggregateId}_${ev.aggregateVersion}`,
          ),
      );

      if (newEventsOnly.length > 0) {
        const inboxDocsToInsert = newEventsOnly.map((ev: any, idx: number) => {
          const evId = ev.id || `EVT_${ev.aggregateId}_${ev.aggregateVersion}`;
          return {
            id: evId,
            eventPayload: {
              id: evId,
              aggregateId: ev.aggregateId,
              aggregateVersion: ev.aggregateVersion,
              seq: ev.seq || 0,
              prevHash: ev.prevHash || "0",
              hash: ev.hash || evId,
              hlc: ev.hlc || String(Date.now()),
              type: ev.type,
              payload:
                typeof ev.payload === "string"
                  ? JSON.parse(ev.payload)
                  : ev.payload,
              dddMetadata: {
                eventId: evId,
                aggregateId: ev.aggregateId,
                aggregateType: ev.aggregateType || "SYSTEM",
                aggregateVersion: ev.aggregateVersion || 1,
                eventVersion: 1,
                businessDate: new Date().toISOString().slice(0, 10),
                actor: { userId: ev.actor || "SYSTEM", role: "SYSTEM" },
              },
              nodeMetadata: { originDeviceId: "SERVER", signature: "SYNCED" },
            },
            status: "PENDING",
            createdAt: Date.now() + idx,
          };
        });

        await this.db.collections.inbox.bulkUpsert(inboxDocsToInsert);
        await globalInboxDaemon.processQueue();

        notifyStateUpdated();
      }

      if (recovery && snapshotCutoffTime !== null) {
        await this.reapplyPendingLocalEvents(true);
      }
    } catch (error) {
      console.warn("[UNIVERSAL LEDGER] Gagal sinkronisasi awal:", error);
    } finally {
      this.isSyncing = false;

      const nowFormatted = new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      localStorage.setItem("__unv_last_sync_datetime", nowFormatted);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("UNV_SYNC_STATUS", {
            detail: { isSyncing: false, lastSync: nowFormatted },
          }),
        );
      }
    }
  }

  public async reapplyPendingLocalEvents(replayAll = true): Promise<void> {
    const pendingOutbox = await this.db.collections.outbox
      .find({
        selector: { status: { $in: ["PENDING", "SENT"] } },
        sort: [{ createdAt: "asc" }],
      })
      .exec();
    if (pendingOutbox.length === 0) return;

    const snapshot = await this.db.collections.snapshots
      .findOne("GLOBAL_SNAPSHOT")
      .exec();
    const snapshotSeq = snapshot?.lastSeq || 0;
    let replayedCount = 0;

    for (const outboxDoc of pendingOutbox) {
      const pendingEvent = outboxDoc.toJSON().eventPayload as LedgerEventDoc;
      const localEvent = await this.db.collections.events
        .findOne(pendingEvent.id)
        .exec();
      if (!localEvent) continue;
      if (!replayAll && localEvent.seq > snapshotSeq) continue;
      globalRegistry.processEvent(localEvent.toJSON());
      replayedCount += 1;
    }

    if (replayedCount > 0 && this.memCurrentSeq > 0) {
      await this.db.collections.snapshots.upsert({
        id: "GLOBAL_SNAPSHOT",
        lastSeq: this.memCurrentSeq,
        data: globalRegistry.getAllStates(),
        updatedAt: Date.now(),
      });
    }

    notifyStateUpdated();
  }

  /**
   * Mendaftarkan versi agregat langsung ke memori (digunakan saat restorasi snapshot fisik)
   */
  public setAggregateVersion(aggregateId: string, version: number): void {
    this.memAggregateVersions.set(
      aggregateId,
      Math.max(1, Number(version) || 1),
    );
  }

  /**
   * Mendaftarkan banyak versi agregat sekaligus dari snapshot
   */
  public bulkSetAggregateVersions(
    versions: Record<string, number> | Map<string, number>,
  ): void {
    if (versions instanceof Map) {
      versions.forEach((v, k) => this.setAggregateVersion(k, v));
    } else if (typeof versions === "object" && versions !== null) {
      Object.entries(versions).forEach(([k, v]) =>
        this.setAggregateVersion(k, v),
      );
    }
  }

  public async getAggregateVersion(aggregateId: string): Promise<number> {
    if (!this.initialized) await this.init();
    if (this.memAggregateVersions.has(aggregateId)) {
      return this.memAggregateVersions.get(aggregateId)!;
    }
    const doc = await this.db.collections.events
      .findOne({ selector: { aggregateId }, sort: [{ seq: "desc" }] })
      .exec();
    const version = doc ? doc.aggregateVersion : 0;
    this.memAggregateVersions.set(aggregateId, version);
    return version;
  }

  public async commitInboxEvent(rawPayload: any): Promise<void> {
    await this.commitInboxBatch([rawPayload]);
  }

  public async commitInboxBatch(rawPayloads: any[]): Promise<void> {
    if (!rawPayloads || rawPayloads.length === 0) return;

    const job = async () => {
      if (!this.initialized) await this.init();

      const eventIds = rawPayloads.map((p) => p.id);
      const existingEvents = await this.db.collections.events
        .find({
          selector: {
            id: { $in: eventIds },
          },
        })
        .exec();
      const existingIdSet = new Set(existingEvents.map((d) => d.id));

      const eventDocsToInsert: LedgerEventDoc[] = [];

      for (const rawPayload of rawPayloads) {
        const eventId = rawPayload.id;
        if (existingIdSet.has(eventId)) continue;
        existingIdSet.add(eventId);

        const nextSeq = this.memCurrentSeq + 1;
        const prevHash = this.memCurrentHash;

        const hashData = {
          seq: nextSeq,
          prevHash: prevHash,
          type: rawPayload.type,
          payload: rawPayload.payload,
          dddMetadata: rawPayload.dddMetadata,
          hlc: rawPayload.hlc,
        };
        const validHash = CryptoManager.hash(hashData);

        const eventDoc: LedgerEventDoc = {
          id: eventId,
          isTx: isTransactionAggregate(
            rawPayload.dddMetadata?.aggregateType ||
              rawPayload.aggregateType ||
              "",
          ),
          createdAt: Number(rawPayload.createdAt) || Date.now(),
          aggregateId: rawPayload.aggregateId,
          aggregateVersion: rawPayload.aggregateVersion,
          seq: nextSeq,
          prevHash: prevHash,
          hash: validHash,
          hlc: rawPayload.hlc,
          type: rawPayload.type,
          payload: rawPayload.payload,
          dddMetadata: rawPayload.dddMetadata,
          nodeMetadata: rawPayload.nodeMetadata,
        };

        this.memCurrentSeq = nextSeq;
        this.memCurrentHash = validHash;
        this.memAggregateVersions.set(
          rawPayload.aggregateId,
          rawPayload.aggregateVersion,
        );

        eventDocsToInsert.push(eventDoc);
      }

      if (eventDocsToInsert.length > 0) {
        await this.db.collections.events.bulkInsert(eventDocsToInsert);
        notifyStateUpdated();
      }
    };

    const nextPromise = this.appendQueue.catch(() => {}).then(job);
    this.appendQueue = nextPromise;
    await nextPromise;
  }

  public async appendEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    expectedVersion: number,
    payload: Record<string, any>,
    actor: { userId: string; role: string },
  ): Promise<LedgerEventDoc> {
    const job = async (): Promise<LedgerEventDoc> => {
      if (!this.initialized) await this.init();

      const currentVersion = await this.getAggregateVersion(aggregateId);
      if (currentVersion !== expectedVersion - 1) {
        throw new Error(
          `[LEDGER] Optimistic Lock Failed for ${aggregateId}. Expected ${expectedVersion}, got ${currentVersion + 1}`,
        );
      }

      const nextSeq = this.memCurrentSeq + 1;
      const prevHash = this.memCurrentHash;
      const eventId = `EVT_${ulid()}`;
      const hlc = HLC.generate(this.nodeId);

      // KUNCI: TIMESTAMP(6) Mikrodetik untuk Resolusi Rebase Deterministik
      const nowMs = Date.now();
      const microFraction =
        typeof performance !== "undefined"
          ? Math.floor((performance.now() % 1) * 1000)
          : Math.floor(Math.random() * 1000);
      const clientTimestampIso = new Date(nowMs)
        .toISOString()
        .replace("Z", `${String(microFraction).padStart(3, "0")}Z`);

      const enrichedPayload = {
        ...payload,
        updatedAt: payload.updatedAt || clientTimestampIso,
        client_timestamp: clientTimestampIso,
      };

      const dddMetadata = {
        eventId,
        aggregateId,
        aggregateType,
        aggregateVersion: expectedVersion,
        eventVersion: 1,
        businessDate: new Date().toISOString().split("T")[0],
        clientTimestamp: clientTimestampIso,
        actor,
      };

      const hashData = {
        seq: nextSeq,
        prevHash: prevHash,
        type,
        payload: enrichedPayload,
        dddMetadata,
        hlc,
      };
      const hash = CryptoManager.hash(hashData);
      const signature = CryptoManager.sign(hash, this.secretKey);

      const eventDoc: LedgerEventDoc = {
        id: eventId,
        isTx: isTransactionAggregate(aggregateType),
        createdAt: nowMs,
        aggregateId,
        aggregateVersion: expectedVersion,
        seq: nextSeq,
        prevHash,
        hash,
        hlc,
        type,
        payload: enrichedPayload,
        dddMetadata,
        nodeMetadata: { originDeviceId: this.nodeId, signature },
      };

      this.memCurrentSeq = nextSeq;
      this.memCurrentHash = hash;
      this.memAggregateVersions.set(aggregateId, expectedVersion);

      let insertedEvent: any = null;
      try {
        insertedEvent = await this.db.collections.events.insert(eventDoc);
        await this.db.collections.outbox.insert({
          id: eventId,
          eventPayload: eventDoc,
          status: "PENDING",
          retryCount: 0,
          createdAt: nowMs,
        });
      } catch (error) {
        if (insertedEvent) {
          await insertedEvent.remove();
        }
        this.memCurrentSeq = nextSeq - 1;
        this.memCurrentHash = prevHash;
        this.memAggregateVersions.set(aggregateId, expectedVersion - 1);
        throw new Error(
          "Gagal menyimpan transaksi. Sistem telah membatalkan perubahan secara otomatis.",
        );
      }

      return eventDoc;
    };

    const nextPromise = this.appendQueue.catch(() => {}).then(job);
    this.appendQueue = nextPromise;
    return nextPromise;
  }

  public getRxDatabase() {
    return this.db;
  }

  public getCurrentSeq(): number {
    return this.memCurrentSeq;
  }

  public setSnapshotBaseSequence(sequence: number): void {
    this.memCurrentSeq = Math.max(0, Number(sequence) || 0);
  }

  /**
   * Reset Memori RAM Kriptografi (Mencegah Sequence Rusak / Database Corrupted saat Reset)
   */
  public resetMemoryChain(): void {
    this.memCurrentSeq = 0;
    this.memCurrentHash = "0";
    this.memAggregateVersions.clear();
    this.isSyncing = false;
    console.log(
      "[UNIVERSAL LEDGER] Memori sequence & hash chain berhasil di-reset ke 0 (Clean State).",
    );
  }
}

export const globalLedger = new UniversalLedger();
