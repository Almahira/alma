// File: modules/mdl_receiving/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
  AlmaTransactionEnvelope,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { ulid } from "ulidx";
import { useOrgStore } from "../../../mdl_organization/src/client/store";

function getActiveActor(): { userId: string; role: string } {
  try {
    const rawUser = localStorage.getItem("__unv_activeUser");
    const orgState = useOrgStore.getState();

    if (rawUser) {
      const user = JSON.parse(rawUser);
      const emp = orgState.employees.find((e) => e.id === user.employeeId);
      const actorName =
        emp?.fullName || user.fullName || user.username || "SUPER ADMIN";
      return { userId: actorName, role: user.role || "SUPER_ADMIN" };
    }

    if (orgState.userAccounts.length > 0) {
      const firstUser = orgState.userAccounts[0];
      const emp = orgState.employees.find((e) => e.id === firstUser.employeeId);
      if (emp) {
        return { userId: emp.fullName, role: firstUser.role || "SUPER_ADMIN" };
      }
    }
  } catch {}

  return { userId: "RENDI FAIZAL", role: "SUPER_ADMIN" };
}

export const receivingCommandHandlers: CommandHandler[] = [
  // 1. BUAT TRANSAKSI (CREATE)
  {
    commandType: "CREATE_RECEIVING",
    execute: async (cmd: Command) => {
      const transactionId = `RCV_${ulid()}`;
      const activeActor = getActiveActor();

      // Tanggal Nota Asli
      const documentDate = cmd.payload.date
        ? new Date(cmd.payload.date).toISOString()
        : new Date().toISOString();

      // Format Item dengan pembulatan rupiah yang presisi
      const formattedItems = (cmd.payload.items || []).map((item: any) => {
        const itemQty = Number(item.qty) || 1;
        const itemPrice = Math.round(Number(item.price) || 0);
        const itemSubtotal = Math.round(
          Number(item.subtotal) || itemQty * itemPrice,
        );

        return {
          id: item.id || `RITM_${ulid()}`,
          itemId: item.itemId,
          name: item.name,
          isExpense: item.isExpense || false,
          qty: itemQty,
          receivedQty: Number(item.receivedQty ?? itemQty) || 1,
          returnedQty: Number(item.returnedQty) || 0,
          price: itemPrice,
          subtotal: itemSubtotal,
          itemStatus: "RECEIVED",
        };
      });

      const rawTotalQty = formattedItems.reduce(
        (sum: number, it: any) => sum + (it.isExpense ? 1 : it.qty),
        0,
      );
      const totalQty = parseFloat(rawTotalQty.toFixed(4));

      const grandTotal = Math.round(
        formattedItems.reduce((sum: number, it: any) => sum + it.subtotal, 0),
      );

      const companyId =
        cmd.payload.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        cmd.payload.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        cmd.payload.outletId || localStorage.getItem("__unv_outletId") || null;
      const isTempo = Boolean(cmd.payload.isTempo);

      // BUNGKUS KE DALAM ALMA CANONICAL ENVELOPE DENGAN TANGGAL NOTA ASLI & RUPIAH BULAT
      const canonicalPayload: AlmaTransactionEnvelope<{
        items: any[];
        isTempo: boolean;
        paymentMethod: string;
        date: string;
      }> = {
        id: transactionId,
        type: "RECEIVING",
        action: "CREATE_RECEIVING",
        status: isTempo ? "DRAFT" : "COMPLETED",
        timestamp: documentDate,
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: {
          regionId,
          outletId,
          warehouseId: regionId,
        },
        reference: {
          invoiceNumber: cmd.payload.invoiceNumber,
          supplierId: cmd.payload.vendorId || null,
          dueDate: isTempo ? cmd.payload.dueDate : null,
          documentType: cmd.payload.documentType || "HUTANG",
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
          paid: isTempo ? 0 : grandTotal,
          balance: isTempo ? grandTotal : 0,
        },
        data: {
          items: formattedItems,
          isTempo,
          paymentMethod: cmd.payload.paymentMethod || "KASIR",
          date: documentDate,
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_CREATED",
        transactionId,
        "RECEIVING_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );

      if (!isTempo && grandTotal > 0) {
        const paymentId = `RPAY_${ulid()}`;
        const paymentPayload: AlmaTransactionEnvelope<{
          paymentId: string;
          paymentMethod: string;
          proofFileId: string | null;
        }> = {
          id: transactionId,
          type: "RECEIVING",
          action: "PAYMENT",
          status: "SUCCESS",
          timestamp: documentDate,
          actor: {
            id: activeActor.userId,
            name: activeActor.userId,
            role: activeActor.role,
          },
          organization: { companyId },
          location: { regionId, outletId },
          reference: { invoiceNumber: cmd.payload.invoiceNumber },
          amount: {
            subtotal: grandTotal,
            total: grandTotal,
            paid: grandTotal,
            balance: 0,
          },
          data: {
            paymentId,
            paymentMethod: cmd.payload.paymentMethod || "KASIR",
            proofFileId: null,
          },
        };
        await globalLedger.appendEvent(
          "RECEIVING_PAYMENT_ADDED",
          transactionId,
          "RECEIVING_DOCUMENT",
          2,
          paymentPayload,
          activeActor,
        );
      }
    },
  },

  // 2. TAMBAH CICILAN PEMBAYARAN (ADD PAYMENT)
  {
    commandType: "ADD_RECEIVING_PAYMENT",
    execute: async (cmd: Command) => {
      const { documentId, amount, paymentMethod, paymentDate, proofFileObj } =
        cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const paymentId = `RPAY_${ulid()}`;
      const activeActor = getActiveActor();

      // Bulatkan nominal cicilan Rupiah
      const paymentAmount = Math.round(Number(amount) || 0);

      let proofFileId: string | null = null;
      if (proofFileObj) {
        proofFileId = `PRF_${ulid()}`;
        await globalBlobManager.queueFileForUpload(
          proofFileId,
          "RECEIVING",
          documentId,
          proofFileObj,
        );
      }

      const canonicalPayload: AlmaTransactionEnvelope<{
        paymentId: string;
        amount: number;
        paymentMethod: string;
        paymentDate: string;
        proofFileId: string | null;
      }> = {
        id: documentId,
        type: "RECEIVING",
        action: "ADD_PAYMENT",
        status: "SUCCESS",
        timestamp: paymentDate || new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        amount: {
          subtotal: paymentAmount,
          total: paymentAmount,
          paid: paymentAmount,
          balance: 0,
        },
        data: {
          paymentId,
          amount: paymentAmount,
          paymentMethod,
          paymentDate: paymentDate || new Date().toISOString(),
          proofFileId,
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_PAYMENT_ADDED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 3. EDIT DRAFT TRANSAKSI (UPDATE)
  {
    commandType: "UPDATE_RECEIVING",
    execute: async (cmd: Command) => {
      const {
        documentId,
        items,
        isTempo,
        dueDate,
        date,
        invoiceNumber,
        vendorId,
        paymentMethod,
      } = cmd.payload;

      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const activeActor = getActiveActor();

      const documentDate = date
        ? new Date(date).toISOString()
        : new Date().toISOString();

      const formattedItems = (items || []).map((item: any) => {
        const itemQty = Number(item.qty) || 1;
        const itemPrice = Math.round(Number(item.price) || 0);
        const itemSubtotal = Math.round(
          Number(item.subtotal) || itemQty * itemPrice,
        );

        return {
          id: item.id || `RITM_${ulid()}`,
          itemId: item.itemId,
          name: item.name,
          isExpense: item.isExpense || false,
          qty: itemQty,
          receivedQty: Number(item.receivedQty ?? itemQty) || 1,
          returnedQty: Number(item.returnedQty) || 0,
          price: itemPrice,
          subtotal: itemSubtotal,
          itemStatus: "RECEIVED",
        };
      });

      const grandTotal = Math.round(
        formattedItems.reduce(
          (acc: number, curr: any) => acc + curr.subtotal,
          0,
        ),
      );
      const rawTotalQty = formattedItems.reduce(
        (acc: number, curr: any) => acc + (curr.isExpense ? 1 : curr.qty),
        0,
      );
      const totalQty = parseFloat(rawTotalQty.toFixed(4));

      const canonicalPayload: AlmaTransactionEnvelope<{
        items: any[];
        isTempo: boolean;
        paymentMethod: string;
        date: string;
      }> = {
        id: documentId,
        type: "RECEIVING",
        action: "UPDATE_RECEIVING",
        status: "DRAFT",
        timestamp: documentDate,
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        reference: {
          invoiceNumber,
          supplierId: vendorId || null,
          dueDate: isTempo ? dueDate : null,
        },
        quantity: {
          ordered: totalQty,
          received: totalQty,
          rejected: 0,
        },
        amount: {
          subtotal: grandTotal,
          total: grandTotal,
          paid: 0,
          balance: grandTotal,
        },
        data: {
          items: formattedItems,
          isTempo: Boolean(isTempo),
          paymentMethod: paymentMethod || "KASIR",
          date: documentDate,
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_UPDATED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 4. SELESAIKAN DOKUMEN (COMPLETE)
  {
    commandType: "COMPLETE_RECEIVING",
    execute: async (cmd: Command) => {
      const { documentId, documentType, outletId, regionId, companyId } =
        cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const activeActor = getActiveActor();

      const canonicalPayload: AlmaTransactionEnvelope<any> = {
        id: documentId,
        type: "RECEIVING",
        action: "COMPLETE_RECEIVING",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { regionId, outletId },
        reference: { documentType },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: {},
      };

      await globalLedger.appendEvent(
        "RECEIVING_COMPLETED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 5. BATALKAN TRANSAKSI RESMI (VOID)
  {
    commandType: "CANCEL_RECEIVING",
    execute: async (cmd: Command) => {
      const { documentId, cancelReason } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const activeActor = getActiveActor();

      const canonicalPayload: AlmaTransactionEnvelope<{
        cancelReason: string;
        cancelledAt: string;
      }> = {
        id: documentId,
        type: "RECEIVING",
        action: "VOID_RECEIVING",
        status: "CANCELLED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: {
          cancelReason:
            cancelReason || "Pembatalan Transaksi (VOID) oleh Pengguna",
          cancelledAt: new Date().toISOString(),
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_CANCELLED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 6. BUKA KEMBALI NOTA KE DRAFT (REOPEN)
  {
    commandType: "REOPEN_RECEIVING",
    execute: async (cmd: Command) => {
      const { documentId } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const activeActor = getActiveActor();

      const canonicalPayload: AlmaTransactionEnvelope<{
        reopenReason: string;
        reopenedAt: string;
      }> = {
        id: documentId,
        type: "RECEIVING",
        action: "REOPEN_TO_DRAFT",
        status: "DRAFT",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: {
          reopenReason: "Buka Kembali ke Draft untuk Revisi Data",
          reopenedAt: new Date().toISOString(),
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_REOPENED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 7. ARSIPKAN DRAFT (SOFT DELETE)
  {
    commandType: "ARCHIVE_RECEIVING",
    execute: async (cmd: Command) => {
      const { documentId } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      await globalLedger.appendEvent(
        "RECEIVING_ARCHIVED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },

  // 8. RESTORE DRAFT DARI ARSIP
  {
    commandType: "RESTORE_RECEIVING",
    execute: async (cmd: Command) => {
      const { documentId } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      await globalLedger.appendEvent(
        "RECEIVING_RESTORED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },

  // 9. VOID CICILAN PEMBAYARAN
  {
    commandType: "VOID_RECEIVING_PAYMENT",
    execute: async (cmd: Command) => {
      const { documentId, paymentId, voidReason } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(documentId)) + 1;
      const activeActor = getActiveActor();

      const canonicalPayload: AlmaTransactionEnvelope<{
        paymentId: string;
        voidReason: string;
      }> = {
        id: documentId,
        type: "RECEIVING",
        action: "VOID_PAYMENT",
        status: "VOID",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: {
          paymentId,
          voidReason: voidReason || "Koreksi Pembayaran Cicilan (VOID)",
        },
      };

      await globalLedger.appendEvent(
        "RECEIVING_PAYMENT_VOIDED",
        documentId,
        "RECEIVING_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },
];
