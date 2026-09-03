// File: packages/core_unv/src/cqrs/CommandGuard.ts
import { Command } from "./types";
import { UniquenessRule } from "../plugin/types";
import { globalRegistry } from "./UniversalRegistry";

export class CommandGuard {
  private static rules = new Map<string, UniquenessRule[]>();

  public static registerRules(rules: UniquenessRule[]): void {
    rules.forEach((rule) => {
      if (!this.rules.has(rule.commandType)) {
        this.rules.set(rule.commandType, []);
      }
      this.rules.get(rule.commandType)!.push(rule);
      console.log(
        `[SATPAM CORE] Aturan keunikan terdaftar untuk: ${rule.commandType}`,
      );
    });
  }

  public static validate(command: Command): void {
    const activeRules = this.rules.get(command.type);
    if (!activeRules || activeRules.length === 0) return; // Lolos langsung jika tidak terdaftar

    const payload = command.payload || {};

    for (const rule of activeRules) {
      const state = globalRegistry.getState(rule.targetAggregate);
      if (!state) continue;

      const items: any[] = Array.isArray(state[rule.collectionKey])
        ? state[rule.collectionKey]
        : Array.isArray(state)
          ? state
          : [];

      // Identitas data saat ini (untuk pengecualian diri sendiri saat UPDATE)
      const currentId = payload[rule.idField || "id"] || payload.documentId;

      // Konteks Scope Perusahaan / Outlet
      const localCompanyId =
        payload.companyId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("__unv_companyId")
          : "") ||
        "";

      const duplicate = items.find((existing) => {
        // 1. Lewati diri sendiri jika sedang UPDATE
        const existingId = existing.id || existing.documentId;
        if (
          currentId &&
          existingId &&
          String(currentId) === String(existingId)
        ) {
          return false;
        }

        // 2. Filter Scope Perusahaan (Holding)
        if (rule.scopeBy && rule.scopeBy.length > 0) {
          const isSameScope = rule.scopeBy.every((scopeKey) => {
            const pVal =
              payload[scopeKey] ||
              (scopeKey === "companyId" ? localCompanyId : undefined);
            const eVal =
              existing[scopeKey] ||
              existing.organization?.[scopeKey] ||
              existing.location?.[scopeKey];
            if (!pVal || !eVal) return true;
            return String(pVal).trim() === String(eVal).trim();
          });
          if (!isSameScope) return false;
        }

        // 3. Filter Kustom Tambahan (misal: membedakan barang vs jasa)
        if (rule.customFilter && !rule.customFilter(existing, payload)) {
          return false;
        }

        // 4. Pencocokan Field (Case-Insensitive & Trim)
        return rule.matchFields.every((field) => {
          const pVal = payload[field];
          const eVal = existing[field];
          if (typeof pVal === "string" && typeof eVal === "string") {
            return pVal.trim().toUpperCase() === eVal.trim().toUpperCase();
          }
          return pVal !== undefined && eVal !== undefined && pVal === eVal;
        });
      });

      if (duplicate) {
        throw new Error(rule.errorMessage);
      }
    }
  }
}
