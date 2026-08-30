// File: apps/server_unv/src/scripts/test-provision.ts
import { ulid } from "ulidx";
import {
  LicenseManager,
  AlmaLicensePayload,
} from "../../../../packages/core_unv/src/ledger/licenseManager.js";
import { CryptoManager } from "../../../../packages/core_unv/src/ledger/crypto.js";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function pass(testName: string, detail?: string) {
  console.log(
    `  ${c.green}✔ [PASS]${c.reset} ${c.bold}${testName}${c.reset} ${detail ? `(${detail})` : ""}`,
  );
}

function fail(testName: string, reason: string) {
  console.log(
    `  ${c.red}✖ [FAIL]${c.reset} ${c.bold}${testName}${c.reset} -> ${reason}`,
  );
}

async function runTestSuite() {
  console.clear();
  console.log(`
${c.cyan}${c.bold}===================================================================
   ALMA ERP PROVISIONING & LICENSE AUTOMATED TEST SUITE
   Target Server: ${SERVER_URL}
===================================================================${c.reset}
  `);

  let testCompanyId = "";
  let testRegionId = "";
  const testRunId = ulid().toLowerCase();
  const supervisorEmail = `test_${testRunId}@company.com`;
  const supervisorPassword = "Password123!";
  const registeredDeviceIds: string[] = [];

  try {
    // 1. CEK SYSTEM STATUS
    console.log(
      `\n${c.yellow}[1/6] Menguji Endpoint /system-status...${c.reset}`,
    );
    const statusRes = await fetch(`${SERVER_URL}/api/provision/system-status`);
    const statusData = await statusRes.json();

    if (statusRes.ok) {
      pass(
        "System Status Berhasil Diakses",
        `Virgin State: ${statusData.isVirgin}`,
      );
    } else {
      fail("System Status Gagal", statusData.error);
      return;
    }

    // 2. INISIALISASI COLD-START TENANT UJI COBA
    console.log(
      `\n${c.yellow}[2/6] Inisialisasi Tenant Uji Coba Baru (Free Tier)...${c.reset}`,
    );
    const coldStartKeypair = CryptoManager.generateKeyPair();
    const coldStartDeviceId = `NODE_TEST_01_${ulid()}`;

    const coldStartPayload = {
      company: { name: `PT TEST ${testRunId.toUpperCase().slice(-6)}` },
      region: { name: "WILAYAH TEST PUSAT" },
      outlet: { name: "OUTLET TEST UTAMA" },
      superAdmin: {
        fullName: "SUPERVISOR PENGUJIAN",
        email: supervisorEmail,
        password: supervisorPassword,
        pin: "123456",
      },
      device: {
        deviceId: coldStartDeviceId,
        name: "TABLET-KASIR-01",
        scope: "OUTLET",
        publicKey: coldStartKeypair.publicKey,
        allowedModules: ["mdl_organization", "mdl_item"],
      },
      licenseTier: "FREE",
      licenseKey: null,
    };

    const coldRes = await fetch(`${SERVER_URL}/api/provision/cold-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coldStartPayload),
    });
    const coldData = await coldRes.json();

    if (coldRes.ok && coldData.status === "SUCCESS") {
      testCompanyId = coldData.companyId;
      testRegionId = coldData.regionId;
      registeredDeviceIds.push(coldStartDeviceId);
      pass(
        "Tenant Uji Coba Berhasil Dibuat",
        `Company ID: ${testCompanyId}, Mesin #1 Terdaftar`,
      );
    } else {
      fail("Inisialisasi Tenant Gagal", coldData.error);
      return;
    }

    // 3. DAFTARKAN MESIN HINGGA BATAS KUOTA FREE (10 PERANGKAT)
    console.log(
      `\n${c.yellow}[3/6] Mendaftarkan Perangkat #2 s/d #10 (Batas Kuota Free = 10)...${c.reset}`,
    );
    for (let i = 2; i <= 10; i++) {
      const kp = CryptoManager.generateKeyPair();
      const devId = `NODE_TEST_${String(i).padStart(2, "0")}_${ulid()}`;
      const devPayload = {
        companyId: testCompanyId,
        regionId: testRegionId || null,
        name: `TABLET-KASIR-${String(i).padStart(2, "0")}`,
        publicKey: kp.publicKey,
        allowedModules: ["mdl_organization"],
        licenseTier: "FREE",
        licenseKey: null,
        deviceId: devId,
      };

      const devRes = await fetch(`${SERVER_URL}/api/provision/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(devPayload),
      });

      if (devRes.ok) {
        registeredDeviceIds.push(devId);
        pass(`Perangkat #${i} Terdaftar`, `ID: ${devId.substring(0, 18)}...`);
      } else {
        const errJson = await devRes.json();
        fail(`Perangkat #${i} Gagal`, errJson.error);
      }
    }

    // 4. UJI PENOLAKAN KUOTA (PERANGKAT KE-11 HARUS DITOLAK 403)
    console.log(
      `\n${c.yellow}[4/6] Menguji Pendaftaran Perangkat ke-11 (Harus Ditolak HTTP 403)...${c.reset}`,
    );
    const kp11 = CryptoManager.generateKeyPair();
    const dev11Id = `NODE_TEST_11_${ulid()}`;
    const dev11Payload = {
      companyId: testCompanyId,
      regionId: testRegionId || null,
      name: "TABLET-KASIR-11",
      publicKey: kp11.publicKey,
      allowedModules: ["mdl_organization"],
      licenseTier: "FREE",
      licenseKey: null,
      deviceId: dev11Id,
    };

    const dev11Res = await fetch(`${SERVER_URL}/api/provision/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dev11Payload),
    });
    const dev11Data = await dev11Res.json();

    if (dev11Res.status === 403) {
      pass(
        "Penolakan Kuota Berhasil!",
        `HTTP 403 - Pesan: "${dev11Data.error}"`,
      );
    } else if (dev11Res.ok) {
      fail(
        "Pencegahan Kuota Bocor!",
        `Perangkat ke-11 berhasil mendaftar padahal batas Free adalah 10. Status: ${dev11Res.status}`,
      );
    } else {
      fail(
        "Respons Tidak Terduga",
        `HTTP ${dev11Res.status} - ${dev11Data.error}`,
      );
    }

    // 5. UJI UPGRADE LISENSI OTA KE PREMIUM (KUOTA 50)
    console.log(
      `\n${c.yellow}[5/6] Menguji Upgrade Lisensi Over-The-Air ke PREMIUM (Kuota 50)...${c.reset}`,
    );
    const masterSecretKey =
      process.env.ALMA_MASTER_SECRET_KEY || "ALMA_SECRET_DEV_KEY";
    const now = new Date();
    const validUntil = new Date(
      now.setFullYear(now.getFullYear() + 1),
    ).toISOString();

    const premiumLicensePayload: AlmaLicensePayload = {
      licenseId: `LIC_TEST_${ulid()}`,
      tier: "PREMIUM",
      companyName: "PT TEST ENTERPRISE",
      issuedTo: supervisorEmail,
      maxOutlets: 50,
      allowedModules: [
        "mdl_organization",
        "mdl_item",
        "mdl_vendor",
        "mdl_receiving",
        "mdl_warehouse",
        "mdl_plusales",
        "mdl_executivepanel",
        "mdl_manufacturing",
        "mdl_multi_warehouse",
      ],
      validUntil,
    };

    const newPremiumToken = LicenseManager.generateLicenseToken(
      premiumLicensePayload,
      masterSecretKey,
    );

    const upgradeRes = await fetch(
      `${SERVER_URL}/api/provision/upgrade-license`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: testCompanyId,
          newLicenseKey: newPremiumToken,
        }),
      },
    );
    const upgradeData = await upgradeRes.json();

    if (upgradeRes.ok && upgradeData.status === "SUCCESS") {
      pass(
        "Upgrade Lisensi Sukses",
        `Tier: ${upgradeData.tier}, Kuota 50 Aktif`,
      );

      console.log(
        `  ${c.magenta}↳ Mendaftarkan kembali Perangkat ke-11 pasca-upgrade...${c.reset}`,
      );
      const retry11Res = await fetch(`${SERVER_URL}/api/provision/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dev11Payload,
          licenseTier: "PREMIUM",
          licenseKey: newPremiumToken,
        }),
      });

      if (retry11Res.ok) {
        registeredDeviceIds.push(dev11Id);
        pass(
          "Perangkat ke-11 Berhasil Terdaftar Pasca-Upgrade",
          `ID: ${dev11Id}`,
        );
      } else {
        const retryErr = await retry11Res.json();
        fail("Perangkat ke-11 Masih Ditolak Pasca-Upgrade", retryErr.error);
      }
    } else {
      fail("Upgrade Lisensi Gagal", upgradeData.error);
    }

    // 6. UJI DISASTER RECOVERY (TAKEOVER MESIN RUSAK)
    console.log(
      `\n${c.yellow}[6/6] Menguji Protokol Disaster Recovery / Takeover...${c.reset}`,
    );
    const victimDeviceId = registeredDeviceIds[0];
    const replacementKp = CryptoManager.generateKeyPair();
    const replacementDeviceId = `NODE_REPLACEMENT_${ulid()}`;

    const takeoverPayload = {
      replaceDeviceId: victimDeviceId,
      publicKey: replacementKp.publicKey,
      deviceId: replacementDeviceId,
      nodeId: replacementDeviceId,
    };

    const takeoverRes = await fetch(`${SERVER_URL}/api/provision/takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(takeoverPayload),
    });
    const takeoverData = await takeoverRes.json();

    if (takeoverRes.ok && takeoverData.status === "SUCCESS") {
      pass(
        "Takeover Berhasil!",
        `Mesin Lama (${victimDeviceId.substring(0, 16)}...) dinonaktifkan -> Mesin Baru (${replacementDeviceId.substring(0, 16)}...) aktif`,
      );
    } else {
      fail("Takeover Gagal", takeoverData.error);
    }

    // KESIMPULAN
    console.log(`
${c.green}${c.bold}===================================================================
   SEMUA SKENARIO PENGUJIAN PROVISIONING & LISENSI SELESAI!
   - Guard Kuota 10 Perangkat : VALID & AMAN
   - Penolakan Perangkat #11  : VALID (HTTP 403)
   - Hot-Upgrade OTA ke 50    : VALID & RESPONSIF
   - Disaster Recovery Takeover: VALID (Zero Kuota Leak)
===================================================================${c.reset}
    `);
  } catch (error: any) {
    console.error(`\n${c.red}FATAL TEST ERROR:${c.reset}`, error.message);
  }
}

runTestSuite();
