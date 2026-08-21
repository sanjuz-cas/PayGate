// DO NOT COMMIT TO GIT — local key generation only
// Usage: node scripts/gen-accounts.mjs

import algosdk from "algosdk";
import fs from "node:fs";
import path from "node:path";

const agent = algosdk.generateAccount();
const seller = algosdk.generateAccount();

const agentMnemonic = algosdk.secretKeyToMnemonic(agent.sk);
const sellerMnemonic = algosdk.secretKeyToMnemonic(seller.sk);

console.log("=".repeat(60));
console.log("AGENT ACCOUNT (buyer / x402 signer)");
console.log("=".repeat(60));
console.log("Address  :", agent.addr);
console.log("Mnemonic :", agentMnemonic);

console.log("");
console.log("=".repeat(60));
console.log("SELLER ACCOUNT (receiver / service wallet)");
console.log("=".repeat(60));
console.log("Address  :", seller.addr);
console.log("Mnemonic :", sellerMnemonic);

// Save to a local file (gitignored)
const accountsData = {
  agent: {
    address: agent.addr,
    mnemonic: agentMnemonic,
  },
  seller: {
    address: seller.addr,
    mnemonic: sellerMnemonic,
  },
  generatedAt: new Date().toISOString(),
};

const outPath = path.resolve("scripts", "accounts.json");
fs.writeFileSync(outPath, JSON.stringify(accountsData, null, 2), "utf8");
console.log(`\nAccounts saved to: ${outPath} (DO NOT COMMIT)`);
