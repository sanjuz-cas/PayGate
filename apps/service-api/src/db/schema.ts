import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mailboxes = sqliteTable("mailboxes", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  legalName: text("legal_name").notNull(),
  street1: text("street1").notNull(),
  street2: text("street2"),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  mailboxId: text("mailbox_id").notNull().unique(),
  authTokenHash: text("auth_token_hash").notNull().unique(),
  webhookUrl: text("webhook_url").notNull(),
  webhookSecretEncrypted: text("webhook_secret_encrypted").notNull(),
  walletLabel: text("wallet_label"),
  createdAt: text("created_at").notNull(),
});

export const outboundLetters = sqliteTable("outbound_letters", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  recipientJson: text("recipient_json").notNull(),
  subject: text("subject").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  pdfPath: text("pdf_path").notNull(),
  status: text("status").notNull(),
  paymentTxid: text("payment_txid"),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
});

export const inboundLetters = sqliteTable("inbound_letters", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  fromName: text("from_name").notNull(),
  receivedAt: text("received_at").notNull(),
  pageCount: integer("page_count").notNull(),
  envelopeSummary: text("envelope_summary").notNull(),
  pdfPath: text("pdf_path").notNull(),
  ocrText: text("ocr_text").notNull(),
  status: text("status").notNull(),
  unlockPaymentTxid: text("unlock_payment_txid"),
  createdAt: text("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  routeKey: text("route_key").notNull(),
  agentId: text("agent_id"),
  mailboxId: text("mailbox_id"),
  txid: text("txid").notNull(),
  amountUsd: text("amount_usd").notNull(),
  network: text("network").notNull(),
  payTo: text("pay_to").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const notificationEvents = sqliteTable("notification_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  agentId: text("agent_id").notNull(),
  mailboxId: text("mailbox_id").notNull(),
  letterId: text("letter_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  delivered: integer("delivered", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  agentId: text("agent_id").notNull(),
  targetUrl: text("target_url").notNull(),
  status: text("status").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: text("last_attempt_at"),
  createdAt: text("created_at").notNull(),
});

export type ServiceAgentRow = typeof agents.$inferSelect;
export type ServiceInboundLetterRow = typeof inboundLetters.$inferSelect;
export type ServiceOutboundLetterRow = typeof outboundLetters.$inferSelect;
