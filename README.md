<div align="center">

# 🔗 CertChain

### Decentralized Certificate Verification System

A hybrid **on-chain / off-chain** DApp that lets administrators issue tamper-proof academic certificates and allows anyone to verify them trustlessly — powered by Ethereum, React, and IPFS-backed decentralized storage via Pinata.

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.x-FFF100?logo=hardhat)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-3C3C3D)](https://docs.ethers.org/v6/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📖 Table of Contents

1. [Project Overview](#-project-overview)
2. [Why a Hybrid Architecture?](#-why-a-hybrid-architecture)
3. [Architecture Diagram](#-architecture-diagram)
4. [Data Flow](#-data-flow)
5. [Tech Stack](#-tech-stack)
6. [Project Structure](#-project-structure)
7. [Installation & Setup](#-installation--setup)
8. [IPFS Integration & Pinata Pinning Strategy](#-ipfs-integration--pinata-pinning-strategy)
9. [User Manual](#-user-manual)
10. [API Documentation](#-api-documentation)
11. [Smart Contract Reference](#-smart-contract-reference)
12. [Design System](#-design-system)
13. [License](#-license)

---

## 🎯 Project Overview

**CertChain** is a full-stack decentralized application (DApp) designed for issuing and verifying academic certificates. It combines the **immutability of blockchain** with the **practicality of off-chain storage** to create a system that is both trustworthy and user-friendly.

### Key Features

| Feature | Description |
|---|---|
| 🔐 **On-Chain Hash Storage** | SHA-256 hash of each certificate is stored on Ethereum — tamper-proof and permanent |
| 📁 **IPFS-Backed File Storage** | PDF documents and photos pinned to **IPFS via Pinata**—decentralized, globally replicated, and content-addressed with immutable CIDs |
| 🔍 **Dual Verification** | Look up certificates by **Certificate ID** (blockchain) or **SHA-256 Hash** (backend) |
| 🌍 **Global Accessibility** | Files distributed across IPFS nodes worldwide—no centralized server, no downtime, permanent availability |
| ✅ **Triple Verification** | Validated at three levels: blockchain reference, SHA-256 metadata hash, and IPFS CID integrity |
| 🎨 **Dark Cinematic UI** | Cyberpunk-inspired dark theme with glassmorphism cards and smooth animations |
| 👛 **MetaMask Integration** | Wallet connection, network detection, and admin-only access enforcement |
| 📄 **Inline Asset Viewer** | View student photos and certificate PDFs directly in the browser via IPFS gateways |
| 📦 **Batch Issuance** | Issue up to **100 certificates in a single on-chain transaction** via a guided 3-step CSV wizard |
| 📱 **Data-Rich QR Codes** | Each verified certificate generates a scannable QR code embedding the on-chain hash — no internet required to read |
| 🔗 **LinkedIn Integration** | One-click "Add to LinkedIn Profile" button auto-fills course, institute, and certification ID |

---

## 🧠 Why a Hybrid Architecture?

Storing large files (PDFs, images) directly on Ethereum is **prohibitively expensive** (≈ $0.10–$1.00 per KB of storage). CertChain uses a hybrid approach:

| Concern | Solution |
|---|---|
| **Trust & Integrity** | The **SHA-256 hash** of each certificate's metadata is stored **on-chain** — any change to the data invalidates the hash. Files are further protected by IPFS **Content Identifiers (CIDs)** — immutable by design. |
| **File Storage** | PDFs and photos are stored **off-chain on IPFS** via Pinata — decentralized, globally distributed, resilient, and content-addressed. No single point of failure. |
| **Verification** | A verifier retrieves the on-chain reference, fetches IPFS metadata from the backend, and validates both the SHA-256 hash AND the IPFS CIDs — triple-verified authenticity. |
| **Accessibility** | IPFS provides **global redundancy**. Files pinned to Pinata are mirrored across nodes, ensuring permanent availability and fast retrieval worldwide. |

> **Result:** You get blockchain-grade trust, IPFS-grade resilience, and decentralized storage—all without vendor lock-in.

---

## 🏛 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CertChain Architecture                      │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐        ┌──────────────────┐       ┌─────────────┐
    │   React App  │        │  Express Backend  │       │  Ganache /  │
    │  (Frontend)  │        │  (Node.js API)    │       │  Ethereum   │
    │              │        │                    │       │  Blockchain │
    │  Tailwind    │  HTTP  │  POST /api/certs   │       │             │
    │  Framer      │◄──────►│  GET  /api/certs   │       │  Solidity   │
    │  Motion      │        │                    │       │  Contract   │
    │  Ethers.js ──┼────────┼────────────────────┼──────►│             │
    └──────────────┘  RPC   │  ┌──────────────┐  │       │  ┌───────┐  │
                            │  │ database.json│  │       │  │ID→Hash│  │
                            │  └──────────────┘  │       │  │Mapping│  │
                            │  ┌──────────────┐  │       │  └───────┘  │
                            │  │ Pinata / IPFS│  │       └─────────────┘
                            │  │ (File Storage) │  │
                            │  └────────────────┘  │
                            └──────────────────┘

    ┌──────────────┐
    │   MetaMask   │  ◄── Browser Wallet (signs transactions)
    │   Wallet     │
    └──────────────┘
```

---

## 🔄 Data Flow

### 📤 Certificate Issuance (Admin)

```
Admin fills form (Name, Course, Institute) + uploads PDF & Photo
              │
              ▼
    ┌─────────────────────────────────┐
    │  POST /api/certs                  │  ── Express receives FormData
    │  (Backend Server)                 │  ── Files streamed to IPFS via Pinata SDK
    │                                    │  ── Receives immutable CIDs for each file
    │                                    │  ── Builds metadata JSON w/ CIDs & Pinata URLs
    │                                    │  ── Computes SHA-256 hash of metadata
    │                                    │  ── Persists to database.json (metadata only)
    └──────────┬──────────────────────┘
               │  Returns { hash, pdfCid, photoCid }
               ▼
    ┌─────────────────────┐
    │  contract.addCert()  │  ── React sends (certId, hash) to chain
    │  (Blockchain TX)     │  ── MetaMask prompts user to confirm
    │                      │  ── Smart contract stores ID → Hash mapping
    └─────────────────────┘
               │
               ▼
      ✅ Certificate Issued — ID + Hash shown to admin
      📌 Files pinned to IPFS (permanent, globally available)
```

### 📦 Batch Issuance (Admin — up to 100 certificates)

```
Admin uploads CSV (Name, Course, Institute, PDF_Filename, Photo_Filename)
              │
              ▼ Step 1 — CSV parsed & validated (PapaParse)
              │
              ▼ Step 2 — All referenced PDFs & Photos selected; checklist validated
              │
              ▼ Step 3 — Sequential backend uploads (chunks of 3)
    ┌─────────────────────────────────────────────────────────┐
    │  For each row:  POST /api/certificates                    │
    │  ── Files streamed to IPFS; SHA-256 hash returned         │
    │  ── Per-row status shown in live terminal log             │
    └──────────┬──────────────────────────────────────────────┘
               │  ids[], hashes[] collected
               ▼
    ┌──────────────────────────────────────┐
    │  contract.addCertificateBatch(       │  ── Single MetaMask confirmation
    │    ids[], hashes[]                   │  ── All IDs stored on-chain atomically
    │  )                                   │
    └──────────────────────────────────────┘
               │
               ▼
      ✅ Batch confirmed — per-row Cert IDs & Tx hash displayed
```

### 🔍 Certificate Verification (Anyone)

```
User enters Certificate ID or Hash
              │
              ▼
    ┌─────────────────────────────┐
    │  Step A: Blockchain Lookup   │  ── contract.certificateExists(id)
    │  (via Ethers.js + MetaMask)  │  ── If found → gets stored hash
    └──────────┬──────────────────┘
               │  hash
               ▼
    ┌─────────────────────────────┐
    │  GET /api/certificates/:hash │  ── Fetches full metadata from database
    │  (Backend API)               │  ── Returns name, course, IPFS CIDs & URLs…
    │                               │  ── Validates SHA-256 hash match
    └──────────┬──────────────────┘
               │
               ▼
      ✅ "Verified on Ethereum" — full details + IPFS files displayed via gateway
      📱 Data-rich QR code generated (offline-readable JSON payload)
      🔗 LinkedIn "Add to Profile" button auto-populated

    ── OR (if ID not found on chain) ──

    ┌─────────────────────────────┐
    │  Step B: Hash Fallback       │  ── GET /api/certificates/:input
    │  (Backend Direct Lookup)     │  ── Treats input as SHA-256 hash
    └──────────┬──────────────────┘
               │
               ▼
      📂 "Retrieved via Hash" — details from database only
```

---

## 🛠 Tech Stack

### Frontend (`dapp/`)

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.4 | UI framework (Create React App) |
| Tailwind CSS | 3.x | Utility-first styling with custom dark theme |
| Ethers.js | 6.16.0 | Web3 provider — wallet & contract interaction |
| Framer Motion | 12.34.2 | Page transitions, animations, expand/collapse |
| Lucide React | 0.574.0 | Icon library |
| qrcode.react | 4.2.0 | QR code generation from JSON certificate payloads |
| PapaParse | 5.5.3 | Client-side CSV parsing for batch issuance wizard |
| react-hot-toast | 2.6.0 | Non-intrusive toast notifications |

### Backend (`backend/`)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Runtime environment |
| Express | 5.x | HTTP server & REST API |
| Pinata SDK | Latest | IPFS pinning via Pinata—uploads files to decentralized IPFS network and receives immutable CIDs |
| Multer | — | **In-memory** multipart file handling (no disk storage)—streams directly to IPFS |
| Streamifier | — | Converts Node.js streams for seamless Pinata integration |
| Crypto (Node.js) | Built-in | SHA-256 hashing for metadata integrity verification |

### Smart Contract (`contracts/`)

| Technology | Version | Purpose |
|---|---|---|
| Solidity | ^0.8.20 | Smart contract language |
| Hardhat | 2.x | Compilation, testing, deployment |
| Ganache | — | Local Ethereum blockchain (port 7545) |

### Tools & Integrations

| Tool | Purpose |
|---|---|
| MetaMask | Browser wallet for signing transactions |
| Ganache | Local blockchain with instant mining |

---

## 📂 Project Structure

```
Blockchain/
│
├── contracts/
│   └── CertificateVerification.sol    # Solidity smart contract
│
├── scripts/
│   └── deploy.js                      # Deploys contract & exports ABI
│
├── hardhat.config.js                  # Hardhat config (Ganache network)
├── package.json                       # Root dependencies (Hardhat, etc.)
│
├── backend/                           # Express API server
│   ├── server.js                      # Routes, multer, crypto hashing
│   ├── database.json                  # Persistent certificate metadata
│
└── dapp/                              # React frontend
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js                     # Main orchestrator + wallet logic
    │   ├── contract.js                # Auto-generated: ABI + address
    │   ├── index.css                  # Tailwind directives
    │   └── components/
    │       ├── LandingPage.jsx        # Cinematic hero + features page
    │       ├── Navbar.jsx             # Glass navbar with wallet badge
    │       ├── AdminPanel.jsx         # Single certificate issuance form
    │       ├── BatchAdminPanel.jsx    # Bulk issuance — CSV wizard (NEW)
    │       ├── VerifyPanel.jsx        # Dual-lookup verification panel
    │       ├── CertificateQRCode.jsx  # Data-rich QR code generator (NEW)
    │       └── LinkedInShareButton.jsx # One-click LinkedIn share (NEW)
    ├── tailwind.config.js             # Custom dark theme tokens
    └── package.json
```

---

## 🚀 Installation & Setup

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js** ≥ 18 | [Download](https://nodejs.org/) |
| **MetaMask** | Browser extension — [Install](https://metamask.io/) |
| **Ganache** | Local blockchain GUI — [Download](https://trufflesuite.com/ganache/) |

### Step 1 — Install Dependencies

```bash
# 📦 Root (Hardhat + Solidity tooling)
cd Blockchain
npm install

# 📦 Frontend (React + Tailwind + PapaParse + qrcode.react)
cd dapp
npm install

# 📦 Backend (Express + IPFS/Pinata)
cd ../backend && npm install
npm install @pinata/sdk streamifier
```

### Step 1.5 — Configure Pinata Environment Variables

Create a `.env` file in the `backend/` directory with your Pinata API credentials:

```env
# Pinata API Configuration
PINATA_API_KEY=your_pinata_api_key_here
PINATA_API_SECRET=your_pinata_api_secret_here

# Optional: Custom IPFS gateway (defaults to Pinata public gateway)
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs

# Backend Server
PORT=5000
NODE_ENV=development
```

**How to obtain Pinata credentials:**

1. Sign up at [pinata.cloud](https://pinata.cloud/)
2. Navigate to **API Keys** in the dashboard.
3. Click **Create Key** and grant **Admin** permissions.
4. Copy the **API Key** and **API Secret**.
5. Paste them into your `.env` file.

> ⚠️ **Keep your `.env` file private**—add it to `.gitignore` to prevent accidental commits of secrets.

### Step 2 — Start Ganache

1. Open **Ganache** and create a new workspace.
2. Ensure it runs on **port 7545** with **Chain ID 1337**.
3. Leave it running — it provides your local Ethereum node.

### Step 3 — Import Ganache Account into MetaMask

1. In Ganache → Click the 🔑 key icon on **Account 0** → Copy the private key.
2. In MetaMask → **Import Account** → Paste the private key.
3. Add a custom network in MetaMask:

| Field | Value |
|---|---|
| Network Name | `Ganache` |
| RPC URL | `http://127.0.0.1:7545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

### Step 3 — Verify Pinata Connectivity

Before proceeding, test your Pinata API keys:

```bash
cd backend
node -e "
const axios = require('axios');
const apiKey = process.env.PINATA_API_KEY;
const apiSecret = process.env.PINATA_API_SECRET;

axios.get('https://api.pinata.cloud/data/testAuthentication', {
  headers: {
    'pinata_api_key': apiKey,
    'pinata_secret_api_key': apiSecret
  }
}).then(() => console.log('✅ Pinata connected!'))
  .catch(err => console.log('❌ Pinata auth failed:', err.message));
"
```

> If successful, you'll see `✅ Pinata connected!`. If not, verify your `.env` credentials.

### Step 4 — Compile & Deploy the Smart Contract

```bash
cd Blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

> ✅ This automatically writes the contract address and ABI to `dapp/src/contract.js`.

### Step 5 — Start the Backend Server

```bash
cd backend
node server.js
```

> 🚀 Server starts at `http://127.0.0.1:5000`. You should see:
> ```
> 🚀 CertChain Backend running on http://localhost:5000
> 📂 Database    : ...\backend\database.json
> 📊 Existing records: 20
> 📌 IPFS via Pinata: Connected
> ```
>
> Files uploaded to forms will now be **pinned to IPFS** automatically and indexed with immutable CIDs.

### Step 7 — Build & Serve the Frontend

```bash
cd dapp
npx react-scripts build
```

Then serve the build folder using any static server, or use the dev server:

```bash
npm start
```

> 🌐 Open [http://localhost:3000](http://localhost:3000) — connect MetaMask and you're ready.

---

## 📘 User Manual

### 👨‍💼 Admin Flow — Issuing a Single Certificate

1. **Connect Wallet** — Click the wallet badge in the navbar. MetaMask will prompt for connection. Ensure you're on the **Ganache** network (Chain ID 1337).

2. **Navigate to Admin Panel** — Click "Issue Certificate" in the navbar or use the Quick Access card on the landing page.

3. **Fill the Form** —
   | Field | Example |
   |---|---|
   | Name | `Hrithik Singh` |
   | Course Name | `Full Stack Web Development` |
   | Institute Name | `MGM College of Engineering` |
   | Certificate PDF | Upload a `.pdf` file |
   | Student Photo | Upload an image (`.jpg`, `.png`) |

4. **Submit** — Click "Issue Certificate & Register Hash".
   - **Phase 1:** Files are streamed to IPFS via Pinata. The system receives immutable **CIDs** for each file and generates SHA-256 metadata hash. Display shows both the hash and the Pinata gateway URLs.
   - **Phase 2:** MetaMask prompts you to confirm the blockchain transaction. Once confirmed, the Certificate ID and transaction hash are shown. Files are now **permanently pinned to IPFS**.

5. **Done** — Copy the Certificate ID (e.g., `CERT-1771529389384`) and share it with the student. Their certificate is now on-chain, and the files are globally accessible via IPFS.

> ⚠️ If the blockchain transaction fails, the hash remains visible. You can retry without re-uploading.

### 📦 Admin Flow — Batch Issuance (up to 100 certificates)

1. **Navigate to Batch Issue** — Click the "Batch Issue" tab (⛓ icon) in the navbar.

2. **Step 1 — Upload CSV** — Drag and drop (or click to browse) a `.csv` file with the following columns:

   ```
   Name,Course,Institute,PDF_Filename,Photo_Filename
   Alice Sharma,B.Tech CSE,MIT College,alice_cert.pdf,alice_photo.jpg
   Bob Kumar,MBA Finance,IIM Ahmedabad,bob_cert.pdf,bob_photo.png
   ```

   - The system validates columns and shows a live preview of up to 5 rows.
   - Maximum **100 rows** per batch (enforced on both frontend and smart contract).

3. **Step 2 — Select Assets** — After the CSV is accepted, a file checklist appears showing every PDF and photo filename referenced. Drag and drop **all** the actual files into the dropzone in one go. The checklist turns green (✓) as each file is matched.

4. **Step 3 — Process & Issue** —
   - Click **"Start Batch Issuance"**.
   - Files are uploaded to the backend **sequentially in chunks of 3** to avoid memory pressure on the Express/Multer server. A live terminal log shows per-row status in real time.
   - Once all uploads complete, a **single MetaMask confirmation** is requested for `addCertificateBatch(ids, hashes)`.
   - Upon blockchain confirmation, a per-row status table displays each Certificate ID, hash prefix, and success/error badge.

5. **Done** — Click **"Start New Batch"** to reset the wizard and issue another batch.

> ⚠️ If some rows fail during upload (e.g., file type mismatch), the successful rows are still submitted on-chain. Failed rows are shown with red error badges and must be re-issued individually.

### 🔍 Verifier Flow — Checking a Certificate

1. **Navigate to Verify** — Click "Verify" in the navbar.

2. **Enter ID or Hash** — Paste a **Certificate ID** (e.g., `CERT-1771529389384`) or a **SHA-256 Hash** into the search box.

3. **Click "Verify"** — The system performs a dual lookup:
   - First checks the **blockchain** (by ID).
   - If not found, falls back to the **backend** (by hash).

4. **View Results** —
   - ✅ **Green badge** = "Verified on Ethereum" (found on chain).
   - 📂 **Amber badge** = "Retrieved via Hash" (found in database only).
   - All metadata is displayed: Name, Course, Institute, Creation Date, IPFS CIDs, Pinata gateway URLs.

5. **QR Code** — A data-rich QR code is automatically generated and displayed below the metadata. Scanning it with any phone camera instantly surfaces certificate details — **no internet connection required** (the full JSON payload is embedded in the code). Click **"Download QR"** to save a 512×512 PNG.

6. **LinkedIn** — Click **"Add to LinkedIn"** to open LinkedIn's native "Add Certification" flow, pre-filled with the course name, institution, issue date, and a direct verification link back to this DApp.

7. **View Assets** — Click the "View Certificate Assets" button to expand an inline viewer. Files are retrieved from IPFS gateways and displayed directly in the browser—PDFs in an embedded reader, photos inline.

---

## 📡 API Documentation

Base URL: `http://127.0.0.1:5000`

### `POST /api/certificates`

Upload certificate files and metadata. Files are streamed to IPFS via Pinata and indexed with immutable CIDs. Returns a SHA-256 hash of the metadata for on-chain registration.

| Parameter | Type | Location | Required | Description |
|---|---|---|---|---|
| `name` | string | form-data | ✅ | Student's full name |
| `courseName` | string | form-data | ✅ | Course or program name |
| `instituteName` | string | form-data | ✅ | Issuing institution |
| `pdf` | file | form-data | ✅ | Certificate PDF (max 10 MB)—pinned to IPFS |
| `photo` | file | form-data | ✅ | Student photo (max 10 MB)—pinned to IPFS |

**Success Response** `200 OK`:
```json
{
  "success": true,
  "hash": "72480d9efe479e2dab47d1c054a3498aa3b11d0e88a211093f34a00874af7592",
  "pdfCid": "QmZf3t...aP7n",
  "photoCid": "QmWp9s...zK8r"
}
```

**Error Response** `400 Bad Request`:
```json
{
  "success": false,
  "error": "Missing required fields: name, courseName"
}
```

---

### `GET /api/certificates/:hash`

Retrieve certificate metadata by its SHA-256 hash. Returns full metadata including IPFS CIDs and Pinata gateway URLs for file access.

| Parameter | Type | Location | Description |
|---|---|---|---|
| `hash` | string | URL param | SHA-256 hash of the certificate |

**Success Response** `200 OK`:
```json
{
  "success": true,
  "certificate": {
    "id": "CERT-1771529389384",
    "name": "Hrithik Singh",
    "courseName": "Full Stack Web Development",
    "instituteName": "MGM College of Engineering",
    "pdfCid": "QmZf3t...aP7n",
    "photoCid": "QmWp9s...zK8r",
    "createdAt": "2026-02-19T19:29:49.411Z",
    "pdfUrl": "https://gateway.pinata.cloud/ipfs/QmZf3t...aP7n",
    "photoUrl": "https://gateway.pinata.cloud/ipfs/QmWp9s...zK8r",
    "metadataHash": "72480d9efe479e2dab47d1c054a3498aa3b11d0e88a211093f34a00874af7592"
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Certificate not found."
}
```

---

## 🌐 IPFS Integration & Pinata Pinning Strategy

### How It Works

CertChain leverages **IPFS (InterPlanetary File System)** via **Pinata** as the backbone for decentralized file storage:

| Component | Role |
|---|---|
| **Pinata SDK** | Handles file uploads and IPFS pinning programmatically |
| **IPFS CIDs** | Content-addressed identifiers—immutable and cryptographically secure |
| **Pinata Gateways** | HTTP endpoints for browser-based file retrieval (no IPFS node required) |
| **database.json** | Stores only metadata links (CIDs, URLs, hashes)—no raw file data |

### Benefits of IPFS

| Benefit | Implication |
|---|---|
| **Content-Addressed Storage** | Files identified by their hash, not location—impossible to alter without changing CID |
| **Global Redundancy** | Pinata replicates files across multiple IPFS nodes—permanent availability |
| **No Vendor Lock-In** | CIDs work across any IPFS network—Pinata is interchangeable with other pinning services |
| **Bandwidth Efficiency** | IPFS caches frequently accessed files across the network—faster retrieval |
| **Survivability** | Files persisted to IPFS remain accessible even if Pinata gateway goes down (via alternative IPFS gateways) |

### Data Integrity: Triple Verification

1. **SHA-256 Metadata Hash** — Stored on Ethereum blockchain; verifies metadata integrity
2. **IPFS Presence** — CIDs prove files are pinned; accessible via any IPFS gateway
3. **Content Verification** — Hash CIDs match stored metadata—cryptographic proof of authenticity

---

### `GET /uploads/:filename`

Static file serving for uploaded PDFs and photos.

---

## 📜 Smart Contract Reference

**Contract:** `CertificateVerification.sol` · **Solidity** `^0.8.20`

### State

| Name | Type | Visibility | Description |
|---|---|---|---|
| `admin` | `address` | public | Deployer address — the only account that may issue certificates |
| `MAX_BATCH_SIZE` | `uint256` constant | public | Hard cap of **100** certificates per batch transaction |

### Functions

| Function | Access | Returns | Description |
|---|---|---|---|
| `addCertificate(string _id, string _hash)` | 🔒 Admin | — | Stores a certificate ID → hash mapping on-chain |
| `addCertificateBatch(string[] _ids, string[] _hashes)` | 🔒 Admin | — | Issues up to 100 certificates atomically in a single transaction; validates length parity, batch cap, no on-chain duplicates, and no intra-batch duplicate IDs |
| `verifyCertificate(string _id)` | 🌐 Public | `string` | Returns the stored hash for a given certificate ID |
| `certificateExists(string _id)` | 🌐 Public | `bool` | Checks if a certificate ID exists on-chain |

### Events

| Event | Parameters | Description |
|---|---|---|
| `CertificateAdded` | `id` (indexed), `hash`, `timestamp` | Emitted for every certificate registered — including each entry within a batch |
| `BatchIssued` | `count`, `timestamp` | Emitted once per successful `addCertificateBatch` call with the total number of certificates issued |

### Custom Errors (Gas-Efficient)

| Error | Trigger |
|---|---|
| `NotAdmin()` | Non-admin attempts to add a certificate |
| `CertificateAlreadyExists(id)` | Duplicate certificate ID — single or batch |
| `CertificateNotFound(id)` | Lookup for non-existent ID |
| `EmptyId()` | Empty string passed as ID |
| `EmptyHash()` | Empty string passed as hash |
| `BatchEmpty()` | `addCertificateBatch` called with zero-length arrays |
| `BatchLengthMismatch()` | `_ids` and `_hashes` arrays have different lengths |
| `BatchTooLarge(provided, maxAllowed)` | Batch exceeds `MAX_BATCH_SIZE` (100) |
| `DuplicateIdInBatch(id)` | The same ID appears more than once within a single batch call |

---

## 🎨 Design System

CertChain uses a **dark cinematic** theme with glassmorphism and neon accents.

| Token | Value | Usage |
|---|---|---|
| Background | `slate-950` (#020617) | Page background |
| Surface | `white/5` | Glassmorphism cards |
| Border | `white/10` | Subtle card borders |
| Primary | `cyan-500` (#06B6D4) | Buttons, links, accents |
| Secondary | `purple-600` (#9333EA) | Gradient endpoints |
| Success | `emerald-400` (#34D399) | Verified badges, success states |
| Warning | `amber-400` (#FBBF24) | Hash-only / fallback states |
| Error | `red-400` (#F87171) | Error messages |
| Text | `white` / `slate-400` | Primary / secondary text |

### Animations

| Animation | Library | Usage |
|---|---|---|
| Page transitions | Framer Motion | `AnimatePresence` view switching |
| Hover effects | Tailwind + Framer | Scale, glow, gradient shifts |
| Expand/collapse | Framer Motion | Assets viewer, status panels |
| Glow pulse | Tailwind keyframes | Hero section accent |
| Wizard step slides | Framer Motion | `slideVariants` x-axis transitions between batch steps |
| Stepper connector fill | Framer Motion | Animated gradient line between completed wizard steps |

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Ethereum, React & Express**

</div>
