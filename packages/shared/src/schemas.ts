import { z } from "zod";

import {
  agentInboundStatuses,
  inboundLetterStatuses,
  outboundLetterStatuses,
  webhookDeliveryStatuses,
} from "./statuses.js";

export const addressSchema = z.object({
  name: z.string().min(1),
  street1: z.string().min(1),
  street2: z.string().optional(),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(2),
});

export const legalIdentitySchema = addressSchema;

export const registrationRequestSchema = z.object({
  agentName: z.string().min(1),
  entityType: z.enum(["company", "person"]),
  legalIdentity: legalIdentitySchema,
  webhook: z.object({
    url: z.string().url(),
  }),
});

export const registrationResponseSchema = z.object({
  agentId: z.string(),
  mailboxId: z.string(),
  agentAuthToken: z.string(),
  webhook: z.object({
    secret: z.string(),
  }),
  status: z.literal("registered"),
  x402: z
    .object({
      txid: z.string().optional(),
    })
    .optional(),
});

export const outboundLetterCreateSchema = z.object({
  mailboxId: z.string(),
  recipient: addressSchema,
  subject: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  sendMode: z.enum(["standard"]),
});

export const outboundLetterResponseSchema = z.object({
  letterId: z.string(),
  status: z.enum(outboundLetterStatuses),
  x402: z
    .object({
      txid: z.string().optional(),
    })
    .optional(),
});

export const inboundLetterUnlockSchema = z.object({
  mailboxId: z.string(),
  letterId: z.string(),
});

export const inboundLetterUnlockResponseSchema = z.object({
  letterId: z.string(),
  status: z.literal("unlocked"),
  from: z.string(),
  receivedAt: z.string(),
  ocrText: z.string(),
  x402: z
    .object({
      txid: z.string().optional(),
    })
    .optional(),
});

export const inboundLetterMetadataSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  fromName: z.string(),
  receivedAt: z.string(),
  pageCount: z.number().int().nonnegative(),
  envelopeSummary: z.string(),
  ocrText: z.string(),
  status: z.enum(inboundLetterStatuses),
  unlockPaymentTxid: z.string().nullable(),
  createdAt: z.string(),
});

export const outboundLetterMetadataSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  recipient: addressSchema,
  subject: z.string(),
  bodyMarkdown: z.string(),
  status: z.enum(outboundLetterStatuses),
  paymentTxid: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});

export const notificationEnvelopeSchema = z.object({
  eventId: z.string(),
  type: z.literal("inbound_letter.received"),
  agentId: z.string(),
  mailboxId: z.string(),
  letter: z.object({
    letterId: z.string(),
    from: z.string(),
    receivedAt: z.string(),
    pageCount: z.number().int().nonnegative(),
    envelopeSummary: z.string(),
  }),
});

export const agentRegistrationSchema = z.object({
  agentName: z.string().min(1),
  entityType: z.enum(["company", "person"]),
  legalIdentity: legalIdentitySchema,
  currency: z.enum(["usdc", "eurd"]).default("usdc"),
});

export const agentSendLetterSchema = z.object({
  recipient: addressSchema,
  subject: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  currency: z.enum(["usdc", "eurd"]).default("usdc"),
});

export const agentIgnoreLetterSchema = z.object({
  letterId: z.string(),
});

export const agentUnlockLetterSchema = z.object({
  letterId: z.string(),
  currency: z.enum(["usdc", "eurd"]).default("usdc"),
});

export const internalInboundLetterCreateSchema = z.object({
  mailboxId: z.string(),
  fromName: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  pageCount: z.number().int().positive(),
  envelopeSummary: z.string().min(1),
  ocrText: z.string().min(1),
  scanDraftId: z.string().optional(),
  scanFileName: z.string().optional(),
});

export const internalInboundLetterScanExtractResponseSchema = z.object({
  scanDraftId: z.string(),
  scanFileName: z.string(),
  pageCount: z.number().int().positive(),
  fromName: z.string(),
  envelopeSummary: z.string(),
  ocrText: z.string(),
});

export const paymentRecordSchema = z.object({
  id: z.string(),
  routeKey: z.string(),
  txid: z.string(),
  amountUsd: z.number(),
  network: z.string(),
  payTo: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const agentBalancesSchema = z.object({
  algo: z.number(),
  usdc: z.number(),
  eurd: z.number(),
  address: z.string(),
});

export const webhookDeliverySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  agentId: z.string(),
  targetUrl: z.string(),
  status: z.enum(webhookDeliveryStatuses),
  attemptCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().nullable(),
});

export const agentStateSchema = z.object({
  registration: z
    .object({
      agentId: z.string(),
      mailboxId: z.string(),
      agentName: z.string(),
      entityType: z.enum(["company", "person"]),
      legalIdentity: legalIdentitySchema,
      webhookUrl: z.string().url(),
      registeredAt: z.string(),
    })
    .nullable(),
  balances: agentBalancesSchema,
  inboundLetters: z.array(
    inboundLetterMetadataSchema.extend({
      agentStatus: z.enum(agentInboundStatuses),
      ocrText: z.string().nullable(),
      notifiedAt: z.string().nullable(),
    }),
  ),
  outboundLetters: z.array(outboundLetterMetadataSchema),
  recentPayments: z.array(paymentRecordSchema),
  lastEvent: z
    .object({
      type: z.string(),
      message: z.string(),
      txid: z.string().optional(),
      network: z.string().optional(),
      createdAt: z.string(),
    })
    .nullable(),
});

export const serviceStateSchema = z.object({
  paymentOptions: z.object({
    usdc: z.literal(true),
    eurd: z.boolean(),
  }),
  counters: z.object({
    registeredAgents: z.number(),
    pendingInboundLetters: z.number(),
    queuedOutboundLetters: z.number(),
  }),
  agents: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      mailboxId: z.string(),
      webhookUrl: z.string().url(),
      createdAt: z.string(),
    }),
  ),
  inboundLetters: z.array(inboundLetterMetadataSchema),
  outboundLetters: z.array(outboundLetterMetadataSchema),
  recentPayments: z.array(paymentRecordSchema),
  recentWebhookDeliveries: z.array(webhookDeliverySchema),
  lastEvent: z
    .object({
      message: z.string(),
      txid: z.string().optional(),
      network: z.string().optional(),
      createdAt: z.string(),
    })
    .nullable(),
});

export type Address = z.infer<typeof addressSchema>;
export type AgentRegistrationInput = z.infer<typeof agentRegistrationSchema>;
export type AgentSendLetterInput = z.infer<typeof agentSendLetterSchema>;
export type AgentUnlockLetterInput = z.infer<typeof agentUnlockLetterSchema>;
export type AgentIgnoreLetterInput = z.infer<typeof agentIgnoreLetterSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;
export type AgentBalances = z.infer<typeof agentBalancesSchema>;
export type InboundLetterMetadata = z.infer<typeof inboundLetterMetadataSchema>;
export type NotificationEnvelope = z.infer<typeof notificationEnvelopeSchema>;
export type OutboundLetterMetadata = z.infer<typeof outboundLetterMetadataSchema>;
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
export type RegistrationRequest = z.infer<typeof registrationRequestSchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export type ServiceState = z.infer<typeof serviceStateSchema>;
export type WebhookDeliveryRecord = z.infer<typeof webhookDeliverySchema>;
export type InternalInboundLetterScanExtractResponse = z.infer<
  typeof internalInboundLetterScanExtractResponseSchema
>;
