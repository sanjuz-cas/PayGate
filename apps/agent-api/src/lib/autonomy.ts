import { desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
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

// Rules-based fallback function (used when ANTHROPIC_API_KEY is not set or LLM call fails)
function evaluateInboundLetterRules(
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

export async function evaluateInboundLetter(
  letter: InboundLetterInput,
  env: AgentEnv,
): Promise<AutonomyDecision> {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;

  // If no API key, fall back to rules-based logic
  if (!anthropicApiKey) {
    return evaluateInboundLetterRules(letter, env);
  }

  const evaluatedAt = nowIso();
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const allowlistSenders = env.AUTONOMOUS_ALLOWLIST_SENDERS
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const priorityKeywords = env.AUTONOMOUS_PRIORITY_KEYWORDS
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const skipKeywords = env.AUTONOMOUS_SKIP_KEYWORDS
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const systemPrompt = `You are an AI assistant that helps manage a physical mailbox by deciding how to handle inbound letters. Your task is to analyze each letter and recommend one of three actions:

1. "unlock" - The letter should be automatically unlocked by paying an x402 unlock fee. This is for important, legitimate mail.
2. "ignore" - The letter is junk/promotional/spam and should be ignored without spending money to unlock it.
3. "defer" - The letter is ambiguous or uncertain and should be held for manual human review.

Guidance (use these as context, NOT hard rules):
- Allowlisted senders (typically trusted): ${allowlistSenders.join(", ") || "(none configured)"}
- Priority keywords that often indicate important mail: ${priorityKeywords.join(", ") || "(none configured)"}
- Skip/junk keywords that often indicate promotional mail: ${skipKeywords.join(", ") || "(none configured)"}

Important: Use your reasoning to detect edge cases that simple keyword matching would miss, such as:
- Phishing attempts impersonating banks or government agencies
- Urgent-sounding scams
- Legitimate mail from unknown but credible senders
- Sophisticated marketing that avoids obvious spam keywords

You MUST respond with ONLY valid JSON in this exact format:
{
  "decision": "unlock" | "ignore" | "defer",
  "reason": "A clear explanation of your reasoning",
  "confidence": 0.0 to 1.0
}

Do not include any text before or after the JSON. Do not use markdown code blocks. Output raw JSON only.`;

  const userPrompt = `Analyze this inbound letter:

From: ${letter.from}
Envelope Summary: ${letter.envelopeSummary}
Page Count: ${letter.pageCount ?? "unknown"}

Provide your decision in JSON format.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textContent || !textContent.text) {
      console.warn(
        `[autonomy] LLM response had no text content, falling back to rules-based evaluation for letter ${letter.letterId}`
      );
      return evaluateInboundLetterRules(letter, env);
    }

    const jsonText = textContent.text.trim();
    // Try to extract JSON if there's extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : jsonText;

    const parsed = JSON.parse(jsonString);

    // Validate against the schema
    const { autonomyDecisionSchema } = await import("@juicebag-mail/shared");
    const validationResult = autonomyDecisionSchema.safeParse({
      letterId: letter.letterId,
      fromName: letter.from,
      envelopeSummary: letter.envelopeSummary,
      decision: parsed.decision,
      reason: parsed.reason,
      confidence: parsed.confidence,
      evaluatedAt,
    });

    if (!validationResult.success) {
      console.warn(
        `[autonomy] LLM response failed validation: ${validationResult.error.message}, falling back to rules-based evaluation for letter ${letter.letterId}`
      );
      return evaluateInboundLetterRules(letter, env);
    }

    return validationResult.data;
  } catch (error) {
    console.warn(
      `[autonomy] LLM call failed for letter ${letter.letterId}:`,
      error instanceof Error ? error.message : String(error),
      "- falling back to rules-based evaluation"
    );
    return evaluateInboundLetterRules(letter, env);
  }
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
