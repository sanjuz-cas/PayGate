// DO NOT COMMIT TO GIT — local key generation only
// Usage: apps/agent-api/node_modules/.bin/tsx scripts/gen-accounts.ts (from repo root)
import algosdk from "algosdk";
import fs from "node:fs";
import path from "node:path";

const agent = algosdk.generateAccount();
const seller = algosdk.generateAccount();

// algosdk v3: addr is an Address object, encodeAddress() gives the Bech32/base32 string
const agentAddress = algosdk.encodeAddress(agent.addr.publicKey);
const sellerAddress = algosdk.encodeAddress(seller.addr.publicKey);
const agentMnemonic = algosdk.secretKeyToMnemonic(agent.sk);
const sellerMnemonic = algosdk.secretKeyToMnemonic(seller.sk);

console.log("=".repeat(60));
console.log("AGENT ACCOUNT (buyer / x402 signer)");
console.log("=".repeat(60));
console.log("Address  :", agentAddress);
console.log("Mnemonic :", agentMnemonic);

console.log("");
console.log("=".repeat(60));
console.log("SELLER ACCOUNT (receiver / service wallet)");
console.log("=".repeat(60));
console.log("Address  :", sellerAddress);
console.log("Mnemonic :", sellerMnemonic);

// Save to a local file (gitignored)
const accountsData = {
  agent: {
    address: agentAddress,
    mnemonic: agentMnemonic,
  },
  seller: {
    address: sellerAddress,
    mnemonic: sellerMnemonic,
  },
  generatedAt: new Date().toISOString(),
};

const outPath = path.resolve("scripts", "accounts.json");
fs.writeFileSync(outPath, JSON.stringify(accountsData, null, 2), "utf8");
console.log(`\nAccounts saved to: ${outPath} (DO NOT COMMIT)`);
