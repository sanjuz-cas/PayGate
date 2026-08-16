import "dotenv/config";

import { and, desc, eq } from "drizzle-orm";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { type Context, Hono } from "hono";
import { ALGORAND_TESTNET_CAIP2 } from "@x402-avm/avm";

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

const env = loadAgentEnv(process.env);
const { db } = createAgentDb(env.AGENT_DB_PATH);
const events = createEventBus(db);
const juicebag = createJuicebagClient(env);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Authorization", "Content-Type"],
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

  void refreshAgentBalances(env).catch(() => {});
  await juicebag.syncState(db).catch(() => {});
  return c.json(await buildAgentState({ db, env }));
});

app.get("/balances", (c) => {
  const unauthorized = requireUiToken(c);
  if (unauthorized) {
    return unauthorized;
  }

  void refreshAgentBalances(env).catch(() => {});
  return c.json(getCachedAgentBalances(env));
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
  const result = await juicebag.register(db, parsed.data, currency);
  const txid = result.payment?.transaction ?? result.registration.x402?.txid;
  const network = result.payment?.network ?? (currency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);
  if (txid) {
    await juicebag.recordPayment(db, {
      routeKey: ROUTE_KEYS.registration,
      txid,
      amountUsd: currency === "eurd" ? 0.05 : 1,
      network,
      payTo: "",
    });
  }

  await events.publish({
    type: "registration.completed",
    message: `Registered mailbox ${result.registration.mailboxId}`,
    txid,
    network,
  });

  void refreshAgentBalances(env).catch(() => {});
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
  const result = await juicebag.sendLetter(db, parsed.data, sendCurrency);
  const txid = result.payment?.transaction ?? result.data.x402?.txid;
  const sendNetwork = result.payment?.network ?? (sendCurrency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);

  await juicebag.syncState(db);

  if (txid) {
    await juicebag.recordPayment(db, {
      routeKey: ROUTE_KEYS.outboundLetter,
      txid,
      amountUsd: sendCurrency === "eurd" ? 0.01 : 0.05,
      network: sendNetwork,
      payTo: "",
    });
  }

  await events.publish({
    type: "letter.sent",
    message: `Queued outbound letter ${result.data.letterId}`,
    txid,
    network: sendNetwork,
  });

  void refreshAgentBalances(env).catch(() => {});
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
  const result = await juicebag.unlockLetter(db, parsed.data, unlockCurrency);
  const txid = result.payment?.transaction ?? result.data.x402?.txid;
  const unlockNetwork = result.payment?.network ?? (unlockCurrency === "eurd" ? ALGORAND_MAINNET_QUANTOZ : ALGORAND_TESTNET_CAIP2);

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
      amountUsd: unlockCurrency === "eurd" ? 0.02 : 0.2,
      network: unlockNetwork,
      payTo: "",
    });
  }

  await events.publish({
    type: "letter.unlocked",
    message: `Unlocked inbound letter ${parsed.data.letterId}`,
    txid,
    network: unlockNetwork,
  });

  void refreshAgentBalances(env).catch(() => {});
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

  void refreshAgentBalances(env).catch(() => {});
  return c.json(await buildAgentState({ db, env }));
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

  return c.json({ ok: true });
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

serve(
  {
    fetch: app.fetch,
    port: env.AGENT_PORT,
  },
  () => {
    console.log(`Agent API listening on ${env.AGENT_BASE_URL}`);
  },
);
