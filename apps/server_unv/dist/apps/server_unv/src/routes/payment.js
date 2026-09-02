// File: apps/server_unv/src/routes/payment.ts
import express from "express";
import { ulid } from "ulidx";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "../config/db.js";
import { billingOrders, deviceRegistry, } from "../../../../packages/db-schema/index.js";
import { LicenseManager, } from "../../../../packages/core_unv/src/ledger/licenseManager.js";
const router = express.Router();
function createMailTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    if (!user || !pass) {
        console.warn("[SMTP MAILER] Kredensial SMTP belum disetel di .env. Email akan dicetak ke log server.");
        return null;
    }
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}
function generateLicenseEmailHtml(params) {
    const formattedExpiry = new Date(params.validUntil).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #ea580c, #f97316); padding: 32px 24px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 28px; font-weight: 900; line-height: 48px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 12px; opacity: 0.9; margin-top: 4px; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 15px; font-weight: 600; color: #f8fafc; margin-bottom: 16px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; }
    .info-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #1e293b; }
    .info-table td.label { color: #94a3b8; font-weight: 600; width: 40%; }
    .info-table td.val { color: #f1f5f9; font-weight: 700; }
    .license-box { background: #030712; border: 2px dashed #ea580c; border-radius: 14px; padding: 18px; margin: 24px 0; text-align: center; }
    .license-label { font-size: 11px; font-weight: 800; color: #fb923c; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
    .license-key { font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; color: #f97316; word-break: break-all; background: #111827; padding: 12px; border-radius: 8px; border: 1px solid #374151; user-select: all; }
    .guide-step { background: #1e293b; border-left: 4px solid #f97316; padding: 12px 16px; border-radius: 0 10px 10px 0; margin-bottom: 10px; font-size: 12px; color: #cbd5e1; }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #64748b; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">Z</div>
      <h1 class="title">ALMA ENTERPRISE PLATFORM</h1>
      <div class="subtitle">Bukti Pembelian & Lisensi Resmi Kriptografis Ed25519</div>
    </div>
    <div class="content">
      <div class="greeting">Halo, ${params.customerName}</div>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px;">
        Terima kasih atas kepercayaan Anda. Pembayaran lisensi software ALMA ERP untuk entitas <strong>${params.companyName}</strong> telah berhasil diverifikasi oleh sistem.
      </p>

      <table class="info-table">
        <tr>
          <td class="label">Nama Perusahaan</td>
          <td class="val">${params.companyName}</td>
        </tr>
        <tr>
          <td class="label">Paket Langganan</td>
          <td class="val"><span style="color: #fb923c;">${params.tier}</span></td>
        </tr>
        <tr>
          <td class="label">Masa Aktif Lisensi</td>
          <td class="val">s/d ${formattedExpiry} (1 Tahun)</td>
        </tr>
        <tr>
          <td class="label">Batas Kuota Mesin</td>
          <td class="val">${params.maxOutlets} Perangkat Aktif</td>
        </tr>
      </table>

      <div class="license-box">
        <div class="license-label">KUNCI LISENSI KRIPTOGRAFIS (OFFLINE-SAFE)</div>
        <div class="license-key">${params.licenseKey}</div>
      </div>

      <div style="margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 800; color: #ffffff; text-transform: uppercase; margin-bottom: 12px;">PANDUAN AKTIVASI DI PERANGKAT KASIR:</h3>
        <div class="guide-step">
          <strong>Langkah 1:</strong> Buka browser pada tablet kasir atau laptop cabang Anda dan akses alamat portal: <code>/setup</code>
        </div>
        <div class="guide-step">
          <strong>Langkah 2:</strong> Pilih <strong>"Daftarkan Perangkat Baru"</strong> lalu tempelkan Kunci Lisensi di atas.
        </div>
        <div class="guide-step">
          <strong>Langkah 3:</strong> Tekan Verifikasi. Sistem akan langsung memvalidasi tanda tangan digital dan mengaktifkan seluruh modul secara instan.
        </div>
      </div>
    </div>
    <div class="footer">
      Email ini diterbitkan otomatis oleh ALMA ERP Licensing Server.<br>
      Simpan email ini sebagai bukti kepemilikan lisensi yang sah.
    </div>
  </div>
</body>
</html>
  `;
}
// 1. CREATE SNAP MIDTRANS
router.post("/create-snap", async (req, res) => {
    try {
        const { tier, companyName, customerName, email, phone, companyId } = req.body;
        if (!tier || !companyName || !email) {
            return res.status(400).json({ error: "Data pemesanan tidak lengkap." });
        }
        const orderId = `ALMA-ORD-${ulid()}`;
        const amount = tier === "EXCLUSIVE" ? 1499000 : 499000;
        const tierName = tier === "EXCLUSIVE" ? "Paket Eksklusif AI" : "Paket Premium Enterprise";
        const maxOutlets = tier === "EXCLUSIVE" ? 100 : 50; // Premium = 50, Exclusive = 100
        const targetModules = [
            "mdl_organization",
            "mdl_item",
            "mdl_vendor",
            "mdl_receiving",
            "mdl_warehouse",
            "mdl_plusales",
            "mdl_executivepanel",
            "mdl_manufacturing",
            "mdl_multi_warehouse",
            ...(tier === "EXCLUSIVE" ? ["mdl_ai_forecasting", "mdl_ai_ocr"] : []),
        ];
        const serverKey = process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-YOUR_SERVER_KEY";
        const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
        const midtransSnapUrl = isProduction
            ? "https://app.midtrans.com/snap/v1/transactions"
            : "https://app.sandbox.midtrans.com/snap/v1/transactions";
        const authString = Buffer.from(`${serverKey}:`).toString("base64");
        const snapPayload = {
            transaction_details: {
                order_id: orderId,
                gross_amount: amount,
            },
            customer_details: {
                first_name: customerName,
                email: email,
                phone: phone || "081234567890",
            },
            item_details: [
                {
                    id: tier,
                    price: amount,
                    quantity: 1,
                    name: `Lisensi 1 Tahun ${tierName} (${maxOutlets} Mesin)`,
                },
            ],
            callbacks: {
                finish: `${req.headers.origin || "http://localhost:3010"}/?payment=finish&orderId=${orderId}`,
            },
        };
        await db.insert(billingOrders).values({
            id: orderId,
            companyId: companyId || null,
            companyName: companyName.toUpperCase(),
            customerName: customerName.toUpperCase(),
            customerEmail: email.toLowerCase().trim(),
            customerPhone: phone || null,
            tier,
            amount,
            status: "PENDING",
            maxOutlets,
            allowedModules: targetModules,
            paymentGateway: "MIDTRANS",
        });
        const snapRes = await fetch(midtransSnapUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify(snapPayload),
        });
        const snapData = await snapRes.json();
        if (!snapRes.ok) {
            return res.status(200).json({
                token: `DEV_SNAP_TOKEN_${orderId}`,
                redirect_url: "#",
                orderId,
            });
        }
        await db
            .update(billingOrders)
            .set({ paymentReference: snapData.token, updatedAt: new Date() })
            .where(eq(billingOrders.id, orderId));
        res.status(200).json({
            token: snapData.token,
            redirect_url: snapData.redirect_url,
            orderId,
        });
    }
    catch (err) {
        console.error("[MIDTRANS CREATE ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
// 2. MIDTRANS WEBHOOK NOTIFICATION
router.post("/notification", async (req, res) => {
    try {
        const notif = req.body;
        const orderId = notif.order_id;
        const transactionStatus = notif.transaction_status;
        const fraudStatus = notif.fraud_status;
        console.log(`[MIDTRANS WEBHOOK] Notifikasi diterima untuk Order: ${orderId} [Status: ${transactionStatus}]`);
        const orderRows = await db
            .select()
            .from(billingOrders)
            .where(eq(billingOrders.id, orderId))
            .limit(1);
        if (orderRows.length === 0) {
            return res.status(404).json({ status: "ORDER_NOT_FOUND" });
        }
        const order = orderRows[0];
        const isPaid = transactionStatus === "settlement" ||
            (transactionStatus === "capture" && fraudStatus === "accept");
        if (isPaid) {
            const now = new Date();
            const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
            const masterSecretKey = process.env.ALMA_MASTER_SECRET_KEY || "ALMA_SECRET_DEV_KEY";
            const allowedModules = order.allowedModules || [
                "mdl_organization",
                "mdl_item",
                "mdl_vendor",
                "mdl_receiving",
                "mdl_warehouse",
                "mdl_plusales",
                "mdl_executivepanel",
                "mdl_manufacturing",
                "mdl_multi_warehouse",
                ...(order.tier === "EXCLUSIVE"
                    ? ["mdl_ai_forecasting", "mdl_ai_ocr"]
                    : []),
            ];
            const maxOutlets = order.maxOutlets || (order.tier === "EXCLUSIVE" ? 100 : 50);
            const licensePayload = {
                licenseId: `LIC_${ulid()}`,
                tier: order.tier,
                companyName: order.companyName,
                issuedTo: order.customerEmail,
                phone: order.customerPhone || undefined,
                maxOutlets,
                allowedModules,
                validUntil,
            };
            const token = LicenseManager.generateLicenseToken(licensePayload, masterSecretKey);
            await db
                .update(billingOrders)
                .set({
                status: "PAID",
                licenseKey: token,
                validUntil: new Date(validUntil),
                updatedAt: new Date(),
            })
                .where(eq(billingOrders.id, orderId));
            console.log(`[LICENSE GENERATED] Sukses membuat token Ed25519 untuk ${order.companyName} (${order.customerEmail}) - Kuota: ${maxOutlets} Mesin`);
            let emailStatus = "FAILED";
            try {
                const transporter = createMailTransporter();
                if (transporter) {
                    const mailHtml = generateLicenseEmailHtml({
                        customerName: order.customerName,
                        companyName: order.companyName,
                        tier: order.tier,
                        licenseKey: token,
                        validUntil,
                        maxOutlets,
                        allowedModules,
                    });
                    await transporter.sendMail({
                        from: `"${process.env.SMTP_SENDER_NAME || "ALMA ERP Licensing"}" <${process.env.SMTP_USER}>`,
                        to: order.customerEmail,
                        subject: `[ALMA ERP] Lisensi Resmi ${order.tier} - ${order.companyName}`,
                        html: mailHtml,
                    });
                    emailStatus = "SENT";
                    console.log(`[SMTP MAILER] Email lisensi berhasil dikirim ke: ${order.customerEmail}`);
                }
                else {
                    console.log(`[SMTP MOCK] Simulasi Kirim Email ke ${order.customerEmail}:\n${token}`);
                    emailStatus = "SENT";
                }
            }
            catch (mailErr) {
                console.error(`[SMTP MAILER ERROR] Gagal mengirim email ke ${order.customerEmail}:`, mailErr.message);
            }
            await db
                .update(billingOrders)
                .set({ emailDeliveryStatus: emailStatus })
                .where(eq(billingOrders.id, orderId));
            // OVER-THE-AIR UPGRADE HOOK
            if (order.companyId) {
                console.log(`[OTA UPGRADE] Menerapkan lisensi baru ke database deviceRegistry untuk company: ${order.companyId}`);
                await db
                    .update(deviceRegistry)
                    .set({
                    licenseTier: order.tier,
                    licenseKey: token,
                    allowedModules: allowedModules,
                    licenseExpiresAt: new Date(validUntil),
                    updatedAt: new Date(),
                })
                    .where(eq(deviceRegistry.companyId, order.companyId));
                const io = req.app.get("io");
                if (io) {
                    io.to(`company:${order.companyId}`).emit("LICENSE_UPGRADED", {
                        companyId: order.companyId,
                        licenseKey: token,
                        tier: order.tier,
                        allowedModules: allowedModules,
                        validUntil,
                    });
                }
            }
        }
        else if (transactionStatus === "cancel" ||
            transactionStatus === "deny" ||
            transactionStatus === "expire") {
            await db
                .update(billingOrders)
                .set({ status: "EXPIRED", updatedAt: new Date() })
                .where(eq(billingOrders.id, orderId));
        }
        res.status(200).json({ status: "OK" });
    }
    catch (err) {
        console.error("[MIDTRANS NOTIFICATION ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
// 3. GET ORDER STATUS (POLLING / DEV SANDBOX)
router.get("/order-status/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;
        const orderRows = await db
            .select()
            .from(billingOrders)
            .where(eq(billingOrders.id, orderId))
            .limit(1);
        if (orderRows.length === 0) {
            return res.status(404).json({ error: "Order tidak ditemukan." });
        }
        const order = orderRows[0];
        if (order.status === "PENDING" &&
            orderId.startsWith("ALMA-ORD-") &&
            process.env.NODE_ENV !== "production") {
            const now = new Date();
            const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
            const allowedModules = order.allowedModules || [
                "mdl_organization",
                "mdl_item",
                "mdl_vendor",
                "mdl_receiving",
                "mdl_warehouse",
                "mdl_plusales",
                "mdl_executivepanel",
                "mdl_manufacturing",
                "mdl_multi_warehouse",
                ...(order.tier === "EXCLUSIVE"
                    ? ["mdl_ai_forecasting", "mdl_ai_ocr"]
                    : []),
            ];
            const maxOutlets = order.tier === "EXCLUSIVE" ? 100 : 50;
            const token = LicenseManager.generateLicenseToken({
                licenseId: `LIC_${ulid()}`,
                tier: order.tier,
                companyName: order.companyName,
                issuedTo: order.customerEmail,
                maxOutlets,
                allowedModules,
                validUntil,
            }, "ALMA_SECRET_DEV_KEY");
            await db
                .update(billingOrders)
                .set({
                status: "PAID",
                licenseKey: token,
                validUntil: new Date(validUntil),
                updatedAt: new Date(),
            })
                .where(eq(billingOrders.id, orderId));
            order.status = "PAID";
            order.licenseKey = token;
        }
        res.status(200).json(order);
    }
    catch (err) {
        console.error("[ORDER STATUS ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
export const paymentRouter = router;
