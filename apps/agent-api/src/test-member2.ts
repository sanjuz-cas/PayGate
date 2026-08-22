import assert from "node:assert";
import { createAgentDb } from "./db/index.js";
import { loadAgentEnv } from "./lib/env.js";
import {
  checkSpendGuardrail,
  getSpendStatus,
  recordSpendLog,
} from "./lib/guardrail.js";
import {
  evaluateInboundLetter,
  getRecentAutonomyDecisions,
  recordAutonomyDecision,
} from "./lib/autonomy.js";

async function runTests() {
  console.log("=== Running Member 2 Guardrail & Autonomy Unit Tests ===");

  const env = loadAgentEnv({
    AGENT_MNEMONIC:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest",
    AGENT_DAILY_CAP_USDC: "1.00",
    AUTONOMOUS_UNLOCK_ENABLED: "true",
  });

  const { db } = createAgentDb(":memory:");

  // Test 1: Guardrail with initial zero spend
  console.log("Test 1: Initial spend status");
  const initialStatus = await getSpendStatus(db, env);
  assert.strictEqual(initialStatus.currentSpendUsdc, 0);
  assert.strictEqual(initialStatus.dailyCapUsdc, 1.0);
  assert.strictEqual(initialStatus.remainingUsdc, 1.0);
  assert.strictEqual(initialStatus.blocked, false);
  console.log("✓ Initial spend status passed");

  // Test 2: Guardrail allows transaction within budget
  console.log("Test 2: Check spend allowed");
  const check1 = await checkSpendGuardrail(db, env, 0.2);
  assert.strictEqual(check1.allowed, true);
  console.log("✓ Under-cap check passed");

  // Test 3: Record spend and verify status updates
  console.log("Test 3: Record payment and check cap");
  await db.insert((await import("./db/schema.js")).payments).values({
    id: "pay_test_1",
    routeKey: "inbound_unlock",
    txid: "TXID_TEST_1",
    amountUsd: "0.90",
    network: "algorand:testnet",
    payTo: "SOME_RECEIVER",
    createdAt: new Date().toISOString(),
  });

  const check2 = await checkSpendGuardrail(db, env, 0.2);
  assert.strictEqual(check2.allowed, false);
  assert.match(check2.reason ?? "", /Payment blocked by guardrail/);
  console.log("✓ Over-cap block passed");

  // Test 4: Autonomy Decision Engine - Priority Allowlist (Tax)
  console.log("Test 4: Autonomous decision on Tax Office mail");
  const taxLetter = await evaluateInboundLetter(
    {
      letterId: "let_tax_1",
      from: "City Tax Office Schnitzelburg",
      envelopeSummary: "Annual Tax Assessment Notice 2026",
    },
    env,
  );
  assert.strictEqual(taxLetter.decision, "unlock");
  assert.strictEqual(taxLetter.confidence >= 0.9, true);
  console.log("✓ Tax Office letter prioritized for unlock");

  // Test 5: Autonomy Decision Engine - Promotional / Spam
  console.log("Test 5: Autonomous decision on Promo mail");
  const promoLetter = await evaluateInboundLetter(
    {
      letterId: "let_promo_1",
      from: "Casino Super Deals",
      envelopeSummary: "Claim your $5,000 lottery promo discount free gift!",
    },
    env,
  );
  assert.strictEqual(promoLetter.decision, "ignore");
  console.log("✓ Promotional letter flagged to ignore");

  // Test 6: Autonomy Decision Engine - Unknown / Defer
  console.log("Test 6: Autonomous decision on Unknown mail");
  const unknownLetter = await evaluateInboundLetter(
    {
      letterId: "let_unk_1",
      from: "Random Strangers Club",
      envelopeSummary: "General correspondence regarding nothing specific",
    },
    env,
  );
  assert.strictEqual(unknownLetter.decision, "defer");
  console.log("✓ Unknown letter deferred for review");

  // Test 7: Decision and Spend Log persistence
  console.log("Test 7: Autonomy decision persistence");
  await recordAutonomyDecision(db, taxLetter, true);
  const savedDecisions = await getRecentAutonomyDecisions(db, 10);
  assert.strictEqual(savedDecisions.length, 1);
  assert.strictEqual(savedDecisions[0].decision, "unlock");
  console.log("✓ Autonomy decision persistence passed");

  await recordSpendLog(db, {
    routeKey: "inbound_unlock",
    action: "unlock-letter",
    amountUsd: 0.2,
    currency: "usdc",
    status: "settled",
  });

  console.log("\n ALL TESTS PASSED SUCCESSFULLY! \n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
