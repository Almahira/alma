// File: apps/server_unv/src/utils/snapshotEnricher.ts

export interface RelationResolver {
  sourceTable: string; // Nama tabel master sumber data
  primaryKey?: string; // Kolom Primary Key (default: 'id')
  injectFields: (
    masterEntity: any,
    lookupTables: Map<string, Map<string, any>>,
  ) => Record<string, any>;
}

/**
 * ============================================================================
 * KAMUS RELASI SKEMA GLOBAL (SCHEMA RELATION DICTIONARY)
 * ============================================================================
 * Mendaftarkan setiap Foreign Key ID standar Alma ERP beserta paket field
 * representasi kanonikal (Shallow String Injection) yang dibutuhkan client.
 */
export const SCHEMA_RELATION_DICTIONARY: Record<string, RelationResolver> = {
  // 1. Relasi ke Produk Master (Domain: ITEM_DOMAIN)
  itemId: {
    sourceTable: "itemProducts",
    primaryKey: "id",
    injectFields: (product, lookupTables) => {
      const catMap = lookupTables.get("itemCategories");
      const uomMap = lookupTables.get("itemUoms");

      const catName = product?.categoryId
        ? catMap?.get(product.categoryId)?.name
        : null;
      const uomName = product?.uomId ? uomMap?.get(product.uomId)?.name : null;

      return {
        // Mendukung kompatibilitas ganda (name maupun itemName)
        name: product?.name || "-",
        itemName: product?.name || "-",
        categoryName: catName || "-",
        uomName: uomName || "-",
        isExpense: Boolean(product?.isExpense),
      };
    },
  },

  // 2. Relasi ke Kategori Produk (Domain: ITEM_DOMAIN)
  categoryId: {
    sourceTable: "itemCategories",
    primaryKey: "id",
    injectFields: (category) => ({
      categoryName: category?.name || "-",
    }),
  },

  // 3. Relasi ke Satuan UOM (Domain: ITEM_DOMAIN)
  uomId: {
    sourceTable: "itemUoms",
    primaryKey: "id",
    injectFields: (uom) => ({
      uomName: uom?.name || "-",
    }),
  },

  // 4. Relasi ke Vendor / Pemasok (Domain: VENDOR)
  vendorId: {
    sourceTable: "vendors",
    primaryKey: "id",
    injectFields: (vendor) => ({
      vendorName: vendor?.name || "-",
      vendorBankName: vendor?.bankName || "-",
      vendorBankAccount: vendor?.bankAccount || "-",
      vendorBankAccountName: vendor?.bankAccountName || "-",
    }),
  },

  // 5. Relasi ke Cabang Outlet (Domain: ORGANIZATION)
  outletId: {
    sourceTable: "outlets",
    primaryKey: "id",
    injectFields: (outlet) => ({
      outletName: outlet?.name || "-",
    }),
  },

  // 6. Relasi ke Wilayah / Gudang Pusat (Domain: ORGANIZATION)
  regionId: {
    sourceTable: "regions",
    primaryKey: "id",
    injectFields: (region) => ({
      regionName: region?.name || "-",
    }),
  },

  // 7. Relasi ke Divisi (Domain: ORGANIZATION)
  divisionId: {
    sourceTable: "divisions",
    primaryKey: "id",
    injectFields: (division) => ({
      divisionName: division?.name || "-",
    }),
  },

  // 8. Relasi ke Karyawan / Pegawai (Domain: ORGANIZATION)
  employeeId: {
    sourceTable: "employees",
    primaryKey: "id",
    injectFields: (employee) => ({
      employeeName: employee?.fullName || employee?.name || "-",
    }),
  },
};

/**
 * ============================================================================
 * UNIVERSAL RECORD ENRICHER
 * ============================================================================
 * Menelusuri seluruh record dokumen dan sub-array (seperti items) secara rekursif.
 * Jika menemukan Foreign Key yang terdaftar di Kamus, field display diinjeksi otomatis.
 */
export function enrichWithSchemaDictionary(
  data: any,
  lookupTables: Map<string, Map<string, any>>,
): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => enrichWithSchemaDictionary(item, lookupTables));
  }

  const enriched: Record<string, any> = { ...data };

  // 1. Pindai setiap properti di objek ini
  for (const [key, value] of Object.entries(data)) {
    const resolver = SCHEMA_RELATION_DICTIONARY[key];

    // Jika properti merupakan foreign key yang terdaftar di kamus
    if (resolver && typeof value === "string" && value.trim() !== "") {
      const tableMap = lookupTables.get(resolver.sourceTable);
      const masterEntity = tableMap?.get(value);

      if (masterEntity) {
        const injectedFields = resolver.injectFields(
          masterEntity,
          lookupTables,
        );

        // Injeksi field baru jika belum ada nilainya (non-destructive)
        for (const [injKey, injVal] of Object.entries(injectedFields)) {
          if (
            enriched[injKey] === undefined ||
            enriched[injKey] === null ||
            enriched[injKey] === ""
          ) {
            enriched[injKey] = injVal;
          }
        }
      }
    }

    // 2. Jika ada properti berupa sub-array (misal: items, dynamicItems, payments), telusuri ke dalam
    if (Array.isArray(value)) {
      enriched[key] = enrichWithSchemaDictionary(value, lookupTables);
    } else if (value && typeof value === "object" && !(value instanceof Date)) {
      enriched[key] = enrichWithSchemaDictionary(value, lookupTables);
    }
  }

  return enriched;
}
