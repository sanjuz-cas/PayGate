// DO NOT COMMIT TO GIT
// Usage: apps/agent-api/node_modules/.bin/tsx scripts/opt-in-usdc.ts
// Opts BOTH agent and seller accounts into USDC TestNet ASA (10458941)

import algosdk from "algosdk";
import fs from "node:fs";
import path from "node:path";

const USDC_ASA_ID = 10458941; // TestNet USDC ASA ID
const ALGOD_URL = "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = "";

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");

async function optIn(label: string, address: string, mnemonic: string) {
  console.log(`\n[opt-in] ${label}: ${address}`);
  const privKey = algosdk.mnemonicToSecretKey(mnemonic);
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    assetIndex: USDC_ASA_ID,
    amount: 0,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(privKey.sk);
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
  console.log(`[opt-in] ${label} opt-in txid: ${txid}`);

  // Wait for confirmation
  const result = await algosdk.waitForConfirmation(algodClient, txid, 4);
  console.log(`[opt-in] ${label} confirmed at round ${result.confirmedRound ?? result["confirmed-round"]}`);
  return txid;
}

async function main() {
  const accountsPath = path.resolve("scripts", "accounts.json");
  if (!fs.existsSync(accountsPath)) {
    console.error("ERROR: scripts/accounts.json not found. Run gen-accounts.ts first.");
    process.exit(1);
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));

  const agentTxid = await optIn("AGENT", accounts.agent.address, accounts.agent.mnemonic);
  const sellerTxid = await optIn("SELLER", accounts.seller.address, accounts.seller.mnemonic);

  console.log("\n=== OPT-IN COMPLETE ===");
  console.log("Agent opt-in txid :", agentTxid);
  console.log("Seller opt-in txid:", sellerTxid);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
