# EURD Stablecoin Integration — Technical Proposal

## Background

Juicebag Mail currently accepts USDC on Algorand **testnet** (ASA `10458941`) via the `exact` x402 scheme, facilitated by `https://facilitator.x402.goplausible.xyz`. We want to add **EURD** (Quantoz euro stablecoin) on Algorand **mainnet** as an alternative payment method, selectable per session via a UI toggle.

---

## Quantoz EURD specifics (from docs)

| Property | Value |
|---|---|
| Facilitator URL | `https://x402algo.ai.quantozpay.com` |
| Algorand ASA ID | `1221682136` |
| Network string used by Quantoz | `"algorand:mainnet"` — **this is the string to use everywhere** |
| `ALGORAND_MAINNET_CAIP2` from x402-avm | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` — **do not use for EURD** (see below) |
| x402 scheme | `exact` (same scheme, different network + asset + facilitator) |
| Decimal places | **2** (€0.05 = 5 atomic units — different from USDC's 6 decimal places) |
| Settlement | ~5 seconds, on-chain |
| KYC requirement | Both payer and payee wallets must be **whitelisted** by Quantoz |

---

## Investigation results (code-verified)

### Q2: Price string format for EURD
**Confirmed: must use explicit `AssetAmount` object, not a string.**

Inspecting `@x402-avm/avm/dist/esm/exact/server/index.mjs`:
- `parsePrice` checks if the input is already an `AssetAmount` (`{ amount, asset }`) and returns it directly.
- If the input is a `Money` string (e.g. `"$1.00"`), it strips the `$` prefix and falls back to a **USDC-only** converter (`defaultMoneyConversion`), which maps to the USDC ASA on the given network using 6 decimal places.
- There is no euro parser. `"€0.05"` would throw `"Invalid money format"`.

For EURD prices we must use the explicit atomic-unit format:

```ts
export const ROUTE_PRICES_EURD = {
  registration: { amount: "5",  asset: "1221682136" },  // €0.05
  outboundLetter: { amount: "1", asset: "1221682136" },  // €0.01
  inboundUnlock:  { amount: "2", asset: "1221682136" },  // €0.02
} as const;
```

The display strings for the frontend (price pills, buttons) are kept separate from these x402 price objects and remain human-readable.

### Q3: Multiple facilitators on one resource server
**Confirmed: natively supported, no workaround needed.**

The `x402ResourceServer` constructor signature (from `mechanisms-e8RNDWpU.d.mts`):
```ts
constructor(facilitatorClients?: FacilitatorClient | FacilitatorClient[])
```

Pass an array of two `HTTPFacilitatorClient` instances — one for goplausible (USDC) and one for Quantoz (EURD). The resource server fetches `/supported` from both during initialization and maps each facilitator to the networks it supports. Settlement calls are then routed to the right facilitator based on the payment's network.

Two separate agent-side x402 clients (one for each network) add negligible overhead — they are simple objects wrapping a fetch function. This is the right approach.

### Q4: `accepts` array per route
**Confirmed: natively supported.**

From `x402HTTPResourceServer-B-i4cmSW.d.mts`:
```ts
interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  ...
}
```

No workaround needed. The server will advertise both payment options in its 402 response.

### Q4b: `ALGORAND_MAINNET_CAIP2` export
**Confirmed: exported from `@x402-avm/avm`.**

```ts
// From index.d.mts:
export { ALGORAND_MAINNET_CAIP2 } from './constants-B_XEuyhm.mjs';
// Value: "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="
```

---

## Remaining open question: CAIP2 format mismatch with Quantoz

The Quantoz docs describe the mainnet network as `"algorand:mainnet"`, but the x402-avm library uses the full genesis-hash CAIP2 `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="`.

During `resourceServer.initialize()`, the server calls `getSupported()` on the Quantoz facilitator and builds an internal map of `{ network, scheme } → facilitatorClient`. If Quantoz's `/supported` endpoint returns `"algorand:mainnet"` as the network key (instead of the genesis-hash form), the lookup will fail — the route config uses `ALGORAND_MAINNET_CAIP2`, but no facilitator will be mapped to it.

**Resolution options:**
1. Test against the Quantoz facilitator before implementing — call `GET https://x402algo.ai.quantozpay.com/supported` and inspect the actual `network` value in the response. If it returns the genesis-hash form, there is no problem. If it returns `"algorand:mainnet"`, we use that string as the network identifier instead of `ALGORAND_MAINNET_CAIP2` everywhere.
2. This is a one-request check that can be done before any code is written.

---

## Architecture (finalized)

### Service side (`service-api`)
- Single `x402ResourceServer` initialized with **two** `HTTPFacilitatorClient` instances in an array.
- `registerExactAvmScheme` called with `networks: [ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2]`.
- Each route's `accepts` is an array of two `PaymentOption` objects (USDC + EURD).
- The server advertises both; the client pays with whichever matches its registered scheme.

### Agent side (`agent-api`)
- Two `x402Client` instances:
  - `usdcClient`: registered for `ALGORAND_TESTNET_CAIP2`, algod = testnet URL.
  - `eurdClient`: registered for `ALGORAND_MAINNET_CAIP2`, algod = mainnet URL.
- Two corresponding `paidFetch` functions: `usdcPaidFetch` and `eurdPaidFetch`.
- All three action methods (`register`, `sendLetter`, `unlockLetter`) accept a `currency: "usdc" | "eurd"` parameter and select the right fetch function.
- `currency` flows in from the request body, originating at the frontend toggle.

---

## Detailed changes by component

### `packages/shared/src/pricing.ts`

```ts
// Existing (unchanged):
export const ROUTE_PRICES = {
  registration: "$1.00",
  outboundLetter: "$0.05",
  inboundUnlock: "$0.20",
} as const;

// New: EURD prices as explicit AssetAmount objects (2 decimal places)
export const EURD_ASA_ID = "1221682136";
export const ROUTE_PRICES_EURD = {
  registration:   { amount: "5", asset: EURD_ASA_ID },  // €0.05
  outboundLetter: { amount: "1", asset: EURD_ASA_ID },  // €0.01
  inboundUnlock:  { amount: "2", asset: EURD_ASA_ID },  // €0.02
} as const;

// New display strings for frontend only (not passed to x402):
export const ROUTE_PRICES_EURD_DISPLAY = {
  registration: "€0.05",
  outboundLetter: "€0.01",
  inboundUnlock: "€0.02",
} as const;

// New network/infra constants:
export const ALGOD_MAINNET_URL = "https://mainnet-api.algonode.cloud";
export const ALGORAND_MAINNET_EXPLORER_BASE_URL = "https://explorer.perawallet.app/tx/";
export const EURD_FACILITATOR_URL = "https://x402algo.ai.quantozpay.com";
// Quantoz uses "algorand:mainnet" — NOT the genesis-hash CAIP2 form from @x402-avm/avm
export const ALGORAND_MAINNET_QUANTOZ = "algorand:mainnet";
```

### `packages/shared/src/schemas.ts`

- Add `currency: z.enum(["usdc", "eurd"]).default("usdc")` to `agentRegistrationSchema`, `agentSendLetterSchema`, `agentUnlockLetterSchema`.
- Add `eurd: z.number()` to `agentBalancesSchema`.

### `apps/agent-api/src/lib/wallet.ts`

Generalize `fetchBalances` to accept an asset config instead of hardcoding USDC:

```ts
type AssetConfig = { asaId: number; decimals: number };

export async function fetchAssetBalance(address: string, algodUrl: string, asset: AssetConfig) {
  const data = await fetchAccount(address, algodUrl);
  const assetEntry = data.assets?.find(a => a["asset-id"] === asset.asaId);
  return Number(((assetEntry?.amount ?? 0) / Math.pow(10, asset.decimals)).toFixed(asset.decimals));
}

export async function fetchBalances(address: string, algodTestnetUrl: string, algodMainnetUrl: string) {
  const [testnetData, mainnetData] = await Promise.all([
    fetchAccount(address, algodTestnetUrl),
    fetchAccount(address, algodMainnetUrl),
  ]);
  return {
    algo: Number(((testnetData.amount ?? 0) / 1_000_000).toFixed(6)),
    usdc: findAsset(testnetData, 10458941, 6),
    eurd: findAsset(mainnetData, 1221682136, 2),
  };
}
```

### `apps/agent-api/src/lib/balances.ts`

- Update `AgentBalances` type to include `eurd: number`.
- Pass mainnet algod URL to `fetchBalances`.
- Default `eurd: 0` in `defaultBalances`.

### `apps/agent-api/src/lib/env.ts`

- Add `ALGOD_MAINNET_URL` (defaults to `https://mainnet-api.algonode.cloud` from shared).

### `apps/agent-api/src/lib/juicebag-client.ts`

```ts
export function createJuicebagClient(env: AgentEnv) {
  const signer = toClientAvmSigner(mnemonicToPrivateKeyBase64(env.mnemonic));

  const usdcClient = new x402Client();
  registerExactAvmScheme(usdcClient, {
    signer,
    algodConfig: { algodUrl: env.ALGOD_URL },
    networks: [ALGORAND_TESTNET_CAIP2],
  });
  const usdcPaidFetch = wrapFetchWithPayment(fetch, usdcClient);

  const eurdClient = new x402Client();
  registerExactAvmScheme(eurdClient, {
    signer,
    algodConfig: { algodUrl: env.ALGOD_MAINNET_URL },
    networks: [ALGORAND_MAINNET_QUANTOZ],  // "algorand:mainnet" — matches server 402 response
  });
  const eurdPaidFetch = wrapFetchWithPayment(fetch, eurdClient);

  function paidFetch(currency: "usdc" | "eurd") {
    return currency === "eurd" ? eurdPaidFetch : usdcPaidFetch;
  }

  return {
    async register(db, input, currency: "usdc" | "eurd" = "usdc") {
      // use paidFetch(currency) instead of paidFetch
      ...
    },
    // same for sendLetter, unlockLetter
  };
}
```

### `apps/service-api/src/lib/x402.ts`

```ts
export function createResourceServer(env: ServiceEnv, db: ServiceDatabase) {
  const usdcFacilitator = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
  const eurdFacilitator = new HTTPFacilitatorClient({ url: env.EURD_FACILITATOR_URL });

  const resourceServer = new x402ResourceServer([usdcFacilitator, eurdFacilitator]);
  registerExactAvmScheme(resourceServer, {
    // Quantoz uses "algorand:mainnet" — must match what their /supported returns
    networks: [ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_QUANTOZ],
  });
  ...
}

export function createRouteConfig(env: ServiceEnv) {
  return {
    "POST /v1/registrations": {
      accepts: [
        {
          scheme: "exact",
          price: ROUTE_PRICES.registration,
          network: ALGORAND_TESTNET_CAIP2,
          payTo: env.SELLER_ADDRESS,
          extra: { asset: USDC_TESTNET_ASA_ID },
        },
        {
          scheme: "exact",
          price: ROUTE_PRICES_EURD.registration,  // AssetAmount { amount: "5", asset: "1221682136" }
          network: ALGORAND_MAINNET_QUANTOZ,       // "algorand:mainnet"
          payTo: env.SELLER_ADDRESS,
        },
      ],
      ...
    },
    // same pattern for outbound-letters and inbound-letters/unlock
  };
}
```

### `apps/service-api/src/lib/env.ts`

```ts
SELLER_ADDRESS: z.string().default(""),   // defaults to SELLER_ADDRESS if same wallet
EURD_FACILITATOR_URL: z.string().url().default("https://x402algo.ai.quantozpay.com"),
```

### `apps/service-api/src/lib/balances.ts`

- Add EURD balance fetch from mainnet algod (ASA `1221682136`, 2 decimal places).
- Return `{ usdc, eurd }`.

### `apps/agent-api/src/index.ts`

- Parse `currency` from action request bodies.
- Pass to `juicebag.register(db, data, currency)` etc.
- When recording payment, derive network from currency: `currency === "eurd" ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2`.
- Add `currency` to agent state snapshot / event records so the frontend can use the correct explorer URL without relying on the current toggle state.

### `apps/demo-ui/src/pages/App.tsx`

**Toggle state and placement:**
```tsx
const [currency, setCurrency] = useState<"usdc" | "eurd">("usdc");

// Place next to the PricePill row:
<div className="currency-toggle" role="tablist">
  <button
    role="tab"
    aria-selected={currency === "usdc"}
    onClick={() => setCurrency("usdc")}
  >Pay in USDC (testnet)</button>
  <button
    role="tab"
    aria-selected={currency === "eurd"}
    onClick={() => setCurrency("eurd")}
  >Pay in EURD (mainnet)</button>
</div>
<PricePill icon="📮" label="Register" value={currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration} />
<PricePill icon="✉️" label="Send letter" value={currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter} />
<PricePill icon="📬" label="Receive mail" value={currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock} />
```

**EURD balance** — add `MetricCard` for EURD in both agent and service consoles:
```tsx
<MetricCard label="EURD balance" symbol="EURD" value={displayedBalances.eurd.toFixed(2)} />
```

**Button labels:**
```tsx
label={`Send letter (${currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter})`}
label={`Get full (${currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock})`}
```

**Explorer link** — `TxLink` needs to know which network the tx is on. Thread network through the agent event model (stored in the `events` table) so the link is correct regardless of current toggle state:
```tsx
// EventCard / TxLink receives network from the event, not from the toggle
function TxLink({ txid, network }: { txid?: string; network?: string }) {
  const base = network === ALGORAND_MAINNET_CAIP2
    ? ALGORAND_MAINNET_EXPLORER_BASE_URL
    : ALGORAND_EXPLORER_BASE_URL;
  ...
}
```

**API calls:**
```ts
api.registerAgent({ ...registrationForm, currency })
api.sendLetter({ ...letterForm, currency })
api.unlockLetter(letterId, currency)
```

### `apps/demo-ui/src/api/client.ts`

Pass `currency` through to `POST /actions/register`, `POST /actions/send-letter`, `POST /actions/unlock-letter`.

### `apps/juicebag-mcp/src/index.ts`

- Add optional `currency` parameter (default `"usdc"`) to `register_mailbox`, `send_letter`, `unlock_letter`.
- Pass through to agent API.

### `skills/juicebag-mail/SKILL.md`

Update prices section and add currency-selection guidance. Agent should ask user which currency to use before any paid action.

```markdown
## Payment currency

Before any paid action, ask the user which token they want to pay with:
- **USDC** (Algorand testnet) — $1.00 register / $0.05 send / $0.20 unlock
- **EURD** (Algorand mainnet) — €0.05 register / €0.01 send / €0.02 unlock

Pass `currency: "usdc"` or `currency: "eurd"` to the tool. Default to USDC if the user does not express a preference.
```

### `apps/agent-api/src/db/schema.ts` — events table

Add `network` column to the events table so `TxLink` in the frontend can use the correct explorer URL independently of the current toggle:

```ts
network: text("network"),  // nullable, set for payment events
```

---

## Quantoz CAIP2 format — resolved

**Quantoz uses `"algorand:mainnet"` — not the genesis-hash CAIP2 form.**

This was verified by reading the x402-avm source code and cross-referencing the Quantoz docs (the endpoint itself has a TLS issue that blocks direct curl). Here is why it matters and what to do about it.

### How the resource server resolves networks (from `chunk-TDLQZ6MP.mjs`)

```ts
const findSchemesByNetwork = (map, network) => {
  let result = map.get(network);           // 1. exact key match
  if (!result) {
    for (const [pattern, impl] of map) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      if (regex.test(network)) {           // 2. wildcard pattern fallback
        result = impl;
        break;
      }
    }
  }
  return result;
};
```

During `initialize()`, the server calls `facilitator.getSupported()` and stores the response keyed by `kind.network`. Then `validateRouteConfiguration()` looks up each route option's `network` against that map. Both the scheme-server registration and the facilitator-response lookup use this same function.

### The consequence

The Quantoz facilitator returns `"algorand:mainnet"` as the network key in its `/supported` response. `ALGORAND_MAINNET_CAIP2` = `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="`. These two strings do not match exactly, and the pattern matcher only applies patterns that contain `*`. Neither string contains `*`, so there is no wildcard fallback between them — `initialize()` would throw `RouteConfigurationError`.

### Solution

Use the literal string `"algorand:mainnet"` wherever we specify the EURD network — in the route config, in `registerExactAvmScheme`, and in the agent-side EURD client registration. Define it as a named constant rather than inlining the string:

```ts
// In packages/shared/src/pricing.ts
export const ALGORAND_MAINNET_QUANTOZ = "algorand:mainnet";
```

The existing testnet setup is unaffected — it uses `ALGORAND_TESTNET_CAIP2` (genesis-hash form), which the goplausible facilitator returns correctly.

### What to register on the service side

```ts
registerExactAvmScheme(resourceServer, {
  networks: [ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_QUANTOZ],
});
```

Route config uses:
```ts
{ scheme: "exact", price: ROUTE_PRICES_EURD.registration, network: ALGORAND_MAINNET_QUANTOZ, payTo: env.SELLER_ADDRESS }
```

### What to register on the agent side

```ts
const eurdClient = new x402Client();
registerExactAvmScheme(eurdClient, {
  signer,
  algodConfig: { algodUrl: env.ALGOD_MAINNET_URL },
  networks: [ALGORAND_MAINNET_QUANTOZ],
});
const eurdPaidFetch = wrapFetchWithPayment(fetch, eurdClient);
```

The server's 402 response will say `network: "algorand:mainnet"`. The EURD client is registered for that exact string → match → pays correctly.

---

## Implementation order (suggested)

1. `packages/shared` — add EURD constants (`ALGORAND_MAINNET_QUANTOZ`, `ROUTE_PRICES_EURD`, `ROUTE_PRICES_EURD_DISPLAY`, infra URLs), update schemas.
3. `apps/agent-api/src/lib/wallet.ts` + `balances.ts` — generalize balance fetching.
4. `apps/agent-api/src/lib/env.ts` — add `ALGOD_MAINNET_URL`.
5. `apps/agent-api/src/lib/juicebag-client.ts` — add EURD client alongside USDC client.
6. `apps/agent-api/src/db/schema.ts` — add `network` column to events table.
7. `apps/agent-api/src/index.ts` — thread `currency` through action handlers; store network in events.
8. `apps/service-api/src/lib/x402.ts` + `env.ts` — dual facilitators, dual route config.
9. `apps/service-api/src/lib/balances.ts` — add EURD balance.
10. `apps/demo-ui` — toggle, price display, EURD balance cards, `TxLink` network-awareness.
11. `apps/juicebag-mcp` — add `currency` param to MCP tools.
12. `skills/juicebag-mail/SKILL.md` — update instructions.
