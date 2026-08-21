import { desc } from "drizzle-orm";
import type { AutonomyDecision } from "@juicebag-mail/shared";

import type { AgentDatabase } from "../db/index.js";
import { autonomyDecisions } from "../db/schema.js";
import type { AgentEnv } from "./env.js";
import { createId, nowIso } from "./ids.js";

export type InboundLetterInput = {
  letterId: string;
  from: string;
  envelopeSummary: string;
  pageCount?: number;
};

export function evaluateInboundLetter(
  letter: InboundLetterInput,
  env: AgentEnv,
): AutonomyDecision {
  const evaluatedAt = nowIso();
  const fromNormalized = letter.from.toLowerCase();
  const summaryNormalized = letter.envelopeSummary.toLowerCase();
  const combinedText = `${fromNormalized} ${summaryNormalized}`;

  // 1. Check Allowlist Senders
  const allowlistSenders = env.AUTONOMOUS_ALLOWLIST_SENDERS
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  for (const sender of allowlistSenders) {
    if (fromNormalized.includes(sender)) {
      return {
        letterId: letter.letterId,
        fromName: letter.from,
        envelopeSummary: letter.envelopeSummary,
        decision: "unlock",
        reason: `Sender "${letter.from}" matched trusted allowlist sender "${sender}" → Autonomous unlock recommended`,
        confidence: 0.98,
        evaluatedAt,
      };
    }
  }

  // 2. Check Priority Keywords
  const priorityKeywords = env.AUTONOMOUS_PRIORITY_KEYWORDS
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  for (const kw of priorityKeywords) {
    if (combinedText.includes(kw)) {
      return {
        letterId: letter.letterId,
        fromName: letter.from,
        envelopeSummary: letter.envelopeSummary,
        decision: "unlock",
        reason: `Letter matched high-priority keyword "${kw}" (Sender: "${letter.from}") → Autonomous unlock recommended`,
        confidence: 0.92,
        evaluatedAt,
      };
    }
  }

  // 3. Check Skip / Promotional Keywords
  const skipKeywords = env.AUTONOMOUS_SKIP_KEYWORDS
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  for (const kw of skipKeywords) {
    if (combinedText.includes(kw)) {
      return {
        letterId: letter.letterId,
        fromName: letter.from,
        envelopeSummary: letter.envelopeSummary,
        decision: "ignore",
        reason: `Letter matched promotional/junk keyword "${kw}" → Autonomous skip (ignore) recommended`,
        confidence: 0.90,
        evaluatedAt,
      };
    }
  }

  // 4. Default / Defer
  return {
    letterId: letter.letterId,
    fromName: letter.from,
    envelopeSummary: letter.envelopeSummary,
    decision: "defer",
    reason: `Sender "${letter.from}" did not match explicit priority or skip rules → Held in pending for manual action`,
    confidence: 0.50,
    evaluatedAt,
  };
}

export async function recordAutonomyDecision(
  db: AgentDatabase,
  decision: AutonomyDecision,
  executed = false,
) {
  const id = createId("aut");
  await db.insert(autonomyDecisions).values({
    id,
    letterId: decision.letterId,
    fromName: decision.fromName,
    envelopeSummary: decision.envelopeSummary,
    decision: decision.decision,
    reason: decision.reason,
    confidence: String(decision.confidence),
    executed: executed ? 1 : 0,
    createdAt: decision.evaluatedAt,
  });

  return {
    id,
    ...decision,
    executed,
  };
}

export async function getRecentAutonomyDecisions(
  db: AgentDatabase,
  limit = 20,
): Promise<AutonomyDecision[]> {
  const rows = await db
    .select()
    .from(autonomyDecisions)
    .orderBy(desc(autonomyDecisions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    letterId: r.letterId,
    fromName: r.fromName,
    envelopeSummary: r.envelopeSummary,
    decision: r.decision as "unlock" | "ignore" | "defer",
    reason: r.reason,
    confidence: Number(r.confidence) || 1.0,
    evaluatedAt: r.createdAt,
  }));
}
