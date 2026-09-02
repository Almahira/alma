// File: packages/core_unv/src/ledger/licenseManager.ts
import { CryptoManager } from "./crypto.js";
// PERINGATAN: Kunci Publik di bawah ini harus dipasangkan dengan Secret Key Ed25519 aslimu di .env
export const ALMA_MASTER_PUBLIC_KEY = "/wjmuBlzNSaIlk+03QrFaAQoY2WW+uH/74FmYoSY4hs=";
export class LicenseManager {
    /**
     * MEMVALIDASI TOKEN LISENSI SECARA OFFLINE DI KLIEN BROWSER & SERVER
     */
    static verifyLicense(licenseToken) {
        if (!licenseToken || !licenseToken.startsWith("ALMA-LIC-")) {
            return {
                isValid: false,
                tier: "FREE",
                allowedModules: ["mdl_organization"],
                maxOutlets: 10,
                errorMessage: "Format kunci lisensi tidak valid.",
            };
        }
        try {
            const rawBase64 = licenseToken.replace("ALMA-LIC-", "").trim();
            const decodedJson = atob(rawBase64);
            const parsed = JSON.parse(decodedJson);
            const { payload, signature } = parsed;
            const fallbackQuota = payload.tier === "EXCLUSIVE"
                ? 100
                : payload.tier === "PREMIUM"
                    ? 50
                    : 10;
            // 1. Cek Masa Berlaku
            if (new Date(payload.validUntil).getTime() <= Date.now()) {
                return {
                    isValid: false,
                    tier: payload.tier || "FREE",
                    companyName: payload.companyName,
                    allowedModules: payload.allowedModules || ["mdl_organization"],
                    validUntil: payload.validUntil,
                    maxOutlets: payload.maxOutlets || fallbackQuota,
                    errorMessage: "Masa aktif kunci lisensi telah kedaluwarsa.",
                };
            }
            // 2. Verifikasi Tanda Tangan Kriptografi Ed25519 Secara Ketat
            const canonicalData = CryptoManager.canonicalStringify(payload);
            const isVerified = CryptoManager.verify(canonicalData, signature, ALMA_MASTER_PUBLIC_KEY);
            // BLOK DEV_MOCK_SIGNATURE DIHAPUS. Tanda tangan wajib valid 100%.
            if (!isVerified) {
                return {
                    isValid: false,
                    tier: "FREE",
                    allowedModules: ["mdl_organization"],
                    maxOutlets: 10,
                    errorMessage: "Tanda tangan lisensi tidak sah (Data telah diubah).",
                };
            }
            return {
                isValid: true,
                tier: payload.tier,
                companyName: payload.companyName,
                allowedModules: payload.allowedModules,
                validUntil: payload.validUntil,
                maxOutlets: payload.maxOutlets || fallbackQuota,
            };
        }
        catch (err) {
            return {
                isValid: false,
                tier: "FREE",
                allowedModules: ["mdl_organization"],
                maxOutlets: 10,
                errorMessage: "Gagal memproses berkas lisensi.",
            };
        }
    }
    /**
     * MEMBANGKITKAN KUNCI LISENSI RESMI
     */
    static generateLicenseToken(payload, secretKeyBase64) {
        if (!secretKeyBase64 || secretKeyBase64 === "ALMA_SECRET_DEV_KEY") {
            throw new Error("Penerbitan lisensi ditolak: Kunci rahasia produksi belum dikonfigurasi.");
        }
        const canonicalData = CryptoManager.canonicalStringify(payload);
        // Metode sign() akan otomatis throw error jika gagal (bukan fallback ke mock lagi)
        const signature = CryptoManager.sign(canonicalData, secretKeyBase64);
        const licenseObject = {
            payload,
            signature,
        };
        const base64Token = btoa(JSON.stringify(licenseObject));
        return `ALMA-LIC-${base64Token}`;
    }
}
