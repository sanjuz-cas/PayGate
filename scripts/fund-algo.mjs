// DO NOT COMMIT TO GIT
// Usage: node scripts/fund-algo.mjs
// Funds both agent and seller accounts via Algorand TestNet dispenser

import fs from "node:fs";
import path from "node:path";

const DISPENSER_URL = "https://bank.testnet.algorand.network";

async function fundAccount(label, address) {
  console.log(`\n[fund] Requesting ALGO for ${label}: ${address}`);
  const response = await fetch(DISPENSER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: address }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[fund] ${label} dispenser response (${response.status}): ${text}`);
    throw new Error(`Dispenser failed for ${label}`);
  }

  console.log(`[fund] ${label} funded! Response: ${text}`);
  return text;
}

async function main() {
  const accountsPath = path.resolve("scripts", "accounts.json");
  if (!fs.existsSync(accountsPath)) {
    console.error("ERROR: scripts/accounts.json not found. Run gen-accounts.mjs first.");
    process.exit(1);
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));

  await fundAccount("AGENT", accounts.agent.address);
  await fundAccount("SELLER", accounts.seller.address);

  console.log("\n=== FUNDING COMPLETE ===");
  console.log("Both accounts requested 5 ALGO from TestNet dispenser.");
  console.log("Wait ~4 seconds for confirmation before running opt-in.");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
