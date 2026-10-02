// File: modules/mdl_whatsapp/src/server/poParser.ts
import { db } from "../../../../apps/server_unv/src/config/db.js";
import { eq, and } from "drizzle-orm";
import { itemProducts } from "../../../mdl_item/src/server/schema.js";
import { outlets } from "../../../mdl_organization/src/server/schema.js";
import { publishEvent } from "../../../../apps/server_unv/src/config/nats.js";
import { waMessages } from "./schema.js";
import { ulid } from "ulidx";

function sanitizeWhatsAppLine(rawLine: string): string {
  return rawLine
    .replace(/[\u200B-\u200D\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u00AD\u034F\u180B-\u180D\uFE00-\uFE0F]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s•*\-–—]+/, "")
    .trim();
}

// Algoritma Levenshtein Distance dengan Strict Typing & Null Safety
function similarity(
  s1: string | null | undefined,
  s2: string | null | undefined,
): number {
  if (!s1 || !s2) return 0;
  const str1 = String(s1).toLowerCase().trim();
  const str2 = String(s2).toLowerCase().trim();
  if (str1 === str2) return 1.0;

  const longer = str1.length >= str2.length ? str1 : str2;
  const shorter = str1.length < str2.length ? str1 : str2;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longerLength - costs[shorter.length]) / longerLength;
}

export interface ParsedItem {
  itemId: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export class WhatsAppPOParser {
  /**
   * Ekstraksi teks pesanan dari chat WhatsApp
   */
  public static async parseAndCreateReceiving(params: {
    messageId: string;
    text: string;
    companyId: string;
    vendorId: string;
    outletId: string;
    senderName: string;
  }): Promise<{ success: boolean; receivingId?: string; itemCount: number }> {
    const { messageId, text, companyId, vendorId, outletId, senderName } =
      params;

    // 1. Ambil data cabang outlet
    const outletRows = await db
      .select()
      .from(outlets)
      .where(eq(outlets.id, outletId))
      .limit(1);

    const outletObj = outletRows[0];
    const regionId = outletObj?.regionId || null;
    const outletCode = outletObj?.code || "CAB";

    // 2. Ambil katalog produk aktif untuk holding ini
    const allProducts = await db
      .select()
      .from(itemProducts)
      .where(
        and(
          eq(itemProducts.companyId, companyId),
          eq(itemProducts.isActive, true),
        ),
      );

    // 3. Pecah teks baris per baris
    const lines = text.replace(/\r/g, "\n").split("\n");
    const parsedItems: ParsedItem[] = [];

    for (const rawLine of lines) {
      const line = sanitizeWhatsAppLine(rawLine);

      if (!line || line.startsWith("#") || line.length < 3) continue;
      if (/^\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4}$/.test(line)) continue;
      if (/^(?:@?\d+|[A-Z0-9_@]+)$/.test(line)) continue;

      // Regex mendeteksi baris item & kuantitas
      const match = line.match(
        /^\s*(?:[-*•]\s*)?([\p{L}\p{N}][\p{L}\p{N}\s'’\-./&]+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]{0,5})?\s*$/u,
      );

      if (match) {
        // Safe Destructuring menghindari bug pemanggilan .trim() pada array
        const [, rawName, rawQty] = match;
        if (!rawName || !rawQty) continue;

        const rawItemName = rawName.trim().toUpperCase();
        const rawQtyStr = rawQty.trim().replace(",", ".");
        const qty = parseFloat(rawQtyStr) || 1;

        if (qty <= 0 || qty > 10000) continue;

        // Cari produk dengan kemiripan tertinggi (Fuzzy Match >= 65%)
        let bestMatch: any = null;
        let highestSim = 0;

        for (const prod of allProducts) {
          if (!prod?.name) continue;
          const sim = similarity(rawItemName, prod.name);
          if (sim > highestSim) {
            highestSim = sim;
            bestMatch = prod;
          }
        }

        if (bestMatch && highestSim >= 0.65) {
          const pricing = bestMatch.pricing || {};
          const scopePricing =
            pricing[outletId] ||
            pricing[regionId || ""] ||
            pricing["DEFAULT"] ||
            {};
          const basePrice = Math.round(Number(scopePricing.basePrice || 0));

          parsedItems.push({
            itemId: bestMatch.id,
            name: bestMatch.name,
            qty,
            price: basePrice,
            subtotal: Math.round(qty * basePrice),
          });
        }
      }
    }

    if (parsedItems.length === 0) {
      return { success: false, itemCount: 0 };
    }

    // 4. Hitung Total
    const grandTotal = parsedItems.reduce((sum, it) => sum + it.subtotal, 0);
    const totalQty = parsedItems.reduce((sum, it) => sum + it.qty, 0);

    const transactionId = `RCV_${ulid()}`;
    const nowIso = new Date().toISOString();
    const dateFormatted = nowIso.slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `PO-WA-${dateFormatted}-${outletCode}`;

    // 5. Bungkus ke Amplop Transaksi Baku ALMA (RECEIVING_CREATED DRAFT)
    const canonicalPayload = {
      id: transactionId,
      type: "RECEIVING",
      action: "CREATE_RECEIVING",
      status: "DRAFT",
      timestamp: nowIso,
      actor: {
        id: `WA_BOT`,
        name: `WA: ${senderName}`,
        role: "WA_GATEWAY",
      },
      organization: { companyId },
      location: { regionId, outletId, warehouseId: regionId },
      reference: {
        invoiceNumber,
        supplierId: vendorId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        documentType: "HUTANG",
        vendorSource: "EXTERNAL",
      },
      quantity: {
        ordered: totalQty,
        received: totalQty,
        rejected: 0,
      },
      amount: {
        subtotal: grandTotal,
        tax: 0,
        discount: 0,
        total: grandTotal,
        paid: 0,
        balance: grandTotal,
      },
      data: {
        items: parsedItems.map((it) => ({
          id: `RITM_${ulid()}`,
          itemId: it.itemId,
          name: it.name,
          isExpense: false,
          qty: it.qty,
          receivedQty: it.qty,
          returnedQty: 0,
          price: it.price,
          subtotal: it.subtotal,
          itemStatus: "RECEIVED",
        })),
        isTempo: true,
        paymentMethod: "KASIR",
        date: nowIso,
        source: "WHATSAPP_AUTO_PO",
      },
    };

    // 6. Terbitkan ke NATS JetStream
    const eventDoc = {
      id: `EVT_${ulid()}`,
      aggregateId: transactionId,
      aggregateType: "RECEIVING_DOCUMENT",
      aggregateVersion: 1,
      type: "RECEIVING_CREATED",
      payload: canonicalPayload,
      dddMetadata: {
        eventId: `EVT_${ulid()}`,
        aggregateId: transactionId,
        aggregateType: "RECEIVING_DOCUMENT",
        aggregateVersion: 1,
        actor: { userId: `WA_${senderName}`, role: "WA_GATEWAY" },
        businessDate: nowIso.slice(0, 10),
      },
    };

    await publishEvent("events.sync.up", eventDoc);

    // 7. Tandai pesan WA telah berhasil di-parse
    await db
      .update(waMessages)
      .set({ isPoParsed: true, receivingId: transactionId })
      .where(eq(waMessages.id, messageId));

    console.log(
      `[WA PO PARSER] Berhasil menerbitkan draft Receiving (${transactionId}) untuk Outlet ${outletId}: ${parsedItems.length} item.`,
    );

    return {
      success: true,
      receivingId: transactionId,
      itemCount: parsedItems.length,
    };
  }
}
