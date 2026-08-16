import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export function createAgentDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS registration (
      id INTEGER PRIMARY KEY,
      agent_id TEXT NOT NULL,
      mailbox_id TEXT NOT NULL,
      agent_auth_token TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      legal_identity_json TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      registered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inbound_letters (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      from_name TEXT NOT NULL,
      received_at TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      envelope_summary TEXT NOT NULL,
      service_status TEXT NOT NULL,
      agent_status TEXT NOT NULL,
      ocr_text TEXT,
      unlock_payment_txid TEXT,
      notified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbound_letters (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      recipient_json TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_txid TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      route_key TEXT NOT NULL,
      txid TEXT NOT NULL,
      amount_usd TEXT NOT NULL,
      network TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      txid TEXT,
      network TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export type AgentDatabase = ReturnType<typeof createAgentDb>["db"];
