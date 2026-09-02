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

export interface ConversionVariantInput {
  value: number; // misal: 25
  uom: string; // misal: "KG"
}

/**
 * 1. Mengonversi kuantitas matematis antar satuan sejenis (Massa ke Massa, Volume ke Volume)
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
  if ((from === "KG" || from === "KILOGRAM") && target === "ONS") {
    return { convertedQty: qty * 10, ratio: 10 };
  }
  if ((from === "GRAM" || from === "G") && target === "ONS") {
    return { convertedQty: qty / 100, ratio: 0.01 };
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
 * 2. JANTUNG MATEMATIKA: Menghitung Rasio & Biaya HPP Berdasarkan Varian Kemasan
 * Mendukung konversi dari takaran mikro (Gram/ML) ke kemasan makro (Karung/Jerigen/Dus)
 */
export function calculatePackagingLossCost(
  inputQty: number,
  inputUom: string,
  baseUom: string,
  basePricePerUnit: number,
  variant?: ConversionVariantInput | null,
): {
  convertedBaseQty: number; // Berapa bagian kemasan master (misal: 0.02 Karung)
  convertedStandardQty: number; // Takaran dalam satuan varian (misal: 0.5 KG)
  standardUom: string; // Satuan standar (misal: "KG")
  unitCostPerStandard: number; // HPP per satuan standar (misal: Rp 4.000 / KG)
  totalCost: number; // Total Rupiah HPP / Kerugian
} {
  const cleanInputUom = (inputUom || "").toUpperCase().trim();
  const cleanBaseUom = (baseUom || "").toUpperCase().trim();

  // KASUS 1: BARANG MEMILIKI VARIAN KONVERSI KEMASAN (Misal: 1 KARUNG = 25 KG)
  if (variant && Number(variant.value) > 0 && variant.uom) {
    const variantStandardUom = variant.uom.toUpperCase().trim();
    const variantCapacity = Number(variant.value);

    // Langkah A: Konversi takaran input ke satuan standar varian (misal: 500 GRAM -> 0.5 KG)
    const { convertedQty: standardQty } = convertUomQty(
      inputQty,
      cleanInputUom,
      variantStandardUom,
    );

    // Langkah B: Hitung HPP per satuan standar (misal: Rp 100.000 / 25 KG = Rp 4.000 / KG)
    const unitCostPerStandard = Math.round(basePricePerUnit / variantCapacity);

    // Langkah C: Hitung bagian kemasan master untuk pemotongan stok (misal: 0.5 KG / 25 KG = 0.02 Karung)
    const convertedBaseQty = parseFloat(
      (standardQty / variantCapacity).toFixed(4),
    );

    // Langkah D: Hitung total biaya HPP
    const totalCost = Math.round(
      standardQty * (basePricePerUnit / variantCapacity),
    );

    return {
      convertedBaseQty,
      convertedStandardQty: standardQty,
      standardUom: variantStandardUom,
      unitCostPerStandard,
      totalCost,
    };
  }

  // KASUS 2: BARANG STANDAR TANPA VARIAN (Misal: Daging per KG, Telur per KG)
  const { convertedQty } = convertUomQty(inputQty, cleanInputUom, cleanBaseUom);
  const totalCost = Math.round(convertedQty * (basePricePerUnit || 0));

  return {
    convertedBaseQty: convertedQty,
    convertedStandardQty: convertedQty,
    standardUom: cleanBaseUom,
    unitCostPerStandard: basePricePerUnit,
    totalCost,
  };
}

/**
 * 3. BACKWARD-COMPATIBLE WRAPPER: Menjamin modul lama tidak error
 */
export function calculateLossCost(
  inputQty: number,
  inputUom: string,
  baseUom: string,
  basePricePerUnit: number,
  variant?: ConversionVariantInput | null,
): { convertedQty: number; totalCost: number } {
  const result = calculatePackagingLossCost(
    inputQty,
    inputUom,
    baseUom,
    basePricePerUnit,
    variant,
  );
  return {
    convertedQty: result.convertedBaseQty,
    totalCost: result.totalCost,
  };
}
