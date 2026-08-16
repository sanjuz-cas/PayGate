import { and, desc, eq } from "drizzle-orm";
import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from "@x402-avm/fetch";
import {
  ALGORAND_TESTNET_CAIP2,
  toClientAvmSigner,
} from "@x402-avm/avm";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";

import {
  ALGORAND_MAINNET_QUANTOZ,
  paymentRecordSchema,
  registrationRequestSchema,
  registrationResponseSchema,
} from "@juicebag-mail/shared";
import type {
  AgentRegistrationInput,
  AgentSendLetterInput,
  AgentUnlockLetterInput,
  InboundLetterMetadata,
  OutboundLetterMetadata,
  RegistrationResponse,
} from "@juicebag-mail/shared";

import type { AgentDatabase } from "../db/index.js";
import {
  inboundLetters,
  outboundLetters,
  payments,
  registration,
} from "../db/schema.js";
import type { AgentEnv } from "./env.js";
import { createId, nowIso } from "./ids.js";
import { mnemonicToPrivateKeyBase64 } from "./wallet.js";

type PaidFetchResult<T> = {
  data: T;
  payment?: ReturnType<typeof decodePaymentResponseHeader>;
};

async function parseResponse<T>(response: Response): Promise<PaidFetchResult<T>> {
  const body = (await response.json()) as T;
  const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
  return {
    data: body,
    payment: paymentHeader ? decodePaymentResponseHeader(paymentHeader) : undefined,
  };
}

export function createJuicebagClient(env: AgentEnv) {
  const signer = toClientAvmSigner(mnemonicToPrivateKeyBase64(env.mnemonic));

  const usdcClient = new x402Client();
  registerExactAvmScheme(usdcClient, {
    signer,
    algodConfig: { algodUrl: env.ALGOD_URL },
    networks: [ALGORAND_TESTNET_CAIP2],
  });
  const usdcPaidFetch = wrapFetchWithPayment(fetch, usdcClient);

  // x402-avm uses `suggestedParams.fee ?? minFee` which keeps 0 (algod returns fee=0 at min load).
  // Wrap the algod client to always return fee=minFee so the transaction isn't built with 0 fees.
  const eurdAlgodClient = {
    suggestedParams: async () => {
      const res = await fetch(`${env.ALGOD_MAINNET_URL}/v2/transactions/params`);
      const data = await res.json() as {
        fee: number;
        "min-fee": number;
        "last-round": number;
        "genesis-hash": string;
        "genesis-id": string;
      };
      const minFee = BigInt(data["min-fee"] ?? 1000);
      return {
        fee: minFee,
        minFee,
        firstValid: BigInt(data["last-round"]),
        lastValid: BigInt(data["last-round"]) + BigInt(1000),
        genesisHash: new Uint8Array(Buffer.from(data["genesis-hash"], "base64")),
        genesisId: data["genesis-id"],
      };
    },
  };

  const eurdClient = new x402Client();
  registerExactAvmScheme(eurdClient, {
    signer,
    algodConfig: { algodClient: eurdAlgodClient },
    networks: [ALGORAND_MAINNET_QUANTOZ],
  });
  const eurdPaidFetch = wrapFetchWithPayment(fetch, eurdClient);

  function paidFetch(currency: "usdc" | "eurd") {
    return currency === "eurd" ? eurdPaidFetch : usdcPaidFetch;
  }

  async function getRegistration(db: AgentDatabase) {
    const rows = await db.select().from(registration).where(eq(registration.id, 1)).limit(1);
    return rows[0] ?? null;
  }

  async function authHeaders(db: AgentDatabase) {
    const stored = await getRegistration(db);
    if (!stored) {
      throw new Error("Agent is not registered yet");
    }

    return {
      Authorization: `Bearer ${stored.agentAuthToken}`,
    };
  }

  return {
    async register(db: AgentDatabase, input: AgentRegistrationInput, currency: "usdc" | "eurd" = "usdc") {
      const payload = registrationRequestSchema.parse({
        ...input,
        webhook: {
          url: `${env.AGENT_BASE_URL}/webhooks/incoming-mail`,
        },
      });

      console.log(`[agent→service] POST ${env.SERVICE_BASE_URL}/v1/registrations (x402 — will probe then pay)`);
      let response: Response;
      try {
        response = await paidFetch(currency)(`${env.SERVICE_BASE_URL}/v1/registrations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("[agent→service] registration paidFetch threw:", err);
        throw err;
      }

      console.log(`[agent→service] registration response: status=${response.status}`);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[agent→service] registration failed: ${body}`);
        throw new Error(`Registration failed with status ${response.status}`);
      }

      const { data, payment } = await parseResponse<RegistrationResponse>(response);
      if (payment?.transaction) {
        console.log(`[agent→service] x402 registration settled: txid=${payment.transaction}`);
      }
      const parsed = registrationResponseSchema.parse(data);

      await db
        .insert(registration)
        .values({
          id: 1,
          agentId: parsed.agentId,
          mailboxId: parsed.mailboxId,
          agentAuthToken: parsed.agentAuthToken,
          webhookSecret: parsed.webhook.secret,
          agentName: input.agentName,
          entityType: input.entityType,
          legalIdentityJson: JSON.stringify(input.legalIdentity),
          webhookUrl: `${env.AGENT_BASE_URL}/webhooks/incoming-mail`,
          registeredAt: nowIso(),
        })
        .onConflictDoUpdate({
          target: registration.id,
          set: {
            agentId: parsed.agentId,
            mailboxId: parsed.mailboxId,
            agentAuthToken: parsed.agentAuthToken,
            webhookSecret: parsed.webhook.secret,
            agentName: input.agentName,
            entityType: input.entityType,
            legalIdentityJson: JSON.stringify(input.legalIdentity),
            webhookUrl: `${env.AGENT_BASE_URL}/webhooks/incoming-mail`,
            registeredAt: nowIso(),
          },
        });

      return {
        registration: parsed,
        payment,
      };
    },

    async sendLetter(db: AgentDatabase, input: AgentSendLetterInput, currency: "usdc" | "eurd" = "usdc") {
      const stored = await getRegistration(db);
      if (!stored) {
        throw new Error("Agent is not registered yet");
      }

      console.log(`[agent→service] POST ${env.SERVICE_BASE_URL}/v1/outbound-letters (x402 — will probe then pay)`);
      let response: Response;
      try {
        response = await paidFetch(currency)(`${env.SERVICE_BASE_URL}/v1/outbound-letters`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders(db)),
          },
          body: JSON.stringify({
            mailboxId: stored.mailboxId,
            recipient: input.recipient,
            subject: input.subject,
            bodyMarkdown: input.bodyMarkdown,
            sendMode: "standard",
          }),
        });
      } catch (err) {
        console.error("[agent→service] send-letter paidFetch threw:", err);
        throw err;
      }

      console.log(`[agent→service] send-letter response: status=${response.status}`);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[agent→service] send-letter failed: ${body}`);
        throw new Error(`Send letter failed with status ${response.status}`);
      }

      const result = await parseResponse<{ letterId: string; status: "queued"; x402?: { txid?: string } }>(response);
      if (result.payment?.transaction) {
        console.log(`[agent→service] x402 send-letter settled: txid=${result.payment.transaction}`);
      }
      return result;
    },

    async unlockLetter(db: AgentDatabase, input: AgentUnlockLetterInput, currency: "usdc" | "eurd" = "usdc") {
      const stored = await getRegistration(db);
      if (!stored) {
        throw new Error("Agent is not registered yet");
      }

      console.log(`[agent→service] POST ${env.SERVICE_BASE_URL}/v1/inbound-letters/unlock (x402 — will probe then pay)`);
      let response: Response;
      try {
        response = await paidFetch(currency)(`${env.SERVICE_BASE_URL}/v1/inbound-letters/unlock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders(db)),
          },
          body: JSON.stringify({
            mailboxId: stored.mailboxId,
            letterId: input.letterId,
          }),
        });
      } catch (err) {
        console.error("[agent→service] unlock paidFetch threw:", err);
        throw err;
      }

      console.log(`[agent→service] unlock response: status=${response.status}`);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[agent→service] unlock failed: ${body}`);
        throw new Error(`Unlock failed with status ${response.status}`);
      }

      const result = await parseResponse<{
        letterId: string;
        status: "unlocked";
        from: string;
        receivedAt: string;
        ocrText: string;
        x402?: { txid?: string };
      }>(response);
      if (result.payment?.transaction) {
        console.log(`[agent→service] x402 unlock settled: txid=${result.payment.transaction}`);
      }
      return result;
    },

    async fetchInboundLetters(db: AgentDatabase) {
      const response = await fetch(`${env.SERVICE_BASE_URL}/v1/inbound-letters`, {
        headers: await authHeaders(db),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch inbound letters: ${response.status}`);
      }
      return (await response.json()) as InboundLetterMetadata[];
    },

    async fetchOutboundLetters(db: AgentDatabase) {
      const response = await fetch(`${env.SERVICE_BASE_URL}/v1/outbound-letters`, {
        headers: await authHeaders(db),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch outbound letters: ${response.status}`);
      }
      return (await response.json()) as OutboundLetterMetadata[];
    },

    async fetchNotifications(db: AgentDatabase, cursor?: string) {
      const response = await fetch(
        `${env.SERVICE_BASE_URL}/v1/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        {
          headers: await authHeaders(db),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }
      return (await response.json()) as {
        notifications: unknown[];
        nextCursor: string | null;
      };
    },

    async recordPayment(db: AgentDatabase, input: {
      routeKey: string;
      txid: string;
      amountUsd: number;
      network: string;
      payTo: string;
    }) {
      const row = paymentRecordSchema.parse({
        id: createId("pay"),
        routeKey: input.routeKey,
        txid: input.txid,
        amountUsd: input.amountUsd,
        network: input.network,
        payTo: input.payTo,
        status: "settled",
        createdAt: nowIso(),
      });

      await db.insert(payments).values({
        id: row.id,
        routeKey: row.routeKey,
        txid: row.txid,
        amountUsd: String(row.amountUsd),
        network: row.network,
        payTo: row.payTo,
        createdAt: row.createdAt,
      });
    },

    async syncState(db: AgentDatabase) {
      const stored = await getRegistration(db);
      if (!stored) {
        return;
      }

      const [inbound, outbound] = await Promise.all([
        this.fetchInboundLetters(db),
        this.fetchOutboundLetters(db),
      ]);

      for (const letter of inbound) {
        const existingRows = await db
          .select()
          .from(inboundLetters)
          .where(eq(inboundLetters.id, letter.id))
          .limit(1);
        const existing = existingRows[0];

        await db
          .insert(inboundLetters)
          .values({
            id: letter.id,
            mailboxId: letter.mailboxId,
            fromName: letter.fromName,
            receivedAt: letter.receivedAt,
            pageCount: letter.pageCount,
            envelopeSummary: letter.envelopeSummary,
            serviceStatus: letter.status,
            agentStatus:
              existing?.agentStatus === "ignored"
                ? "ignored"
                : existing?.agentStatus === "received" || letter.status === "received"
                  ? "received"
                  : "pending",
            ocrText: existing?.ocrText ?? null,
            unlockPaymentTxid: letter.unlockPaymentTxid,
            notifiedAt: existing?.notifiedAt ?? null,
            createdAt: letter.createdAt,
          })
          .onConflictDoUpdate({
            target: inboundLetters.id,
            set: {
              serviceStatus: letter.status,
              fromName: letter.fromName,
              receivedAt: letter.receivedAt,
              pageCount: letter.pageCount,
              envelopeSummary: letter.envelopeSummary,
              unlockPaymentTxid: letter.unlockPaymentTxid,
            },
          });
      }

      for (const letter of outbound) {
        await db
          .insert(outboundLetters)
          .values({
            id: letter.id,
            mailboxId: letter.mailboxId,
            recipientJson: JSON.stringify(letter.recipient),
            subject: letter.subject,
            bodyMarkdown: letter.bodyMarkdown,
            status: letter.status,
            paymentTxid: letter.paymentTxid,
            createdAt: letter.createdAt,
            sentAt: letter.sentAt,
          })
          .onConflictDoUpdate({
            target: outboundLetters.id,
            set: {
              status: letter.status,
              paymentTxid: letter.paymentTxid,
              sentAt: letter.sentAt,
            },
          });
      }
    },

    async currentRegistration(db: AgentDatabase) {
      return getRegistration(db);
    },

    async latestPayment(db: AgentDatabase) {
      const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(1);
      return rows[0] ?? null;
    },
  };
}
