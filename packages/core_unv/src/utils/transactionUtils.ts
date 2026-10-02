// File: packages/core_unv/src/utils/transactionUtils.ts

export const SYSTEM_AGGREGATES = [
  "COMPANY",
  "REGION",
  "OUTLET",
  "DICTIONARY",
  "USER",
  "USER_ACCOUNT",
  "ROLE",
  "EMPLOYEE",
  "DIVISION",
  "POSITION",
  "DOCUMENT_TYPE",
  "VENDOR",
  "ITEM_DOMAIN",
  "ITEM_CATEGORY",
  "ITEM_UOM",
  "ITEM_PRODUCT",
  "EXECUTIVE_PANEL",
  "EXECUTIVE_TARGET",
  "WHATSAPP_CONFIG",
  "WHATSAPP_MESSAGE",
];

export function isTransactionAggregate(aggregateType: string): boolean {
  return !SYSTEM_AGGREGATES.includes(aggregateType);
}
