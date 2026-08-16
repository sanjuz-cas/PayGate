import path from "node:path";

import { z } from "zod";

import {
  AGENT_PORT,
  ALGOD_TESTNET_URL,
  ALGOD_MAINNET_URL,
  SERVICE_PORT,
} from "@juicebag-mail/shared";

const envSchema = z.object({
  AGENT_PORT: z.coerce.number().int().positive().default(AGENT_PORT),
  AGENT_BASE_URL: z.string().url().default(`http://localhost:${AGENT_PORT}`),
  AGENT_DB_PATH: z.string().default(path.resolve(process.cwd(), ".data/agent.db")),
  VITE_AGENT_UI_TOKEN: z.string().default("juicebag-agent-ui-demo-token"),
  SERVICE_BASE_URL: z.string().url().default(`http://localhost:${SERVICE_PORT}`),
  ALGOD_URL: z.string().url().default(ALGOD_TESTNET_URL),
  ALGOD_MAINNET_URL: z.string().url().default(ALGOD_MAINNET_URL),
  AGENT_MNEMONIC: z.string().optional(),
  AVM_MNEMONIC: z.string().optional(),
});

export type AgentEnv = z.infer<typeof envSchema> & {
  mnemonic: string;
};

export function loadAgentEnv(input: NodeJS.ProcessEnv): AgentEnv {
  const parsed = envSchema.parse(input);
  const mnemonic = parsed.AGENT_MNEMONIC ?? parsed.AVM_MNEMONIC;
  if (!mnemonic) {
    throw new Error("AGENT_MNEMONIC or AVM_MNEMONIC is required");
  }

  return {
    ...parsed,
    mnemonic,
  };
}
