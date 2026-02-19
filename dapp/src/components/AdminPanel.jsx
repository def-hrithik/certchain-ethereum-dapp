import { useState } from "react";
import { motion } from "framer-motion";

/* ───── Spinner SVG ───── */
const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

/* ───── Animation Variants ───── */
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AdminPanel({ contract, signer }) {
  // Updated Form State
  const [formData, setFormData] = useState({
    name: "",
    courseName: "",
    instituteName: "",
  });

  const [files, setFiles] = useState({
    pdf: null,
    photo: null,
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [generatedHash, setGeneratedHash] = useState(null);
  const [certId, setCertId] = useState(null);
  const [txStatus, setTxStatus] = useState(null); // { type: 'success'|'error'|'hash-only', msg }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      setFiles((prev) => ({ ...prev, [type]: e.target.files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus(null);
    setGeneratedHash(null);
    setCertId(null);

    // Validation
    if (!formData.name || !formData.courseName || !formData.instituteName || !files.pdf || !files.photo) {
      setTxStatus({ type: "error", msg: "Please fill all required fields and upload files." });
      return;
    }

    try {
      setLoading(true);

      /* ───── STEP 1: Backend Upload ───── */
      setLoadingStep("Saving files to server...");
      const body = new FormData();
      Object.entries(formData).forEach(([key, val]) => body.append(key, val.trim()));
      body.append("pdf", files.pdf);
      body.append("photo", files.photo);

      const res = await fetch("http://127.0.0.1:5000/api/certificates", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Local backend upload failed.");
      }

      // Hash is ready — show it immediately
      const hash = data.hash;
      setGeneratedHash(hash);
      setTxStatus({ type: "hash-only", msg: "Data saved to server. Registering on blockchain…" });

      /* ───── STEP 2: Blockchain Transaction ───── */
      if (!contract || !signer) {
        setTxStatus({
          type: "hash-only",
          msg: "Hash generated but wallet is not connected. Connect your wallet and retry the on-chain step.",
        });
        return;
      }

      setLoadingStep("Waiting for blockchain confirmation...");
      const connectedContract = contract.connect(signer);
      const id = `CERT-${Date.now()}`;
      const tx = await connectedContract.addCertificate(id, hash);
      await tx.wait();

      setCertId(id);
      setTxStatus({
        type: "success",
        msg: `Certificate issued! ID: ${id} | Tx: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`,
      });

      // Reset form on full success
      setFormData({ name: "", courseName: "", instituteName: "" });
      setFiles({ pdf: null, photo: null });
    } catch (err) {
      let msg = "Transaction failed.";
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected by user.";
      } else if (err.reason) {
        msg = err.reason;
      } else if (err.message?.includes("CertificateAlreadyExists")) {
        msg = "A certificate with this ID already exists.";
      } else if (err.message) {
        msg = err.message;
      }

      // If hash was already generated, keep it visible
      if (generatedHash) {
        setTxStatus({
          type: "hash-only",
          msg: `Hash generated, but blockchain transaction failed: ${msg}`,
        });
      } else {
        setTxStatus({ type: "error", msg });
      }
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-purple-600" />

        <div className="p-6 sm:p-10">
          <motion.div variants={itemVariants} className="mb-8 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white mb-2">
              Certificate Details
            </h2>
            <p className="text-sm text-slate-400">
              Enter the student's academic details and upload the required files to register the certificate on-chain.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Grid Layout for Text Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputGroup 
                label="Name" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                placeholder="e.g., Hrithik Singh" 
                disabled={loading} 
              />
              <InputGroup 
                label="Course Name" 
                name="courseName" 
                value={formData.courseName} 
                onChange={handleInputChange} 
                placeholder="e.g., Full Stack Web Development" 
                disabled={loading} 
              />
              <InputGroup 
                label="Institute Name" 
                name="instituteName" 
                value={formData.instituteName} 
                onChange={handleInputChange} 
                placeholder="e.g., MGM College of Engg and Technology" 
                disabled={loading} 
              />
            </div>

            <motion.hr variants={itemVariants} className="border-white/10 my-6" />

            {/* File Uploads */}
            <div className="space-y-5">
              <FileUploadGroup 
                label="Certificate PDF File (REQUIRED)" 
                accept=".pdf" 
                file={files.pdf}
                onChange={(e) => handleFileChange(e, "pdf")}
                disabled={loading}
              />
              <FileUploadGroup 
                label="Student Photo (REQUIRED)" 
                accept="image/*" 
                file={files.photo}
                onChange={(e) => handleFileChange(e, "photo")}
                disabled={loading}
              />
            </div>

            {/* Generated Hash Display */}
            {generatedHash && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border bg-cyan-500/10 border-cyan-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-cyan-400 text-base">🔑</span>
                  <span className="text-sm font-semibold text-cyan-400">Generated SHA-256 Hash</span>
                </div>
                <p className="text-xs text-white font-mono break-all bg-slate-900/60 rounded-lg px-3 py-2 border border-white/10">
                  {generatedHash}
                </p>
                {certId && (
                  <p className="mt-2 text-xs text-slate-400">
                    Certificate ID: <span className="text-white font-mono">{certId}</span>
                  </p>
                )}
              </motion.div>
            )}

            {/* Status message */}
            {txStatus && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl text-sm font-medium border ${
                  txStatus.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : txStatus.type === "error"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {txStatus.msg}
              </motion.div>
            )}

            {/* Submit button */}
            <motion.div variants={itemVariants} className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center bg-gradient-to-r from-cyan-500 to-purple-600
                           hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.01] text-white font-semibold text-base py-3.5 rounded-xl
                           transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Spinner />
                    {loadingStep}
                  </>
                ) : (
                  "Issue Certificate & Register Hash"
                )}
              </button>
            </motion.div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

/* ───── Helper Components ───── */

function InputGroup({ label, name, value, onChange, placeholder, disabled }) {
  return (
    <motion.div variants={itemVariants}>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/50
                   text-white text-sm placeholder:text-slate-500
                   focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 focus:bg-slate-900
                   transition-all duration-200 disabled:opacity-50"
      />
    </motion.div>
  );
}

function FileUploadGroup({ label, accept, file, onChange, disabled }) {
  return (
    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center gap-3">
      <label className="text-sm font-medium text-slate-300 sm:w-1/3 shrink-0">
        {label}
      </label>
      <div className="flex items-center gap-3 flex-1">
        <label className={`cursor-pointer px-4 py-2.5 rounded-xl border border-white/10 bg-slate-900/80 
                          text-cyan-400 text-sm font-medium hover:bg-slate-800 transition-colors
                          ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
          Choose File
          <input 
            type="file" 
            accept={accept}
            onChange={onChange}
            disabled={disabled}
            className="hidden" 
          />
        </label>
        <span className="text-sm text-slate-500 truncate max-w-[200px] sm:max-w-xs">
          {file ? file.name : "No file chosen"}
        </span>
      </div>
    </motion.div>
  );
}