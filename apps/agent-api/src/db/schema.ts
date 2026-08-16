import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const registration = sqliteTable("registration", {
  id: integer("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  mailboxId: text("mailbox_id").notNull(),
  agentAuthToken: text("agent_auth_token").notNull(),
  webhookSecret: text("webhook_secret").notNull(),
  agentName: text("agent_name").notNull(),
  entityType: text("entity_type").notNull(),
  legalIdentityJson: text("legal_identity_json").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  registeredAt: text("registered_at").notNull(),
});

export const inboundLetters = sqliteTable("inbound_letters", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  fromName: text("from_name").notNull(),
  receivedAt: text("received_at").notNull(),
  pageCount: integer("page_count").notNull(),
  envelopeSummary: text("envelope_summary").notNull(),
  serviceStatus: text("service_status").notNull(),
  agentStatus: text("agent_status").notNull(),
  ocrText: text("ocr_text"),
  unlockPaymentTxid: text("unlock_payment_txid"),
  notifiedAt: text("notified_at"),
  createdAt: text("created_at").notNull(),
});

export const outboundLetters = sqliteTable("outbound_letters", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  recipientJson: text("recipient_json").notNull(),
  subject: text("subject").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  status: text("status").notNull(),
  paymentTxid: text("payment_txid"),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  routeKey: text("route_key").notNull(),
  txid: text("txid").notNull(),
  amountUsd: text("amount_usd").notNull(),
  network: text("network").notNull(),
  payTo: text("pay_to").notNull(),
  createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  txid: text("txid"),
  network: text("network"),
  createdAt: text("created_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});
