import { desc } from "drizzle-orm";

import { events } from "../db/schema.js";
import { createId, nowIso } from "./ids.js";
import type { AgentDatabase } from "../db/index.js";
import type { AgentEvent } from "@juicebag-mail/shared";

type Listener = (event: AgentEvent) => void;
type PublishableEvent = {
  type: AgentEvent["type"];
  message: string;
  txid?: string;
  network?: string;
  id?: string;
  createdAt?: string;
};

export function createEventBus(db: AgentDatabase) {
  const listeners = new Set<Listener>();

  async function publish(event: PublishableEvent) {
    const fullEvent: AgentEvent = {
      ...event,
      id: event.id ?? createId("evt"),
      createdAt: event.createdAt ?? nowIso(),
    } as AgentEvent;

    await db.insert(events).values({
      id: fullEvent.id,
      type: fullEvent.type,
      message: fullEvent.message,
      txid: "txid" in fullEvent ? fullEvent.txid ?? null : null,
      network: event.network ?? null,
      createdAt: fullEvent.createdAt,
    });

    for (const listener of listeners) {
      listener(fullEvent);
    }

    return fullEvent;
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish,
    async recent(limit = 20) {
      const rows = await db.select().from(events).orderBy(desc(events.createdAt)).limit(limit);
      return rows.map((row) => ({
        id: row.id,
        type: row.type as AgentEvent["type"],
        message: row.message,
        txid: row.txid ?? undefined,
        createdAt: row.createdAt,
      }));
    },
  };
}

export type AgentEventBus = ReturnType<typeof createEventBus>;
