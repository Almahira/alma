export declare class CryptoManager {
    /**
     * Canonicalize JSON: Mengurutkan keys sesuai abjad secara rekursif
     * dan MENGABAIKAN nilai undefined agar identik antara Klien & Server.
     */
    static canonicalStringify(obj: any): string;
    /** Menghasilkan hash SHA-256 (Menerima Objek atau String) */
    static hash(data: any): string;
    /** Menghasilkan pasangan kunci public & private (Ed25519) */
    static generateKeyPair(): {
        publicKey: string;
        secretKey: string;
    };
    /** Menandatangani hash dengan Secret Key perangkat */
    static sign(data: string, secretKeyBase64: string): string;
    /** Memvalidasi tanda tangan dari perangkat lain atau server */
    static verify(data: string, signatureBase64: string, publicKeyBase64: string): boolean;
}
export declare class HLC {
    static generate(nodeId: string, customNow?: number): string;
}
