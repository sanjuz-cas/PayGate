import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  agentRegistrationSchema,
  agentSendLetterSchema,
} from "@juicebag-mail/shared";
import { z } from "zod";

const currencySchema = z
  .enum(["usdc", "eurd"])
  .default("usdc")
  .describe('Payment currency: "usdc" for USDC on Algorand testnet, "eurd" for EURD on Algorand mainnet. Ask the user which to use before any paid action.');

const agentApiUrl = process.env.AGENT_API_URL ?? "http://localhost:4022";
const agentUiToken =
  process.env.VITE_AGENT_UI_TOKEN ?? "juicebag-agent-ui-demo-token";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${agentApiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${agentUiToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : `Agent API request failed with status ${response.status}`,
    );
  }

  return body;
}

function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const server = new McpServer({
  name: "juicebag-mail",
  version: "0.1.0",
});

server.registerTool(
  "register_mailbox",
  {
    description: "Register the agent with Juicebag Mail and pay the mailbox setup fee.",
    inputSchema: {
      ...agentRegistrationSchema.shape,
      currency: currencySchema,
    },
  },
  async (args) => {
    const result = await request("/actions/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return asTextResult(result);
  },
);

server.registerTool(
  "get_agent_state",
  {
    description: "Return the current wallet, mailbox, inbox, outbound queue, and payment state.",
  },
  async () => {
    return asTextResult(await request("/state"));
  },
);

server.registerTool(
  "list_inbound_mail",
  {
    description: "Return inbound letter metadata and current agent-side statuses.",
  },
  async () => {
    const state = await request("/state");
    return asTextResult((state as { inboundLetters?: unknown[] }).inboundLetters ?? []);
  },
);

server.registerTool(
  "list_outbound_mail",
  {
    description: "Return outbound letter jobs and their current statuses.",
  },
  async () => {
    const state = await request("/state");
    return asTextResult((state as { outboundLetters?: unknown[] }).outboundLetters ?? []);
  },
);

server.registerTool(
  "send_letter",
  {
    description: "Pay Juicebag Mail to print and send a physical letter.",
    inputSchema: {
      ...agentSendLetterSchema.shape,
      currency: currencySchema,
    },
  },
  async (args) => {
    const result = await request("/actions/send-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return asTextResult(result);
  },
);

server.registerTool(
  "unlock_letter",
  {
    description: "Pay to unlock the OCR text for a pending inbound letter.",
    inputSchema: {
      letterId: z.string().describe("Inbound letter id"),
      currency: currencySchema,
    },
  },
  async (args) => {
    const result = await request("/actions/unlock-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return asTextResult(result);
  },
);

server.registerTool(
  "ignore_letter",
  {
    description: "Mark a pending inbound letter as ignored in local agent state.",
    inputSchema: {
      letterId: z.string().describe("Inbound letter id"),
    },
  },
  async (args) => {
    const result = await request("/actions/ignore-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return asTextResult(result);
  },
);

const transport = new StdioServerTransport();

await server.connect(transport);
