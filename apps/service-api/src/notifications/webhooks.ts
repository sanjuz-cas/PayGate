import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";

import { notificationEvents, webhookDeliveries } from "../db/schema.js";
import { createId, nowIso } from "../lib/ids.js";
import type { ServiceDatabase } from "../db/index.js";
import type { ServiceEnv } from "../lib/env.js";
import type { InboundLetterReceivedEvent } from "@juicebag-mail/shared";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function signWebhook(secret: string, timestamp: string, rawBody: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export async function deliverWebhookEvent(input: {
  agentId: string;
  db: ServiceDatabase;
  event: InboundLetterReceivedEvent;
  secret: string;
  targetUrl: string;
  env: ServiceEnv;
}) {
  void input.env;

  const rawBody = JSON.stringify(input.event);
  const timestamp = String(Date.now());
  const signature = signWebhook(input.secret, timestamp, rawBody);

  let lastStatus = "failed";
  let attemptCount = 0;

  for (const delayMs of [0, 500, 1500]) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    attemptCount += 1;

    try {
      const response = await fetch(input.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-JBM-Timestamp": timestamp,
          "X-JBM-Signature": signature,
        },
        body: rawBody,
      });

      lastStatus = response.ok ? "delivered" : "failed";

      await input.db.insert(webhookDeliveries).values({
        id: createId("whd"),
        eventId: input.event.eventId,
        agentId: input.agentId,
        targetUrl: input.targetUrl,
        status: lastStatus,
        attemptCount,
        lastAttemptAt: nowIso(),
        createdAt: nowIso(),
      });

      if (response.ok) {
        await input.db
          .update(notificationEvents)
          .set({ delivered: true })
          .where(
            and(
              eq(notificationEvents.eventId, input.event.eventId),
              eq(notificationEvents.agentId, input.agentId),
            ),
          );

        return {
          attemptCount,
          status: lastStatus,
        };
      }
    } catch {
      await input.db.insert(webhookDeliveries).values({
        id: createId("whd"),
        eventId: input.event.eventId,
        agentId: input.agentId,
        targetUrl: input.targetUrl,
        status: "failed",
        attemptCount,
        lastAttemptAt: nowIso(),
        createdAt: nowIso(),
      });
    }
  }

  return {
    attemptCount,
    status: lastStatus,
  };
}
