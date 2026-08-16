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
      type: "x402.info";
      createdAt: string;
      message: string;
      txid?: string;
    };
