import type {
  AgentRegistrationInput,
  AgentSendLetterInput,
  AgentState,
  EcoStats,
  InternalInboundLetterScanExtractResponse,
  ServiceState,
} from "@juicebag-mail/shared";

type ServiceStateWithPaymentOptions = ServiceState & {
  paymentOptions: {
    usdc: true;
    eurd: boolean;
  };
};

const agentApiUrl =
  import.meta.env.VITE_AGENT_API_URL ??
  import.meta.env.AGENT_API_URL ??
  "http://localhost:4022";
const serviceApiUrl =
  import.meta.env.VITE_SERVICE_API_URL ??
  import.meta.env.SERVICE_API_URL ??
  "http://localhost:4021";
const agentUiToken =
  import.meta.env.VITE_AGENT_UI_TOKEN ?? "juicebag-agent-ui-demo-token";
const adminUiToken =
  import.meta.env.VITE_ADMIN_UI_TOKEN ?? "juicebag-admin-demo-token";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (init?.method && init.method !== "GET") {
    console.log(`[ui] ${init.method} ${url}`);
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  agentEventsUrl() {
    const token = encodeURIComponent(agentUiToken);
    return `${agentApiUrl}/events?token=${token}`;
  },
  getAgentState() {
    return request<AgentState>(`${agentApiUrl}/state`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  getAgentBalances() {
    return request<AgentState["balances"]>(`${agentApiUrl}/balances`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  registerAgent(input: AgentRegistrationInput) {
    return request<AgentState>(`${agentApiUrl}/actions/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  sendLetter(input: AgentSendLetterInput) {
    return request<AgentState>(`${agentApiUrl}/actions/send-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  unlockLetter(letterId: string, currency: "usdc" | "eurd" = "usdc") {
    return request<AgentState>(`${agentApiUrl}/actions/unlock-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ letterId, currency }),
    });
  },
  getSpendStatus() {
    return request<{ guardrail: import("@juicebag-mail/shared").AgentGuardrail; recentSpendLogs: any[] }>(`${agentApiUrl}/spend`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  getEcoStats() {
    return request<EcoStats>(`${agentApiUrl}/eco-stats`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  getAutonomyDecisions() {
    return request<{ decisions: import("@juicebag-mail/shared").AutonomyDecision[]; autonomousUnlockEnabled: boolean }>(`${agentApiUrl}/autonomy/decisions`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  setDailyCap(dailyCapUsdc: number) {
    return request<{ success: boolean; guardrail: import("@juicebag-mail/shared").AgentGuardrail }>(`${agentApiUrl}/actions/set-cap`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dailyCapUsdc }),
    });
  },
  evaluateLetter(input: { letterId?: string; from?: string; envelopeSummary?: string }) {
    return request<{ decision: import("@juicebag-mail/shared").AutonomyDecision }>(`${agentApiUrl}/actions/evaluate-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  ignoreLetter(letterId: string) {
    return request<AgentState>(`${agentApiUrl}/actions/ignore-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ letterId }),
    });
  },
  getServiceState() {
    return request<ServiceStateWithPaymentOptions>(`${serviceApiUrl}/internal/state`, {
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
      },
    });
  },
  getServiceBalances() {
    return request<{ usdc: number; eurd: number; address: string }>(`${serviceApiUrl}/internal/balances`, {
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
      },
    });
  },
  ingestInboundLetter(input: {
    mailboxId: string;
    fromName: string;
    pageCount: number;
    envelopeSummary: string;
    ocrText: string;
    scanDraftId?: string;
    scanFileName?: string;
  }) {
    return request<{ letterId: string }>(`${serviceApiUrl}/internal/inbound-letters`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  ingestEmail(input: {
    mailboxId?: string;
    from: string;
    fromName?: string;
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: Array<{ filename: string; text?: string }>;
  }) {
    return request<{ ok: true; letterId: string; decision: any }>(`${agentApiUrl}/actions/ingest-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  ingestServiceEmail(input: {
    mailboxId: string;
    from: string;
    fromName?: string;
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: Array<{ filename: string; text?: string }>;
  }) {
    return request<{ letterId: string }>(`${serviceApiUrl}/internal/inbound-emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  extractInboundLetterFromScan(input: {
    mailboxId: string;
    scan: File;
  }) {
    const body = new FormData();
    body.set("mailboxId", input.mailboxId);
    body.set("scan", input.scan);

    return request<InternalInboundLetterScanExtractResponse>(
      `${serviceApiUrl}/internal/inbound-letters/scan-extract`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminUiToken}`,
        },
        body,
      },
    );
  },
  markOutboundSent(letterId: string) {
    return request<{ ok: boolean }>(
      `${serviceApiUrl}/internal/outbound-letters/${letterId}/mark-sent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminUiToken}`,
        },
      },
    );
  },

  // ─── Wallet Session (non-custodial Pera Wallet) ──────────────────────────

  walletSession(address: string) {
    return request<{ address: string }>(`${agentApiUrl}/wallet/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agentUiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
  },

  clearWalletSession() {
    return fetch(`${agentApiUrl}/wallet/session`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${agentUiToken}` },
    });
  },

  pendingSignatureRequests() {
    return request<{
      requests: Array<{
        id: string;
        walletAddress: string;
        unsignedTransactionsBase64: string[];
        indexesToSign: number[];
        description: string;
        expiresAt: string;
      }>;
    }>(`${agentApiUrl}/wallet/signature-requests`, {
      headers: { Authorization: `Bearer ${agentUiToken}` },
    });
  },

  approveSignatureRequest(requestId: string, signedTransactionsBase64: string[]) {
    return request<{ ok: true }>(
      `${agentApiUrl}/wallet/signature-requests/${encodeURIComponent(requestId)}/approve`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${agentUiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransactionsBase64 }),
      },
    );
  },

  rejectSignatureRequest(requestId: string, reason?: string) {
    return request<{ ok: true }>(
      `${agentApiUrl}/wallet/signature-requests/${encodeURIComponent(requestId)}/reject`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${agentUiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
  },

  // ─── Agent Chat (SSE streaming) ──────────────────────────────────────────

  /**
   * POST /actions/agent-chat — starts the agent brain tool-use loop.
   * Returns the raw fetch Response so the caller can read the SSE stream.
   * Events: started | step_completed | done | error
   */
  async agentChat(
    taskDescription: string,
    currency: "usdc" | "eurd" = "usdc",
  ): Promise<Response> {
    const response = await fetch(`${agentApiUrl}/actions/agent-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskDescription, currency }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Agent chat failed with status ${response.status}`);
    }
    return response;
  },

  // ─── Kaam API Methods (Build What Moves India) ──────────────────────────

  executeKaamTask(input: {
    prompt?: string;
    syntheticDocument?: {
      name: string;
      address: string;
      date: string;
      rawText?: string;
    };
  }) {
    return request<{
      taskId: string;
      userPrompt: string;
      interpretedGoal: string;
      taskBudgetInr: number;
      totalSpentInr: number;
      steps: any[];
      status: string;
      outcomeSummary: {
        requirementsChecked: boolean;
        addressVerified: boolean;
        formPrepared: boolean;
        totalPaidInr: string;
        budgetRemainingInr: string;
      };
    }>(`${agentApiUrl}/actions/kaam-task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  getPassportRequirements(serviceType: string = "reissue_address_change") {
    return request<import("@juicebag-mail/shared").PassportRequirementResponse>(
      `${serviceApiUrl}/v1/passport-rules`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceType }),
      },
    );
  },

  verifyDocument(input: {
    documentType: string;
    rawText: string;
    expectedName?: string;
    expectedCity?: string;
    expectedPostalCode?: string;
  }) {
    return request<import("@juicebag-mail/shared").DocumentVerificationResponse>(
      `${serviceApiUrl}/v1/verify-document`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
  },

  passportFormAssist(input: {
    applicantName: string;
    serviceType?: string;
    reissueReason?: string;
    currentAddress: string;
    verifiedDocumentType?: string;
    verifiedDocumentDetails?: string;
  }) {
    return request<import("@juicebag-mail/shared").PassportFormAssistResponse>(
      `${serviceApiUrl}/v1/passport-form-assist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
  },

  getServiceRegistry() {
    return request<{
      services: Array<{
        name: string;
        description: string;
        endpoint: string;
        price: number;
        priceInr?: number;
        currency: string;
        network: string;
      }>;
    }>(`${serviceApiUrl}/v1/service-registry`);
  },
};
