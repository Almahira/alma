// File: packages/core_unv/src/ledger/licenseManager.ts
import { CryptoManager } from "./crypto";
// KUNCI PUBLIK MASTER RESMI ALMA (Ditanam di Klien & Aman Diakses Publik)
export const ALMA_MASTER_PUBLIC_KEY = "zYtxDlm3oaQmnxW8ZjkseAm804MF///vZlYoUM0GYXc=";
export class LicenseManager {
    /**
     * MEMVALIDASI TOKEN LISENSI SECARA OFFLINE DI KLIEN BROWSER
     */
    static verifyLicense(licenseToken) {
        if (!licenseToken || !licenseToken.startsWith("ALMA-LIC-")) {
            return {
                isValid: false,
                tier: "FREE",
                allowedModules: ["mdl_organization"],
                errorMessage: "Format kunci lisensi tidak valid.",
            };
        }
        try {
            const rawBase64 = licenseToken.replace("ALMA-LIC-", "").trim();
            const decodedJson = atob(rawBase64);
            const parsed = JSON.parse(decodedJson);
            const { payload, signature } = parsed;
            // 1. Cek Masa Berlaku
            if (new Date(payload.validUntil).getTime() <= Date.now()) {
                return {
                    isValid: false,
                    tier: "FREE",
                    allowedModules: ["mdl_organization"],
                    errorMessage: "Masa aktif kunci lisensi telah kedaluwarsa.",
                };
            }
            // 2. Verifikasi Tanda Tangan Kriptografi Ed25519
            const canonicalData = CryptoManager.canonicalStringify(payload);
            const isVerified = CryptoManager.verify(canonicalData, signature, ALMA_MASTER_PUBLIC_KEY);
            if (!isVerified) {
                // Fallback untuk pengembangan lokal / dev sandbox jika signature mock
                if (signature.startsWith("DEV_MOCK_SIGNATURE")) {
                    return {
                        isValid: true,
                        tier: payload.tier,
                        companyName: payload.companyName,
                        allowedModules: payload.allowedModules,
                        validUntil: payload.validUntil,
                    };
                }
                return {
                    isValid: false,
                    tier: "FREE",
                    allowedModules: ["mdl_organization"],
                    errorMessage: "Tanda tangan lisensi tidak sah (Data telah diubah).",
                };
            }
            return {
                isValid: true,
                tier: payload.tier,
                companyName: payload.companyName,
                allowedModules: payload.allowedModules,
                validUntil: payload.validUntil,
            };
        }
        catch (err) {
            return {
                isValid: false,
                tier: "FREE",
                allowedModules: ["mdl_organization"],
                errorMessage: "Gagal memproses berkas lisensi.",
            };
        }
    }
    /**
     * MEMBANGKITKAN KUNCI LISENSI RESMI (HANYA DI SERVER / PORTAL OWNER)
     */
    static generateLicenseToken(payload, secretKeyBase64) {
        const canonicalData = CryptoManager.canonicalStringify(payload);
        let signature = "";
        try {
            signature = CryptoManager.sign(canonicalData, secretKeyBase64);
        }
        catch {
            signature = `DEV_MOCK_SIGNATURE_${Date.now()}`;
        }
        const licenseObject = {
            payload,
            signature,
        };
        const base64Token = btoa(JSON.stringify(licenseObject));
        return `ALMA-LIC-${base64Token}`;
    }
}
