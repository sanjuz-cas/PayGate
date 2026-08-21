import { desc, gte } from "drizzle-orm";
import type { AgentGuardrail } from "@juicebag-mail/shared";

import type { AgentDatabase } from "../db/index.js";
import { agentSpendLog, payments } from "../db/schema.js";
import type { AgentEnv } from "./env.js";
import { createId, nowIso } from "./ids.js";

export type GuardrailCheckResult = {
  allowed: boolean;
  dailyCapUsdc: number;
  currentSpendUsdc: number;
  requestedAmountUsd: number;
  remainingUsdc: number;
  reason?: string;
};

export async function getSpendStatus(
  db: AgentDatabase,
  env: AgentEnv,
): Promise<AgentGuardrail> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Sum payments in rolling 24h window
  const settledPayments = await db
    .select()
    .from(payments)
    .where(gte(payments.createdAt, windowStart));

  const currentSpendUsdc = settledPayments.reduce((acc, p) => {
    const val = Number(p.amountUsd);
    return acc + (Number.isNaN(val) ? 0 : val);
  }, 0);

  const dailyCapUsdc = env.AGENT_DAILY_CAP_USDC;
  const remainingUsdc = Math.max(0, Number((dailyCapUsdc - currentSpendUsdc).toFixed(4)));
  const blocked = currentSpendUsdc >= dailyCapUsdc;

  return {
    dailyCapUsdc,
    currentSpendUsdc: Number(currentSpendUsdc.toFixed(4)),
    remainingUsdc,
    blocked,
    window: "24h",
  };
}

export async function checkSpendGuardrail(
  db: AgentDatabase,
  env: AgentEnv,
  requestedAmountUsd: number,
): Promise<GuardrailCheckResult> {
  const status = await getSpendStatus(db, env);
  const totalAfter = Number((status.currentSpendUsdc + requestedAmountUsd).toFixed(4));

  if (totalAfter > status.dailyCapUsdc) {
    const reason = `Payment blocked by guardrail: requested $${requestedAmountUsd.toFixed(2)} would exceed daily cap of $${status.dailyCapUsdc.toFixed(2)} (current 24h spend: $${status.currentSpendUsdc.toFixed(2)})`;
    return {
      allowed: false,
      dailyCapUsdc: status.dailyCapUsdc,
      currentSpendUsdc: status.currentSpendUsdc,
      requestedAmountUsd,
      remainingUsdc: status.remainingUsdc,
      reason,
    };
  }

  return {
    allowed: true,
    dailyCapUsdc: status.dailyCapUsdc,
    currentSpendUsdc: status.currentSpendUsdc,
    requestedAmountUsd,
    remainingUsdc: status.remainingUsdc,
  };
}

export async function recordSpendLog(
  db: AgentDatabase,
  input: {
    routeKey: string;
    action: string;
    amountUsd: number;
    currency?: string;
    txid?: string | null;
    status: "settled" | "blocked" | "pending";
  },
) {
  const id = createId("spl");
  const createdAt = nowIso();

  await db.insert(agentSpendLog).values({
    id,
    routeKey: input.routeKey,
    action: input.action,
    amountUsd: String(input.amountUsd),
    currency: input.currency ?? "usdc",
    txid: input.txid ?? null,
    status: input.status,
    createdAt,
  });

  return {
    id,
    ...input,
    createdAt,
  };
}

export async function getRecentSpendLogs(db: AgentDatabase, limit = 20) {
  const rows = await db
    .select()
    .from(agentSpendLog)
    .orderBy(desc(agentSpendLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    routeKey: r.routeKey,
    action: r.action,
    amountUsd: Number(r.amountUsd),
    currency: r.currency,
    txid: r.txid ?? undefined,
    status: r.status,
    createdAt: r.createdAt,
  }));
}
