/**
 * LinkedInShareButton
 *
 * A "one-click" button to help users add their verified certificate to their
 * LinkedIn profile.  It constructs a pre-filled URL using LinkedIn's native
 * "Add to Profile" URL scheme — no backend or API keys required.
 *
 * Props:
 *  - certificate {object} Full certificate metadata object from the backend.
 *  - certId      {string} The unique on-chain certificate ID.
 */
export default function LinkedInShareButton({ certificate, certId }) {
  if (!certificate || !certId) return null;

  const handleLinkedInShare = () => {
    const { courseName, instituteName, createdAt } = certificate;

    // Parse issuance date — JavaScript months are 0-indexed, LinkedIn expects 1-indexed.
    const issueDate = new Date(createdAt);
    const issueYear  = issueDate.getFullYear();
    const issueMonth = issueDate.getMonth() + 1;

    // Direct verification link back to this DApp.
    const verifyUrl = `${window.location.origin}/verify/${certId}`;

    // Build the fully-encoded LinkedIn "Add to Profile" URL.
    const linkedInURL =
      `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
      `&name=${encodeURIComponent(courseName || "")}` +
      `&organizationName=${encodeURIComponent(instituteName || "")}` +
      `&issueYear=${issueYear}` +
      `&issueMonth=${issueMonth}` +
      `&certId=${encodeURIComponent(certId)}` +
      `&certUrl=${encodeURIComponent(verifyUrl)}`;

    // 'noopener,noreferrer' prevents tabnabbing vulnerabilities.
    window.open(linkedInURL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      id="linkedin-share-btn"
      onClick={handleLinkedInShare}
      className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl
                 bg-[#0A66C2] text-white font-semibold text-sm
                 hover:bg-[#004182] active:scale-95
                 transition-all duration-200 shadow-lg shadow-[#0A66C2]/20
                 hover:shadow-[#0A66C2]/40"
    >
      {/* Official LinkedIn icon (Bootstrap Icons, MIT licensed) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z" />
      </svg>
      Add to LinkedIn
    </button>
  );
}
