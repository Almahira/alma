// File: apps/server_unv/src/routes/provision.ts
import express from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { companies, regions, outlets, userAccounts, employees, } from "../../../../modules/mdl_organization/src/server/schema.js";
import { systemEventJournal, deviceRegistry, } from "../../../../packages/db-schema/index.js";
import { ulid } from "ulidx";
import { LicenseManager } from "../../../../packages/core_unv/src/ledger/licenseManager.js";
const router = express.Router();
// Helper: Cek Kuota Perangkat Aktif (Free = 10, Premium = 50, Exclusive = 100)
async function checkDeviceQuota(companyId, licenseKey, licenseTier) {
    let maxAllowed = 10; // Default Free: 10 Mesin Kasir / Perangkat
    if (licenseKey) {
        const licenseData = LicenseManager.verifyLicense(licenseKey);
        if (licenseData.isValid && licenseData.maxOutlets) {
            maxAllowed = licenseData.maxOutlets;
        }
    }
    else if (licenseTier === "PREMIUM") {
        maxAllowed = 50;
    }
    else if (licenseTier === "EXCLUSIVE") {
        maxAllowed = 100;
    }
    const activeDevices = await db
        .select({ count: sql `count(*)` })
        .from(deviceRegistry)
        .where(and(eq(deviceRegistry.companyId, companyId), eq(deviceRegistry.status, "ACTIVE")));
    const currentCount = Number(activeDevices[0]?.count || 0);
    return {
        allowed: currentCount < maxAllowed,
        currentCount,
        maxAllowed,
    };
}
router.get("/system-status", async (_req, res) => {
    try {
        const companyList = await db.select().from(companies).limit(1);
        const userList = await db.select().from(userAccounts).limit(1);
        const isVirgin = companyList.length === 0 || userList.length === 0;
        res.status(200).json({
            isVirgin,
            companyCount: companyList.length,
            userCount: userList.length,
        });
    }
    catch (err) {
        console.error("[PROVISION ERROR - system-status]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.post("/cold-start", async (req, res) => {
    try {
        const { company, region, outlet, superAdmin, device, licenseTier = "FREE", licenseKey = null, licenseExpiresAt = null, } = req.body;
        if (!company?.name ||
            !superAdmin?.email ||
            !superAdmin?.password ||
            !device?.name) {
            return res.status(400).json({
                error: "Data inisialisasi tidak lengkap. Perusahaan, Akun Superadmin, dan Perangkat wajib diisi.",
            });
        }
        const companyId = `AGG_${ulid()}`;
        const regionId = region?.name ? `AGG_${ulid()}` : null;
        const outletId = outlet?.name && regionId ? `AGG_${ulid()}` : null;
        const employeeId = `AGG_${ulid()}`;
        const userId = `AGG_${ulid()}`;
        const deviceId = device.deviceId || device.nodeId || `NODE_${ulid()}`;
        // Generator Kode Unik Anti-Bentrok
        const suffix = ulid().slice(-4).toUpperCase();
        const compCode = company.code || `COM_${suffix}`;
        const regCode = region?.code || `REG_${suffix}`;
        const outCode = outlet?.code || `OUT_${suffix}`;
        const empNumber = `EMP-${suffix}`;
        const companyEventId = `EVT_${ulid()}`;
        const regionEventId = regionId ? `EVT_${ulid()}` : null;
        const outletEventId = outletId ? `EVT_${ulid()}` : null;
        const employeeEventId = `EVT_${ulid()}`;
        const userAccountEventId = `EVT_${ulid()}`;
        const deviceCompanyId = companyId;
        const deviceRegionId = device.scope === "COMPANY" ? null : regionId;
        const deviceOutletId = device.scope === "OUTLET" ? outletId : null;
        await db.transaction(async (tx) => {
            const journalEvents = [];
            journalEvents.push({
                id: companyEventId,
                aggregateId: companyId,
                aggregateType: "COMPANY",
                aggregateVersion: 1,
                type: "COMPANY_CREATED",
                payload: JSON.stringify({
                    code: compCode,
                    name: company.name.toUpperCase(),
                    legalName: company.legalName || null,
                }),
                actor: "SYS_COLD_START",
            });
            if (regionId && regionEventId && region?.name) {
                journalEvents.push({
                    id: regionEventId,
                    aggregateId: regionId,
                    aggregateType: "REGION",
                    aggregateVersion: 1,
                    type: "REGION_CREATED",
                    payload: JSON.stringify({
                        companyId,
                        code: regCode,
                        name: region.name.toUpperCase(),
                        timezone: region.timezone || "Asia/Jakarta",
                        address: region.address || null,
                    }),
                    actor: "SYS_COLD_START",
                });
            }
            if (outletId && outletEventId && outlet?.name) {
                journalEvents.push({
                    id: outletEventId,
                    aggregateId: outletId,
                    aggregateType: "OUTLET",
                    aggregateVersion: 1,
                    type: "OUTLET_CREATED",
                    payload: JSON.stringify({
                        companyId,
                        regionId,
                        code: outCode,
                        name: outlet.name.toUpperCase(),
                        address: outlet.address || "Pusat",
                        industry: outlet.industry || "UMUM",
                    }),
                    actor: "SYS_COLD_START",
                });
            }
            journalEvents.push({
                id: employeeEventId,
                aggregateId: employeeId,
                aggregateType: "EMPLOYEE",
                aggregateVersion: 1,
                type: "EMPLOYEE_CREATED",
                payload: JSON.stringify({
                    employeeNumber: empNumber,
                    fullName: superAdmin.fullName.toUpperCase(),
                    gender: superAdmin.gender || "LAKI-LAKI",
                    phone: superAdmin.phone || null,
                    email: superAdmin.email.toLowerCase().trim(),
                    employmentStatus: "PERMANENT",
                    systemStatus: "REGISTERED",
                }),
                actor: "SYS_COLD_START",
            });
            journalEvents.push({
                id: userAccountEventId,
                aggregateId: userId,
                aggregateType: "USER_ACCOUNT",
                aggregateVersion: 1,
                type: "USER_ACCOUNT_CREATED",
                payload: JSON.stringify({
                    employeeId,
                    username: superAdmin.email.toLowerCase().trim(),
                    passwordHash: superAdmin.password,
                    role: "SUPER_ADMIN",
                }),
                actor: "SYS_COLD_START",
            });
            await tx.insert(systemEventJournal).values(journalEvents);
            await tx.insert(companies).values({
                id: companyId,
                code: compCode,
                name: company.name.toUpperCase(),
                legalName: company.legalName || null,
                isActive: true,
                lastEventId: companyEventId,
            });
            if (regionId && region?.name && regionEventId) {
                await tx.insert(regions).values({
                    id: regionId,
                    companyId,
                    code: regCode,
                    name: region.name.toUpperCase(),
                    timezone: region.timezone || "Asia/Jakarta",
                    address: region.address || null,
                    isActive: true,
                    lastEventId: regionEventId,
                });
            }
            if (outletId && outlet?.name && outletEventId) {
                await tx.insert(outlets).values({
                    id: outletId,
                    companyId,
                    regionId: regionId,
                    code: outCode,
                    name: outlet.name.toUpperCase(),
                    address: outlet.address || "Pusat",
                    industry: outlet.industry || "UMUM",
                    isActive: true,
                    lastEventId: outletEventId,
                });
            }
            await tx.insert(employees).values({
                id: employeeId,
                employeeNumber: empNumber,
                fullName: superAdmin.fullName.toUpperCase(),
                gender: superAdmin.gender || "LAKI-LAKI",
                phone: superAdmin.phone || null,
                email: superAdmin.email.toLowerCase().trim(),
                employmentStatus: "PERMANENT",
                systemStatus: "REGISTERED",
                isActive: true,
                lastEventId: employeeEventId,
            });
            await tx.insert(userAccounts).values({
                id: userId,
                employeeId,
                username: superAdmin.email.toLowerCase().trim(),
                passwordHash: superAdmin.password,
                pin: superAdmin.pin || "123456",
                role: "SUPER_ADMIN",
                isActive: true,
                lastEventId: userAccountEventId,
            });
            await tx.insert(deviceRegistry).values({
                id: deviceId,
                name: device.name.toUpperCase(),
                companyId: deviceCompanyId,
                regionId: deviceRegionId,
                outletId: deviceOutletId,
                nodePublicKey: device.publicKey || "ED25519_KEY",
                allowedModules: device.allowedModules || ["mdl_organization"],
                lat: String(device.lat || ""),
                lng: String(device.lng || ""),
                status: "ACTIVE",
                licenseTier: licenseTier,
                licenseKey: licenseKey,
                licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : null,
            });
        });
        res.status(200).json({
            status: "SUCCESS",
            deviceToken: `DVT_${ulid()}`,
            deviceId,
            companyId: deviceCompanyId,
            regionId: deviceRegionId,
            outletId: deviceOutletId,
            allowedModules: device.allowedModules,
        });
    }
    catch (err) {
        console.error("[PROVISION ERROR - cold-start]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db
            .select()
            .from(userAccounts)
            .where(and(eq(userAccounts.username, email.toLowerCase().trim()), eq(userAccounts.isActive, true)))
            .limit(1);
        if (user.length === 0 || user[0].passwordHash !== password) {
            return res
                .status(401)
                .json({ error: "Email atau password otorisasi salah." });
        }
        const allCompanies = await db
            .select()
            .from(companies)
            .where(eq(companies.isActive, true));
        const allRegions = await db
            .select()
            .from(regions)
            .where(eq(regions.isActive, true));
        const allOutlets = await db
            .select()
            .from(outlets)
            .where(eq(outlets.isActive, true));
        res.status(200).json({
            status: "SUCCESS",
            user: { id: user[0].id, username: user[0].username, role: user[0].role },
            structure: {
                companies: allCompanies,
                regions: allRegions,
                outlets: allOutlets,
            },
        });
    }
    catch (err) {
        console.error("[PROVISION ERROR - login]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.get("/devices-by-scope", async (req, res) => {
    try {
        const { companyId, regionId, outletId } = req.query;
        if (!companyId) {
            return res.status(400).json({ error: "companyId wajib disertakan." });
        }
        const conditions = [
            eq(deviceRegistry.companyId, companyId),
            eq(deviceRegistry.status, "ACTIVE"),
        ];
        if (outletId) {
            conditions.push(eq(deviceRegistry.outletId, outletId));
        }
        else if (regionId) {
            conditions.push(eq(deviceRegistry.regionId, regionId));
        }
        const devices = await db
            .select()
            .from(deviceRegistry)
            .where(and(...conditions));
        res.status(200).json({ devices });
    }
    catch (err) {
        console.error("[PROVISION ERROR - devices-by-scope]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.post("/device", async (req, res) => {
    try {
        const { companyId, regionId, outletId, name, replaceDeviceId, lat, lng, publicKey, allowedModules, licenseTier = "FREE", licenseKey = null, licenseExpiresAt = null, } = req.body;
        if (!companyId || !name || !publicKey) {
            return res
                .status(400)
                .json({ error: "Data registrasi perangkat tidak lengkap." });
        }
        const quotaCheck = await checkDeviceQuota(companyId, licenseKey, licenseTier);
        if (!quotaCheck.allowed) {
            return res.status(403).json({
                error: `Batas kuota lisensi tercapai! Maksimal ${quotaCheck.maxAllowed} perangkat aktif untuk paket ini. Silakan upgrade lisensi perusahaan Anda di portal cloud.`,
            });
        }
        const deviceId = req.body.deviceId || req.body.nodeId || `NODE_${ulid()}`;
        await db.transaction(async (tx) => {
            if (replaceDeviceId) {
                await tx
                    .update(deviceRegistry)
                    .set({ status: "REPLACED", updatedAt: new Date() })
                    .where(eq(deviceRegistry.id, replaceDeviceId));
            }
            await tx.insert(deviceRegistry).values({
                id: deviceId,
                name: name.toUpperCase(),
                companyId,
                regionId: regionId || null,
                outletId: outletId || null,
                nodePublicKey: publicKey,
                allowedModules: allowedModules || ["mdl_organization"],
                lat: String(lat || ""),
                lng: String(lng || ""),
                status: "ACTIVE",
                licenseTier: licenseTier,
                licenseKey: licenseKey,
                licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : null,
            });
        });
        res.status(200).json({
            status: "SUCCESS",
            deviceToken: `DVT_${ulid()}`,
            deviceId,
            companyId,
            regionId: regionId || null,
            outletId: outletId || null,
            allowedModules,
        });
    }
    catch (err) {
        console.error("[PROVISION ERROR - device]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.post("/takeover", async (req, res) => {
    try {
        const { replaceDeviceId, publicKey, lat, lng, deviceId: clientNodeId, nodeId, } = req.body;
        if (!replaceDeviceId || !publicKey) {
            return res
                .status(400)
                .json({ error: "replaceDeviceId dan publicKey wajib disertakan." });
        }
        const oldDevices = await db
            .select()
            .from(deviceRegistry)
            .where(eq(deviceRegistry.id, replaceDeviceId))
            .limit(1);
        if (oldDevices.length === 0) {
            return res
                .status(404)
                .json({ error: "Mesin lama tidak ditemukan di registry." });
        }
        const oldDevice = oldDevices[0];
        const newDeviceId = clientNodeId || nodeId || `NODE_${ulid()}`;
        await db.transaction(async (tx) => {
            await tx
                .update(deviceRegistry)
                .set({ status: "REPLACED", updatedAt: new Date() })
                .where(eq(deviceRegistry.id, replaceDeviceId));
            await tx.insert(deviceRegistry).values({
                id: newDeviceId,
                name: oldDevice.name,
                companyId: oldDevice.companyId,
                regionId: oldDevice.regionId,
                outletId: oldDevice.outletId,
                nodePublicKey: publicKey,
                allowedModules: oldDevice.allowedModules,
                lat: String(lat || ""),
                lng: String(lng || ""),
                status: "ACTIVE",
                licenseTier: oldDevice.licenseTier,
                licenseKey: oldDevice.licenseKey,
                licenseExpiresAt: oldDevice.licenseExpiresAt,
            });
        });
        const io = req.app.get("io");
        if (io) {
            io.emit("DEVICE_FORCE_LOGOUT", {
                deviceId: replaceDeviceId,
                reason: "DEVICE_REPLACED",
            });
        }
        res.status(200).json({
            status: "SUCCESS",
            deviceToken: `DVT_${ulid()}`,
            deviceId: newDeviceId,
            name: oldDevice.name,
            companyId: oldDevice.companyId,
            regionId: oldDevice.regionId,
            outletId: oldDevice.outletId,
            allowedModules: oldDevice.allowedModules,
        });
    }
    catch (err) {
        console.error("[TAKEOVER ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
router.patch("/upgrade-license", async (req, res) => {
    try {
        const { companyId, newLicenseKey } = req.body;
        if (!companyId || !newLicenseKey) {
            return res.status(400).json({
                error: "companyId dan newLicenseKey wajib disertakan.",
            });
        }
        const licenseData = LicenseManager.verifyLicense(newLicenseKey);
        if (!licenseData.isValid) {
            return res.status(400).json({
                error: licenseData.errorMessage ||
                    "Kunci lisensi tidak sah atau kedaluwarsa.",
            });
        }
        await db
            .update(deviceRegistry)
            .set({
            licenseTier: licenseData.tier,
            licenseKey: newLicenseKey,
            allowedModules: licenseData.allowedModules,
            licenseExpiresAt: licenseData.validUntil
                ? new Date(licenseData.validUntil)
                : null,
            updatedAt: new Date(),
        })
            .where(eq(deviceRegistry.companyId, companyId));
        const io = req.app.get("io");
        if (io) {
            io.to(`company:${companyId}`).emit("LICENSE_UPGRADED", {
                companyId,
                tier: licenseData.tier,
                licenseKey: newLicenseKey,
                allowedModules: licenseData.allowedModules,
                validUntil: licenseData.validUntil,
            });
        }
        res.status(200).json({
            status: "SUCCESS",
            message: `Lisensi perusahaan berhasil ditingkatkan ke paket ${licenseData.tier}.`,
            tier: licenseData.tier,
            allowedModules: licenseData.allowedModules,
        });
    }
    catch (err) {
        console.error("[UPGRADE LICENSE ERROR]:", err);
        res.status(500).json({ error: err.message });
    }
});
export const provisionRouter = router;
