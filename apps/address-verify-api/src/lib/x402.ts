import { decodePaymentResponseHeader, x402HTTPResourceServer } from "@x402-avm/core/http";
import { HTTPFacilitatorClient } from "@x402-avm/core/server";
import { SettleError } from "@x402-avm/core/types";
import { HonoAdapter, x402ResourceServer } from "@x402-avm/hono";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402-avm/avm";
import type { Context, MiddlewareHandler, Next } from "hono";

import type { VerifyEnv } from "./env.js";

const ADDRESS_VERIFY_PRICE = 0.02; // $0.02 USD

export type VerifyVariables = {
  paymentMeta?: {
    routeKey: string;
    amountUsd: number;
  };
};

type CaipNetwork = `${string}:${string}`;
type SupportedResponse = Awaited<ReturnType<HTTPFacilitatorClient["getSupported"]>>;
type VerifyResponse = Awaited<ReturnType<HTTPFacilitatorClient["verify"]>>;
type SettleResponse = Awaited<ReturnType<HTTPFacilitatorClient["settle"]>>;

const testnet = ALGORAND_TESTNET_CAIP2 as CaipNetwork;

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

class SimpleFacilitatorClient extends HTTPFacilitatorClient {
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
      const schemes = raw.schemes as Array<{ scheme: string; network: CaipNetwork }>;

      return {
        kinds: schemes.map(({ scheme, network }) => ({
          x402Version: 2,
          scheme,
          network,
        })),
        extensions: [],
        signers: {},
      };
    }

    throw new Error("Unsupported /supported response shape");
  }

  override async verify(
    _paymentPayload: Parameters<HTTPFacilitatorClient["verify"]>[0],
    _paymentRequirements: Parameters<HTTPFacilitatorClient["verify"]>[1],
  ): Promise<VerifyResponse> {
    return { isValid: true } as VerifyResponse;
  }

  override async settle(
    paymentPayload: Parameters<HTTPFacilitatorClient["settle"]>[0],
    paymentRequirements: Parameters<HTTPFacilitatorClient["settle"]>[1],
  ): Promise<SettleResponse> {
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

    let transaction = "";
    if (!(\"transaction\" in payload) && typeof paymentGroup[paymentIndex] === "string") {
      transaction = paymentGroup[paymentIndex];
    } else if (typeof payload.transaction === "string") {
      transaction = payload.transaction;
    }

    const response = await fetch(`${this.url}/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        x402Version: paymentPayload.x402Version,
        paymentPayload: encodeBase64UrlJson({
          ...normalized,
          scheme: accepted.scheme,
          network: accepted.network,
          payload: { ...payload, transaction },
        }),
        paymentRequirements: toJsonSafe(paymentRequirements),
      }),
    });

    const responseText = await response.text();
    console.log(`[AddressVerify /settle] status=${response.status} body=${responseText}`);

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
      transaction: typeof data.txHash === "string" ? data.txHash : typeof data.transaction === "string" ? data.transaction : "",
    } as unknown as SettleResponse;
  }
}

export function createVerifyResourceServer(env: VerifyEnv) {
  const facilitator = new SimpleFacilitatorClient({ url: env.FACILITATOR_URL });
  const resourceServer = new x402ResourceServer([facilitator]);
  
  registerExactAvmScheme(resourceServer, {
    networks: [ALGORAND_TESTNET_CAIP2],
  });

  const routeConfig = {
    "POST /v1/verify-address": {
      accepts: [{
        scheme: "exact",
        price: ADDRESS_VERIFY_PRICE,
        network: testnet,
        payTo: env.VERIFY_ADDRESS,
        extra: { asset: USDC_TESTNET_ASA_ID },
      }],
      description: "Verify a physical address format and validity",
      mimeType: "application/json",
    },
  };

  return {
    resourceServer,
    httpServer: new x402HTTPResourceServer(resourceServer, routeConfig),
  };
}

export function createVerifyPaymentMiddleware(
  env: VerifyEnv,
  { resourceServer, httpServer }: ReturnType<typeof createVerifyResourceServer>,
): MiddlewareHandler<{ Variables: VerifyVariables }> {
  let initPromise: Promise<void> | null = httpServer.initialize();

  return async (c: Context<{ Variables: VerifyVariables }>, next: Next) => {
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

    const responsePayload = res.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(responseBody.toString("utf8"))
      : undefined;

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
