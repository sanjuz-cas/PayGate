export const mailboxStatuses = ["registered"] as const;
export type MailboxStatus = (typeof mailboxStatuses)[number];

export const inboundLetterStatuses = ["pending", "received"] as const;
export type InboundLetterStatus = (typeof inboundLetterStatuses)[number];

export const outboundLetterStatuses = ["queued", "sent"] as const;
export type OutboundLetterStatus = (typeof outboundLetterStatuses)[number];

export const agentInboundStatuses = ["pending", "received", "ignored"] as const;
export type AgentInboundStatus = (typeof agentInboundStatuses)[number];

export const webhookDeliveryStatuses = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];
