const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
require("dotenv").config();

/* ═══════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 5000;
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(__dirname, "database.json");

// Ensure uploads/ exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Ensure database.json exists
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));

/* ═══════════════════════════════════════════════════════
   MULTER — file upload with original extensions
   ═══════════════════════════════════════════════════════ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === "pdf" && file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed for the certificate document."));
  }
  if (file.fieldname === "photo" && !file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed for the student photo."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

/* ═══════════════════════════════════════════════════════
   JSON DATABASE HELPERS
   ═══════════════════════════════════════════════════════ */
async function readDB() {
  try {
    const raw = await fsPromises.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeDB(data) {
  await fsPromises.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

/* ═══════════════════════════════════════════════════════
   EXPRESS APP
   ═══════════════════════════════════════════════════════ */
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

/* ───── Health Check ───── */
app.get("/", (_req, res) => {
  res.json({ message: "CertChain Backend Running 🚀" });
});

/* ═══════════════════════════════════════════════════════
   POST /api/certificates — Upload files + store metadata
   ═══════════════════════════════════════════════════════ */
const certUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "photo", maxCount: 1 },
]);

app.post("/api/certificates", (req, res) => {
  console.log("\n━━━ POST /api/certificates HIT ━━━");

  certUpload(req, res, async (err) => {
    // Multer / file-type errors
    if (err) {
      console.error("❌ Multer error:", err.message);
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      /* ── Debug: log everything received ── */
      console.log("📦 req.body:", JSON.stringify(req.body, null, 2));
      console.log("📎 req.files keys:", req.files ? Object.keys(req.files) : "NONE");
      if (req.files?.pdf?.[0]) console.log("   pdf →", req.files.pdf[0].filename);
      if (req.files?.photo?.[0]) console.log("   photo →", req.files.photo[0].filename);

      /* ── Validate files ── */
      const pdfFile = req.files?.pdf?.[0];
      const photoFile = req.files?.photo?.[0];

      if (!pdfFile || !photoFile) {
        console.error("❌ Missing files — pdf:", !!pdfFile, "photo:", !!photoFile);
        return res.status(400).json({
          success: false,
          error: "Both a PDF certificate and a student photo are required.",
        });
      }

      /* ── Validate text fields ── */
      const { name, courseName, instituteName } = req.body;
      const required = { name, courseName, instituteName };
      const missing = Object.entries(required)
        .filter(([, v]) => !v || !v.trim())
        .map(([k]) => k);

      if (missing.length > 0) {
        console.error("❌ Missing text fields:", missing);
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(", ")}`,
        });
      }

      /* ── Build metadata object ── */
      const metadata = {
        name: name.trim(),
        courseName: courseName.trim(),
        instituteName: instituteName.trim(),
        pdfFilename: pdfFile.filename,
        photoFilename: photoFile.filename,
        createdAt: new Date().toISOString(),
      };

      /* ── Deterministic SHA-256 hash of metadata ── */
      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(metadata))
        .digest("hex");

      /* ── Persist to database.json ── */
      console.log("💾 DB_PATH:", DB_PATH);
      console.log("💾 Writing hash:", hash.slice(0, 16) + "…");

      const db = await readDB();
      db[hash] = metadata;

      try {
        await writeDB(db);
        console.log("✅ database.json written successfully. Total records:", Object.keys(db).length);
      } catch (writeErr) {
        console.error("❌ WRITE FAILED:", writeErr.message);
        console.error("   Full error:", writeErr);
        return res.status(500).json({ success: false, error: "Failed to write database." });
      }

      console.log(`✅ Certificate stored — Name: ${metadata.name}  Hash: ${hash.slice(0, 12)}…`);

      return res.json({ success: true, hash });
    } catch (error) {
      console.error("❌ POST /api/certificates error:", error);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });
});

/* ═══════════════════════════════════════════════════════
   GET /api/certificates/:hash — Lookup by hash
   ═══════════════════════════════════════════════════════ */
app.get("/api/certificates/:hash", async (req, res) => {
  try {
    const db = await readDB();
    const record = db[req.params.hash];

    if (!record) {
      return res.status(404).json({ success: false, error: "Certificate not found." });
    }

    return res.json({
      success: true,
      certificate: {
        ...record,
        pdfUrl: `/uploads/${record.pdfFilename}`,
        photoUrl: `/uploads/${record.photoFilename}`,
      },
    });
  } catch (error) {
    console.error("GET /api/certificates/:hash error:", error);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
});

/* ═══════════════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════════════ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 CertChain Backend running on http://localhost:${PORT}`);
  console.log(`📂 Uploads dir : ${UPLOADS_DIR}`);
  console.log(`📂 Database    : ${DB_PATH}`);
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    console.log(`📊 Existing records: ${Object.keys(db).length}`);
  } catch {
    console.log(`⚠️  database.json could not be read — will be created on first write`);
  }
});
