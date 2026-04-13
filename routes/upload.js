// ─────────────────────────────────────────────────────────────
//  routes/upload.js  —  File upload endpoint
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads", "reports");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  },
});

const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const maxSize = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Please upload PDF or image files."));
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    res.json({
      pathname: `reports/${req.file.filename}`,
      contentType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Upload failed" });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
