import { desc, eq } from "drizzle-orm";

import { agentStateSchema } from "@juicebag-mail/shared";
import type { Address, AgentState } from "@juicebag-mail/shared";

import type { AgentDatabase } from "../db/index.js";
import {
  events,
  inboundLetters,
  outboundLetters,
  payments,
  registration,
} from "../db/schema.js";
import type { AgentEnv } from "./env.js";
import { getCachedAgentBalances } from "./balances.js";

export function parseLegalIdentity(value: string) {
  return JSON.parse(value) as Address;
}

export async function buildAgentState(input: {
  db: AgentDatabase;
  env: AgentEnv;
}): Promise<AgentState> {
  const [regRows, inboundRows, outboundRows, paymentRows, eventRows] = await Promise.all([
    input.db.select().from(registration).where(eq(registration.id, 1)).limit(1),
    input.db.select().from(inboundLetters).orderBy(desc(inboundLetters.createdAt)),
    input.db.select().from(outboundLetters).orderBy(desc(outboundLetters.createdAt)),
    input.db.select().from(payments).orderBy(desc(payments.createdAt)).limit(20),
    input.db.select().from(events).orderBy(desc(events.createdAt)).limit(1),
  ]);

  const reg = regRows[0] ?? null;
  const balances = getCachedAgentBalances(input.env);
  const lastEvent = eventRows[0] ?? null;

  return agentStateSchema.parse({
    registration: reg
      ? {
          agentId: reg.agentId,
          mailboxId: reg.mailboxId,
          agentName: reg.agentName,
          entityType: reg.entityType,
          legalIdentity: parseLegalIdentity(reg.legalIdentityJson),
          webhookUrl: reg.webhookUrl,
          registeredAt: reg.registeredAt,
        }
      : null,
    balances: {
      algo: balances.algo,
      usdc: balances.usdc,
      eurd: balances.eurd,
      address: balances.address,
    },
    inboundLetters: inboundRows.map((row) => ({
      id: row.id,
      mailboxId: row.mailboxId,
      fromName: row.fromName,
      receivedAt: row.receivedAt,
      pageCount: row.pageCount,
      envelopeSummary: row.envelopeSummary,
      status: row.serviceStatus,
      unlockPaymentTxid: row.unlockPaymentTxid,
      createdAt: row.createdAt,
      agentStatus: row.agentStatus,
      ocrText: row.ocrText,
      notifiedAt: row.notifiedAt,
    })),
    outboundLetters: outboundRows.map((row) => ({
      id: row.id,
      mailboxId: row.mailboxId,
      recipient: JSON.parse(row.recipientJson),
      subject: row.subject,
      bodyMarkdown: row.bodyMarkdown,
      status: row.status,
      paymentTxid: row.paymentTxid,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    })),
    recentPayments: paymentRows.map((row) => ({
      id: row.id,
      routeKey: row.routeKey,
      txid: row.txid,
      amountUsd: Number(row.amountUsd),
      network: row.network,
      payTo: row.payTo,
      status: "settled",
      createdAt: row.createdAt,
    })),
    lastEvent: lastEvent
      ? {
          type: lastEvent.type,
          message: lastEvent.message,
          txid: lastEvent.txid ?? undefined,
          network: lastEvent.network ?? undefined,
          createdAt: lastEvent.createdAt,
        }
      : null,
  });
}
