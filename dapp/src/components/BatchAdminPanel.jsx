import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const BACKEND_URL = "http://127.0.0.1:5000/api/certificates";
const CHUNK_SIZE = 3;          // concurrent-safe sequential chunk size
const MAX_BATCH = 100;
const REQUIRED_COLS = ["name", "course", "institute", "pdf_filename", "photo_filename"];

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS  (consistent with AdminPanel / LandingPage)
   ═══════════════════════════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, staggerChildren: 0.08 },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const slideVariants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit: { opacity: 0, x: -32, transition: { duration: 0.25, ease: "easeIn" } },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SMALL HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const Spinner = ({ size = 4 }) => (
  <svg
    className={`animate-spin h-${size} w-${size} text-white inline-block`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const Badge = ({ type, label }) => {
  const styles = {
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    error: "bg-red-500/15   text-red-400   border-red-500/25",
    pending: "bg-amber-500/15  text-amber-400  border-amber-500/25",
    info: "bg-cyan-500/15   text-cyan-400   border-cyan-500/25",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[type] ?? styles.info}`}>
      {type === "success" && "✓"}
      {type === "error" && "✕"}
      {type === "pending" && "…"}
      {type === "info" && "·"}
      {label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD STEPPER
   ═══════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  { id: 1, label: "CSV Upload", icon: "📋" },
  { id: 2, label: "Asset Selection", icon: "📁" },
  { id: 3, label: "Process & Issue", icon: "⛓️" },
];

function Stepper({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10 select-none">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        const isLast = idx === STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={
                  done ? { background: "linear-gradient(135deg,#06b6d4,#9333ea)", scale: 1 } :
                    active ? { background: "linear-gradient(135deg,#06b6d4,#9333ea)", scale: 1.1 } :
                      { background: "rgba(255,255,255,0.05)", scale: 1 }
                }
                transition={{ duration: 0.3 }}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 shadow-lg"
              >
                {done ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-base ${active ? "text-white" : "text-slate-500"}`}>{step.icon}</span>
                )}
              </motion.div>
              <span className={`text-xs font-medium transition-colors duration-200 ${active ? "text-cyan-400" : done ? "text-slate-300" : "text-slate-500"}`}>
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className="relative w-16 sm:w-24 h-0.5 mb-5 bg-white/10 mx-1">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full"
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — CSV UPLOAD
   ═══════════════════════════════════════════════════════════════════════════ */
function StepCsvUpload({ onParsed }) {
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [preview, setPreview] = useState(null); // { rows, filename }
  const inputRef = useRef(null);

  const normaliseKey = (k) => k.trim().toLowerCase().replace(/\s+/g, "_");

  const processFile = useCallback((file) => {
    setParseError(null);
    setPreview(null);

    if (!file || !file.name.endsWith(".csv")) {
      setParseError("Please upload a valid .csv file.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normaliseKey(h),
      complete: (result) => {
        // Validate columns
        const cols = Object.keys(result.data[0] ?? {});
        const missing = REQUIRED_COLS.filter((c) => !cols.includes(c));
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(", ")}`);
          return;
        }
        if (result.data.length === 0) {
          setParseError("CSV file has no data rows.");
          return;
        }
        if (result.data.length > MAX_BATCH) {
          setParseError(`CSV has ${result.data.length} rows — max allowed is ${MAX_BATCH}.`);
          return;
        }
        setPreview({ rows: result.data, filename: file.name });
        onParsed(result.data);
      },
      error: (err) => setParseError(`Parse error: ${err.message}`),
    });
  }, [onParsed]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h3 className="text-lg font-semibold text-white mb-1">Upload Batch CSV</h3>
        <p className="text-sm text-slate-400">
          Your CSV must have exactly these columns:{" "}
          <span className="font-mono text-cyan-400 text-xs">
            Name, Course, Institute, PDF_Filename, Photo_Filename
          </span>
        </p>
      </motion.div>

      {/* Drop zone */}
      <motion.div variants={itemVariants}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300
            ${dragOver
              ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
              : preview
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => processFile(e.target.files[0])}
          />
          {preview ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">✅</span>
              <p className="text-white font-medium">{preview.filename}</p>
              <p className="text-sm text-slate-400">{preview.rows.length} records parsed successfully</p>
              <p className="text-xs text-slate-500 mt-1">Click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
                <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Drop your CSV here</p>
                <p className="text-slate-500 text-sm">or click to browse</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Parse error */}
      <AnimatePresence>
        {parseError && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 text-sm font-medium"
          >
            ⚠️ {parseError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview table */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Preview</span>
              <Badge type="info" label={`${preview.rows.length} rows`} />
            </div>
            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    {REQUIRED_COLS.map((c) => (
                      <th key={c} className="px-4 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                        {c.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                      {REQUIRED_COLS.map((c) => (
                        <td key={c} className="px-4 py-2.5 text-slate-300 truncate max-w-[140px]" title={row[c]}>
                          {row[c] || <span className="text-red-400/70">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {preview.rows.length > 5 && (
                    <tr>
                      <td colSpan={REQUIRED_COLS.length} className="px-4 py-2.5 text-slate-500 text-center italic">
                        + {preview.rows.length - 5} more rows…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column format reference */}
      <motion.div variants={itemVariants}
        className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] text-xs text-slate-500"
      >
        <p className="font-semibold text-slate-400 mb-1.5">📌 Expected CSV format</p>
        <code className="text-cyan-400/80 font-mono leading-relaxed break-all">
          Name,Course,Institute,PDF_Filename,Photo_Filename<br />
          Alice Sharma,B.Tech CSE,MIT College,alice_cert.pdf,alice_photo.jpg
        </code>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — ASSET SELECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function StepAssetSelection({ csvRows, onFilesValidated }) {
  const [fileMap, setFileMap] = useState(new Map()); // filename(lower) -> File
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // Build required files list from CSV
  const required = csvRows.flatMap((row) => [
    { name: row.pdf_filename, type: "PDF" },
    { name: row.photo_filename, type: "Photo" },
  ]);
  const unique = [...new Map(required.map((r) => [r.name?.toLowerCase(), r])).values()];

  const addFiles = useCallback((files) => {
    setFileMap((prev) => {
      const next = new Map(prev);
      for (const f of files) next.set(f.name.toLowerCase(), f);
      return next;
    });
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles([...e.dataTransfer.files]);
  }, [addFiles]);

  // Derive validation state
  const missing = unique.filter((r) => !fileMap.has(r.name?.toLowerCase()));
  const allFound = missing.length === 0 && fileMap.size > 0;

  // Notify parent when all files present
  const handleConfirm = () => {
    if (!allFound) return;
    onFilesValidated(fileMap);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h3 className="text-lg font-semibold text-white mb-1">Select PDF & Photo Assets</h3>
        <p className="text-sm text-slate-400">
          Select all <span className="text-white font-medium">{csvRows.length * 2}</span> files referenced in the CSV at once.
          The filenames must match exactly (case-insensitive).
        </p>
      </motion.div>

      {/* ── Action-required info banner ── */}
      <motion.div
        variants={itemVariants}
        className="flex items-start gap-3 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10"
      >
        {/* Icon */}
        <span className="mt-0.5 flex-shrink-0 text-cyan-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        {/* Text */}
        <p className="text-sm text-cyan-400 leading-relaxed">
          <span className="font-semibold">Action Required: </span>
          Your CSV was read successfully. Now, drag and drop all the actual
          {" "}<span className="font-semibold">PDF and Photo files</span> referenced
          in the checklist below into the box so we can process them.
        </p>
      </motion.div>

      {/* File drop zone */}
      <motion.div variants={itemVariants}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
            ${dragOver
              ? "border-purple-400 bg-purple-500/10 scale-[1.01]"
              : allFound
                ? "border-emerald-500/40 bg-emerald-500/5"
                : fileMap.size > 0
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles([...e.target.files])}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            {fileMap.size > 0 ? (
              <>
                <p className="text-white font-medium">{fileMap.size} file{fileMap.size !== 1 ? "s" : ""} loaded</p>
                <p className="text-slate-500 text-xs">
                  {allFound ? "All required files found ✓" : `${missing.length} still missing — click to add more`}
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-medium">
                  Drag &amp; Drop the{" "}
                  <span className="text-cyan-400 font-bold">{unique.length}</span>{" "}
                  missing file{unique.length !== 1 ? "s" : ""} here
                </p>
                <p className="text-slate-500 text-sm">or click to browse — select multiple at once</p>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Validation checklist */}
      <AnimatePresence>
        {(fileMap.size > 0 || unique.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">File Validation</span>
              <div className="flex items-center gap-2">
                <Badge type="success" label={`${unique.length - missing.length} found`} />
                {missing.length > 0 && <Badge type="error" label={`${missing.length} missing`} />}
              </div>
            </div>
            <div className="overflow-y-auto max-h-56">
              {unique.map((req, i) => {
                const found = fileMap.has(req.name?.toLowerCase());
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                  >
                    <span className={`text-base flex-shrink-0 ${found ? "text-emerald-400" : "text-red-400"}`}>
                      {found ? "✓" : "✕"}
                    </span>
                    <span className={`text-xs font-mono flex-1 truncate ${found ? "text-slate-300" : "text-red-400/80"}`}>
                      {req.name || <span className="italic text-slate-500">empty filename</span>}
                    </span>
                    <Badge type={req.type === "PDF" ? "info" : "pending"} label={req.type} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm button */}
      <motion.div variants={itemVariants}>
        <button
          onClick={handleConfirm}
          disabled={!allFound}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300
            bg-gradient-to-r from-purple-600 to-cyan-500
            hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] hover:scale-[1.01]
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
            text-white"
        >
          {allFound ? "Confirm Files & Continue →" : `Waiting for ${missing.length} missing file${missing.length !== 1 ? "s" : ""}…`}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — PROCESSING & ISSUANCE
   ═══════════════════════════════════════════════════════════════════════════ */
function StepProcessing({ csvRows, fileMap, contract, signer, onReset }) {
  const [phase, setPhase] = useState("idle");   // idle | uploading | awaiting_mm | confirming | done | error
  const [uploadIdx, setUploadIdx] = useState(0);
  const [logs, setLogs] = useState([]);
  const [rowResults, setRowResults] = useState([]);       // { id, hash, status, error }
  const [txHash, setTxHash] = useState(null);
  const [txStatus, setTxStatus] = useState(null);     // { type, msg }
  const logRef = useRef(null);

  const pushLog = (msg, type = "info") => {
    setLogs((prev) => {
      const next = [...prev, { msg, type, ts: new Date().toLocaleTimeString() }];
      // Auto-scroll
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, 30);
      return next;
    });
  };

  /* ─── Main processing workflow ───────────────────────────────────────── */
  const handleStart = async () => {
    setPhase("uploading");
    setLogs([]);
    setRowResults([]);
    setTxStatus(null);
    setTxHash(null);

    const batchTimestamp = Date.now();
    const ids = [];
    const hashes = [];
    const results = Array(csvRows.length).fill(null).map((_, i) => ({
      idx: i,
      name: csvRows[i].name,
      id: `CERT-BATCH-${batchTimestamp}-${i + 1}`,
      hash: null,
      status: "pending",
      error: null,
    }));

    pushLog(`🚀 Starting batch upload of ${csvRows.length} certificate${csvRows.length !== 1 ? "s" : ""}…`, "info");

    /* ─── Sequential upload in chunks of CHUNK_SIZE ─── */
    try {
      for (let chunkStart = 0; chunkStart < csvRows.length; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, csvRows.length);
        const chunkSlice = csvRows.slice(chunkStart, chunkEnd);

        pushLog(`📦 Processing records ${chunkStart + 1}–${chunkEnd} of ${csvRows.length}…`, "info");

        // Sequential within each chunk to avoid multer memory spikes
        for (let localIdx = 0; localIdx < chunkSlice.length; localIdx++) {
          const absIdx = chunkStart + localIdx;
          const row = chunkSlice[localIdx];
          const certId = results[absIdx].id;

          setUploadIdx(absIdx + 1);
          pushLog(`  ↳ [${absIdx + 1}/${csvRows.length}] Uploading "${row.name}"…`, "info");

          try {
            // Resolve files (case-insensitive)
            const pdfFile = fileMap.get(row.pdf_filename?.toLowerCase());
            const photoFile = fileMap.get(row.photo_filename?.toLowerCase());

            if (!pdfFile) throw new Error(`PDF not found: ${row.pdf_filename}`);
            if (!photoFile) throw new Error(`Photo not found: ${row.photo_filename}`);

            const body = new FormData();
            body.append("name", row.name.trim());
            body.append("courseName", row.course.trim());
            body.append("instituteName", row.institute.trim());
            body.append("pdf", pdfFile);
            body.append("photo", photoFile);

            const res = await fetch(BACKEND_URL, { method: "POST", body });
            const data = await res.json();

            if (!res.ok || !data.success) throw new Error(data.error || "Backend upload failed");

            results[absIdx] = { ...results[absIdx], hash: data.hash, status: "uploaded" };
            ids.push(certId);
            hashes.push(data.hash);

            pushLog(`  ✅ [${absIdx + 1}] Hash: ${data.hash.slice(0, 14)}…`, "success");
          } catch (rowErr) {
            results[absIdx] = { ...results[absIdx], status: "error", error: rowErr.message };
            pushLog(`  ❌ [${absIdx + 1}] Failed: ${rowErr.message}`, "error");
          }

          setRowResults([...results]);
        }
      }

      /* ─── Check if we have anything to submit ─── */
      const successCount = results.filter((r) => r.status === "uploaded").length;
      const failCount = csvRows.length - successCount;

      if (successCount === 0) {
        throw new Error("All uploads failed — no certificates to register on-chain.");
      }

      if (failCount > 0) {
        pushLog(`⚠️  ${failCount} record(s) failed — submitting ${successCount} successful ones.`, "warning");
      }

      /* ─── Blockchain transaction ─── */
      pushLog(`⛓️  Sending batch transaction (${successCount} certs) — check MetaMask…`, "info");
      setPhase("awaiting_mm");

      if (!contract || !signer) {
        throw new Error("Wallet not connected — connect MetaMask and retry.");
      }

      const connectedContract = contract.connect(signer);
      const tx = await connectedContract.addCertificateBatch(ids, hashes);

      setPhase("confirming");
      pushLog(`📡 Transaction submitted: ${tx.hash.slice(0, 10)}…${tx.hash.slice(-6)}`, "info");
      pushLog("⏳ Awaiting blockchain confirmation…", "info");

      setTxHash(tx.hash);
      await tx.wait();

      setPhase("done");
      pushLog(`🎉 Batch confirmed on-chain! ${successCount} certificate${successCount !== 1 ? "s" : ""} issued.`, "success");

      setTxStatus({
        type: "success",
        msg: `✅ ${successCount} certificate${successCount !== 1 ? "s" : ""} issued on-chain.  Tx: ${tx.hash.slice(0, 10)}…${tx.hash.slice(-6)}`,
      });
    } catch (err) {
      setPhase("error");

      let msg = "Processing failed.";
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected in MetaMask.";
        pushLog("🚫 MetaMask: user rejected the transaction.", "error");
      } else if (err.message?.includes("BatchTooLarge")) {
        msg = "Batch exceeds 100-certificate limit.";
        pushLog("❌ Smart contract: batch size > 100.", "error");
      } else if (err.message?.includes("DuplicateIdInBatch")) {
        msg = "Duplicate certificate ID detected by smart contract.";
        pushLog("❌ Smart contract: duplicate ID in batch.", "error");
      } else {
        msg = err.message;
        pushLog(`❌ ${err.message}`, "error");
      }

      setTxStatus({ type: "error", msg });
    }
  };

  const isIdle = phase === "idle";
  const isProcessing = ["uploading", "awaiting_mm", "confirming"].includes(phase);
  const isDone = phase === "done";

  const phaseLabel = {
    idle: "Start Batch Issuance",
    uploading: `Uploading ${uploadIdx} of ${csvRows.length} to backend…`,
    awaiting_mm: "Awaiting MetaMask approval…",
    confirming: "Awaiting blockchain confirmation…",
    done: "Batch Complete ✓",
    error: "Retry Batch Issuance",
  }[phase];

  const uploaded = rowResults.filter((r) => r.status === "uploaded").length;
  const failed = rowResults.filter((r) => r.status === "error").length;
  const progress = csvRows.length > 0 ? Math.round(((uploaded + failed) / csvRows.length) * 100) : 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Summary card */}
      <motion.div variants={itemVariants}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: "Total Records", value: csvRows.length, color: "text-white" },
          { label: "Uploaded", value: uploaded, color: "text-emerald-400" },
          { label: "Failed", value: failed, color: failed > 0 ? "text-red-400" : "text-slate-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </motion.div>

      {/* Progress bar */}
      <AnimatePresence>
        {!isIdle && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex justify-between text-xs text-slate-400">
              <span>Upload progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            {phase === "awaiting_mm" && (
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium animate-pulse">
                <span>🦊</span>
                <span>Check your MetaMask — transaction is awaiting approval</span>
              </div>
            )}
            {phase === "confirming" && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium animate-pulse">
                <Spinner size={3} />
                <span>Transaction submitted — waiting for block confirmation…</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live log terminal */}
      <motion.div variants={itemVariants}
        className="rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden"
      >
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-amber-500/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <span className="text-xs text-slate-500 ml-2 font-mono">batch_issuance.log</span>
        </div>
        <div
          ref={logRef}
          className="font-mono text-xs p-4 space-y-1 h-44 overflow-y-auto scroll-smooth"
        >
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">No activity yet. Click "Start" to begin.</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-600 shrink-0">[{l.ts}]</span>
                <span className={
                  l.type === "success" ? "text-emerald-400" :
                    l.type === "error" ? "text-red-400" :
                      l.type === "warning" ? "text-amber-400" :
                        "text-slate-300"
                }>
                  {l.msg}
                </span>
              </div>
            ))
          )}
          {isProcessing && (
            <div className="flex gap-2 animate-pulse">
              <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-cyan-400">█</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Per-row results table */}
      <AnimatePresence>
        {rowResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-slate-300">Per-Row Status</span>
            </div>
            <div className="overflow-y-auto max-h-48">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">#</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">Name</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">Cert ID</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">Status</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {rowResults.map((r) => (
                    <tr key={r.idx} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5 text-slate-500">{r.idx + 1}</td>
                      <td className="px-4 py-2.5 text-slate-300 truncate max-w-[100px]">{r.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono truncate max-w-[140px]">{r.id}</td>
                      <td className="px-4 py-2.5">
                        {r.status === "uploaded" && <Badge type="success" label="Uploaded" />}
                        {r.status === "error" && <Badge type="error" label={r.error?.slice(0, 30) ?? "Error"} />}
                        {r.status === "pending" && <Badge type="pending" label="Pending" />}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 truncate max-w-[100px]" title={r.hash}>
                        {r.hash ? `${r.hash.slice(0, 10)}…` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction status banner */}
      <AnimatePresence>
        {txStatus && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`p-4 rounded-xl text-sm font-medium border ${txStatus.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
          >
            {txStatus.msg}
            {txHash && (
              <p className="mt-1.5 text-xs font-mono opacity-70 break-all">
                Tx Hash: {txHash}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={isProcessing || isDone}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-cyan-500 to-purple-600
            hover:shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:scale-[1.01]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
            transition-all duration-300 text-white"
        >
          {isProcessing ? (
            <>
              <Spinner size={4} />
              {phaseLabel}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {phaseLabel}
            </>
          )}
        </button>

        {(isDone || phase === "error") && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onReset}
            className="px-5 py-3.5 rounded-xl font-semibold text-sm border border-white/10 text-slate-400
              hover:text-white hover:border-white/20 hover:bg-white/5 transition-all duration-200"
          >
            Start New Batch
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BatchAdminPanel({ contract, signer }) {
  const [step, setStep] = useState(1);
  const [csvRows, setCsvRows] = useState([]);
  const [fileMap, setFileMap] = useState(new Map());

  const reset = () => {
    setStep(1);
    setCsvRows([]);
    setFileMap(new Map());
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      {/* ── Page header ── */}
      <motion.div variants={itemVariants} className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span className="text-xs font-semibold text-purple-400 tracking-wide uppercase">Batch Issuance</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Issue Certificates{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            in Bulk
          </span>
        </h2>
        <p className="text-sm text-slate-400 max-w-lg">
          Upload a CSV, map your assets, and issue up to{" "}
          <span className="text-white font-semibold">100 certificates</span>{" "}
          in a single on-chain transaction.
        </p>
      </motion.div>

      {/* ── Glassmorphism card ── */}
      <motion.div
        variants={itemVariants}
        className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative"
      >
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-purple-600 to-cyan-500" />

        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(6,182,212,0.05) 0%, transparent 70%)" }}
        />

        <div className="relative p-6 sm:p-10">
          {/* Stepper */}
          <Stepper current={step} />

          {/* Step panels with slide animation */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit">
                <StepCsvUpload
                  onParsed={(rows) => {
                    setCsvRows(rows);
                    // Small delay so the tick animation completes
                    setTimeout(() => setStep(2), 400);
                  }}
                />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit">
                <StepAssetSelection
                  csvRows={csvRows}
                  onFilesValidated={(map) => {
                    setFileMap(map);
                    setTimeout(() => setStep(3), 300);
                  }}
                />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="enter" animate="center" exit="exit">
                <StepProcessing
                  csvRows={csvRows}
                  fileMap={fileMap}
                  contract={contract}
                  signer={signer}
                  onReset={reset}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back navigation (steps 2 & 3 idle) */}
          {step > 1 && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setStep((s) => s - 1)}
              className="mt-8 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Step {step - 1}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
