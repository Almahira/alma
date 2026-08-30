// File: packages/core_unv/src/io/BlobManager.ts
import { IO_CONFIG, getFileTypeCategory } from "./config";
import { compressImageAuto } from "./imageCompressor";
import { getServerUrl } from "../config/env";

export interface QueuedFile {
  fileId: string;
  aggregateType: string;
  aggregateId: string;
  file: File;
  addedAt: number;
}

export class BlobManager {
  private dbName = "ALMA_unv_blob_queue";
  private dbVersion = 1;
  private storeName = "upload_queue";

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) {
          request.result.createObjectStore(this.storeName, {
            keyPath: "fileId",
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async queueFileForUpload(
    fileId: string,
    aggregateType: string,
    aggregateId: string,
    rawFile: File,
  ): Promise<void> {
    const category = getFileTypeCategory(rawFile.type, rawFile.name);
    const maxSize = IO_CONFIG.LIMITS[category];

    let finalFile = rawFile;
    if (category === "IMAGE" && rawFile.size > maxSize) {
      finalFile = await compressImageAuto(rawFile, 5);
    } else if (rawFile.size > maxSize) {
      throw new Error(
        `Ukuran file melebihi batas maksimal untuk kategori ${category} (${maxSize / 1024 / 1024}MB)`,
      );
    }

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const queuedFile: QueuedFile = {
        fileId,
        aggregateType,
        aggregateId,
        file: finalFile,
        addedAt: Date.now(),
      };
      const req = store.put(queuedFile);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getPendingUploads(): Promise<QueuedFile[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public async removeQueuedFile(fileId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getFileFromCacheOrDownload(
    fileId: string,
    aggregateType: string,
    isSystemData: boolean,
    serverUrl: string = getServerUrl(),
  ): Promise<Blob | null> {
    const cacheName = isSystemData
      ? IO_CONFIG.CACHE_NAMES.SYSTEM
      : IO_CONFIG.CACHE_NAMES.TRANSACTION;
    const cache = await caches.open(cacheName);
    const requestUrl = `${serverUrl}/api/storage/download/${aggregateType}/${fileId}`;
    const cachedResponse = await cache.match(requestUrl);
    if (cachedResponse) {
      return await cachedResponse.blob();
    }
    if (!navigator.onLine) {
      throw new Error("Anda sedang offline dan file ini belum di-download.");
    }
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error("File tidak ditemukan di server");
    await cache.put(requestUrl, response.clone());
    return await response.blob();
  }

  public async removeFileFromCache(
    fileId: string,
    aggregateType: string,
    isSystemData: boolean,
    serverUrl: string = getServerUrl(),
  ): Promise<void> {
    const cacheName = isSystemData
      ? IO_CONFIG.CACHE_NAMES.SYSTEM
      : IO_CONFIG.CACHE_NAMES.TRANSACTION;
    const cache = await caches.open(cacheName);
    const requestUrl = `${serverUrl}/api/storage/download/${aggregateType}/${fileId}`;
    await cache.delete(requestUrl);
  }
}

export const globalBlobManager = new BlobManager();
