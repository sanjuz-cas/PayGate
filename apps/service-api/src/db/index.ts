import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export function createServiceDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      street1 TEXT NOT NULL,
      street2 TEXT,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      mailbox_id TEXT NOT NULL UNIQUE,
      auth_token_hash TEXT NOT NULL UNIQUE,
      webhook_url TEXT NOT NULL,
      webhook_secret_encrypted TEXT NOT NULL,
      wallet_label TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbound_letters (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      recipient_json TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      pdf_path TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_txid TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inbound_letters (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      from_name TEXT NOT NULL,
      received_at TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      envelope_summary TEXT NOT NULL,
      pdf_path TEXT NOT NULL,
      ocr_text TEXT NOT NULL,
      status TEXT NOT NULL,
      unlock_payment_txid TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      route_key TEXT NOT NULL,
      agent_id TEXT,
      mailbox_id TEXT,
      txid TEXT NOT NULL,
      amount_usd TEXT NOT NULL,
      network TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      agent_id TEXT NOT NULL,
      mailbox_id TEXT NOT NULL,
      letter_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agents_auth_token_hash ON agents(auth_token_hash);
    CREATE INDEX IF NOT EXISTS idx_outbound_mailbox_id ON outbound_letters(mailbox_id);
    CREATE INDEX IF NOT EXISTS idx_inbound_mailbox_id ON inbound_letters(mailbox_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_notification_events_agent_id ON notification_events(agent_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
  `);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export type ServiceDatabase = ReturnType<typeof createServiceDb>["db"];
