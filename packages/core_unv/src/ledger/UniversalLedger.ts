// File: packages/core_unv/src/ledger/UniversalLedger.ts
import { addRxPlugin, createRxDatabase, RxCollection, RxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateZSchemaStorage } from "rxdb/plugins/validate-z-schema";
import { ulid } from "ulidx";
import {
  LedgerEventDoc,
  UniversalEventSchema,
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

if (typeof window !== "undefined" && (import.meta as any).env?.DEV) {
  disableWarnings();
  addRxPlugin(RxDBDevModePlugin);
}

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

      this.db = await createRxDatabase({
        name: "alma_unv_ledger",
        storage: wrappedValidateZSchemaStorage({
          storage: getRxStorageDexie(),
        }),
        multiInstance: false,
        ignoreDuplicate: Boolean((import.meta as any).env?.DEV),
      });

      await this.db.addCollections({
        events: { schema: UniversalEventSchema },
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

      globalOutbox.attachSocket(this.socket);

      this.socket.on("connect", () => {
        this.syncInitial();
      });

      this.socket.on("SYNC_NEEDED", async (data: any) => {
        if (data?.originDeviceId !== this.nodeId) {
          console.log(
            `[SOCKET PUSH] Menerima sinyal transaksi baru dari ${data?.originDeviceId || "Server"}. Mengambil delta...`,
          );
          await this.syncInitial();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
          }
        }
      });

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

  public async syncInitial() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    let isBackpressureHold = false;

    try {
      const txQueryParams = new URLSearchParams({
        deviceId: this.nodeId,
      });
      const companyId = localStorage.getItem("__unv_companyId");
      const regionId = localStorage.getItem("__unv_regionId");
      const outletId = localStorage.getItem("__unv_outletId");

      if (companyId) txQueryParams.append("companyId", companyId);
      if (regionId) txQueryParams.append("regionId", regionId);
      if (outletId) txQueryParams.append("outletId", outletId);

      const serverEvents = await globalCircuitBreaker.fire(async () => {
        const [resSystem, resTx] = await Promise.all([
          fetch(
            getApiUrl(`/api/events/pull/system?deviceId=${this.nodeId}`),
          ).catch(() => null),
          fetch(getApiUrl(`/api/events/pull/tx?deviceId=${this.nodeId}`)).catch(
            () => null,
          ),
        ]);

        let eventsSys: any[] = [];
        let eventsTx: any[] = [];

        if (resSystem && resSystem.ok) {
          eventsSys = await resSystem.json();
        }
        if (resTx && resTx.ok) {
          eventsTx = await resTx.json();
        }

        return [...(eventsSys || []), ...(eventsTx || [])];
      });

      if (!serverEvents || serverEvents.length === 0) {
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
        }
      }
    } catch (error) {
      console.warn("[UNIVERSAL LEDGER] Gagal sinkronisasi awal:", error);
    } finally {
      if (!isBackpressureHold && globalCircuitBreaker.getState() === "CLOSED") {
        this.isSyncing = false;
      }
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
    if (!this.initialized) await this.init();
    const eventId = rawPayload.id;

    const existingEvent = await this.db.collections.events
      .findOne(eventId)
      .exec();
    if (existingEvent) {
      return;
    }

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

    await this.db.collections.events.insert(eventDoc);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
    }
  }

  public async appendEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    expectedVersion: number,
    payload: Record<string, any>,
    actor: { userId: string; role: string },
  ): Promise<LedgerEventDoc> {
    return (this.appendQueue = this.appendQueue.then(async () => {
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

      const dddMetadata = {
        eventId,
        aggregateId,
        aggregateType,
        aggregateVersion: expectedVersion,
        eventVersion: 1,
        businessDate: new Date().toISOString().split("T")[0],
        actor,
      };

      const hashData = {
        seq: nextSeq,
        prevHash: prevHash,
        type,
        payload,
        dddMetadata,
        hlc,
      };
      const hash = CryptoManager.hash(hashData);
      const signature = CryptoManager.sign(hash, this.secretKey);

      const eventDoc: LedgerEventDoc = {
        id: eventId,
        aggregateId,
        aggregateVersion: expectedVersion,
        seq: nextSeq,
        prevHash,
        hash,
        hlc,
        type,
        payload,
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
          createdAt: Date.now(),
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
    })) as Promise<LedgerEventDoc>;
  }

  public getRxDatabase() {
    return this.db;
  }

  public getCurrentSeq(): number {
    return this.memCurrentSeq;
  }
}

export const globalLedger = new UniversalLedger();
