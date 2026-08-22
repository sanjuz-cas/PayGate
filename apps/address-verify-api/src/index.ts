import "dotenv/config";

import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";

import { loadVerifyEnv } from "./lib/env.js";
import {
  createVerifyResourceServer,
  createVerifyPaymentMiddleware,
} from "./lib/x402.js";
import type { VerifyVariables } from "./lib/x402.js";
import { verifyAddress, addressVerifyRequestSchema } from "./lib/validator.js";

async function main() {
  const env = loadVerifyEnv(process.env);

  const app = new Hono<{ Variables: VerifyVariables }>();

  app.use(
    "*",
    cors({
      origin: env.CORS_ORIGIN,
      allowHeaders: ["Authorization", "Content-Type", "PAYMENT-SIGNATURE", "X-PAYMENT"],
      exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
    }),
  );

  const { resourceServer, httpServer } = createVerifyResourceServer(env);
  app.use("*", createVerifyPaymentMiddleware(env, { resourceServer, httpServer }));

  // Health check (no payment required)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Service registry endpoint (no payment required) - for agent discovery
  app.get("/v1/service-info", (c) =>
    c.json({
      name: "address-verification",
      description: "Verify physical address format and validity before sending mail",
      endpoint: `${env.VERIFY_BASE_URL}/v1/verify-address`,
      price: 0.02,
      currency: "USDC",
      network: "algorand:testnet",
    }),
  );

  // Main verification endpoint (payment required)
  app.post("/v1/verify-address", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = addressVerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          valid: false,
          confidence: 0.95,
          issues: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
        400,
      );
    }

    const result = verifyAddress(parsed.data);
    return c.json(result);
  });

  serve(
    {
      fetch: app.fetch,
      port: env.VERIFY_PORT,
    },
    () => {
      console.log(
        `Address Verification service listening on ${env.VERIFY_BASE_URL}`,
      );
    },
  );
}

void main().catch((error) => {
  console.error("Failed to start Address Verification service", error);
  process.exit(1);
});
