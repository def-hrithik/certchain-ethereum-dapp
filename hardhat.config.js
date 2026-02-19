require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

// ── Validate .env configuration (graceful — won't crash if keys are missing) ──
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const isKeyValid = /^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY);

if (!SEPOLIA_RPC_URL || !isKeyValid) {
  console.warn(
    "\n⚠️  Sepolia config missing — Sepolia deployment unavailable. Set SEPOLIA_RPC_URL and PRIVATE_KEY in .env\n"
  );
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  defaultNetwork: "ganache",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      // Accounts are auto-detected from the running Ganache instance.
      // You can optionally list private keys here:
      // accounts: ["0xYOUR_GANACHE_PRIVATE_KEY"]
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: isKeyValid ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    scripts: "./scripts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};
