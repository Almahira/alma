# 📘 PANDUAN PENGEMBANGAN MODUL (ALMA MODULE DEVELOPER HANDBOOK)

Dokumen ini adalah **standar baku dan cetakan resmi** bagi setiap pengembang yang akan membuat atau memodifikasi modul bisnis di dalam ekosistem Alma ERP.

> **Prinsip Utama:**
> _"Plugin/Modul bebas memiliki logika bisnisnya sendiri, tetapi seluruh fakta bisnis, mutasi data, dan antarmukanya wajib berbicara dalam bahasa universal yang dipahami oleh seluruh ekosistem Alma."_

---

## 🗺️ 1. Peta Struktur Monorepo & Alur Impor

Berikut adalah peta struktur direktori proyek Alma ERP untuk memandu jalur impor berkas (_relative path_):

```text
AlmaAPP/
├── packages/
│   ├── core_unv/               <-- MESIN UTAMA (LEDGER, CQRS, RUNTIME, I/O, PLUGIN)
│   │   └── src/
│   │       ├── cqrs/           <-- CommandBus, UniversalRegistry, types.ts
│   │       ├── ledger/         <-- UniversalLedger, OutboxDaemon, Crypto, Integrity
│   │       ├── io/             <-- BlobManager, ExcelEngine, PdfEngine, CircuitBreaker
│   │       └── runtime/        <-- Scheduler, SubscriptionManager, Telemetry
│   └── db-schema/              <-- SKEMA DATABASE POSTGRESQL GLOBAL
│       └── schema/             <-- journal.ts, telemetry.ts, device.ts
├── apps/
│   ├── server_unv/             <-- BACKEND SERVER (EXPRESS, NATS WORKER, SOCKET.IO)
│   └── client_unv/             <-- FRONTEND SPA (VITE, REACT, ROUTER, TAILWIND)
│       └── src/
│           ├── shared-ui/      <-- UniversalLayout, UniversalCombobox, useToastStore
│           └── system-ui/      <-- SetupWizard, DataManager, DiagnostikDashboard
└── modules/                    <-- WILAYAH MODUL BISNIS
    ├── mdl_organization/       <-- Master Perusahaan, Cabang, Karyawan, Akun
    ├── mdl_item/               <-- Master Produk, Kategori, Satuan, Harga
    ├── mdl_vendor/             <-- Master Vendor & Rekening Pembayaran
    ├── mdl_receiving/          <-- Transaksi Penerimaan, Hutang & Kasir
    └── mdl_[nama_modul_baru]/  <-- MODUL BARU ANDA
        └── src/
            ├── index.ts        <-- Manifest Plugin
            ├── shared/         <-- In-Memory CQRS Projection
            ├── server/         <-- Drizzle Schema & Event Handlers
            └── client/         <-- Halaman UI, Form, Features (Excel/PDF)
```

📍 Jalur Impor Baku dari dalam Modul (modules/mdl_xxx/src/...):
Core CQRS & Ledger: ../../../../packages/core_unv/src/cqrs/CommandBus / UniversalLedger

Tipe Universal Alma: ../../../../packages/core_unv/src/cqrs/types

Modal Universal Layout: ../../../../apps/client_unv/src/shared-ui/UniversalLayout

Toast Store Global: ../../../../apps/client_unv/src/shared-ui/useToastStore

Universal Combobox (No-Mouse): ../../../../apps/client_unv/src/shared-ui/UniversalCombobox

Store Modul Lain (Contoh Organisasi): ../../../mdl_organization/src/client/store

Store Modul Lain (Contoh Item): ../../../mdl_item/src/client/store

🍳 2. Resep Praktis Pengembang (Code Cookbooks)
🧩 Resep A: Membuka Modal (Universal Modals)
Aturan: DILARANG menggunakan useState modal lokal yang rapuh. Wajib menggunakan hook useUniversalModal() dari UniversalLayout.

import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";

export function MyComponent() {
const { openSideOver, openCenterModal, openAlert, closeSideOver, closeCenterModal } = useUniversalModal();

// 1. Form di Panel Samping (SideOver Drawer)
const handleOpenDrawer = () => {
openSideOver({
title: "TAMBAH DATA BARU",
width: "w-[500px]",
content: <MyForm onClose={closeSideOver} />,
});
};

// 2. Modal Pop-up Tengah (CenterModal)
const handleOpenPopup = () => {
openCenterModal({
title: "RINCIAN DATA",
content: <MyDetailModal onClose={closeCenterModal} />,
});
};

// 3. Dialog Konfirmasi / Peringatan (AlertDialog)
const handleDelete = (id: string, name: string) => {
openAlert({
title: "Konfirmasi Hapus",
message: `Apakah Anda yakin ingin mengarsipkan "${name}"?`,
confirmText: "YA, ARSIPKAN",
onConfirm: async () => {
await globalCommandBus.execute({ type: "ARCHIVE_MY_DATA", payload: { id } });
},
});
};

return (
<button onClick={handleOpenDrawer} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold">
Buka Form
</button>
);
}

🔔 Resep B: Menampilkan Toast Notifikasi
Aturan: Gunakan sysToast. Dapat dipanggil dari komponen React maupun fungsi Core biasa di luar React.
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

sysToast.success("Berhasil", "Data transaksi berhasil disimpan.");
sysToast.error("Gagal Menyimpan", "Nominal pembayaran melebihi sisa hutang!");
sysToast.warn("Peringatan", "Stok barang di cabang ini menipis.");
sysToast.info("Informasi", "Laporan sedang diproses di latar belakang.");

⚡ Resep C: Mengirim Command (Event Sourcing Mutasi)
Aturan: DILARANG melakukan insert/update langsung ke database atau memanipulasi state lokal secara liar. Seluruh perubahan data WAJIB melalui globalCommandBus.execute().

import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";

// Di dalam komponen form saat submit:
const handleSave = async (e: React.FormEvent) => {
e.preventDefault();
try {
await globalCommandBus.execute({
type: isEditMode ? "UPDATE_MY_DATA" : "CREATE_MY_DATA",
payload: {
...formData,
},
});
sysToast.success("Sukses", "Data berhasil dikirim ke ledger.");
onClose();
} catch (error: any) {
sysToast.error("Gagal", error.message);
}
};

📊 Resep D: Menambah Template Excel & Cetak PDF

1. Definisi Skema & Fitur Excel (src/client/features/excel-my-module.ts):
   import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
   import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const myExcelSchema: ExcelTemplateSchema = {
entityType: "DATA_MY_MODULE",
sheetName: "DATA",
instructionNote: "Isi data dengan lengkap. Kolom bertanda WAJIB tidak boleh kosong.",
columns: [
{ header: "NAMA ITEM (WAJIB)", key: "name", example: "Kopi Arabica", required: true },
{ header: "HARGA", key: "price", example: 25000 },
],
};

// 1. Unduh Template Excel Kosong
export const downloadMyTemplate = () => {
ExcelEngine.downloadTemplate(myExcelSchema, "Template_Import_MyModule");
};

// 2. Export Data ke Excel
export const exportMyExcel = (dataList: any[]) => {
ExcelEngine.exportData(myExcelSchema, dataList, `Export_Data_${Date.now()}`);
};

2. Cetak Dokumen PDF Resmi (src/client/features/pdf-my-module.ts):
   import jsPDF from "jspdf";
   import autoTable from "jspdf-autotable";

export const printMyReportPdf = (dataList: any[], reportTitle: string, unitName: string) => {
const pdf = new jsPDF("p", "pt", "a4");

// Header Laporan
pdf.setFontSize(15);
pdf.setFont("helvetica", "bold");
pdf.text(reportTitle.toUpperCase(), 40, 40);

pdf.setFontSize(9);
pdf.setFont("helvetica", "normal");
pdf.text(`Unit / Lokasi : ${unitName} | Tanggal: ${new Date().toLocaleDateString("id-ID")}`, 40, 58);

const rows = dataList.map((item, idx) => [
idx + 1,
item.name,
`Rp ${(item.price || 0).toLocaleString()}`,
item.status,
]);

autoTable(pdf, {
head: [["NO", "NAMA ITEM", "HARGA", "STATUS"]],
body: rows,
startY: 75,
theme: "striped",
headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
});

pdf.save(`Laporan_${reportTitle}_${Date.now()}.pdf`);
};

📜 3. Kontrak Baku & Aturan Wajib (The Enterprise Law)

1. Kontrak Amplop Transaksi (AlmaTransactionEnvelope)
   Seluruh event transaksi WAJIB membungkus datanya dalam struktur amplop universal berikut:
   import { AlmaTransactionEnvelope } from "../../../../packages/core_unv/src/cqrs/types";

const canonicalPayload: AlmaTransactionEnvelope = {
id: transactionId,
type: "MY_TRANSACTION",
action: "CREATE",
status: "DRAFT",
timestamp: new Date().toISOString(),
actor: { id: actor.userId, name: actor.userId, role: actor.role },
organization: { companyId: localCompanyId },
location: { regionId: localRegionId, outletId: localOutletId },
reference: { invoiceNumber: "INV-001", supplierId: "VND-01" },
quantity: { ordered: 10, received: 10, rejected: 0 },
amount: { subtotal: 100000, tax: 0, discount: 0, total: 100000, paid: 0, balance: 100000 },
data: { ...dataKhususModulAnda },
};

2. Standar Kosakata Status (AlmaStatus)
   Hanya gunakan status universal:

DRAFT — Konsep awal / belum dieksekusi.

PENDING — Menunggu approval / validasi pusat.

SUCCESS — Berhasil / Sah.

COMPLETED — Transaksi selesai dan terkunci permanen.

CANCELLED — Dibatalkan / VOID.

VOID — Pembayaran / transaksi resmi yang dianulir.

3. Konvensi Penamaan Event Transaksional
   Modul Transaksi WAJIB menamai event dengan awalan TX*[NAMA_MODUL]*... (atau RECEIVING\_...) agar otomatis dirouting ke tx_event_journal oleh NATS Sync Worker.

Modul Master Data menggunakan penamaan domain murni (misal: CATEGORY_CREATED, ITEM_UPDATED).

4. Resolusi Aktor Nyata
   DILARANG keras melakukan hardcode actor = "SYS_ADMIN". Wajib gunakan resolver nama asli karyawan:
   function getActiveActor() {
   const rawUser = localStorage.getItem("\_\_unv_activeUser");
   // Telusuri ke Master SDM: user.employeeId -> employee.fullName
   }

5. Multi-Tier Spatial Inheritance
   Form input transaksi wajib mewarisi konteks spasial perangkat lokal secara otomatis:
   const companyId = localStorage.getItem("**unv_companyId");
   const regionId = localStorage.getItem("**unv_regionId");
   const outletId = localStorage.getItem("\_\_unv_outletId");

6. Tipografi Kontras Tinggi & Dark Mode
   DILARANG menggunakan teks gelap pada latar gelap.

Gunakan CSS variables: bg-(--bg-card), bg-(--bg-input), text-(--text-primary), text-(--text-secondary), border-(--border-color).

Input tanggal wajib menyertakan kelas: dark:[color-scheme:dark] agar ikon kalender browser berwarna putih terang saat mode gelap.

📡 4. Komunikasi Lintas Modul (Cross-Module Listening)
Modul Anda dapat mendengarkan (listen) event dari modul lain tanpa perlu mengimpor kodenya secara langsung:

A. Mendengarkan Event di Proyeksi CQRS:
// File: src/shared/MyProjection.ts
export class MyProjection implements ProjectionHandler<MyState> {
aggregateType = "MY_DOMAIN";

// Daftarkan nama agregat lain yang ingin didengarkan telinganya
listenTo = ["ORGANIZATION", "ITEM_DOMAIN", "VENDOR"];

public applyEvent(event: LedgerEventDoc): void {
const { type, payload } = event;

    // Menangkap event dari modul Item saat harga berubah
    if (type === "PRODUCT_UPDATED") {
      this.recalculateCustomPricing(payload);
    }

}
}

B. Mengakses Data Store Modul Lain:
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useVendorStore } from "../../../mdl_vendor/src/client/store";

export function MyView() {
const { companies, regions, outlets } = useOrgStore();
const { products, categories } = useItemStore();
const { vendors } = useVendorStore();
// Gunakan data secara reaktif dan aman
}

🛡️ 5. Standar Pengujian Produksi (Zero Half-Baked Policy)
ATURAN MUTLAK: Dilarang mempublikasikan modul yang berstatus "setengah jadi" atau sekadar tampilan dummy tanpa fungsi.

📋 Checklist Uji Wajib Sebelum Rilis Modul:
[ ] Zero Dummy Button: Tidak ada tombol bertuliskan "Fitur menyusul" atau alert() kosong. Seluruh tombol wajib terhubung ke aksi nyata.

[ ] Siklus Hidup Tuntas: Modul Master memiliki alur CREATE ➡️ UPDATE ➡️ ARSIP ➡️ RESTORE. Modul Transaksi memiliki alur DRAFT ➡️ COMPLETE ➡️ VOID ➡️ REOPEN.

[ ] Uji Anti-Data Hantu: Modul tidak boleh menyisakan data yatim saat database di-reset.

[ ] Uji Angka & Typo Separator: Input kuantitas (QTY) dan harga wajib lolos uji angka pecahan desimal (seperti 2,5 kg atau 1.500,50).

[ ] Uji Dark Mode: Seluruh teks, tabel, input, dan popover harus terbaca jelas dan tajam baik di tema Terang maupun Gelap.

[ ] Uji Offline & Sync: Putus koneksi internet ➡️ buat transaksi ➡️ sambungkan internet ➡️ data wajib tersinkronisasi ke server tanpa race condition.
