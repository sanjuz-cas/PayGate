import { useEffect, useState } from "react";

import type { AgentEvent } from "@juicebag-mail/shared";

import { api } from "../api/client";

export function useAgentEvents() {
  const [lastEvent, setLastEvent] = useState<AgentEvent | null>(null);

  useEffect(() => {
    const source = new EventSource(api.agentEventsUrl());
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as AgentEvent;
      setLastEvent(parsed);
    };
    return () => source.close();
  }, []);

  return lastEvent;
}
