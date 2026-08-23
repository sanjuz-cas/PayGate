import algosdk from "algosdk";
import { desc } from "drizzle-orm";
import {
  ECO_CAUSE_ADDRESS,
  ECO_CONTRIBUTION_USDC,
  USDC_TESTNET_ASA_ID,
  type EcoContribution,
  type EcoStats,
} from "@juicebag-mail/shared";

import type { AgentDatabase } from "../db/index.js";
import { ecoContributions } from "../db/schema.js";
import type { AgentEnv } from "./env.js";
import type { AgentEventBus } from "./events.js";
import { createId, nowIso } from "./ids.js";

/**
 * Dispatches an automated on-chain micro-donation ($0.01 USDC)
 * to the designated Tree-Planting / Eco Cause Wallet on Algorand TestNet.
 */
export async function dispatchEcoContribution(params: {
  db: AgentDatabase;
  env: AgentEnv;
  events: AgentEventBus;
  action: "send-letter" | "unlock-letter";
  treesCount?: number;
}): Promise<EcoContribution | null> {
  const { db, env, events, action, treesCount = 1 } = params;

  try {
    const account = algosdk.mnemonicToSecretKey(env.mnemonic);
    const algodClient = new algosdk.Algodv2("", env.ALGOD_URL, "");

    // Fetch transaction parameters from TestNet node
    const suggestedParams = await algodClient.getTransactionParams().do();

    // 0.01 USDC = 10,000 micro-units (6 decimals)
    const amountMicroUsdc = Math.round(ECO_CONTRIBUTION_USDC * 1_000_000 * treesCount);

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr.toString(),
      receiver: ECO_CAUSE_ADDRESS,
      assetIndex: USDC_TESTNET_ASA_ID,
      amount: amountMicroUsdc,
      note: new Uint8Array(
        Buffer.from(`EcoGPT: Plant ${treesCount} tree(s) via ${action}`),
      ),
      suggestedParams,
    });

    const signedTxn = txn.signTxn(account.sk);
    const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
    const txid = sendResult.txid;

    console.log(
      `[eco-gpt] 🌳 Dispatched $${(ECO_CONTRIBUTION_USDC * treesCount).toFixed(2)} USDC tree contribution! Txid: ${txid}`,
    );

    void algosdk.waitForConfirmation(algodClient, txid, 4).catch((err) => {
      console.warn("[eco-gpt] Confirmation poll warning:", err);
    });

    const id = createId("eco");
    const createdAt = nowIso();
    const amountUsd = (ECO_CONTRIBUTION_USDC * treesCount).toFixed(2);

    await db.insert(ecoContributions).values({
      id,
      action,
      amountUsd,
      treesCount,
      txid,
      recipientAddress: ECO_CAUSE_ADDRESS,
      createdAt,
    });

    await events.publish({
      type: "eco.contribution",
      message: `Planted ${treesCount} tree(s) with $${amountUsd} USDC eco-contribution on Algorand TestNet`,
      txid,
      amountUsd: Number(amountUsd),
      treesCount,
    });

    return {
      id,
      action,
      amountUsd: Number(amountUsd),
      treesCount,
      txid,
      recipientAddress: ECO_CAUSE_ADDRESS,
      createdAt,
    };
  } catch (error) {
    console.error("[eco-gpt] Failed to dispatch eco contribution:", error);
    return null;
  }
}

/**
 * Returns cumulative statistics and recent on-chain contributions
 */
export async function getEcoStats(db: AgentDatabase): Promise<EcoStats> {
  const rows = await db
    .select()
    .from(ecoContributions)
    .orderBy(desc(ecoContributions.createdAt))
    .limit(20);

  const totalTreesPlanted = rows.reduce(
    (sum, r) => sum + (r.treesCount ?? 1),
    0,
  );
  const totalContributedUsd = rows.reduce(
    (sum, r) => sum + Number(r.amountUsd || "0"),
    0,
  );

  const recentContributions: EcoContribution[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    amountUsd: Number(r.amountUsd),
    treesCount: r.treesCount,
    txid: r.txid,
    recipientAddress: r.recipientAddress,
    createdAt: r.createdAt,
  }));

  return {
    totalTreesPlanted,
    totalContributedUsd: Number(totalContributedUsd.toFixed(2)),
    causeAddress: ECO_CAUSE_ADDRESS,
    recentContributions,
  };
}
