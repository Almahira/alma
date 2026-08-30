// File: packages/core_unv/src/io/ConnectivityManager.ts
import { Socket } from "socket.io-client";
import { BehaviorSubject, Observable } from "rxjs";

export class ConnectivityManager {
  private static instance: ConnectivityManager;
  private isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);
  private socket: Socket | null = null;
  private pingIntervalId: any = null;

  private constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.checkRealConnection());
      window.addEventListener("offline", () => this.setOffline());
    }
  }

  public static getInstance(): ConnectivityManager {
    if (!this.instance) {
      this.instance = new ConnectivityManager();
    }
    return this.instance;
  }

  public attachSocket(socket: Socket): void {
    this.socket = socket;

    this.socket.on("connect", () => {
      this.isOnline$.next(true);
    });

    this.socket.on("disconnect", () => {
      // Jangan langsung anggap offline total, verifikasi dengan HTTP ping ringan
      this.checkRealConnection();
    });

    // Pengecekan aktif setiap 15 detik
    if (!this.pingIntervalId) {
      this.pingIntervalId = setInterval(() => {
        this.checkRealConnection();
      }, 15000);
    }
  }

  public async checkRealConnection(): Promise<boolean> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setOffline();
      return false;
    }

    if (this.socket && this.socket.connected) {
      this.isOnline$.next(true);
      return true;
    }

    try {
      // Ping endpoint health server yang sangat ringan
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const serverUrl =
        localStorage.getItem("__unv_server_url") || "http://localhost:5000";
      const res = await fetch(`${serverUrl}/api/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const isHealthy = res.ok;
      this.isOnline$.next(isHealthy);
      return isHealthy;
    } catch {
      this.setOffline();
      return false;
    }
  }

  private setOffline(): void {
    if (this.isOnline$.getValue() !== false) {
      this.isOnline$.next(false);
      console.warn(
        "[CONNECTIVITY] Jaringan terputus. Mode OFFLINE-FIRST diaktifkan.",
      );
    }
  }

  public isOnline(): boolean {
    return this.isOnline$.getValue();
  }

  public getStatusObservable(): Observable<boolean> {
    return this.isOnline$.asObservable();
  }
}

export const globalConnectivity = ConnectivityManager.getInstance();
