// DO NOT COMMIT TO GIT
// Usage: node scripts/setup-envs.mjs
// Creates .env.agent and .env.service from accounts.json

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const accountsPath = path.resolve("scripts", "accounts.json");
if (!fs.existsSync(accountsPath)) {
  console.error("ERROR: scripts/accounts.json not found. Run gen-accounts.mjs first.");
  process.exit(1);
}

const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
const webhookKey = crypto.randomBytes(32).toString("hex");

const envAgent = [
  `AGENT_MNEMONIC="${accounts.agent.mnemonic}"`,
  ``,
  `VITE_AGENT_UI_TOKEN="juicebag-agent-ui-demo-token"`,
  ``,
  `AGENT_BASE_URL="http://localhost:4022"`,
  `SERVICE_BASE_URL="http://localhost:4021"`,
  `ALGOD_URL="https://testnet-api.algonode.cloud"`,
  ``,
].join("\n");

const envService = [
  `SELLER_ADDRESS="${accounts.seller.address}"`,
  `WEBHOOK_SECRET_MASTER_KEY="${webhookKey}"`,
  ``,
  `VITE_ADMIN_UI_TOKEN="juicebag-admin-demo-token"`,
  ``,
  `SERVICE_BASE_URL="http://localhost:4021"`,
  `FACILITATOR_URL="https://facilitator.goplausible.xyz"`,
  ``,
].join("\n");

const agentEnvPath = path.resolve(".env.agent");
const serviceEnvPath = path.resolve(".env.service");

fs.writeFileSync(agentEnvPath, envAgent, "utf8");
fs.writeFileSync(serviceEnvPath, envService, "utf8");

console.log("=== ENV FILES CREATED ===");
console.log(".env.agent written to:", agentEnvPath);
console.log("  AGENT_MNEMONIC: [set]");
console.log("  ALGOD_URL: https://testnet-api.algonode.cloud");
console.log("");
console.log(".env.service written to:", serviceEnvPath);
console.log("  SELLER_ADDRESS:", accounts.seller.address);
console.log("  WEBHOOK_SECRET_MASTER_KEY:", webhookKey);
console.log("  FACILITATOR_URL: https://facilitator.goplausible.xyz");
