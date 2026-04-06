const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const PinataClient = require("@pinata/sdk");
const streamifier = require("streamifier");
require("dotenv").config();

/* ═══════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, "database.json");

// Pinata Configuration
const pinata = new PinataClient(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";

// Ensure database.json exists
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));

/* ═══════════════════════════════════════════════════════
   MULTER — file upload to memory
   ═══════════════════════════════════════════════════════ */
const storage = multer.memoryStorage();

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

/* ───── Health Check ───── */
app.get("/", (_req, res) => {
  res.json({ message: "CertChain Backend Running 🚀" });
});

/* ═══════════════════════════════════════════════════════
   POST /api/certificates — Upload files + store metadata
   ═══════════════════════════════════════════════════════ */
app.post("/api/certificates", upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "photo", maxCount: 1 },
]), async (req, res) => {
  console.log("\n━━━ POST /api/certificates HIT ━━━");

  try {
    /* ── Debug: log everything received ── */
    console.log("📦 req.body:", JSON.stringify(req.body, null, 2));
    console.log("📎 req.files:", req.files ? Object.keys(req.files) : "NONE");
    if (req.files?.pdf?.[0]) {
      console.log(`   pdf → ${req.files.pdf[0].originalname} (${req.files.pdf[0].size} bytes)`);
    }
    if (req.files?.photo?.[0]) {
      console.log(`   photo → ${req.files.photo[0].originalname} (${req.files.photo[0].size} bytes)`);
    }

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

    /* ── STEP 1: Upload files to Pinata (IPFS) ── */
    console.log("☁️  Uploading files to IPFS via Pinata...");

    const pinFile = async (file) => {
      console.log(`   ↳ Pinning ${file.fieldname}: ${file.originalname}`);
      const stream = streamifier.createReadStream(file.buffer);
      const options = {
        pinataMetadata: { name: file.originalname },
      };
      // FIX: The method is directly on the client instance, not under a `.pinning` property for this SDK version.
      const result = await pinata.pinFileToIPFS(stream, options);
      console.log(`   ↳ Pinned ${file.fieldname} (${file.originalname}) → ${result.IpfsHash}`);
      return result.IpfsHash;
    };

    const [pdfCid, photoCid] = await Promise.all([pinFile(pdfFile), pinFile(photoFile)]);

    if (!pdfCid || !photoCid) {
      throw new Error("IPFS upload failed. One or more CIDs are missing.");
    }

    /* ── Build metadata object with IPFS CIDs ── */
    const metadata = {
      name: name.trim(),
      courseName: courseName.trim(),
      instituteName: instituteName.trim(),
      pdfCid: pdfCid,
      photoCid: photoCid,
      createdAt: new Date().toISOString(),
    };

    /* ── Deterministic SHA-256 hash of the new metadata ── */
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(metadata))
      .digest("hex");

    /* ── Persist to database.json ── */
    console.log("💾 Writing to database. Hash:", hash.slice(0, 16) + "…");
    const db = await readDB();
    db[hash] = metadata;
    await writeDB(db);
    console.log("✅ database.json written successfully. Total records:", Object.keys(db).length);

    console.log(`✅ Certificate stored — Name: ${metadata.name}  Hash: ${hash.slice(0, 12)}…`);
    return res.json({ success: true, hash });

  } catch (error) {
    console.error("❌ POST /api/certificates error:", error);
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
    }
    // Handle specific Pinata auth errors
    if (error.message?.includes("EINVALIDPINATAKEYS") || error.message?.includes("authentication")) {
      return res.status(401).json({ success: false, error: "Pinata authentication failed. Check your API keys." });
    }
    // Handle our custom file filter errors from multer
    if (error.message.includes("Only PDF files are allowed") || error.message.includes("Only image files are allowed")) {
        return res.status(400).json({ success: false, error: error.message });
    }
    // Generic server error
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
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

    // Construct full IPFS gateway URLs
    return res.json({
      success: true,
      certificate: {
        ...record,
        pdfUrl: `${PINATA_GATEWAY}/${record.pdfCid}`,
        photoUrl: `${PINATA_GATEWAY}/${record.photoCid}`,
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
  console.log(`📂 Database    : ${DB_PATH}`);
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    console.log(`📊 Existing records: ${Object.keys(db).length}`);
  } catch {
    console.log(`⚠️  database.json could not be read — will be created on first write`);
  }
});
