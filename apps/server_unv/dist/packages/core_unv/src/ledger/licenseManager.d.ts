export declare const ALMA_MASTER_PUBLIC_KEY = "/wjmuBlzNSaIlk+03QrFaAQoY2WW+uH/74FmYoSY4hs=";
export interface AlmaLicensePayload {
    licenseId: string;
    tier: "FREE" | "PREMIUM" | "EXCLUSIVE";
    companyName: string;
    issuedTo: string;
    phone?: string;
    maxOutlets: number;
    allowedModules: string[];
    validUntil: string;
}
export interface AlmaSignedLicense {
    payload: AlmaLicensePayload;
    signature: string;
}
export declare class LicenseManager {
    /**
     * MEMVALIDASI TOKEN LISENSI SECARA OFFLINE DI KLIEN BROWSER & SERVER
     */
    static verifyLicense(licenseToken: string): {
        isValid: boolean;
        tier: "FREE" | "PREMIUM" | "EXCLUSIVE";
        companyName?: string;
        allowedModules: string[];
        validUntil?: string;
        maxOutlets?: number;
        errorMessage?: string;
    };
    /**
     * MEMBANGKITKAN KUNCI LISENSI RESMI
     */
    static generateLicenseToken(payload: AlmaLicensePayload, secretKeyBase64: string): string;
}
