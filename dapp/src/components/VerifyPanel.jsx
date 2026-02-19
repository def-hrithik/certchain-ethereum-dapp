import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ───── Icons ───── */
const CheckIcon = () => (
  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 text-white inline-block mr-2"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ───── Helpers ───── */
const BACKEND = "http://127.0.0.1:5000";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ───── Metadata Row ───── */
function MetaRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm text-white font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export default function VerifyPanel({ contract }) {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { found, hash, id?, certificate?, source, error? }
  const [showAssets, setShowAssets] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setResult(null);
    setShowAssets(false);

    const input = searchId.trim();
    if (!input) return;

    try {
      setLoading(true);

      /* ── Step A: Try Blockchain lookup by Certificate ID ── */
      let chainFound = false;
      try {
        if (contract) {
          chainFound = await contract.certificateExists(input);
        }
      } catch {
        // Contract call failed — will try hash fallback
      }

      if (chainFound) {
        const hash = await contract.verifyCertificate(input);

        // Fetch full certificate metadata from backend
        let certificate = null;
        try {
          const res = await fetch(`${BACKEND}/api/certificates/${hash}`);
          const data = await res.json();
          if (data.success) certificate = data.certificate;
        } catch {
          // Backend may be down — still show hash-only result
        }

        setResult({ found: true, hash, id: input, certificate, source: "blockchain" });
        return;
      }

      /* ── Step B: Fallback — treat input as Hash, query backend ── */
      try {
        const res = await fetch(`${BACKEND}/api/certificates/${input}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setResult({
            found: true,
            hash: input,
            id: null,
            certificate: data.certificate,
            source: "database",
          });
          return;
        }
      } catch {
        // Backend also unavailable
      }

      /* ── Neither lookup succeeded ── */
      setResult({ found: false, id: input });
    } catch (err) {
      setResult({
        found: false,
        id: input,
        error: err.reason || "Network error. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const cert = result?.certificate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="w-full"
    >
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white mb-1">
          🔍 Verify Certificate
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Enter a Certificate ID to check if it has been registered on the
          Ethereum blockchain.
        </p>

        {/* ── Search Form ── */}
        <form onSubmit={handleVerify} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Certificate ID…"
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-900/50
                         text-white text-sm placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50
                         transition-all duration-200 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchId.trim()}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] text-white font-semibold text-sm
                       px-6 py-2.5 rounded-xl transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed flex items-center
                       whitespace-nowrap"
          >
            {loading ? (
              <>
                <Spinner /> Searching…
              </>
            ) : (
              "Verify"
            )}
          </button>
        </form>

        {/* ── Results ── */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.found ? "found" : "notfound"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-6"
            >
              {result.found ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-5">
                  {/* ── Header badge ── */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 bg-emerald-500/10 rounded-full p-1.5">
                      <CheckIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">
                          {result.id || "Hash Lookup"}
                        </span>
                        {result.source === "blockchain" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                            ✓ Verified on Ethereum
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
                            📂 Retrieved via Hash
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Full Metadata Grid ── */}
                  {cert && (
                    <div className="bg-slate-900/40 rounded-xl border border-white/5 p-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Certificate Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        <MetaRow label="Student Name" value={cert.name} />
                        <MetaRow label="Course Name" value={cert.courseName} />
                        <MetaRow label="Institute Name" value={cert.instituteName} />
                        <MetaRow label="Certificate ID" value={result.id} mono />
                        <MetaRow label="Created At" value={formatDate(cert.createdAt)} />
                        <MetaRow label="PDF Filename" value={cert.pdfFilename} mono />
                        <MetaRow label="Photo Filename" value={cert.photoFilename} mono />
                      </div>
                    </div>
                  )}

                  {/* ── Blockchain Hash ── */}
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Stored Hash (SHA-256)</p>
                    <p className="text-sm text-white font-mono break-all bg-slate-900/50 rounded-lg px-3 py-2 border border-white/10">
                      {result.hash}
                    </p>
                  </div>

                  {/* ── View Certificate Assets Button ── */}
                  {cert && (cert.photoUrl || cert.pdfUrl) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowAssets((prev) => !prev)}
                        className="w-full flex items-center justify-center gap-2
                                   bg-gradient-to-r from-cyan-500 to-purple-600
                                   hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.01]
                                   text-white font-semibold text-sm py-3 rounded-xl
                                   transition-all duration-300"
                      >
                        {showAssets ? "Hide" : "View"} Certificate Assets
                        <ChevronIcon open={showAssets} />
                      </button>

                      <AnimatePresence>
                        {showAssets && (
                          <motion.div
                            key="assets"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-5 pt-1">
                              {/* Student Photo */}
                              {cert.photoUrl && (
                                <div className="bg-slate-900/40 rounded-xl border border-white/5 p-4">
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                    📷 Student Photo
                                  </p>
                                  <div className="flex justify-center">
                                    <img
                                      src={`${BACKEND}${cert.photoUrl}`}
                                      alt="Student"
                                      className="max-w-xs w-full rounded-xl object-cover border border-white/10 shadow-lg"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Certificate PDF */}
                              {cert.pdfUrl && (
                                <div className="bg-slate-900/40 rounded-xl border border-white/5 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                      📄 Certificate Document
                                    </p>
                                    <a
                                      href={`${BACKEND}${cert.pdfUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-cyan-400 hover:underline"
                                    >
                                      Open in new tab ↗
                                    </a>
                                  </div>
                                  <iframe
                                    src={`${BACKEND}${cert.pdfUrl}`}
                                    title="Certificate PDF"
                                    className="w-full rounded-lg border border-white/10"
                                    style={{ height: "500px" }}
                                  />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 bg-red-500/10 rounded-full p-1.5">
                      <XIcon />
                    </div>
                    <div>
                      <p className="font-semibold text-red-400 mb-1">
                        No Record Found
                      </p>
                      <p className="text-sm text-slate-400">
                        {result.error ||
                          "This certificate may be forged or not yet issued on the blockchain."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
