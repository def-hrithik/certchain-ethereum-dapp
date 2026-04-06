<div align="center">

# 🔗 CertChain

### Decentralized Certificate Verification System

A hybrid **on-chain / off-chain** DApp that lets administrators issue tamper-proof academic certificates and allows anyone to verify them trustlessly — powered by Ethereum, React, and a local Express backend.

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
8. [User Manual](#-user-manual)
9. [API Documentation](#-api-documentation)
10. [Smart Contract Reference](#-smart-contract-reference)
11. [Design System](#-design-system)
12. [License](#-license)

---

## 🎯 Project Overview

**CertChain** is a full-stack decentralized application (DApp) designed for issuing and verifying academic certificates. It combines the **immutability of blockchain** with the **practicality of off-chain storage** to create a system that is both trustworthy and user-friendly.

### Key Features

| Feature | Description |
|---|---|
| 🔐 **On-Chain Hash Storage** | SHA-256 hash of each certificate is stored on Ethereum — tamper-proof and permanent |
| 📁 **Decentralized File Storage** | PDF documents and photos are stored on **IPFS** via Pinata for global, persistent access |
| 🔍 **Dual Verification** | Look up certificates by **Certificate ID** (blockchain) or **SHA-256 Hash** (backend) |
| 🎨 **Dark Cinematic UI** | Cyberpunk-inspired dark theme with glassmorphism cards and smooth animations |
| 👛 **MetaMask Integration** | Wallet connection, network detection, and admin-only access enforcement |
| 📄 **Inline Asset Viewer** | View student photos and certificate PDFs directly in the browser |

---

## 🧠 Why a Hybrid Architecture?

Storing large files (PDFs, images) directly on Ethereum is **prohibitively expensive** (≈ $0.10–$1.00 per KB of storage). CertChain uses a hybrid approach:

| Concern | Solution |
|---|---|
| **Trust & Integrity** | The **SHA-256 hash** of each certificate's metadata is stored **on-chain** — any change to the data invalidates the hash |
| **File Storage** | PDFs and photos are stored **off-chain on IPFS** via Pinata — decentralized, resilient, and content-addressed |
| **Verification** | A verifier retrieves the on-chain hash and uses it to fetch the IPFS metadata from the backend — if they match, the certificate is authentic |

> **Result:** You get blockchain-grade trust without blockchain-grade gas costs.

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
    ┌─────────────────────┐
    │  POST /api/certs     │  ── Express receives FormData
    │  (Backend Server)    │  ── Uploads files to IPFS via Pinata
    │                      │  ── Builds metadata JSON with IPFS CIDs
    │                      │  ── Computes SHA-256 hash of metadata
    │                      │  ── Persists to database.json
    └──────────┬──────────┘
               │  Returns { hash }
               ▼
    ┌─────────────────────┐
    │  contract.addCert()  │  ── React sends (certId, hash) to chain
    │  (Blockchain TX)     │  ── MetaMask prompts user to confirm
    │                      │  ── Smart contract stores ID → Hash
    └─────────────────────┘
               │
               ▼
      ✅ Certificate Issued — ID + Hash shown to admin
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
    │  GET /api/certificates/:hash │  ── Fetches full metadata
    │  (Backend API)               │  ── Returns name, course, files…
    └──────────┬──────────────────┘
               │
               ▼
      ✅ "Verified on Ethereum" — full details displayed

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

### Backend (`backend/`)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Runtime environment |
| Express | 5.x | HTTP server & REST API |
| Pinata | — | IPFS pinning service for file storage |
| Multer | — | In-memory multipart file upload handling |

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
    │       ├── AdminPanel.jsx         # Certificate issuance form
    │       └── VerifyPanel.jsx        # Dual-lookup verification panel
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

# 📦 Frontend (React + Tailwind)
cd dapp
npm install

# 📦 Backend (Express + Multer)
cd ../backend && npm install
npm install @pinata/sdk streamifier
```

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
> ```

### Step 6 — Build & Serve the Frontend

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

### 👨‍💼 Admin Flow — Issuing a Certificate

1. **Connect Wallet** — Click the wallet badge in the navbar. MetaMask will prompt for connection. Ensure you're on the **Ganache** network (Chain ID 1337).

2. **Navigate to Admin Panel** — Click "Admin Panel" in the navbar or use the Quick Access card on the landing page.

3. **Fill the Form** —
   | Field | Example |
   |---|---|
   | Name | `Hrithik Singh` |
   | Course Name | `Full Stack Web Development` |
   | Institute Name | `MGM College of Engineering` |
   | Certificate PDF | Upload a `.pdf` file |
   | Student Photo | Upload an image (`.jpg`, `.png`) |

4. **Submit** — Click "Issue Certificate & Register Hash".
   - **Phase 1:** Files + metadata are uploaded to the backend. The SHA-256 hash is generated and displayed immediately in a cyan card.
   - **Phase 2:** MetaMask prompts you to confirm the blockchain transaction. Once confirmed, the Certificate ID and transaction hash are shown.

5. **Done** — Copy the Certificate ID (e.g., `CERT-1771529389384`) and share it with the student.

> ⚠️ If the blockchain transaction fails, the hash remains visible. You can retry without re-uploading.

### 🔍 Verifier Flow — Checking a Certificate

1. **Navigate to Verify** — Click "Verify" in the navbar.

2. **Enter ID or Hash** — Paste a **Certificate ID** (e.g., `CERT-1771529389384`) or a **SHA-256 Hash** into the search box.

3. **Click "Verify"** — The system performs a dual lookup:
   - First checks the **blockchain** (by ID).
   - If not found, falls back to the **backend** (by hash).

4. **View Results** —
   - ✅ **Green badge** = "Verified on Ethereum" (found on chain).
   - 📂 **Amber badge** = "Retrieved via Hash" (found in database only).
   - All metadata is displayed: Name, Course, Institute, Creation Date, Filenames.

5. **View Assets** — Click the "View Certificate Assets" button to expand an inline viewer showing the student photo and an embedded PDF reader.

---

## 📡 API Documentation

Base URL: `http://127.0.0.1:5000`

### `POST /api/certificates`

Upload certificate files and metadata. Returns a SHA-256 hash.

| Parameter | Type | Location | Required | Description |
|---|---|---|---|---|
| `name` | string | form-data | ✅ | Student's full name |
| `courseName` | string | form-data | ✅ | Course or program name |
| `instituteName` | string | form-data | ✅ | Issuing institution |
| `pdf` | file | form-data | ✅ | Certificate PDF (max 10 MB) |
| `photo` | file | form-data | ✅ | Student photo (max 10 MB) |

**Success Response** `200 OK`:
```json
{
  "success": true,
  "hash": "72480d9efe479e2dab47d1c054a3498aa3b11d0e88a211093f34a00874af7592"
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

Retrieve certificate metadata by its SHA-256 hash.

| Parameter | Type | Location | Description |
|---|---|---|---|
| `hash` | string | URL param | SHA-256 hash of the certificate |

**Success Response** `200 OK`:
```json
{
  "success": true,
  "certificate": {
    "name": "Hrithik Singh",
    "courseName": "Full Stack Web Development",
    "instituteName": "MGM College of Engineering",
    "pdfCid": "QmZf3t...aP7n",
    "photoCid": "QmWp9s...zK8r",
    "createdAt": "2026-02-19T19:29:49.411Z",
    "pdfUrl": "https://gateway.pinata.cloud/ipfs/QmZf3t...aP7n",
    "photoUrl": "https://gateway.pinata.cloud/ipfs/QmWp9s...zK8r"
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

### `GET /uploads/:filename`

Static file serving for uploaded PDFs and photos.

---

## 📜 Smart Contract Reference

**Contract:** `CertificateVerification.sol` · **Solidity** `^0.8.20`

### Functions

| Function | Access | Returns | Description |
|---|---|---|---|
| `addCertificate(string _id, string _hash)` | 🔒 Admin | — | Stores a certificate ID → hash mapping on-chain |
| `verifyCertificate(string _id)` | 🌐 Public | `string` | Returns the stored hash for a given certificate ID |
| `certificateExists(string _id)` | 🌐 Public | `bool` | Checks if a certificate ID exists on-chain |

### Events

| Event | Parameters | Description |
|---|---|---|
| `CertificateAdded` | `id` (indexed), `hash`, `timestamp` | Emitted when a new certificate is registered |

### Custom Errors (Gas-Efficient)

| Error | Trigger |
|---|---|
| `NotAdmin()` | Non-admin attempts to add a certificate |
| `CertificateAlreadyExists(id)` | Duplicate certificate ID |
| `CertificateNotFound(id)` | Lookup for non-existent ID |
| `EmptyId()` | Empty string passed as ID |
| `EmptyHash()` | Empty string passed as hash |

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

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Ethereum, React & Express**

</div>
