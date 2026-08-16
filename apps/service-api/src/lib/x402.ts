import { decodePaymentResponseHeader, x402HTTPResourceServer } from "@x402-avm/core/http";
import { HTTPFacilitatorClient } from "@x402-avm/core/server";
import { SettleError } from "@x402-avm/core/types";
import { HonoAdapter, x402ResourceServer } from "@x402-avm/hono";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402-avm/avm";
import {
  ALGORAND_MAINNET_QUANTOZ,
  ROUTE_KEYS,
  ROUTE_PRICES,
  ROUTE_PRICES_EURD,
} from "@juicebag-mail/shared";
import type { Context, MiddlewareHandler, Next } from "hono";

import { createId, nowIso } from "./ids.js";
import { payments } from "../db/schema.js";
import type { ServiceDatabase } from "../db/index.js";
import type { ServiceEnv } from "./env.js";

export type PaymentMeta = {
  routeKey: string;
  amountUsd: number;
  agentId?: string;
  mailboxId?: string;
};

export type PaymentFinalizeResult = {
  body: unknown;
  paymentMeta?: Partial<PaymentMeta>;
};

export type ServiceVariables = {
  paymentMeta?: PaymentMeta;
  paymentFinalize?: (txid: string) => Promise<PaymentFinalizeResult>;
};

export type PaymentOptions = {
  usdc: true;
  eurd: boolean;
};

type CaipNetwork = `${string}:${string}`;
type SupportedResponse = Awaited<ReturnType<HTTPFacilitatorClient["getSupported"]>>;
type VerifyResponse = Awaited<ReturnType<HTTPFacilitatorClient["verify"]>>;
type SettleResponse = Awaited<ReturnType<HTTPFacilitatorClient["settle"]>>;
type QuantozSupportedScheme = {
  scheme: string;
  network: CaipNetwork;
  [key: string]: unknown;
};
const testnet = ALGORAND_TESTNET_CAIP2 as CaipNetwork;
const mainnet = ALGORAND_MAINNET_QUANTOZ as CaipNetwork;

function toJsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    ),
  );
}

function encodeBase64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(toJsonSafe(value)), "utf8")
    .toString("base64url");
}

function toQuantozPaymentPayload(
  paymentPayload: Parameters<HTTPFacilitatorClient["settle"]>[0],
) {
  const normalized = toJsonSafe(paymentPayload) as Record<string, unknown>;
  const accepted =
    typeof normalized.accepted === "object" && normalized.accepted !== null
      ? (normalized.accepted as Record<string, unknown>)
      : {};
  const payload =
    typeof normalized.payload === "object" && normalized.payload !== null
      ? { ...(normalized.payload as Record<string, unknown>) }
      : {};
  const paymentGroup = Array.isArray(payload.paymentGroup) ? payload.paymentGroup : [];
  const paymentIndex =
    typeof payload.paymentIndex === "number" ? payload.paymentIndex : 0;

  if (!("transaction" in payload) && typeof paymentGroup[paymentIndex] === "string") {
    payload.transaction = paymentGroup[paymentIndex];
  }

  return {
    ...normalized,
    scheme: accepted.scheme,
    network: accepted.network,
    payload,
  };
}

class QuantozFacilitatorClient extends HTTPFacilitatorClient {
  override async getSupported(): Promise<SupportedResponse> {
    const raw = (await super.getSupported()) as unknown;

    if (
      typeof raw === "object" &&
      raw !== null &&
      "kinds" in raw &&
      Array.isArray(raw.kinds)
    ) {
      return raw as SupportedResponse;
    }

    if (
      typeof raw === "object" &&
      raw !== null &&
      "schemes" in raw &&
      Array.isArray(raw.schemes)
    ) {
      const schemes = raw.schemes as QuantozSupportedScheme[];

      return {
        kinds: schemes.map(({ scheme, network, ...extra }) => ({
          x402Version: 2,
          scheme,
          network,
          ...(Object.keys(extra).length > 0 ? { extra } : {}),
        })),
        extensions: [],
        signers: {},
      };
    }

    throw new Error("Unsupported Quantoz /supported response shape");
  }

  override async verify(
    _paymentPayload: Parameters<HTTPFacilitatorClient["verify"]>[0],
    _paymentRequirements: Parameters<HTTPFacilitatorClient["verify"]>[1],
  ): Promise<VerifyResponse> {
    // Quantoz's exact scheme combines verify+settle into a single /settle call.
    // We skip pre-verification and let settle do the real check.
    return { isValid: true } as VerifyResponse;
  }

  override async settle(
    paymentPayload: Parameters<HTTPFacilitatorClient["settle"]>[0],
    paymentRequirements: Parameters<HTTPFacilitatorClient["settle"]>[1],
  ): Promise<SettleResponse> {
    const response = await fetch(`${this.url}/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        x402Version: paymentPayload.x402Version,
        paymentPayload: encodeBase64UrlJson(toQuantozPaymentPayload(paymentPayload)),
        paymentRequirements: toJsonSafe(paymentRequirements),
      }),
    });

    const responseText = await response.text();
    console.log(`[Quantoz /settle] status=${response.status} body=${responseText}`);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      throw new SettleError(response.status, {
        success: false,
        errorReason: "invalid_response",
        transaction: "",
      } as unknown as SettleResponse);
    }

    if (!response.ok) {
      throw new SettleError(response.status, data as unknown as SettleResponse);
    }

    return {
      ...data,
      success: true,
      transaction: typeof data.txHash === "string" ? data.txHash : "",
    } as unknown as SettleResponse;
  }
}

export function createRouteConfig(env: ServiceEnv, paymentOptions: PaymentOptions) {
  return {
    "POST /v1/registrations": {
      accepts: [
        {
          scheme: "exact",
          price: ROUTE_PRICES.registration,
          network: testnet,
          payTo: env.SELLER_ADDRESS,
          extra: { asset: USDC_TESTNET_ASA_ID },
        },
        ...(paymentOptions.eurd
          ? [
              {
                scheme: "exact" as const,
                price: ROUTE_PRICES_EURD.registration,
                network: mainnet,
                payTo: env.SELLER_ADDRESS,
              },
            ]
          : []),
      ],
      description: "Register a Juicebag Mail mailbox",
      mimeType: "application/json",
    },
    "POST /v1/outbound-letters": {
      accepts: [
        {
          scheme: "exact",
          price: ROUTE_PRICES.outboundLetter,
          network: testnet,
          payTo: env.SELLER_ADDRESS,
          extra: { asset: USDC_TESTNET_ASA_ID },
        },
        ...(paymentOptions.eurd
          ? [
              {
                scheme: "exact" as const,
                price: ROUTE_PRICES_EURD.outboundLetter,
                network: mainnet,
                payTo: env.SELLER_ADDRESS,
              },
            ]
          : []),
      ],
      description: "Queue a physical outbound letter",
      mimeType: "application/json",
    },
    "POST /v1/inbound-letters/unlock": {
      accepts: [
        {
          scheme: "exact",
          price: ROUTE_PRICES.inboundUnlock,
          network: testnet,
          payTo: env.SELLER_ADDRESS,
          extra: { asset: USDC_TESTNET_ASA_ID },
        },
        ...(paymentOptions.eurd
          ? [
              {
                scheme: "exact" as const,
                price: ROUTE_PRICES_EURD.inboundUnlock,
                network: mainnet,
                payTo: env.SELLER_ADDRESS,
              },
            ]
          : []),
      ],
      description: "Unlock OCR text for an inbound letter",
      mimeType: "application/json",
    },
  };
}

async function facilitatorSupportsExactNetwork(
  facilitator: Pick<HTTPFacilitatorClient, "getSupported">,
  network: CaipNetwork,
) {
  try {
    const supported = await facilitator.getSupported();
    return supported.kinds.some((kind) => kind.scheme === "exact" && kind.network === network);
  } catch (error) {
    console.warn(
      `[x402] EURD facilitator unavailable at startup, disabling EURD payments: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

export async function createResourceServer(env: ServiceEnv, db: ServiceDatabase) {
  const usdcFacilitator = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
  const eurdFacilitator = new QuantozFacilitatorClient({ url: env.EURD_FACILITATOR_URL });
  const eurdEnabled = await facilitatorSupportsExactNetwork(eurdFacilitator, mainnet);

  const resourceServer = new x402ResourceServer(
    eurdEnabled ? [usdcFacilitator, eurdFacilitator] : [usdcFacilitator],
  );
  registerExactAvmScheme(resourceServer, {
    networks: eurdEnabled
      ? [ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_QUANTOZ]
      : [ALGORAND_TESTNET_CAIP2],
  });

  resourceServer.onAfterSettle(async () => {
    void db;
  });

  return {
    paymentOptions: {
      usdc: true,
      eurd: eurdEnabled,
    } satisfies PaymentOptions,
    resourceServer,
  };
}

export function createPaymentMiddleware(
  env: ServiceEnv,
  db: ServiceDatabase,
  resourceServer: x402ResourceServer,
  paymentOptions: PaymentOptions,
): MiddlewareHandler<{ Variables: ServiceVariables }> {
  const httpServer = new x402HTTPResourceServer(
    resourceServer,
    createRouteConfig(env, paymentOptions),
  );

  let initPromise: Promise<void> | null = httpServer.initialize();

  return async (c: Context<{ Variables: ServiceVariables }>, next: Next) => {
    const adapter = new HonoAdapter(c);
    const requestContext = {
      adapter,
      path: c.req.path,
      method: c.req.method,
      paymentHeader:
        adapter.getHeader("payment-signature") ?? adapter.getHeader("x-payment"),
    };

    if (!httpServer.requiresPayment(requestContext)) {
      await next();
      return;
    }

    if (initPromise) {
      await initPromise;
      initPromise = null;
    }

    const result = await httpServer.processHTTPRequest(requestContext);

    if (result.type === "no-payment-required") {
      await next();
      return;
    }

    if (result.type === "payment-error") {
      Object.entries(result.response.headers).forEach(([key, value]) => {
        c.header(key, value);
      });

      if (result.response.isHtml) {
        c.res = new Response(String(result.response.body ?? ""), {
          status: result.response.status,
          headers: result.response.headers,
        });
        return;
      }

      c.res = Response.json(result.response.body ?? {}, {
        status: result.response.status,
        headers: result.response.headers,
      });
      return;
    }

    await next();

    let res = c.res;

    if (!res || res.status >= 400) {
      return;
    }

    const responseBody = Buffer.from(await res.clone().arrayBuffer());
    c.res = undefined;

    const settleResult = await httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      {
        request: requestContext,
        responseBody,
      },
    );

    if (!settleResult.success) {
      const response = settleResult.response;
      c.res = new Response(
        response.isHtml
          ? String(response.body ?? "")
          : JSON.stringify(response.body ?? {}),
        {
          status: response.status,
          headers: response.headers,
        },
      );
      return;
    }

    const settlement = decodePaymentResponseHeader(
      settleResult.headers["PAYMENT-RESPONSE"],
    );
    const txid = settlement.transaction;
    const finalize = c.get("paymentFinalize");
    const initialMeta = c.get("paymentMeta");

    let responsePayload: unknown;
    let finalMeta = initialMeta;

    if (finalize) {
      const finalized = await finalize(txid);
      responsePayload = finalized.body;
      finalMeta = initialMeta
        ? {
            ...initialMeta,
            ...finalized.paymentMeta,
          }
        : undefined;
    } else if (res.headers.get("content-type")?.includes("application/json")) {
      responsePayload = JSON.parse(responseBody.toString("utf8"));
    }

    if (finalMeta) {
      await db.insert(payments).values({
        id: createId("pay"),
        routeKey: finalMeta.routeKey,
        agentId: finalMeta.agentId ?? null,
        mailboxId: finalMeta.mailboxId ?? null,
        txid,
        amountUsd: String(finalMeta.amountUsd),
        network: result.paymentRequirements.network,
        payTo: result.paymentRequirements.payTo,
        status: "settled",
        createdAt: nowIso(),
      });
    }

    Object.entries(settleResult.headers).forEach(([key, value]) => {
      res.headers.set(key, value);
    });

    if (responsePayload && typeof responsePayload === "object" && !Array.isArray(responsePayload)) {
      const body = {
        ...(responsePayload as Record<string, unknown>),
        x402: {
          txid,
        },
      };

      c.res = Response.json(body, {
        status: res.status,
        headers: res.headers,
      });
      return;
    }

    c.res = res;
  };
}

export const PAYMENT_ROUTE_KEYS = ROUTE_KEYS;
