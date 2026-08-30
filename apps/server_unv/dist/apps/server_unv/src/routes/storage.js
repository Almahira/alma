// File: apps/server_unv/src/routes/storage.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
const router = express.Router();
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
// Konfigurasi Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const aggregateType = req.body.aggregateType || "UNKNOWN";
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        // Format: uploads/ORGANIZATION
        const aggregateDir = path.join(UPLOAD_ROOT, aggregateType);
        if (!fs.existsSync(aggregateDir)) {
            fs.mkdirSync(aggregateDir, { recursive: true });
        }
        cb(null, aggregateDir);
    },
    filename: (req, file, cb) => {
        const fileId = req.body.fileId || `FILE_${Date.now()}`;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const ext = path.extname(file.originalname);
        // Format: YYYY#MM#FILEID.ext
        const newFilename = `${year}#${month}#${fileId}${ext}`;
        cb(null, newFilename);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // Hard limit server 200MB, validasi halus ada di klien
});
// Endpoint Upload
router.post("/upload", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ status: "FAILED", message: "File tidak dikirim" });
        }
        res.status(200).json({
            status: "SUCCESS",
            message: "File berhasil disimpan",
            filename: req.file.filename,
        });
    }
    catch (error) {
        console.error("[STORAGE] Upload error:", error);
        res.status(500).json({ status: "FAILED", message: error.message });
    }
});
// Endpoint Download
router.get("/download/:aggregateType/:fileId", (req, res) => {
    const { aggregateType, fileId } = req.params;
    const aggregateDir = path.join(UPLOAD_ROOT, aggregateType);
    if (!fs.existsSync(aggregateDir)) {
        return res
            .status(404)
            .json({ status: "FAILED", message: "Direktori tidak ditemukan" });
    }
    // Cari file yang mengandung fileId
    const files = fs.readdirSync(aggregateDir);
    const matchedFile = files.find((f) => f.includes(`#${fileId}.`));
    if (!matchedFile) {
        return res
            .status(404)
            .json({ status: "FAILED", message: "File tidak ditemukan" });
    }
    const filePath = path.join(aggregateDir, matchedFile);
    res.sendFile(filePath);
});
// ---> PERBAIKAN DI SINI: Menambahkan anotasi tipe eksplisit : Router <---
export const storageRouter = router;
