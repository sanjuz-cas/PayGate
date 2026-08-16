import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { Context, Hono } from "hono";

import {
  inboundLetterReceivedEventType,
  inboundLetterUnlockSchema,
  internalInboundLetterCreateSchema,
  internalInboundLetterScanExtractResponseSchema,
  outboundLetterCreateSchema,
  registrationRequestSchema,
  ROUTE_KEYS,
  notificationEnvelopeSchema,
} from "@juicebag-mail/shared";
import type {
  Address,
  InboundLetterReceivedEvent,
  ServiceState,
} from "@juicebag-mail/shared";

import type { ServiceDatabase } from "../db/index.js";
import {
  agents,
  inboundLetters,
  mailboxes,
  notificationEvents,
  outboundLetters,
  payments,
  webhookDeliveries,
} from "../db/schema.js";
import { authenticateAgent, getBearerToken } from "../lib/auth.js";
import { getCachedServiceBalances, refreshServiceBalances } from "../lib/balances.js";
import { decryptString, encryptString, hashToken } from "../lib/crypto.js";
import type { ServiceEnv } from "../lib/env.js";
import { createId, nowIso } from "../lib/ids.js";
import { extractInboundLetterFromScan } from "../lib/inbound-scan-ocr.js";
import { parseJsonSafe } from "../lib/json.js";
import { renderOutboundLetterPdf } from "../pdf/outbound-letter-pdf.js";
import { deliverWebhookEvent } from "../notifications/webhooks.js";
import type {
  PaymentFinalizeResult,
  PaymentOptions,
  ServiceVariables,
} from "../lib/x402.js";

type ServiceApp = Hono<{ Variables: ServiceVariables }>;
type ServiceContext = Context<{ Variables: ServiceVariables }>;
type ServiceStateWithPaymentOptions = ServiceState & {
  paymentOptions: PaymentOptions;
};

function requireAdmin(c: ServiceContext, env: ServiceEnv) {
  const token = getBearerToken(c.req.header("Authorization"));
  if (!token || token !== env.VITE_ADMIN_UI_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return null;
}

async function requireAgent(
  c: ServiceContext,
  db: ServiceDatabase,
) {
  const token = getBearerToken(c.req.header("Authorization"));
  const agent = await authenticateAgent(db, token);
  if (!agent) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return agent;
}

function mapInboundLetter(row: typeof inboundLetters.$inferSelect) {
  return {
    id: row.id,
    mailboxId: row.mailboxId,
    fromName: row.fromName,
    receivedAt: row.receivedAt,
    pageCount: row.pageCount,
    envelopeSummary: row.envelopeSummary,
    ocrText: row.ocrText,
    status: row.status as "pending" | "received",
    unlockPaymentTxid: row.unlockPaymentTxid,
    createdAt: row.createdAt,
  };
}

function mapOutboundLetter(row: typeof outboundLetters.$inferSelect) {
  return {
    id: row.id,
    mailboxId: row.mailboxId,
    recipient: parseJsonSafe<Address>(row.recipientJson),
    subject: row.subject,
    bodyMarkdown: row.bodyMarkdown,
    status: row.status as "queued" | "sent",
    paymentTxid: row.paymentTxid,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

function inferImageExtension(file: File) {
  if (file.type === "image/png") {
    return ".png";
  }

  if (file.type === "image/jpeg") {
    return path.extname(file.name).toLowerCase() === ".jpeg" ? ".jpeg" : ".jpg";
  }

  return "";
}

function isSupportedScanImage(file: File) {
  return file.type === "image/png" || file.type === "image/jpeg";
}

async function createInboundLetterRecord({
  agent,
  db,
  env,
  input,
}: {
  agent: typeof agents.$inferSelect;
  db: ServiceDatabase;
  env: ServiceEnv;
  input: {
    envelopeSummary: string;
    fromName: string;
    letterId: string;
    mailboxId: string;
    ocrText: string;
    pageCount: number;
    pdfPath: string;
    receivedAt?: string;
  };
}) {
  const createdAt = nowIso();
  const receivedAt = input.receivedAt ?? createdAt;

  await db.insert(inboundLetters).values({
    id: input.letterId,
    mailboxId: input.mailboxId,
    fromName: input.fromName,
    receivedAt,
    pageCount: input.pageCount,
    envelopeSummary: input.envelopeSummary,
    pdfPath: input.pdfPath,
    ocrText: input.ocrText,
    status: "pending",
    unlockPaymentTxid: null,
    createdAt,
  });

  const event: InboundLetterReceivedEvent = notificationEnvelopeSchema.parse({
    eventId: createId("evt"),
    type: inboundLetterReceivedEventType,
    agentId: agent.id,
    mailboxId: input.mailboxId,
    letter: {
      letterId: input.letterId,
      from: input.fromName,
      receivedAt,
      pageCount: input.pageCount,
      envelopeSummary: input.envelopeSummary,
    },
  });

  await db.insert(notificationEvents).values({
    id: createId("nev"),
    eventId: event.eventId,
    agentId: agent.id,
    mailboxId: input.mailboxId,
    letterId: input.letterId,
    type: inboundLetterReceivedEventType,
    payloadJson: JSON.stringify(event),
    delivered: false,
    createdAt,
  });

  const webhookSecret = decryptString(
    agent.webhookSecretEncrypted,
    env.WEBHOOK_SECRET_MASTER_KEY,
  );

  const delivery = await deliverWebhookEvent({
    agentId: agent.id,
    db,
    event,
    secret: webhookSecret,
    targetUrl: agent.webhookUrl,
    env,
  });

  return {
    delivery,
    letterId: input.letterId,
  };
}

async function buildServiceState(
  db: ServiceDatabase,
  paymentOptions: PaymentOptions,
): Promise<ServiceStateWithPaymentOptions> {
  const [
    agentRows,
    inboundRows,
    outboundRows,
    paymentRows,
    webhookRows,
  ] = await Promise.all([
    db.select().from(agents).orderBy(desc(agents.createdAt)),
    db.select().from(inboundLetters).orderBy(desc(inboundLetters.createdAt)),
    db.select().from(outboundLetters).orderBy(desc(outboundLetters.createdAt)),
    db.select().from(payments).orderBy(desc(payments.createdAt)).limit(20),
    db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(20),
  ]);

  const lastPayment = paymentRows[0];
  const lastWebhook = webhookRows[0];

  return {
    paymentOptions,
    counters: {
      registeredAgents: agentRows.length,
      pendingInboundLetters: inboundRows.filter((row) => row.status === "pending").length,
      queuedOutboundLetters: outboundRows.filter((row) => row.status === "queued").length,
    },
    agents: agentRows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      mailboxId: row.mailboxId,
      webhookUrl: row.webhookUrl,
      createdAt: row.createdAt,
    })),
    inboundLetters: inboundRows.map(mapInboundLetter),
    outboundLetters: outboundRows.map(mapOutboundLetter),
    recentPayments: paymentRows.map((row) => ({
      id: row.id,
      routeKey: row.routeKey,
      txid: row.txid,
      amountUsd: Number(row.amountUsd),
      network: row.network,
      payTo: row.payTo,
      status: row.status,
      createdAt: row.createdAt,
    })),
    recentWebhookDeliveries: webhookRows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      agentId: row.agentId,
      targetUrl: row.targetUrl,
      status: row.status as "pending" | "delivered" | "failed",
      attemptCount: row.attemptCount,
      lastAttemptAt: row.lastAttemptAt,
    })),
    lastEvent: lastPayment
      ? {
          message: `Settled ${lastPayment.routeKey} payment`,
          txid: lastPayment.txid,
          network: lastPayment.network,
          createdAt: lastPayment.createdAt,
        }
      : lastWebhook
        ? {
            message: `Webhook ${lastWebhook.status} for ${lastWebhook.eventId}`,
            createdAt: lastWebhook.createdAt,
          }
        : null,
  };
}

export function registerPublicRoutes(
  app: ServiceApp,
  db: ServiceDatabase,
  env: ServiceEnv,
  paymentOptions: PaymentOptions,
) {
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/v1/inbound-letters", async (c) => {
    const agent = await requireAgent(c, db);
    if (agent instanceof Response) {
      return agent;
    }

    const rows = await db
      .select()
      .from(inboundLetters)
      .where(eq(inboundLetters.mailboxId, agent.mailboxId))
      .orderBy(desc(inboundLetters.createdAt));

    return c.json(rows.map(mapInboundLetter));
  });

  app.get("/v1/outbound-letters", async (c) => {
    const agent = await requireAgent(c, db);
    if (agent instanceof Response) {
      return agent;
    }

    const rows = await db
      .select()
      .from(outboundLetters)
      .where(eq(outboundLetters.mailboxId, agent.mailboxId))
      .orderBy(desc(outboundLetters.createdAt));

    return c.json(rows.map(mapOutboundLetter));
  });

  app.get("/v1/notifications", async (c) => {
    const agent = await requireAgent(c, db);
    if (agent instanceof Response) {
      return agent;
    }

    const cursor = c.req.query("cursor");
    const rows = await db
      .select()
      .from(notificationEvents)
      .where(
        cursor
          ? and(
              eq(notificationEvents.agentId, agent.id),
              gt(notificationEvents.createdAt, cursor),
            )
          : eq(notificationEvents.agentId, agent.id),
      )
      .orderBy(asc(notificationEvents.createdAt))
      .limit(50);

    const notifications = rows.map((row) => parseJsonSafe<InboundLetterReceivedEvent>(row.payloadJson));

    return c.json({
      notifications,
      nextCursor: rows.at(-1)?.createdAt ?? null,
    });
  });

  app.post("/v1/registrations", async (c) => {
    console.log("[service] POST /v1/registrations");
    const parsed = registrationRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    c.set("paymentMeta", {
      routeKey: ROUTE_KEYS.registration,
      amountUsd: 1,
    });

    c.set("paymentFinalize", async (txid): Promise<PaymentFinalizeResult> => {
      const mailboxId = createId("mbx");
      const agentId = createId("agt");
      const agentAuthToken = `jbm_${crypto.randomBytes(18).toString("hex")}`;
      const webhookSecret = `jbm_whsec_${crypto.randomBytes(18).toString("hex")}`;
      const createdAt = nowIso();

      await db.insert(mailboxes).values({
        id: mailboxId,
        entityType: parsed.data.entityType,
        legalName: parsed.data.legalIdentity.name,
        street1: parsed.data.legalIdentity.street1,
        street2: parsed.data.legalIdentity.street2 ?? null,
        postalCode: parsed.data.legalIdentity.postalCode,
        city: parsed.data.legalIdentity.city,
        country: parsed.data.legalIdentity.country,
        status: "registered",
        createdAt,
      });

      await db.insert(agents).values({
        id: agentId,
        displayName: parsed.data.agentName,
        mailboxId,
        authTokenHash: hashToken(agentAuthToken),
        webhookUrl: parsed.data.webhook.url,
        webhookSecretEncrypted: encryptString(
          webhookSecret,
          env.WEBHOOK_SECRET_MASTER_KEY,
        ),
        walletLabel: parsed.data.agentName,
        createdAt,
      });

      return {
        body: {
          agentId,
          mailboxId,
          agentAuthToken,
          webhook: {
            secret: webhookSecret,
          },
          status: "registered",
        },
        paymentMeta: {
          agentId,
          mailboxId,
        },
      };
    });

    return c.json({ ok: true }, 201);
  });

  app.post("/v1/outbound-letters", async (c) => {
    console.log("[service] POST /v1/outbound-letters");
    const agent = await requireAgent(c, db);
    if (agent instanceof Response) {
      return agent;
    }

    const parsed = outboundLetterCreateSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    if (parsed.data.mailboxId !== agent.mailboxId) {
      return c.json({ error: "Mailbox does not belong to authenticated agent" }, 403);
    }

    const mailboxRows = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.id, agent.mailboxId))
      .limit(1);
    const mailbox = mailboxRows[0];
    if (!mailbox) {
      return c.json({ error: "Mailbox not found" }, 404);
    }

    c.set("paymentMeta", {
      routeKey: ROUTE_KEYS.outboundLetter,
      amountUsd: 0.05,
      agentId: agent.id,
      mailboxId: agent.mailboxId,
    });

    c.set("paymentFinalize", async (txid): Promise<PaymentFinalizeResult> => {
      const letterId = createId("out");
      const createdAt = nowIso();
      const letterDir = path.join(env.STORAGE_DIR, "outbound", agent.mailboxId, letterId);
      const pdfPath = path.join(letterDir, "letter.pdf");

      fs.mkdirSync(letterDir, { recursive: true });
      const pdfBuffer = await renderOutboundLetterPdf({
        mailboxName: mailbox.legalName,
        recipient: parsed.data.recipient,
        subject: parsed.data.subject,
        bodyMarkdown: parsed.data.bodyMarkdown,
        createdAt,
      });
      fs.writeFileSync(pdfPath, pdfBuffer);

      await db.insert(outboundLetters).values({
        id: letterId,
        mailboxId: agent.mailboxId,
        recipientJson: JSON.stringify(parsed.data.recipient),
        subject: parsed.data.subject,
        bodyMarkdown: parsed.data.bodyMarkdown,
        pdfPath,
        status: "queued",
        paymentTxid: txid,
        createdAt,
        sentAt: null,
      });

      return {
        body: {
          letterId,
          status: "queued",
        },
      };
    });

    return c.json({ ok: true }, 201);
  });

  app.post("/v1/inbound-letters/unlock", async (c) => {
    console.log("[service] POST /v1/inbound-letters/unlock");
    const agent = await requireAgent(c, db);
    if (agent instanceof Response) {
      return agent;
    }

    const parsed = inboundLetterUnlockSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    if (parsed.data.mailboxId !== agent.mailboxId) {
      return c.json({ error: "Mailbox does not belong to authenticated agent" }, 403);
    }

    const rows = await db
      .select()
      .from(inboundLetters)
      .where(
        and(
          eq(inboundLetters.id, parsed.data.letterId),
          eq(inboundLetters.mailboxId, agent.mailboxId),
        ),
      )
      .limit(1);
    const letter = rows[0];

    if (!letter) {
      return c.json({ error: "Inbound letter not found" }, 404);
    }

    if (letter.unlockPaymentTxid) {
      return c.json({ error: "Inbound letter already unlocked" }, 409);
    }

    c.set("paymentMeta", {
      routeKey: ROUTE_KEYS.inboundUnlock,
      amountUsd: 0.2,
      agentId: agent.id,
      mailboxId: agent.mailboxId,
    });

    c.set("paymentFinalize", async (txid): Promise<PaymentFinalizeResult> => {
      await db
        .update(inboundLetters)
        .set({
          status: "received",
          unlockPaymentTxid: txid,
        })
        .where(eq(inboundLetters.id, letter.id));

      return {
        body: {
          letterId: letter.id,
          status: "unlocked",
          from: letter.fromName,
          receivedAt: letter.receivedAt,
          ocrText: letter.ocrText,
        },
      };
    });

    return c.json({ ok: true }, 200);
  });

  app.get("/internal/balances", (c) => {
    const unauthorized = requireAdmin(c, env);
    if (unauthorized) {
      return unauthorized;
    }

    void refreshServiceBalances(env).catch(() => {});
    return c.json(getCachedServiceBalances(env));
  });

  app.get("/internal/state", async (c) => {
    const unauthorized = requireAdmin(c, env);
    if (unauthorized) {
      return unauthorized;
    }

    return c.json(await buildServiceState(db, paymentOptions));
  });

  app.post("/internal/inbound-letters/scan-extract", async (c) => {
    const unauthorized = requireAdmin(c, env);
    if (unauthorized) {
      return unauthorized;
    }

    const body = await c.req.parseBody();
    const mailboxId = body.mailboxId;
    const scan = body.scan;

    if (typeof mailboxId !== "string" || mailboxId.length === 0) {
      return c.json({ error: "Mailbox Id is required" }, 400);
    }

    if (!(scan instanceof File)) {
      return c.json({ error: "Scan image is required" }, 400);
    }

    if (!isSupportedScanImage(scan)) {
      return c.json({ error: "Only PNG and JPEG scans are supported" }, 400);
    }

    if (scan.size > 10 * 1024 * 1024) {
      return c.json({ error: "Scan image must be 10 MB or smaller" }, 413);
    }

    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.mailboxId, mailboxId))
      .limit(1);
    const agent = agentRows[0];
    if (!agent) {
      return c.json({ error: "No registered agent for mailbox" }, 404);
    }

    const scanDraftId = createId("in");
    const extension = inferImageExtension(scan);
    if (!extension) {
      return c.json({ error: "Unsupported scan image type" }, 400);
    }

    const scanFileName = `scan${extension}`;
    const letterDir = path.join(env.STORAGE_DIR, "inbound", mailboxId, scanDraftId);
    const scanPath = path.join(letterDir, scanFileName);

    fs.mkdirSync(letterDir, { recursive: true });
    fs.writeFileSync(scanPath, Buffer.from(await scan.arrayBuffer()));

    const extracted = await extractInboundLetterFromScan(scanPath, env);

    return c.json(
      internalInboundLetterScanExtractResponseSchema.parse({
        scanDraftId,
        scanFileName,
        pageCount: 1,
        ...extracted,
      }),
      201,
    );
  });

  app.post("/internal/inbound-letters", async (c) => {
    const unauthorized = requireAdmin(c, env);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = internalInboundLetterCreateSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.mailboxId, parsed.data.mailboxId))
      .limit(1);
    const agent = agentRows[0];
    if (!agent) {
      return c.json({ error: "No registered agent for mailbox" }, 404);
    }

    const letterId = parsed.data.scanDraftId ?? createId("in");
    const scanFileName = parsed.data.scanFileName ?? "scan.pdf";
    const letterDir = path.join(env.STORAGE_DIR, "inbound", parsed.data.mailboxId, letterId);
    const pdfPath = path.join(letterDir, scanFileName);

    if (parsed.data.scanDraftId) {
      if (!fs.existsSync(pdfPath)) {
        return c.json({ error: "Uploaded scan draft was not found" }, 404);
      }
    } else {
      fs.mkdirSync(letterDir, { recursive: true });
    }

    const result = await createInboundLetterRecord({
      agent,
      db,
      env,
      input: {
        envelopeSummary: parsed.data.envelopeSummary,
        fromName: parsed.data.fromName,
        letterId,
        mailboxId: parsed.data.mailboxId,
        ocrText: parsed.data.ocrText,
        pageCount: parsed.data.pageCount,
        pdfPath,
        receivedAt: parsed.data.receivedAt,
      },
    });

    return c.json(result, 201);
  });

  app.post("/internal/outbound-letters/:id/mark-sent", async (c) => {
    const unauthorized = requireAdmin(c, env);
    if (unauthorized) {
      return unauthorized;
    }

    const letterId = c.req.param("id");
    await db
      .update(outboundLetters)
      .set({
        status: "sent",
        sentAt: nowIso(),
      })
      .where(eq(outboundLetters.id, letterId));

    return c.json({ ok: true });
  });
}
