export const inboundLetterReceivedEventType = "inbound_letter.received";
export type InboundLetterReceivedEventType = typeof inboundLetterReceivedEventType;

export type InboundLetterReceivedEvent = {
  eventId: string;
  type: InboundLetterReceivedEventType;
  agentId: string;
  mailboxId: string;
  letter: {
    letterId: string;
    from: string;
    receivedAt: string;
    pageCount: number;
    envelopeSummary: string;
  };
};

export type AgentEvent =
  | {
      id: string;
      type: "registration.completed";
      createdAt: string;
      message: string;
      txid?: string;
    }
  | {
      id: string;
      type: "letter.sent";
      createdAt: string;
      message: string;
      txid?: string;
    }
  | {
      id: string;
      type: "letter.unlocked";
      createdAt: string;
      message: string;
      txid?: string;
    }
  | {
      id: string;
      type: "letter.ignored";
      createdAt: string;
      message: string;
    }
  | {
      id: string;
      type: "webhook.received";
      createdAt: string;
      message: string;
    }
  | {
      id: string;
      type: "budget_blocked";
      createdAt: string;
      message: string;
      routeKey?: string;
      requestedAmount?: number;
      currentSpend?: number;
      cap?: number;
    }
  | {
      id: string;
      type: "autonomy_decision";
      createdAt: string;
      message: string;
      letterId?: string;
      fromName?: string;
      decision?: "unlock" | "ignore" | "defer";
      reason?: string;
      confidence?: number;
    }
  | {
      id: string;
      type: "x402.info";
      createdAt: string;
      message: string;
      txid?: string;
    };
