import path from "node:path";

import { z } from "zod";

import {
  ALGOD_TESTNET_URL,
  ALGOD_MAINNET_URL,
  EURD_FACILITATOR_URL,
  SERVICE_PORT,
} from "@juicebag-mail/shared";

const envSchema = z.object({
  SERVICE_PORT: z.coerce.number().int().positive().default(SERVICE_PORT),
  SERVICE_BASE_URL: z.string().url().default(`http://localhost:${SERVICE_PORT}`),
  SERVICE_DB_PATH: z.string().default(path.resolve(process.cwd(), ".data/service.db")),
  STORAGE_DIR: z.string().default(path.resolve(process.cwd(), "storage")),
  OCR_LANGS: z.string().default("deu+eng"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  VITE_ADMIN_UI_TOKEN: z.string().default("juicebag-admin-demo-token"),
  FACILITATOR_URL: z.string().url().default("https://facilitator.x402.goplausible.xyz"),
  EURD_FACILITATOR_URL: z.string().url().default(EURD_FACILITATOR_URL),
  ALGOD_URL: z.string().url().default(ALGOD_TESTNET_URL),
  ALGOD_MAINNET_URL: z.string().url().default(ALGOD_MAINNET_URL),
  SELLER_ADDRESS: z.string().min(1, "SELLER_ADDRESS is required to accept x402 payments"),
  WEBHOOK_SECRET_MASTER_KEY: z
    .string()
    .default("juicebag-mail-demo-webhook-master-key"),
});

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadServiceEnv(input: NodeJS.ProcessEnv): ServiceEnv {
  return envSchema.parse(input);
}
