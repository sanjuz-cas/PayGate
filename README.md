# PayGate — Autonomous Trust-Services Agent

[![Algorand](https://img.shields.io/badge/Blockchain-Algorand%20TestNet-000000?style=flat-square&logo=algorand&logoColor=white)](https://testnet.explorer.perawallet.app/)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402%20AVM-10b981?style=flat-square)](https://github.com/x402/protocol)
[![Token](https://img.shields.io/badge/Currency-USDC%20%7C%20EURD-2775ca?style=flat-square)](https://quantoz.com/eurd)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Wallet](https://img.shields.io/badge/Wallet-Pera%20Connect-ffe600?style=flat-square&logoColor=black&labelColor=1a1a1a)](https://perawallet.app/)
[![EcoGPT](https://img.shields.io/badge/EcoGPT-Carbon%20Negative%20🌱-059669?style=flat-square)](./ARCHITECTURE_DATA_FLOW.md)
[![Build](https://img.shields.io/badge/monorepo%20build-passing-brightgreen?style=flat-square)](./package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> **One-liner:** PayGate is an AI agent that autonomously buys the verification and processing services it needs mid-task — pay-per-use, via x402 on Algorand — under a spending policy a human sets once but never has to operate.

---

## 🎯 The problem: AI agents don't fit the subscription model

AI agents increasingly need to complete multi-step tasks that require external, specialized capabilities: OCR, address or vendor verification, translation, compliance checks, and more. The tooling landscape assumes those capabilities are consumed by a human logging into a dashboard — not by an autonomous process deciding, mid-task, that it suddenly needs one.

That mismatch shows up as a few compounding problems:

- **Pre-registration friction.** Before an agent can call a service, its owner has to sign up for an account, generate and store an API key, and hand the agent credentials for every service it might ever touch.
- **Subscriptions don't track usage.** Most of those services bill monthly, whether the agent calls them once a day or once a quarter. Cost stops reflecting actual work done.
- **It doesn't scale with autonomy.** As agents take on more open-ended tasks, the list of services they *might* need grows faster than any human wants to keep provisioning for. Pre-registering for all of them is wasted effort; missing one blocks the agent mid-task.
- **Trust and custody.** Handing an agent a standing API key or a funded account is also handing it standing access — there's no clean way to say "you can spend a few cents on verification, and nothing more."

## 💡 The solution

PayGate gives an agent the ability to:

1. **Discover** paid services it needs mid-task, via an open service registry.
2. **Decide** whether a given service is worth paying for, using a real LLM reasoning loop.
3. **Pay for it instantly, per use**, via x402 on Algorand — no pre-registered accounts, no stored API keys, no monthly subscription.

The agent reasons about which services to call using an actual LLM tool-use loop, not hardcoded logic, and every payment is enforced against a spending guardrail the policy owner defines up front.

---

## 🔄 Concrete demo flow

```
Incoming document (e.g. a supplier letter/invoice) arrives
  ↓
Agent reads it and extracts context
  ↓
Agent autonomously decides address/vendor verification is needed
  ↓
Agent discovers the verification service via a service registry
  ↓
Agent proposes the payment ($0.02 USDC)
  ↓
Non-custodial wallet (Pera) authorizes the payment — the agent never holds a private key
  ↓
x402 payment settles on Algorand TestNet, verified live on-chain
  ↓
Agent acts on the verified result within its budget & triggers an EcoGPT tree donation 🌱
```

> [!NOTE]
> **Why physical postal mail in the demo?**
> Physical mail was our visual demo trigger because it proves a complex real-world pipeline end-to-end. PayGate itself is an input-agnostic trust and micropayment protocol — the same agent can just as easily ingest a Gmail thread, a supplier PDF invoice, a Slack request, or a WhatsApp message, and autonomously buy verification services on Algorand via x402.

---

## ⚡ Why this matters technically

- **Real x402 payment flow** — live on Algorand TestNet (USDC ASA ID `10458941`) and MainNet (Quantoz EURD ASA ID `1221682136`), settled through the x402 facilitator.
- **Genuine LLM tool-use harness** — the agent's decision-making is powered by an LLM reasoning loop (Groq SDK / Llama-3 / Mixtral) that evaluates incoming document context and chooses which tools to execute.
- **Non-custodial by design** — the agent never stores a private key. A connected non-custodial wallet (Pera) authorizes spend, with hardcoded 24-hour spending guardrails limiting what the agent can request.
- **Input-agnostic trust layer** — physical mail is the demo trigger because it's a concrete, relatable way to show an autonomous incoming event; the actual product is the trust/verification micropayment layer underneath, usable across Gmail, PDFs, Slack, or webhooks.
- **EcoGPT climate action** — automated on-chain micro-donations ($0.01 USDC) dispatched to a verified tree-planting cause on every letter transaction, so each unit of agent activity is tied to a measurable, verifiable environmental offset rather than an opaque monthly "impact" claim — carbon-negative AI operations, by construction.

---

## 🌱 EcoGPT: carbon-negative by default

Every service PayGate's agent pays for is a real, metered transaction — which means every transaction is also a clean hook to attach a real-world outcome, instead of an opaque monthly "impact" claim bolted onto a subscription plan.

That's what the EcoGPT integration does: on **every letter transaction**, PayGate automatically dispatches a small on-chain micro-donation ($0.01 USDC) to a verified tree-planting cause, alongside the payment for the service itself.

- **Automatic, not opt-in per action** — the donation fires as part of the same transaction flow as the service payment, so it can't be skipped or forgotten.
- **On-chain and verifiable** — like the service payments themselves, the donation settles on Algorand and is checkable via Pera Explorer, not just reported in a dashboard.
- **Scales with usage, not time** — because it's tied to actual agent activity (per letter, per verification) rather than a flat monthly fee, impact grows exactly in step with what the agent actually does.
- **Already live in the demo flow** — see step 8 in the [demo flow](#-concrete-demo-flow) above ("Agent acts on the verified result within its budget & triggers an EcoGPT tree donation 🌱").

This is the same core idea as PayGate's spending model applied to sustainability: pay-per-use, on-chain, and verifiable — no flat fee, no vague "we plant trees" claim without a receipt.

---

## 🎯 Being upfront about scope

Given hackathon time constraints, we prioritized getting one core payment flow — address verification & mailbox registration — fully real and verifiable end-to-end, genuinely signed, settled, and checkable on-chain via Pera Explorer, rather than three partially-working ones. We're extending the same verified x402 pattern across all secondary service endpoints next.

---

## 📦 Monorepo architecture

```
paygate/
├── apps/
│   ├── agent-api/          # Autonomous buyer agent (Hono, SQLite, LLM brain, guardrails, EcoGPT)
│   ├── service-api/        # Postal ops seller hub (x402 server, physical print queue, OCR engine)
│   ├── address-verify-api/ # Standalone x402 address verification microservice
│   ├── demo-ui/            # React 18 + Vite live telemetry dashboard & Pera wallet bridge
│   └── juicebag-mcp/       # Model Context Protocol (MCP) server for native AI tool calling
├── packages/
│   └── shared/              # Shared schemas, pricing constants, types & event contracts
└── scripts/                 # Environment launchers and wallet automation utilities
```

---

## 🚀 Getting started locally

### 1. Prerequisites

- Node.js >= 20
- `pnpm` >= 9 (`npm install -g pnpm`)

### 2. Install dependencies & build

```bash
pnpm install
pnpm build
```

### 3. Configure environment variables

Copy the template files:

```bash
cp .env.agent.example .env.agent
cp .env.service.example .env.service
```

- **`.env.agent`** — paying Algorand TestNet mnemonic, Groq API key (for LLM chat), and ports.
- **`.env.service`** — seller payout address (`SELLER_ADDRESS`), master webhook key, and facilitator config.

### 4. Run services

In separate terminal windows (or concurrently):

```bash
# Terminal 1: Postal Service Hub (Port 4021)
pnpm dev:service

# Terminal 2: Autonomous Agent API (Port 4022)
pnpm dev:agent

# Terminal 3: Demo Dashboard UI (Port 5173)
pnpm dev:ui
```

### 5. Access the dashboard

Open your browser to **[http://localhost:5173](http://localhost:5173)**.

---

## 🧪 Interactive pitch diagrams

For visual presentations and architectural walk-throughs:

- **Interactive visual slide deck** — open [`presentation_diagram.html`](./presentation_diagram.html) in any browser.
- **Full architecture & sequence docs** — read [`ARCHITECTURE_DATA_FLOW.md`](./ARCHITECTURE_DATA_FLOW.md).

## License

MIT
