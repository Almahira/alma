# 🏛️ SPESIFIKASI ARSITEKTUR MESIN UTAMA (ALMA ENGINE ARCHITECTURE SPECIFICATION)

Dokumen ini menjelaskan arsitektur dasar, pilar teknologi, mekanisme ketahanan terdistribusi (_distributed resilience_), dan matriks kegagalan (_failure mode_) dari **Alma Universal Core Engine (`_unv`)**.

---

## 🏛️ Arsitektur Tingkat Tinggi (High-Level Architecture)

Alma ERP mengusung paradigma **Local-First Distributed Event Sourcing with CQRS & Micro-Kernel Plugins**:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT WORKSPACE (BROWSER)                               │
│                                                                                         │
│  [ React UI Modules ] ──► [ Command Bus ] ──► [ Universal Ledger (RxDB / Dexie) ]       │
│           ▲                                                    │ (Outbox insert$)       │
│           │ (Reaktif O(1))                                     ▼                        │
│  [ In-Memory Projections ] ◄── [ Event Bus ] ◄───────── [ Outbox Daemon ]               │
└────────────────────────────────────┬───────────────────────────┬────────────────────────┘
                                     │ (HTTP Pull Sync)          │ (Socket.IO Realtime)
                                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                ALMA SERVER INFRASTRUCTURE                               │
│                                                                                         │
│  [ Express API Gateway ] ────► [ Socket.IO Server ] ────► [ NATS JetStream (ERP_STREAM) ]│
│                                                                    │                     │
│                                                                    ▼                     │
│  [ PostgreSQL 16 ] ◄──── [ Drizzle ORM ] ◄────────────── [ Sync Worker Group ]          │
│  ├── system_event_journal                                  (3-Way Merge & DLQ)          │
│  ├── tx_event_journal                                                                   │
│  └── device_registry                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## ⚙️ Rincian 8 Pilar Sistem Alma Engine

### 01 — Ledger & Event Infrastructure

- **RxDB & Dexie**: Database lokal di browser berbasis IndexedDB dengan performa tinggi.
- **Hash Chain SHA-256**: Setiap event lokal dikaitkan secara kriptografis (`seq`, `prevHash`, `hash`) untuk menjamin data tidak bisa dimanipulasi (anti-tamper).
- **Ed25519 Cryptography**: Setiap perangkat fisik memiliki pasangan kunci publik/privat untuk menandatangani identitas event.
- **Hybrid Logical Clock (HLC)**: Pengurutan waktu logis terdistribusi (`timestamp:count:nodeId`) untuk mencegah kekacauan urutan event lintas perangkat.
- **Optimistic Concurrency Control (OCC)**: Deteksi benturan versi agregat di klien dan penangkapan error PostgreSQL 23505 di server.
- **Outbox Draining Loop**: Daemon pengirim event keluar dengan loop `while(true)` bertingkat untuk mencegah queue starvation dan race condition.
- **Snapshot Engine**: Pemotretan kondisi memori (Read Model) secara berkala untuk pemuatan instan (< 1ms) saat aplikasi dibuka kembali.

### 02 — CQRS (Command Query Responsibility Segregation)

- **Command Bus**: Jalur pipa eksekusi perintah mutasi data yang terisolasi dari proses pembacaan.
- **Universal Registry**: Penyimpan in-memory state seluruh agregat yang reaktif.
- **Cross-Aggregate Listeners**: Mekanisme telinga event lintas modul tanpa tight-coupling.
- **Event Replay**: Kemampuan membangun ulang seluruh kondisi aplikasi dari sequence 0 jika terjadi kerusakan state.

### 03 — Distributed Synchronization & Ketahanan Jaringan

- **NATS JetStream**: Mesin antrean pesan terdistribusi berkinerja tinggi dengan jaminan pengiriman At-Least-Once.
- **3-Way Merge Conflict Resolution**: Mesin rekonsiliasi benturan data otomatis antara Base State (N-1), Server State (N), dan Client State (N).
- **Quarantine Journal (DLQ)**: Penampung otomatis event yang rusak fatal agar tidak memacetkan antrean utama.
- **Smart Pruning Engine**: Pembersihan cerdas yang memilah data aktif bulan berjalan vs data historis yang telah berstatus terminal/completed.
- **Circuit Breaker**: Pemutus arus jaringan otomatis jika server gagal merespons 3 kali berturut-turut (mencegah DDoS internal).
- **Backpressure Guard**: Pembatas beban server (maks 50 koneksi sinkronisasi serentak) dengan instruksi penundaan HTTP 503 ke klien.
- **PostgreSQL Advisory Lock**: Kunci terdistribusi tingkat database untuk mencegah server multi-instance menjalankan cron scheduler yang sama bersamaan.

### 04 — Runtime & Manajemen Memori

- **Universal Scheduler**: Penjadwal tugas berkala di klien (interval, date_change, daily_midnight) dan di server.
- **Route-Level Lifecycle (ModuleLifecycleWrapper)**: Pemutus sambungan listener reaktif secara otomatis saat user berpindah halaman (Zero Memory Leak Policy).
- **Subscription Manager**: Kolektor sampah memori RAM yang membersihkan langganan RxDB/Socket saat komponen unmount.

### 05 — I/O Engine (Universal Parsers & Storage)

- **ExcelEngine**: Pengolah spreadsheet universal (Pembuat Template dengan Tab Panduan + Data, Batch Import Parser, dan Exporter).
- **PdfEngine**: Pembangkit dokumen dan tabel PDF resmi menggunakan jsPDF & AutoTable.
- **Canvas Auto-Compressor**: Kompresi gambar otomatis di browser sebelum berkas diunggah.
- **BlobManager**: Manajemen antrean unggah offline IndexedDB dan Cache Storage terisolasi.

### 07 — UI Primitives & Human-Computer Interface

- **UniversalLayout**: Bingkai sentral penyedia Context API untuk Modal, SideOver Drawer, dan Alert Dialog.
- **UniversalCombobox (No-Mouse Policy)**: Dropdown navigasi keyboard penuh (Arrow Up/Down, Enter, Escape, Auto-Scroll).
- **Virtual Numpad (Spatial Memory)**: Keyboard numerik mengambang yang dapat digeser (drag-and-drop) dengan memori posisi per modul.
- **Setup Wizard & Rapid 24h Recovery**: Antarmuka aktivasi perangkat baru (Cold-Start) dan pemulihan instan mesin rusak dalam hitungan detik.

### 08 — Security & Trust Infrastructure

- **Multi-Tier Spatial Scoping**: Pemetaan hak operasional perangkat berjenjang:
  - `COMPANY` (Holding / Owner Dashboard Global)
  - `REGION` (Gudang Pusat / Distribusi Wilayah)
  - `OUTLET` (Mesin Kasir Cabang Spesifik)
- **Remote Kill Switch**: Penonaktifan perangkat lama secara instan via sinyal Socket `DEVICE_FORCE_LOGOUT` dan blokade HTTP 403 saat perangkat diambil alih oleh mesin pengganti.
- **Real-time Cross-Device Synchronization**: Broadcast socket `SYNC_NEEDED` seketika (< 100ms) saat ada transaksi baru tanpa perlu refresh halaman.

## 🛡️ Matriks Ketahanan Sistem (Failure Mode & Self-Healing)

| Kegagalan Sistem                | Pengaman Otomatis Alma Engine    | Mekanisme Pemulihan Mandiri                                                                                      |
| ------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Koneksi Internet Putus          | Offline Outbox Queue & IndexedDB | Data tersimpan aman di lokal; Outbox Daemon otomatis mengirim event saat internet kembali menyala.               |
| Request Ganda / Replay          | Idempotency Gatekeeper           | Inbox Daemon & Server memverifikasi ID unik event; duplikasi langsung diabaikan tanpa error ganda.               |
| Data Diubah Paksa di Disk Lokal | SHA-256 Hash Chain Integrity     | IntegrityChecker mendeteksi putusnya rantai `prevHash` dan memicu rekonsiliasi ulang dari server.                |
| Dua Kasir Edit Data Bersamaan   | 3-Way Merge Engine               | NATS Worker menggabungkan field non-konflik secara otomatis dan mencatat log resolusi ke `sync_logs`.            |
| Server Crash / Down Total       | Circuit Breaker Klien            | Arus permintaan ke server diputus sementara selama 30 detik untuk menghemat baterai & memori mesin kasir.        |
| Beban Server Meledak (Spike)    | Concurrency Backpressure Guard   | Server menolak koneksi ke-51 ke atas dengan HTTP 503; klien menunda penarikan data secara halus.                 |
| Hardware Rusak / Tablet Pecah   | 24h Rapid Disaster Recovery      | Buka Setup Wizard di tablet baru ➡️ Pilih mesin rusak ➡️ Data 24 jam terakhir pulih instan dalam 30 detik.       |
| Device Lama Dinyalakan Kembali  | Remote Kill Switch Security      | Server mendeteksi status `REPLACED` ➡️ Memutus koneksi socket & me-reset sesi lokal tablet lama ke Setup Wizard. |
| Beberapa Event Masuk Bersamaan  | Draining Queue Loop              | OutboxDaemon mengeksekusi antrean secara berurutan (FIFO batch) hingga tuntas tanpa ada event yang tertinggal.   |

Kedua dokumen spesifikasi ini sekarang menjadi **fondasi konstitusi baku** seluruh sistem.

Pada tahap berikutnya, kita dapat langsung membahas arsitektur dan perancangan skrip **Generator Plugin CLI (`scripts/create-module.ts`)** yang akan mencetak modul-modul masa depan berdasarkan kedua dokumen standar ini!
