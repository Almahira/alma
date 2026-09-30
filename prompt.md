PS C:\Users\User\Desktop\alma-main> pnpm dev:server
$ pnpm --filter server dev
$ tsx watch src/index.ts
[NATS] Berhasil terhubung ke NATS JetStream
[WORKER] Menginisialisasi Consumer NATS Universal...
[WA DAEMON] Kredensial sesi ditemukan. Menghubungkan ke WhatsApp...
[SERVER SCHEDULER] Task terdaftar: Clean Temporary & Stale Uploads (clean-temp-uploads)
[SERVER SCHEDULER] Task terdaftar: Server Heartbeat & Memory Health (server-heartbeat)
[SERVER SCHEDULER] Daemon scheduler server aktif.
[SERVER SCHEDULER] Menjalankan task: Server Heartbeat & Memory Health
[SERVER HEALTH] Uptime: 4s | Heap: 45.39MB | RSS: 244.36MB
[SERVER SCHEDULER] Task selesai: Server Heartbeat & Memory Health
====================================================
ALMA ERP Server berjalan di port 5000
NATS JetStream & Socket.IO Aktif
Server Scheduler Aktif
====================================================
[WORKER] Sync Worker berjalan dan mendengarkan event...
[WA DAEMON] Sukses terhubung permanen sebagai: +6285722027326
[SOCKET SPATIAL] Device RENDI (01M3GPP0AGTTGHX6ESQ6FQ39C9) bergabung ke Room -> Company: AGG_01M3GPTNP6QGKPY963A6WTN3WG | Region: AGG_01M3GPTNP750EK0HV5T465WJ54 | Outlet: -
[SOCKET] Client terhubung: 2LisLEvTgWYXQZEIAAAB (Device: 01M3GPP0AGTTGHX6ESQ6FQ39C9)
[HTTP] PULL System Delta dari device 01M3GPP0AGTTGHX6ESQ6FQ39C9 sejak waktu: 2026-09-27T05:53:52.427Z
[HTTP] PULL Tx Events dari device: 01M3GPP0AGTTGHX6ESQ6FQ39C9 (Outlet: ALL, Region: AGG_01M3GPTNP750EK0HV5T465WJ54, Since: FULL)
[SOCKET] Client terputus: 2LisLEvTgWYXQZEIAAAB
[SOCKET SPATIAL] Device RENDI (01M3GPP0AGTTGHX6ESQ6FQ39C9) bergabung ke Room -> Company: AGG_01M3GPTNP6QGKPY963A6WTN3WG | Region: AGG_01M3GPTNP750EK0HV5T465WJ54 | Outlet: -
[SOCKET] Client terhubung: s_fuL810lJ7ECXS2AAAD (Device: 01M3GPP0AGTTGHX6ESQ6FQ39C9)
[HTTP] PULL System Delta dari device 01M3GPP0AGTTGHX6ESQ6FQ39C9 sejak waktu: 2026-09-27T05:53:52.427Z
[HTTP] PULL Tx Events dari device: 01M3GPP0AGTTGHX6ESQ6FQ39C9 (Outlet: ALL, Region: AGG_01M3GPTNP750EK0HV5T465WJ54, Since: FULL)
Failed to decrypt message with any known session...
Session error:Error: Bad MAC Error: Bad MAC
at Object.verifyMAC (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\crypto.js:87:15)
at SessionCipher.doDecryptWhisperMessage (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:250:16)
at async SessionCipher.decryptWithSessions (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:147:29)
at async 280994359840982.0 [as awaitable] (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:171:28)
at async \_asyncQueueExecutor (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\queue_job.js:20:29)
Failed to decrypt message with any known session...
Session error:Error: Bad MAC Error: Bad MAC
at Object.verifyMAC (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\crypto.js:87:15)
at SessionCipher.doDecryptWhisperMessage (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:250:16)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async SessionCipher.decryptWithSessions (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:147:29)
at async 280994359840982.0 [as awaitable] (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:171:28)
at async \_asyncQueueExecutor (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\queue_job.js:20:29)
Failed to decrypt message with any known session...
Session error:Error: Bad MAC Error: Bad MAC
at Object.verifyMAC (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\crypto.js:87:15)
at SessionCipher.doDecryptWhisperMessage (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:250:16)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async SessionCipher.decryptWithSessions (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:147:29)
at async 280994359840982.0 [as awaitable] (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:171:28)
at async \_asyncQueueExecutor (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\queue_job.js:20:29)
Failed to decrypt message with any known session...
Session error:Error: Bad MAC Error: Bad MAC
at Object.verifyMAC (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\crypto.js:87:15)
at SessionCipher.doDecryptWhisperMessage (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:250:16)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async SessionCipher.decryptWithSessions (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:147:29)
at async 280994359840982.0 [as awaitable] (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\session_cipher.js:171:28)
at async \_asyncQueueExecutor (C:\Users\User\Desktop\alma-main\node_modules\.pnpm\libsignal@https+++codeload.\_67456c0eeff1c9e2a03c5f1e60572206\node_modules\libsignal\src\queue_job.js:20:29)

    masih gagal menerima pesan dari luar.
    kemudian masih terjebak di 9 agustus 2026 tidak mau update ke tanggal hari ini untuk grup, dan untuk nomor pribadi vendor tidak ada riwayat chat yang muncul.
