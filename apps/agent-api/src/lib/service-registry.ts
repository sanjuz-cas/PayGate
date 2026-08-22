import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from "@x402-avm/fetch";
import {
  ALGORAND_TESTNET_CAIP2,
  toClientAvmSigner,
} from "@x402-avm/avm";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";

import type { AgentEnv } from "./env.js";
import { mnemonicToPrivateKeyBase64 } from "./wallet.js";

export type ServiceRegistryEntry = {
  name: string;
  description: string;
  endpoint: string;
  price: number;
  currency: string;
  network: string;
};

export type ServiceRegistryResponse = {
  services: ServiceRegistryEntry[];
};

export type AddressVerifyRequest = {
  street1: string;
  street2?: string;
  postalCode: string;
  city: string;
  country: string;
};

export type AddressVerifyResponse = {
  valid: boolean;
  confidence: number;
  issues: string[];
};

export function createServiceRegistryClient(env: AgentEnv) {
  const signer = toClientAvmSigner(mnemonicToPrivateKeyBase64(env.mnemonic));

  const usdcClient = new x402Client();
  registerExactAvmScheme(usdcClient, {
    signer,
    algodConfig: { algodUrl: env.ALGOD_URL },
    networks: [ALGORAND_TESTNET_CAIP2],
  });
  const usdcPaidFetch = wrapFetchWithPayment(fetch, usdcClient);

  return {
    /**
     * Discover available paid services from the service registry.
     * This endpoint does NOT require payment - it's a public discovery endpoint.
     */
    async discoverServices(registryUrl: string): Promise<ServiceRegistryResponse> {
      console.log(`[service-registry] GET ${registryUrl}`);
      const response = await fetch(registryUrl);
      
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[service-registry] discovery failed: ${body}`);
        throw new Error(`Service registry discovery failed with status ${response.status}`);
      }

      const data = await response.json() as ServiceRegistryResponse;
      console.log(`[service-registry] discovered ${data.services.length} services`);
      return data;
    },

    /**
     * Find a specific service by name from the registry.
     */
    findServiceByName(registry: ServiceRegistryResponse, serviceName: string): ServiceRegistryEntry | null {
      return registry.services.find(s => s.name === serviceName) ?? null;
    },

    /**
     * Call the address verification service with x402 payment.
     * Returns the verification result along with payment transaction info.
     */
    async verifyAddress(
      verifyEndpoint: string,
      address: AddressVerifyRequest,
    ): Promise<{
      result: AddressVerifyResponse;
      payment?: ReturnType<typeof decodePaymentResponseHeader>;
    }> {
      console.log(`[address-verify] POST ${verifyEndpoint} (x402 — will probe then pay)`);
      let response: Response;
      try {
        response = await usdcPaidFetch(verifyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(address),
        });
      } catch (err) {
        console.error("[address-verify] paidFetch threw:", err);
        throw err;
      }

      console.log(`[address-verify] response: status=${response.status}`);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[address-verify] failed: ${body}`);
        throw new Error(`Address verification failed with status ${response.status}`);
      }

      const body = (await response.json()) as AddressVerifyResponse;
      const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
      const payment = paymentHeader ? decodePaymentResponseHeader(paymentHeader) : undefined;

      if (payment?.transaction) {
        console.log(`[address-verify] x402 payment settled: txid=${payment.transaction}`);
      }

      return {
        result: body,
        payment,
      };
    },
  };
}
