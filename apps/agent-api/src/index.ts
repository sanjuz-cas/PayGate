import "dotenv/config";

import { and, desc, eq } from "drizzle-orm";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { type Context, Hono } from "hono";
import { ALGORAND_TESTNET_CAIP2 } from "@x402-avm/avm";
import { z } from "zod";

import {
  agentIgnoreLetterSchema,
  agentRegistrationSchema,
  agentSendLetterSchema,
  agentUnlockLetterSchema,
  notificationEnvelopeSchema,
  ALGORAND_MAINNET_QUANTOZ,
  ROUTE_KEYS,
} from "@juicebag-mail/shared";

import { createAgentDb } from "./db/index.js";
import {
  inboundLetters,
  outboundLetters,
  registration,
  webhookEvents,
} from "./db/schema.js";
import { createEventBus } from "./lib/events.js";
import {
  getCachedAgentBalances,
  refreshAgentBalances,
} from "./lib/balances.js";
import { loadAgentEnv } from "./lib/env.js";
import { createId, nowIso } from "./lib/ids.js";
import { createJuicebagClient } from "./lib/juicebag-client.js";
import { buildAgentState, parseLegalIdentity } from "./lib/state.js";
import { verifyWebhookSignature } from "./lib/webhook.js";
import {
  checkSpendGuardrail,
  getRecentSpendLogs,
  getSpendStatus,
  recordSpendLog,
} from "./lib/guardrail.js";
import {
  evaluateInboundLetter,
  getRecentAutonomyDecisions,
  recordAutonomyDecision,
} from "./lib/autonomy.js";
import { dispatchEcoContribution, getEcoStats } from "./lib/eco-service.js";
import { createWalletApprovalManager } from "./lib/wallet-approval.js";
import { mnemonicToPrivateKeyBase64 } from "./lib/wallet.js";
import { toClientAvmSigner } from "@x402-avm/avm";

const env = loadAgentEnv(process.env);
const { db } = createAgentDb(env.AGENT_DB_PATH);
const events = createEventBus(db);

const walletApprovals = createWalletApprovalManager({
  onSignatureRequired: async (request) => {
    await events.publish({
      type: "wallet.signature_required",
      message: `Wallet approval required: ${request.description}`,
      requestId: request.id,
      walletAddress: request.walletAddress,
    });
  },
  onSignatureApproved: async (request) => {
    await events.publish({
      type: "wallet.signature_approved",
      message: `Wallet approved signature for ${request.description}`,
      requestId: request.id,
      walletAddress: request.walletAddress,
    });
  },
});

const juicebag = createJuicebagClient(env, {
  get address() {
    if (walletApprovals.status().connected) {
      return walletApprovals.signer().address;
    }
    return env.mnemonic ? toClientAvmSigner(mnemonicToPrivateKeyBase64(env.mnemonic)).address : "";
  },
  async signTransactions(transactions, indexesToSign) {
    if (walletApprovals.status().connected) {
      return await walletApprovals.signer().signTransactions(transactions, indexesToSign);
    }
    if (env.mnemonic) {
      return await toClientAvmSigner(mnemonicToPrivateKeyBase64(env.mnemonic)).signTransactions(transactions, indexesToSign);
    }
    throw new Error("No wallet signer is available. Connect Pera Wallet before making an x402 payment.");
  },
});

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

type AgentContext = Context;

function requireUiToken(c: AgentContext) {
  const header = c.req.header("Authorization");
  const queryToken = c.req.query("token");
  const isAuthorized =
    header === `Bearer ${env.VITE_AGENT_UI_TOKEN}` ||
    queryToken === env.VITE_AGENT_UI_TOKEN;

  if (!isAuthorized) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/state", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const connectedAddress = walletApprovals.status().connected
    ? walletApprovals.status().address
    : null;
  void refreshAgentBalances(env, connectedAddress).catch(() => { });
  await juicebag.syncState(db).catch(() => { });
  return c.json(await buildAgentState({ db, env }));
});

app.get("/balances", (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const connectedAddress = walletApprovals.status().connected
    ? walletApprovals.status().address
    : null;
  void refreshAgentBalances(env, connectedAddress).catch(() => { });
  return c.json(getCachedAgentBalances(env, connectedAddress));
});

app.get("/eco-stats", async (c) => {
  return c.json(await getEcoStats(db));
});

app.get("/spend", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const guardrail = await getSpendStatus(db, env);
  const recentSpendLogs = await getRecentSpendLogs(db, 50);
  return c.json({ guardrail, recentSpendLogs });
});

app.get("/autonomy/decisions", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const decisions = await getRecentAutonomyDecisions(db, 50);
  return c.json({ decisions, autonomousUnlockEnabled: env.AUTONOMOUS_UNLOCK_ENABLED });
});

app.post("/actions/set-cap", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const schema = z.object({
    dailyCapUsdc: z.number().positive(),
  });
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  env.AGENT_DAILY_CAP_USDC = parsed.data.dailyCapUsdc;
  const guardrail = await getSpendStatus(db, env);
  return c.json({ success: true, guardrail });
});

app.post("/actions/register", async (c) => {
  console.log("[agent] POST /actions/register");
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const existing = await juicebag.currentRegistration(db);
  if (existing) {
    return c.json({ error: "Agent is already registered" }, 409);
  }

  const parsed = agentRegistrationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { currency = "usdc" } = parsed.data;
  const costUsd = currency === "eurd" ? 0.05 : 1.0;

  // Guardrail Check
  const guardrailCheck = await checkSpendGuardrail(db, env, costUsd);
  if (!guardrailCheck.allowed) {
    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.registration,
      action: "register",
      amountUsd: costUsd,
      currency,
      status: "blocked",
    });

    await events.publish({
      type: "budget_blocked",
      message: guardrailCheck.reason ?? "Registration blocked by daily budget cap",
      routeKey: ROUTE_KEYS.registration,
      requestedAmount: costUsd,
      currentSpend: guardrailCheck.currentSpendUsdc,
      cap: guardrailCheck.dailyCapUsdc,
    });

    return c.json(
      {
        error: guardrailCheck.reason,
        code: "BUDGET_BLOCKED",
        guardrail: guardrailCheck,
      },
      422,
    );
  }

  const result = await juicebag.register(db, parsed.data, currency);
  const txid = result.payment?.transaction ?? result.registration.x402?.txid;
  const network =
    result.payment?.network ??
    (currency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);

  if (txid) {
    await juicebag.recordPayment(db, {
      routeKey: ROUTE_KEYS.registration,
      txid,
      amountUsd: costUsd,
      network,
      payTo: "",
    });

    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.registration,
      action: "register",
      amountUsd: costUsd,
      currency,
      txid,
      status: "settled",
    });
  }

  await events.publish({
    type: "registration.completed",
    message: `Registered mailbox ${result.registration.mailboxId}`,
    txid,
    network,
  });

  void refreshAgentBalances(env).catch(() => { });
  return c.json(await buildAgentState({ db, env }), 201);
});

app.post("/actions/send-letter", async (c) => {
  console.log("[agent] POST /actions/send-letter");
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = agentSendLetterSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { currency: sendCurrency = "usdc" } = parsed.data;
  const costUsd = sendCurrency === "eurd" ? 0.01 : 0.05;

  // Guardrail Check
  const guardrailCheck = await checkSpendGuardrail(db, env, costUsd);
  if (!guardrailCheck.allowed) {
    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.outboundLetter,
      action: "send-letter",
      amountUsd: costUsd,
      currency: sendCurrency,
      status: "blocked",
    });

    await events.publish({
      type: "budget_blocked",
      message: guardrailCheck.reason ?? "Send letter blocked by daily budget cap",
      routeKey: ROUTE_KEYS.outboundLetter,
      requestedAmount: costUsd,
      currentSpend: guardrailCheck.currentSpendUsdc,
      cap: guardrailCheck.dailyCapUsdc,
    });

    return c.json(
      {
        error: guardrailCheck.reason,
        code: "BUDGET_BLOCKED",
        guardrail: guardrailCheck,
      },
      422,
    );
  }

  const result = await juicebag.sendLetter(db, parsed.data, sendCurrency);
  const txid = result.payment?.transaction ?? result.data.x402?.txid;
  const sendNetwork =
    result.payment?.network ??
    (sendCurrency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);

  await juicebag.syncState(db);

  if (txid) {
    await juicebag.recordPayment(db, {
      routeKey: ROUTE_KEYS.outboundLetter,
      txid,
      amountUsd: costUsd,
      network: sendNetwork,
      payTo: "",
    });

    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.outboundLetter,
      action: "send-letter",
      amountUsd: costUsd,
      currency: sendCurrency,
      txid,
      status: "settled",
    });

    void dispatchEcoContribution({
      db,
      env,
      events,
      action: "send-letter",
    }).catch(() => {});
  }

  await events.publish({
    type: "letter.sent",
    message: `Queued outbound letter ${result.data.letterId}`,
    txid,
    network: sendNetwork,
  });

  void refreshAgentBalances(env).catch(() => { });
  return c.json(await buildAgentState({ db, env }));
});

app.post("/actions/unlock-letter", async (c) => {
  console.log("[agent] POST /actions/unlock-letter");
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = agentUnlockLetterSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { currency: unlockCurrency = "usdc" } = parsed.data;
  const costUsd = unlockCurrency === "eurd" ? 0.02 : 0.2;

  // Guardrail Check
  const guardrailCheck = await checkSpendGuardrail(db, env, costUsd);
  if (!guardrailCheck.allowed) {
    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.inboundUnlock,
      action: "unlock-letter",
      amountUsd: costUsd,
      currency: unlockCurrency,
      status: "blocked",
    });

    await events.publish({
      type: "budget_blocked",
      message: guardrailCheck.reason ?? "Unlock letter blocked by daily budget cap",
      routeKey: ROUTE_KEYS.inboundUnlock,
      requestedAmount: costUsd,
      currentSpend: guardrailCheck.currentSpendUsdc,
      cap: guardrailCheck.dailyCapUsdc,
    });

    return c.json(
      {
        error: guardrailCheck.reason,
        code: "BUDGET_BLOCKED",
        guardrail: guardrailCheck,
      },
      422,
    );
  }

  const result = await juicebag.unlockLetter(db, parsed.data, unlockCurrency);
  const txid = result.payment?.transaction ?? result.data.x402?.txid;
  const unlockNetwork =
    result.payment?.network ??
    (unlockCurrency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);

  await db
    .update(inboundLetters)
    .set({
      serviceStatus: "received",
      agentStatus: "received",
      ocrText: result.data.ocrText,
      unlockPaymentTxid: txid ?? null,
    })
    .where(eq(inboundLetters.id, parsed.data.letterId));

  if (txid) {
    await juicebag.recordPayment(db, {
      routeKey: ROUTE_KEYS.inboundUnlock,
      txid,
      amountUsd: costUsd,
      network: unlockNetwork,
      payTo: "",
    });

    await recordSpendLog(db, {
      routeKey: ROUTE_KEYS.inboundUnlock,
      action: "unlock-letter",
      amountUsd: costUsd,
      currency: unlockCurrency,
      txid,
      status: "settled",
    });

    void dispatchEcoContribution({
      db,
      env,
      events,
      action: "unlock-letter",
    }).catch(() => {});
  }

  await events.publish({
    type: "letter.unlocked",
    message: `Unlocked inbound letter ${parsed.data.letterId}`,
    txid,
    network: unlockNetwork,
  });

  void refreshAgentBalances(env).catch(() => { });
  return c.json(await buildAgentState({ db, env }));
});

app.post("/actions/ignore-letter", async (c) => {
  console.log("[agent] POST /actions/ignore-letter");
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = agentIgnoreLetterSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db
    .update(inboundLetters)
    .set({
      agentStatus: "ignored",
    })
    .where(eq(inboundLetters.id, parsed.data.letterId));

  await events.publish({
    type: "letter.ignored",
    message: `Ignored inbound letter ${parsed.data.letterId}`,
  });

  void refreshAgentBalances(env).catch(() => { });
  return c.json(await buildAgentState({ db, env }));
});

app.post("/actions/evaluate-letter", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const schema = z.object({
    letterId: z.string(),
    fromName: z.string().optional(),
    envelopeSummary: z.string().optional(),
  });

  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Lookup letter if not all details provided
  let from = parsed.data.fromName ?? "";
  let summary = parsed.data.envelopeSummary ?? "";
  let pageCount = 1;

  if (!from || !summary) {
    const rows = await db
      .select()
      .from(inboundLetters)
      .where(eq(inboundLetters.id, parsed.data.letterId))
      .limit(1);
    if (rows[0]) {
      from = from || rows[0].fromName;
      summary = summary || rows[0].envelopeSummary;
      pageCount = rows[0].pageCount;
    }
  }

  const decision = await evaluateInboundLetter(
    {
      letterId: parsed.data.letterId,
      from: from || "Unknown",
      envelopeSummary: summary || "No summary",
      pageCount,
    },
    env,
  );

  await recordAutonomyDecision(db, decision, false);
  return c.json({ decision });
});

app.post("/webhooks/incoming-mail", async (c) => {
  const rawBody = await c.req.text();
  const storedRows = await db.select().from(registration).where(eq(registration.id, 1)).limit(1);
  const stored = storedRows[0];
  if (!stored) {
    return c.json({ error: "Registration not found" }, 404);
  }

  const valid = verifyWebhookSignature({
    rawBody,
    secret: stored.webhookSecret,
    signature: c.req.header("X-JBM-Signature"),
    timestamp: c.req.header("X-JBM-Timestamp"),
  });

  if (!valid) {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }

  const payload = notificationEnvelopeSchema.parse(JSON.parse(rawBody));
  const existing = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, payload.eventId))
    .limit(1);
  if (existing[0]) {
    return c.json({ ok: true });
  }

  await db.insert(webhookEvents).values({
    eventId: payload.eventId,
    payloadJson: rawBody,
    createdAt: nowIso(),
  });

  await db
    .insert(inboundLetters)
    .values({
      id: payload.letter.letterId,
      mailboxId: payload.mailboxId,
      fromName: payload.letter.from,
      receivedAt: payload.letter.receivedAt,
      pageCount: payload.letter.pageCount,
      envelopeSummary: payload.letter.envelopeSummary,
      serviceStatus: "pending",
      agentStatus: "pending",
      ocrText: null,
      unlockPaymentTxid: null,
      notifiedAt: nowIso(),
      createdAt: nowIso(),
    })
    .onConflictDoNothing();

  await events.publish({
    type: "webhook.received",
    message: `Received inbound mail notice for ${payload.letter.letterId}`,
  });

  // Evaluate Autonomous Decision
  const decision = await evaluateInboundLetter(
    {
      letterId: payload.letter.letterId,
      from: payload.letter.from,
      envelopeSummary: payload.letter.envelopeSummary,
      pageCount: payload.letter.pageCount,
    },
    env,
  );

  console.log(
    `[agent:autonomy] Letter ${payload.letter.letterId} from "${payload.letter.from}" -> Decision: ${decision.decision.toUpperCase()} (${decision.reason})`,
  );

  await events.publish({
    type: "autonomy_decision",
    message: decision.reason,
    letterId: decision.letterId,
    fromName: decision.fromName,
    decision: decision.decision,
    reason: decision.reason,
    confidence: decision.confidence,
  });

  if (env.AUTONOMOUS_UNLOCK_ENABLED) {
    if (decision.decision === "unlock") {
      const unlockCost = 0.2;
      const guardrailCheck = await checkSpendGuardrail(db, env, unlockCost);

      if (!guardrailCheck.allowed) {
        console.warn(`[agent:autonomy] Autonomous unlock blocked by guardrail: ${guardrailCheck.reason}`);
        await recordSpendLog(db, {
          routeKey: ROUTE_KEYS.inboundUnlock,
          action: "autonomous_unlock",
          amountUsd: unlockCost,
          currency: "usdc",
          status: "blocked",
        });

        await events.publish({
          type: "budget_blocked",
          message: guardrailCheck.reason ?? "Autonomous unlock blocked by daily budget cap",
          routeKey: ROUTE_KEYS.inboundUnlock,
          requestedAmount: unlockCost,
          currentSpend: guardrailCheck.currentSpendUsdc,
          cap: guardrailCheck.dailyCapUsdc,
        });

        await recordAutonomyDecision(db, decision, false);
      } else {
        console.log(`[agent:autonomy] Executing autonomous unlock for letter ${payload.letter.letterId}...`);
        try {
          const unlockResult = await juicebag.unlockLetter(
            db,
            { letterId: payload.letter.letterId, currency: "usdc" },
            "usdc",
          );
          const txid = unlockResult.payment?.transaction ?? unlockResult.data.x402?.txid;

          await db
            .update(inboundLetters)
            .set({
              serviceStatus: "received",
              agentStatus: "received",
              ocrText: unlockResult.data.ocrText,
              unlockPaymentTxid: txid ?? null,
            })
            .where(eq(inboundLetters.id, payload.letter.letterId));

          if (txid) {
            await juicebag.recordPayment(db, {
              routeKey: ROUTE_KEYS.inboundUnlock,
              txid,
              amountUsd: unlockCost,
              network: ALGORAND_TESTNET_CAIP2,
              payTo: "",
            });

            await recordSpendLog(db, {
              routeKey: ROUTE_KEYS.inboundUnlock,
              action: "autonomous_unlock",
              amountUsd: unlockCost,
              currency: "usdc",
              txid,
              status: "settled",
            });
          }

          await events.publish({
            type: "letter.unlocked",
            message: `[Autonomous Action] Unlocked inbound letter ${payload.letter.letterId}`,
            txid,
            network: ALGORAND_TESTNET_CAIP2,
          });

          await recordAutonomyDecision(db, decision, true);
          void refreshAgentBalances(env).catch(() => { });
        } catch (err) {
          console.error(`[agent:autonomy] Autonomous unlock failed for letter ${payload.letter.letterId}:`, err);
          await recordAutonomyDecision(db, decision, false);
        }
      }
    } else if (decision.decision === "ignore") {
      console.log(`[agent:autonomy] Executing autonomous ignore for promotional letter ${payload.letter.letterId}`);
      await db
        .update(inboundLetters)
        .set({ agentStatus: "ignored" })
        .where(eq(inboundLetters.id, payload.letter.letterId));

      await events.publish({
        type: "letter.ignored",
        message: `[Autonomous Action] Ignored letter ${payload.letter.letterId} (${decision.reason})`,
      });

      await recordAutonomyDecision(db, decision, true);
    } else {
      await recordAutonomyDecision(db, decision, false);
    }
  } else {
    await recordAutonomyDecision(db, decision, false);
  }

  return c.json({ ok: true, decision });
});

app.get("/events", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const recent = (await events.recent(10)).reverse();
      for (const event of recent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      const unsubscribe = events.subscribe((event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      const abortHandler = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      c.req.raw.signal.addEventListener("abort", abortHandler, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ─── Non-custodial Wallet Session Routes ──────────────────────────────

app.post("/wallet/session", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  const schema = z.object({ address: z.string().min(1) });
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  walletApprovals.connect(parsed.data.address);
  console.log(`[agent:wallet] Pera Wallet connected: ${parsed.data.address}`);
  void refreshAgentBalances(env, parsed.data.address).catch(() => {});
  return c.json({ address: parsed.data.address });
});

app.delete("/wallet/session", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  walletApprovals.disconnect();
  console.log("[agent:wallet] Pera Wallet disconnected");
  return c.json({ ok: true });
});

app.get("/wallet/session", (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  return c.json(walletApprovals.status());
});

app.get("/wallet/signature-requests", (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  return c.json({ requests: walletApprovals.pendingRequests() });
});

app.post("/wallet/signature-requests/:id/approve", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  const id = c.req.param("id");
  const schema = z.object({
    signedTransactionsBase64: z.array(z.string()),
  });
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await walletApprovals.approve(id, parsed.data.signedTransactionsBase64);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

app.post("/wallet/signature-requests/:id/reject", async (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  const id = c.req.param("id");
  const schema = z.object({
    reason: z.string().optional(),
  });
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  walletApprovals.reject(id, parsed.success ? parsed.data.reason : undefined);
  return c.json({ ok: true });
});

// ─── Agent Chat SSE Streaming ──────────────────────────────────────────

app.post("/actions/agent-chat", async (c) => {
  console.log("[agent] POST /actions/agent-chat");
  const unauthorized = requireUiToken(c);
  if (unauthorized) return unauthorized;

  const schema = z.object({
    taskDescription: z.string().min(1).max(4000),
    currency: z.enum(["usdc", "eurd"]).default("usdc"),
  });
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (!env.GROQ_API_KEY) {
    return c.json({ error: "GROQ_API_KEY not configured on the server" }, 503);
  }

  const { runAgentBrain } = await import("./lib/agent-brain.js");
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(eventType: string, data: unknown) {
        const line = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      send("started", { message: "Agent brain started", taskDescription: parsed.data.taskDescription });

      try {
        const result = await runAgentBrain(
          { taskDescription: parsed.data.taskDescription },
          env,
          db,
        );
        for (const step of result.steps) {
          send("step_completed", step);
        }
        send("done", {
          finalAnswer: result.finalAnswer,
          totalCostUsd: result.totalCostUsd,
          allTxids: result.allTxids,
          stepCount: result.steps.length,
        });
      } catch (err) {
        console.error("[agent-chat] Error:", err);
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

serve(
  {
    fetch: app.fetch,
    port: env.AGENT_PORT,
  },
  () => {
    console.log(`Agent API listening on port ${env.AGENT_PORT}`);
    console.log(`[agent] Connected to Service Hub at: ${env.SERVICE_BASE_URL}`);
  },
);
