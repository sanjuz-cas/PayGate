import path from "node:path";

import { z } from "zod";

import {
  ALGOD_TESTNET_URL,
} from "@juicebag-mail/shared";

const envSchema = z.object({
  VERIFY_PORT: z.coerce.number().int().positive().default(3002),
  VERIFY_BASE_URL: z.string().url().default(`http://localhost:3002`),
  FACILITATOR_URL: z.string().url().default("https://facilitator.goplausible.xyz"),
  ALGOD_URL: z.string().url().default(ALGOD_TESTNET_URL),
  VERIFY_ADDRESS: z.string().min(1, "VERIFY_ADDRESS is required to accept x402 payments"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type VerifyEnv = z.infer<typeof envSchema>;

export function loadVerifyEnv(input: NodeJS.ProcessEnv): VerifyEnv {
  return envSchema.parse(input);
}
