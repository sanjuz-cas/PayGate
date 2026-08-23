import { z } from "zod";

import {
  AGENT_PORT,
  ALGOD_TESTNET_URL,
  ALGOD_MAINNET_URL,
  SERVICE_PORT,
} from "@juicebag-mail/shared";

import path from "node:path";

import {
  DEFAULT_AGENT_PORT,
  DEFAULT_SERVICE_PORT,
  ALGOD_TESTNET_URL as CONST_ALGOD_TESTNET_URL,
  ALGOD_MAINNET_URL as CONST_ALGOD_MAINNET_URL,
  DEFAULT_DAILY_CAP_USDC,
  DEFAULT_PRIORITY_KEYWORDS,
  DEFAULT_SKIP_KEYWORDS,
  DEFAULT_ALLOWLIST_SENDERS,
} from "../constants/index.js";

const envSchema = z.object({
  AGENT_PORT: z.coerce.number().int().positive().default(DEFAULT_AGENT_PORT),
  AGENT_BASE_URL: z.string().url().default(`http://localhost:${DEFAULT_AGENT_PORT}`),
  AGENT_DB_PATH: z.string().default(path.resolve(process.cwd(), ".data/agent.db")),
  VITE_AGENT_UI_TOKEN: z.string().default("juicebag-agent-ui-demo-token"),
  SERVICE_BASE_URL: z.string().url().default(`http://localhost:${DEFAULT_SERVICE_PORT}`),
  ALGOD_URL: z.string().url().default(CONST_ALGOD_TESTNET_URL),
  ALGOD_MAINNET_URL: z.string().url().default(CONST_ALGOD_MAINNET_URL),
  AGENT_MNEMONIC: z.string().optional(),
  AVM_MNEMONIC: z.string().optional(),
  AGENT_DAILY_CAP_USDC: z.coerce.number().positive().default(DEFAULT_DAILY_CAP_USDC),
  AUTONOMOUS_UNLOCK_ENABLED: z
    .preprocess((val) => (val === "false" || val === false ? false : true), z.boolean())
    .default(true),
  AUTONOMOUS_PRIORITY_KEYWORDS: z
    .string()
    .default(DEFAULT_PRIORITY_KEYWORDS.join(",")),
  AUTONOMOUS_SKIP_KEYWORDS: z
    .string()
    .default(DEFAULT_SKIP_KEYWORDS.join(",")),
  AUTONOMOUS_ALLOWLIST_SENDERS: z
    .string()
    .default(DEFAULT_ALLOWLIST_SENDERS.join(",")),
  ALLOW_DEV_MNEMONIC_SIGNER: z
    .preprocess((val) => (val === "false" || val === false ? false : true), z.boolean())
    .default(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
});

export type AgentEnv = z.infer<typeof envSchema> & {
  mnemonic: string;
};

export function loadAgentEnv(input: NodeJS.ProcessEnv): AgentEnv {
  const parsed = envSchema.parse({
    ...input,
    AGENT_PORT: input.PORT ?? input.AGENT_PORT,
  });
  const mnemonic = parsed.AGENT_MNEMONIC ?? parsed.AVM_MNEMONIC;
  if (!mnemonic) {
    throw new Error("AGENT_MNEMONIC or AVM_MNEMONIC is required");
  }

  return {
    ...parsed,
    mnemonic,
  };
}
