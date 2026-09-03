// File: packages/core_unv/src/generator/removeModule.js
import fs from "fs";
import path from "path";
import readline from "readline";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function promptQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function pascalCase(str) {
  return str.replace(/(^\w|-\w|_\w|\s\w)/g, (clear) =>
    clear.replace(/[-_\s]/, "").toUpperCase(),
  );
}

const PROTECTED_MODULES = [
  "mdl_organization",
  "mdl_item",
  "mdl_vendor",
  "mdl_receiving",
  "mdl_warehouse",
  "mdl_plusales",
  "mdl_executivepanel",
];

async function runUninstallCLI() {
  console.clear();
  console.log(`
${c.red}${c.bold}===================================================================
   ALMA ERP MODULE UNINSTALLER CLI v2.0.0
   Clean Scaffolding Teardown & De-Registration Tool
===================================================================${c.reset}
  `);

  const rootDir = process.cwd();
  const modulesPath = path.join(rootDir, "modules");

  if (!fs.existsSync(modulesPath)) {
    console.log(`${c.red}  Folder 'modules/' tidak ditemukan.${c.reset}`);
    return;
  }

  const installedModules = fs
    .readdirSync(modulesPath)
    .filter(
      (dir) =>
        dir.startsWith("mdl_") &&
        fs.statSync(path.join(modulesPath, dir)).isDirectory(),
    );

  if (installedModules.length === 0) {
    console.log(`${c.yellow}Tidak ada modul yang terpasang.${c.reset}`);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${c.bold}Daftar Modul Terpasang:${c.reset}`);
  installedModules.forEach((mod, idx) => {
    const isProtected = PROTECTED_MODULES.includes(mod);
    console.log(
      `  ${c.cyan}${idx + 1}.${c.reset} ${c.bold}${mod}${c.reset} ${
        isProtected ? `${c.gray}(Modul Inti - Terlindungi)${c.reset}` : ""
      }`,
    );
  });

  const rawChoice = await promptQuestion(
    rl,
    `\n${c.bold}? Masukkan nomor modul yang ingin dicopot (1-${installedModules.length}):${c.reset} `,
  );
  const choiceIdx = parseInt(rawChoice.trim(), 10) - 1;

  if (
    isNaN(choiceIdx) ||
    choiceIdx < 0 ||
    choiceIdx >= installedModules.length
  ) {
    console.log(`${c.red}  Pilihan tidak valid.${c.reset}`);
    rl.close();
    return;
  }

  const selectedModule = installedModules[choiceIdx];

  if (PROTECTED_MODULES.includes(selectedModule)) {
    console.log(
      `\n${c.red}${c.bold}  DITOLAK: Modul '${selectedModule}' adalah modul inti sistem dan tidak boleh dihapus!${c.reset}\n`,
    );
    rl.close();
    return;
  }

  const confirm = await promptQuestion(
    rl,
    `\n${c.red}${c.bold}⚠️  PERINGATAN: Apakah Anda yakin ingin MENGHAPUS TOTAL '${selectedModule}'? (Ketik 'DELETE' untuk konfirmasi):${c.reset} `,
  );
  rl.close();

  if (confirm.trim() !== "DELETE") {
    console.log(`\n${c.yellow}Pencopotan modul dibatalkan.${c.reset}\n`);
    return;
  }

  console.log(
    `\n${c.cyan}  Membersihkan seluruh referensi modul '${selectedModule}'...${c.reset}`,
  );

  const slug = selectedModule.replace(/^mdl_/, "");
  const PascalName = pascalCase(slug);

  cleanPluginRegistry(rootDir, selectedModule, PascalName);
  cleanServerSyncWorker(rootDir, selectedModule, PascalName, slug);

  const moduleFullPath = path.join(modulesPath, selectedModule);
  if (fs.existsSync(moduleFullPath)) {
    fs.rmSync(moduleFullPath, { recursive: true, force: true });
    console.log(
      `  ${c.green}✓ Folder 'modules/${selectedModule}' berhasil dihapus dari disk.${c.reset}`,
    );
  }

  console.log(
    `\n${c.green}${c.bold}🎉 SUKSES! Modul '${selectedModule}' berhasil dicopot secara bersih!${c.reset}\n`,
  );
}

function cleanPluginRegistry(rootDir, moduleDirName, PascalName) {
  const registryPath = path.join(
    rootDir,
    "apps",
    "client_unv",
    "src",
    "pluginRegistry.ts",
  );
  if (!fs.existsSync(registryPath)) return;

  let content = fs.readFileSync(registryPath, "utf-8");
  const importPluginRegex = new RegExp(
    `^.*import\\s*\\{[^}]*\\b${PascalName}Plugin\\b[^}]*\\}\\s*from\\s*["'][^"']*${moduleDirName}[^"']*["'];?\\r?\\n?`,
    "gm",
  );
  const registerRegex = new RegExp(
    `^.*manager\\.register\\(\\s*${PascalName}Plugin\\s*\\);?\\r?\\n?`,
    "gm",
  );

  content = content.replace(importPluginRegex, "").replace(registerRegex, "");
  content = content.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(registryPath, content);
  console.log(
    `  ${c.green}✓ Seluruh baris impor & registrasi di Plugin Registry (pluginRegistry.ts) telah dibersihkan.${c.reset}`,
  );
}

function cleanServerSyncWorker(rootDir, moduleDirName, PascalName, slug) {
  const syncWorkerPath = path.join(
    rootDir,
    "apps",
    "server_unv",
    "src",
    "worker",
    "syncWorker.ts",
  );
  if (!fs.existsSync(syncWorkerPath)) return;

  let content = fs.readFileSync(syncWorkerPath, "utf-8");
  const importHandlersRegex = new RegExp(
    `^.*import\\s*\\{[^}]*\\b${slug}Handlers\\b[^}]*\\}\\s*from\\s*["'][^"']*${moduleDirName}[^"']*["'];?\\r?\\n?`,
    "gm",
  );
  const rawSpreadRegex = new RegExp(
    `^.*\\.\\.\\.${slug}Handlers,?\\r?\\n?`,
    "gm",
  );

  content = content
    .replace(importHandlersRegex, "")
    .replace(rawSpreadRegex, "");
  content = content.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(syncWorkerPath, content);
  console.log(
    `  ${c.green}✓ Seluruh baris handler di Server Sync Worker (syncWorker.ts) telah dibersihkan.${c.reset}`,
  );
}

runUninstallCLI();
