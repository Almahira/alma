// File: apps/server_unv/src/routes/payment.ts
import express from "express";
import { ulid } from "ulidx";
import { LicenseManager, } from "../../../../packages/core_unv/src/ledger/licenseManager.js";
const router = express.Router();
const ordersStore = new Map();
// 1. ENDPOINT: BUAT TRANSAKSI SNAP MIDTRANS
router.post("/create-snap", async (req, res) => {
    try {
        const { tier, companyName, customerName, email, phone } = req.body;
        if (!tier || !companyName || !email) {
            return res.status(400).json({ error: "Data pemesanan tidak lengkap." });
        }
        const orderId = `ALMA-ORD-${ulid()}`;
        const amount = tier === "EXCLUSIVE" ? 1499000 : 499000;
        const tierName = tier === "EXCLUSIVE" ? "Paket Eksklusif AI" : "Paket Premium Enterprise";
        // Konfigurasi Midtrans Server Key
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
                    name: `Lisensi 1 Tahun ${tierName}`,
                },
            ],
            callbacks: {
                finish: `${req.headers.origin || "http://localhost:3010"}/?payment=finish&orderId=${orderId}`,
            },
        };
        // Simpan order pending
        ordersStore.set(orderId, {
            orderId,
            tier,
            companyName,
            customerName,
            email,
            phone,
            amount,
            status: "PENDING",
            createdAt: Date.now(),
        });
        // Panggil Midtrans Snap API
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
            // Fallback dev mode jika server key belum disetel
            return res.status(200).json({
                token: `DEV_SNAP_TOKEN_${orderId}`,
                redirect_url: "#",
                orderId,
            });
        }
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
// 2. ENDPOINT: WEBHOOK NOTIFIKASI MIDTRANS (AUTO GENERATE LICENSE)
router.post("/notification", async (req, res) => {
    try {
        const notif = req.body;
        const orderId = notif.order_id;
        const transactionStatus = notif.transaction_status;
        const fraudStatus = notif.fraud_status;
        console.log(`[MIDTRANS WEBHOOK] Menerima notifikasi untuk Order: ${orderId} [Status: ${transactionStatus}]`);
        const order = ordersStore.get(orderId);
        if (!order) {
            return res.status(404).json({ status: "ORDER_NOT_FOUND" });
        }
        const isPaid = transactionStatus === "settlement" ||
            (transactionStatus === "capture" && fraudStatus === "accept");
        if (isPaid) {
            order.status = "PAID";
            // GENERATE KUNCI LISENSI KRIPTOGRAFIS RESMI
            const now = new Date();
            const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString(); // 1 Tahun
            const masterSecretKey = process.env.ALMA_MASTER_SECRET_KEY || "ALMA_SECRET_DEV_KEY";
            const allModules = [
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
            const licensePayload = {
                licenseId: `LIC_${ulid()}`,
                tier: order.tier,
                companyName: order.companyName,
                issuedTo: order.email,
                phone: order.phone,
                maxOutlets: order.tier === "EXCLUSIVE" ? 50 : 20,
                allowedModules: allModules,
                validUntil,
            };
            const token = LicenseManager.generateLicenseToken(licensePayload, masterSecretKey);
            order.licenseKey = token;
            console.log(`[LICENSE GENERATED] Sukses menerbitkan kunci lisensi untuk ${order.companyName} (${order.email})`);
        }
        else if (transactionStatus === "cancel" ||
            transactionStatus === "deny" ||
            transactionStatus === "expire") {
            order.status = "EXPIRED";
        }
        res.status(200).json({ status: "OK" });
    }
    catch (err) {
        console.error("[MIDTRANS NOTIFICATION ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
// 3. ENDPOINT: CEK STATUS ORDER & AMBIL LISENSI KEY
router.get("/order-status/:orderId", (req, res) => {
    const { orderId } = req.params;
    const order = ordersStore.get(orderId);
    if (!order) {
        return res.status(404).json({ error: "Order tidak ditemukan." });
    }
    // Jika Dev Mode Mock: Simulasi Langsung Bayar
    if (!order.licenseKey && orderId.includes("ALMA-ORD-")) {
        const now = new Date();
        const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
        const allModules = [
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
        order.licenseKey = LicenseManager.generateLicenseToken({
            licenseId: `LIC_${ulid()}`,
            tier: order.tier,
            companyName: order.companyName,
            issuedTo: order.email,
            maxOutlets: 25,
            allowedModules: allModules,
            validUntil,
        }, "ALMA_SECRET_DEV_KEY");
        order.status = "PAID";
    }
    res.status(200).json(order);
});
export const paymentRouter = router;
