// File: packages/core_unv/src/ledger/schema.ts
import { RxJsonSchema } from "rxdb";

export interface LedgerEventDoc {
  id: string;
  aggregateId: string;
  aggregateVersion: number;
  seq: number;
  prevHash: string;
  hash: string;
  hlc: string;
  type: string;
  payload: Record<string, any>;
  dddMetadata: {
    eventId: string;
    aggregateId: string;
    aggregateType: string;
    aggregateVersion: number;
    eventVersion?: number;
    tenantId?: string;
    correlationId?: string;
    causationId?: string;
    businessDate: string;
    actor: { userId: string; role: string };
  };
  nodeMetadata: {
    originDeviceId: string;
    signature: string;
  };
}

export interface OutboxDoc {
  id: string;
  eventPayload: Record<string, any>;
  status: string;
  retryCount: number;
  createdAt: number;
}

export interface SyncLogDoc {
  id: string;
  title: string;
  message: string;
  status: string;
  isRead: boolean;
  linkPath?: string;
  createdAt: number;
}

// ---> TAMBAHAN: Interface untuk Inbox <---
export interface InboxDoc {
  id: string; // Sama dengan eventId
  eventPayload: Record<string, any>; // Data mentah event dari server
  status: string; // "PENDING" | "ERROR"
  errorMessage?: string;
  createdAt: number;
}

export const UniversalEventSchema: RxJsonSchema<LedgerEventDoc> = {
  title: "universal event ledger schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    aggregateId: { type: "string", maxLength: 100 },
    aggregateVersion: { type: "number" },
    seq: {
      type: "number",
      minimum: 1,
      maximum: 999999999999999,
      multipleOf: 1,
    },
    prevHash: { type: "string" },
    hash: { type: "string" },
    hlc: { type: "string" },
    type: { type: "string", maxLength: 100 },
    payload: { type: "object" },
    dddMetadata: { type: "object" },
    nodeMetadata: { type: "object" },
  },
  required: [
    "id",
    "aggregateId",
    "aggregateVersion",
    "seq",
    "prevHash",
    "hash",
    "hlc",
    "type",
    "payload",
    "dddMetadata",
    "nodeMetadata",
  ],
  indexes: ["seq", "aggregateId", "type"],
};

export const OutboxSchema = {
  title: "outbox schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    eventPayload: { type: "object" },
    status: { type: "string" },
    retryCount: { type: "number" },
    createdAt: {
      type: "number",
      multipleOf: 1,
      minimum: 0,
      maximum: 999999999999999,
    },
  },
  required: ["id", "eventPayload", "status", "retryCount", "createdAt"],
};

export const SyncLogSchema = {
  title: "sync log schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    title: { type: "string" },
    message: { type: "string" },
    status: { type: "string" },
    isRead: { type: "boolean" },
    linkPath: { type: "string" },
    createdAt: {
      type: "number",
      multipleOf: 1,
      minimum: 0,
      maximum: 999999999999999,
    },
  },
  required: ["id", "title", "message", "status", "isRead", "createdAt"],
  indexes: ["createdAt"],
};

// ---> TAMBAHAN: Skema Inbox <---
export const InboxSchema = {
  title: "inbox schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    eventPayload: { type: "object" },
    status: { type: "string" },
    errorMessage: { type: "string" },
    createdAt: {
      type: "number",
      multipleOf: 1,
      minimum: 0,
      maximum: 999999999999999,
    },
  },
  required: ["id", "eventPayload", "status", "createdAt"],
};

export const SnapshotSchema = {
  title: "snapshot schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    lastSeq: { type: "number" }, // Urutan event terakhir saat difoto
    data: { type: "object" }, // Seluruh isi data di UI
    updatedAt: { type: "number" },
  },
  required: ["id", "lastSeq", "data", "updatedAt"],
};

export const SystemLogSchema = {
  title: "system log schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    level: { type: "string", enum: ["DEBUG", "INFO", "WARN", "ERROR"] },
    category: { type: "string", enum: ["SYSTEM", "DATA"] },
    message: { type: "string" },
    timestamp: { type: "number" },
    // Metadata Sistem (IT Manager)
    fileName: { type: "string" },
    stackTrace: { type: "string" },
    deviceId: { type: "string" },
    // Metadata Bisnis (Pemilik Sistem)
    companyId: { type: "string" },
    regionId: { type: "string" },
    outletId: { type: "string" },
    actorId: { type: "string" },
    actorName: { type: "string" },
  },
  required: ["id", "level", "category", "message", "timestamp"],
};

export interface SystemLogDoc {
  id: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  category: "SYSTEM" | "DATA";
  message: string;
  timestamp: number;
  fileName?: string;
  stackTrace?: string;
  deviceId?: string;
  companyId?: string;
  regionId?: string;
  outletId?: string;
  actorId?: string;
  actorName?: string;
}
