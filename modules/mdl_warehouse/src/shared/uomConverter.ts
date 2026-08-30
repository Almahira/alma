// File: modules/mdl_warehouse/src/shared/uomConverter.ts

/**
 * DAFTAR UOM RESMI TERKUNCI (ANTI-TYPO)
 */
export const STANDARD_UOMS = [
  // Massa
  { value: "KG", label: "Kilogram (KG)", type: "MASS", ratioToKg: 1 },
  { value: "GRAM", label: "Gram (GRAM)", type: "MASS", ratioToKg: 0.001 },
  { value: "ONS", label: "Ons (100 Gram)", type: "MASS", ratioToKg: 0.1 },

  // Volume
  { value: "LITER", label: "Liter (LITER)", type: "VOLUME", ratioToLiter: 1 },
  {
    value: "ML",
    label: "Mililiter (ML / CC)",
    type: "VOLUME",
    ratioToLiter: 0.001,
  },

  // Unit / Kemasan
  { value: "PCS", label: "Pieces (PCS)", type: "UNIT", ratioToPcs: 1 },
  { value: "BTL", label: "Botol (BTL)", type: "UNIT", ratioToPcs: 1 },
  { value: "PACK", label: "Pack (PACK)", type: "UNIT", ratioToPcs: 1 },
  { value: "IKAT", label: "Ikat (IKAT)", type: "UNIT", ratioToPcs: 1 },
  { value: "PORSI", label: "Porsi (PORSI)", type: "UNIT", ratioToPcs: 1 },
];

/**
 * Mengonversi kuantitas dari satuan input ke satuan master database
 */
export function convertUomQty(
  qty: number,
  fromUomRaw: string,
  targetUomRaw: string,
): { convertedQty: number; ratio: number } {
  const from = (fromUomRaw || "").toUpperCase().trim();
  const target = (targetUomRaw || "").toUpperCase().trim();

  if (from === target || !from || !target) {
    return { convertedQty: qty, ratio: 1 };
  }

  // 1. Konversi Kelompok Massa (KG <-> GRAM <-> ONS)
  if (
    (from === "GRAM" || from === "G") &&
    (target === "KG" || target === "KILOGRAM")
  ) {
    return { convertedQty: qty / 1000, ratio: 0.001 };
  }
  if (
    (from === "KG" || from === "KILOGRAM") &&
    (target === "GRAM" || target === "G")
  ) {
    return { convertedQty: qty * 1000, ratio: 1000 };
  }
  if (from === "ONS" && (target === "KG" || target === "KILOGRAM")) {
    return { convertedQty: qty / 10, ratio: 0.1 };
  }
  if (from === "ONS" && (target === "GRAM" || target === "G")) {
    return { convertedQty: qty * 100, ratio: 100 };
  }

  // 2. Konversi Kelompok Volume (LITER <-> ML <-> CC)
  if (
    (from === "ML" || from === "CC") &&
    (target === "LITER" || target === "LTR")
  ) {
    return { convertedQty: qty / 1000, ratio: 0.001 };
  }
  if (
    (from === "LITER" || from === "LTR") &&
    (target === "ML" || target === "CC")
  ) {
    return { convertedQty: qty * 1000, ratio: 1000 };
  }

  // Fallback 1:1 jika satuan kemasan khusus
  return { convertedQty: qty, ratio: 1 };
}

/**
 * Menghitung Nilai Kerugian HPP Berdasarkan Satuan Input
 */
export function calculateLossCost(
  inputQty: number,
  inputUom: string,
  baseUom: string,
  basePricePerUnit: number,
): { convertedQty: number; totalCost: number } {
  const { convertedQty } = convertUomQty(inputQty, inputUom, baseUom);
  const totalCost = Math.round(convertedQty * (basePricePerUnit || 0));
  return { convertedQty, totalCost };
}
