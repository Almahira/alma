// File: packages/core_unv/src/config/session.ts

export interface ActiveActor {
  id: string;
  employeeId?: string;
  username: string;
  fullName: string;
  role: string;
}

export class RuntimeSession {
  private static _companyId: string = "";
  private static _regionId: string = "";
  private static _outletId: string = "";
  private static _deviceScope: "COMPANY" | "REGION" | "OUTLET" = "OUTLET";
  private static _nodeId: string = "";
  private static _deviceToken: string = "";
  private static _licenseTier: string = "FREE";
  private static _activeUser: ActiveActor = {
    id: "SYSTEM",
    username: "SYSTEM",
    fullName: "SUPER ADMIN",
    role: "SUPER_ADMIN",
  };
  private static _initialized: boolean = false;

  /**
   * Menginisialisasi session cache ke dalam RAM (Cold Boot).
   * Hanya menyentuh localStorage 1x saat aplikasi pertama kali dimuat.
   */
  public static init(): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }
    this._companyId = localStorage.getItem("__unv_companyId") || "";
    this._regionId = localStorage.getItem("__unv_regionId") || "";
    this._outletId = localStorage.getItem("__unv_outletId") || "";
    this._nodeId = localStorage.getItem("__unv_nodeId") || "";
    this._deviceToken = localStorage.getItem("__unv_deviceToken") || "";
    this._licenseTier = localStorage.getItem("__unv_license_tier") || "FREE";

    const scope = localStorage.getItem("__unv_deviceScope");
    if (scope === "COMPANY" || scope === "REGION" || scope === "OUTLET") {
      this._deviceScope = scope;
    } else {
      this._deviceScope = this._outletId
        ? "OUTLET"
        : this._regionId
          ? "REGION"
          : "COMPANY";
    }

    try {
      const rawUser = localStorage.getItem("__unv_activeUser");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        this._activeUser = {
          id: u.id || u.employeeId || "SYSTEM",
          employeeId: u.employeeId,
          username: u.username || u.fullName || "SYSTEM",
          fullName: u.fullName || u.username || "SUPER ADMIN",
          role: u.role || "SUPER_ADMIN",
        };
      }
    } catch {}

    this._initialized = true;
  }

  // Getter RAM O(1) Instant (< 0.001ms) - ZERO DISK I/O
  public static get companyId(): string {
    if (!this._initialized) this.init();
    return this._companyId;
  }

  public static get regionId(): string {
    if (!this._initialized) this.init();
    return this._regionId;
  }

  public static get outletId(): string {
    if (!this._initialized) this.init();
    return this._outletId;
  }

  public static get deviceScope(): "COMPANY" | "REGION" | "OUTLET" {
    if (!this._initialized) this.init();
    return this._deviceScope;
  }

  public static get nodeId(): string {
    if (!this._initialized) this.init();
    return this._nodeId;
  }

  public static get deviceToken(): string {
    if (!this._initialized) this.init();
    return this._deviceToken;
  }

  public static get licenseTier(): string {
    if (!this._initialized) this.init();
    return this._licenseTier;
  }

  public static get activeUser(): ActiveActor {
    if (!this._initialized) this.init();
    return this._activeUser;
  }

  public static refresh(): void {
    this._initialized = false;
    this.init();
  }
}
