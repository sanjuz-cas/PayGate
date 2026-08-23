import { desc } from "drizzle-orm";

import { events } from "../db/schema.js";
import { createId, nowIso } from "./ids.js";
import type { AgentDatabase } from "../db/index.js";
import type { AgentEvent } from "@juicebag-mail/shared";

type Listener = (event: AgentEvent) => void;
type PublishableEvent = (
  | {
    type: "registration.completed";
    message: string;
    txid?: string;
    network?: string;
  }
  | {
    type: "letter.sent";
    message: string;
    txid?: string;
    network?: string;
  }
  | {
    type: "letter.unlocked";
    message: string;
    txid?: string;
    network?: string;
  }
  | {
    type: "letter.ignored";
    message: string;
    network?: string;
  }
  | {
    type: "webhook.received";
    message: string;
    network?: string;
  }
  | {
    type: "budget_blocked";
    message: string;
    routeKey?: string;
    requestedAmount?: number;
    currentSpend?: number;
    cap?: number;
    network?: string;
  }
  | {
    type: "autonomy_decision";
    message: string;
    letterId?: string;
    fromName?: string;
    decision?: "unlock" | "ignore" | "defer";
    reason?: string;
    confidence?: number;
    network?: string;
  }
  | {
<<<<<<< Updated upstream
      type: "x402.info";
      message: string;
      txid?: string;
      network?: string;
    }
  | {
      type: "wallet.signature_required";
      message: string;
      requestId?: string;
      walletAddress?: string;
      network?: string;
    }
  | {
      type: "wallet.signature_approved";
      message: string;
      requestId?: string;
      walletAddress?: string;
      network?: string;
    }
=======
    type: "x402.info";
    message: string;
    txid?: string;
    network?: string;
  }
  | {
    type: "eco.contribution";
    message: string;
    txid?: string;
    network?: string;
    amountUsd?: number;
    treesCount?: number;
  }
>>>>>>> Stashed changes
) & {
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
