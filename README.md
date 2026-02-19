# 🔗 CertChain — Decentralized Certificate Verification System

A full-stack Ethereum DApp that allows an **admin** to issue certificate hashes on-chain and **anyone** to verify them trustlessly.

![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-2.x-FFF100?logo=hardhat)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-3C3C3D)

---

## 🏗 Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Blockchain | Solidity, Hardhat, Ganache / Sepolia |
| Frontend   | React (CRA), Tailwind CSS, Ethers v6 |
| Wallet     | MetaMask                             |
| UX         | Framer Motion, react-hot-toast       |

---

## 📂 Project Structure

```
Blockchain/
├── contracts/
│   └── CertificateVerification.sol   # Smart contract
├── scripts/
│   └── deploy.js                     # Deployment + ABI export
├── hardhat.config.js                 # Hardhat configuration
├── .env                              # Environment variables (not committed)
│
└── dapp/                             # React frontend
    └── src/
        ├── components/
        │   ├── Navbar.jsx
        │   ├── AdminPanel.jsx
        │   └── VerifyPanel.jsx
        ├── contract.js               # Auto-generated: ABI + address
        ├── App.js                    # Main app with wallet logic
        └── index.css                 # Tailwind directives
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **MetaMask** browser extension
- **Ganache** (for local development)

### 1. Install Dependencies

```bash
# Root (Hardhat)
cd Blockchain
npm install

# Frontend
cd dapp
npm install
```

### 2. Start Ganache

Open Ganache and create a workspace on **port 7545** (Chain ID 1337).

### 3. Import Ganache Account into MetaMask

1. Open Ganache → Click the 🔑 key icon on Account 0 → Copy the private key.
2. In MetaMask → Import Account → Paste the private key.
3. Add a custom network in MetaMask:
   - **RPC URL:** `http://127.0.0.1:7545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** `ETH`

### 4. Deploy the Contract

```bash
cd Blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

This automatically writes the contract address and ABI to `dapp/src/contract.js`.

### 5. Start the Frontend

```bash
cd dapp
npm start
```

Open [http://localhost:3000](http://localhost:3000) — connect MetaMask and start issuing/verifying certificates.

---

## 🌍 Sepolia Testnet Deployment

1. Create a `.env` file in the root:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_metamask_private_key
```

2. Deploy:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. Switch MetaMask to Sepolia and refresh the frontend.

---

## 🎨 Design Tokens

| Token      | Value     |
| ---------- | --------- |
| Primary    | `#2563EB` |
| Background | `#F8FAFC` |
| Success    | `#10B981` |
| Error      | `#EF4444` |
| Radius     | `12px`    |

---

## 📜 Smart Contract API

| Function                               | Access | Description                   |
| -------------------------------------- | ------ | ----------------------------- |
| `addCertificate(string, string)`       | Admin  | Store a certificate hash      |
| `verifyCertificate(string)` → `string` | Public | Retrieve hash by ID           |
| `certificateExists(string)` → `bool`   | Public | Check if a certificate exists |

Custom errors: `NotAdmin`, `CertificateAlreadyExists`, `CertificateNotFound`, `EmptyId`, `EmptyHash`.

---

## 📝 License

MIT
