// File: packages/core_unv/src/ledger/crypto.ts
import CryptoJS from "crypto-js";
import nacl from "tweetnacl";
import util from "tweetnacl-util";

const { encodeBase64, decodeUTF8, decodeBase64 } = util;

export class CryptoManager {
  /**
   * Canonicalize JSON: Mengurutkan keys sesuai abjad secara rekursif
   * dan MENGABAIKAN nilai undefined agar identik antara Klien & Server.
   */
  public static canonicalStringify(obj: any): string {
    if (obj === null || typeof obj !== "object") {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return (
        "[" + obj.map((item) => this.canonicalStringify(item)).join(",") + "]"
      );
    }
    const keys = Object.keys(obj).sort();
    const res: string[] = [];
    for (const key of keys) {
      // ---> PERBAIKAN KRUSIAL: Lewati key yang bernilai undefined <---
      if (obj[key] === undefined) {
        continue;
      }
      res.push(JSON.stringify(key) + ":" + this.canonicalStringify(obj[key]));
    }
    return "{" + res.join(",") + "}";
  }

  /** Menghasilkan hash SHA-256 (Menerima Objek atau String) */
  public static hash(data: any): string {
    const canonicalData =
      typeof data === "string" ? data : this.canonicalStringify(data);
    return CryptoJS.SHA256(canonicalData).toString(CryptoJS.enc.Hex);
  }

  /** Menghasilkan pasangan kunci public & private (Ed25519) */
  public static generateKeyPair() {
    const pair = nacl.sign.keyPair();
    return {
      publicKey: encodeBase64(pair.publicKey),
      secretKey: encodeBase64(pair.secretKey),
    };
  }

  /** Menandatangani hash dengan Secret Key perangkat */
  public static sign(data: string, secretKeyBase64: string): string {
    const secretKey = decodeBase64(secretKeyBase64);
    const signature = nacl.sign.detached(decodeUTF8(data), secretKey);
    return encodeBase64(signature);
  }

  /** Memvalidasi tanda tangan dari perangkat lain atau server */
  public static verify(
    data: string,
    signatureBase64: string,
    publicKeyBase64: string,
  ): boolean {
    try {
      const signature = decodeBase64(signatureBase64);
      const publicKey = decodeBase64(publicKeyBase64);
      return nacl.sign.detached.verify(decodeUTF8(data), signature, publicKey);
    } catch (e) {
      return false;
    }
  }
}

export class HLC {
  public static generate(nodeId: string, customNow?: number): string {
    const now = customNow || Date.now();
    return `${now}:0:${nodeId}`;
  }
}
