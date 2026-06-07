import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";
import { Download, CheckCircle, QrCode } from "lucide-react";

/**
 * CertificateQRCode
 *
 * Renders a data-rich QR code that embeds the certificate's core fields as a
 * JSON payload.  Scanning the code with any phone camera instantly surfaces the
 * certificate details — no internet connection required.
 *
 * Props:
 *  - certificate  {object}  Full certificate object from the backend / chain lookup.
 *  - certId       {string}  The certificate ID used for naming the download file.
 */
export default function CertificateQRCode({ certificate, certId }) {
  const [downloadStatus, setDownloadStatus] = useState("idle"); // "idle" | "success" | "error"
  const qrWrapperRef = useRef(null);

  if (!certificate) return null;

  // ── Build the JSON payload that gets embedded in the QR code ──
  const qrPayload = JSON.stringify({
    id: certId,
    name: certificate.name,
    course: certificate.courseName,
    institute: certificate.instituteName,
    hash: certificate.metadataHash,
    url: `${window.location.origin}/verify/${certId}`,
  });

  // ── Download the QR code as a PNG ──
  const handleDownload = () => {
    if (!qrWrapperRef.current) return;

    setDownloadStatus("downloading");

    const canvas = qrWrapperRef.current.querySelector("canvas");
    if (!canvas) {
      setDownloadStatus("error");
      setTimeout(() => setDownloadStatus("idle"), 2000);
      return;
    }

    // Upscale to 512 × 512 for a sharper download
    const EXPORT_SIZE = 512;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    // Draw the original QR canvas, scaled up
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const pngUrl = exportCanvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");

    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `CertChain-QR-${certId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadStatus("success");
    setTimeout(() => setDownloadStatus("idle"), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm
                 p-6 flex flex-col sm:flex-row items-center justify-center gap-8"
    >
      {/* ── Section label ── */}
      <div className="sm:hidden flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">
        <QrCode className="w-3.5 h-3.5" />
        Data-Rich QR Code
      </div>

      {/* ── QR Code canvas ── */}
      <div
        ref={qrWrapperRef}
        className="flex-shrink-0 p-3 bg-white rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)]
                   ring-1 ring-white/10 transition-shadow duration-300
                   hover:shadow-[0_0_40px_rgba(6,182,212,0.25)]"
      >
        <QRCodeCanvas
          value={qrPayload}
          size={172}
          bgColor="#ffffff"
          fgColor="#020617"   /* slate-950 */
          level="M"           /* medium error-correction — good balance for JSON payloads */
          includeMargin={false}
        />
      </div>

      {/* ── Info + download ── */}
      <div className="text-center sm:text-left max-w-xs">
        {/* Desktop label */}
        <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">
          <QrCode className="w-3.5 h-3.5" />
          Data-Rich QR Code
        </div>

        <h4 className="text-base font-bold text-white leading-snug">
          Offline Certificate Proof
        </h4>
        <p className="text-sm text-slate-400 mt-1 mb-5 leading-relaxed">
          Scan with any phone camera to instantly view certificate details —
          no internet needed. The code embeds the on-chain hash as a
          cryptographic cross-reference.
        </p>

        <button
          id="qr-download-btn"
          onClick={handleDownload}
          disabled={downloadStatus === "downloading"}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                     bg-cyan-500/10 text-cyan-300 font-semibold text-sm
                     border border-cyan-500/20
                     hover:bg-cyan-500/20 hover:text-cyan-200 hover:border-cyan-500/40
                     active:scale-95 transition-all duration-200
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {downloadStatus === "success" ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300">Downloaded!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download QR
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
