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

> **One-liner:** PayGate is an AI agent that autonomously purchases verification and processing services — pay-per-use, via x402 on Algorand — under a spending policy a human sets once but doesn't operate.

---

## 🎯 The Problem

AI agents increasingly need to complete multi-step tasks that require external, specialized capabilities — OCR, address/vendor verification, translation, compliance checks. 

Today that means the agent's owner has to pre-register accounts, manage API keys, and pay subscriptions for every service the agent might ever need, even ones used rarely. That's friction that doesn't scale as agents become more autonomous.

---

## 💡 The Solution

PayGate gives an agent the ability to:
1. **Discover** paid services it needs mid-task via an open service registry.
2. **Decide** whether a given service is worth paying for using an LLM reasoning loop.
3. **Pay for it instantly**, per-use, via x402 on Algorand — no pre-registered accounts, no API keys, no monthly SaaS subscriptions.

The agent reasons about which services to call using a real LLM tool-use loop (not hardcoded logic), and every payment is enforced against a spending guardrail the policy owner defines up front.

---

## 🔄 Concrete Demo Flow

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
Agent acts on the verified result within its budget & triggers EcoGPT tree donation 🌱
```

---

## ⚡ Why This Matters Technically

- **Real x402 payment flow**: Live on Algorand TestNet (USDC ASA ID `10458941`) and MainNet (Quantoz EURD ASA ID `1221682136`), settled through the x402 facilitator.
- **Genuine LLM tool-use harness**: The agent's decision-making is powered by an LLM reasoning loop (Groq SDK / Llama-3 / Mixtral) that evaluates incoming mail context and chooses which tools to execute.
- **Non-custodial by design**: The agent never stores a private key. A connected non-custodial wallet (Pera) authorizes spend, with hardcoded 24-hour spending guardrails limiting what the agent can request.
- **Physical-to-digital bridge**: We use physical mail as our demo trigger because it's a concrete, relatable way to show an autonomous incoming real-world event — the actual product is the trust/verification payment layer underneath.
- **EcoGPT climate action**: Automated on-chain micro-donations ($0.01 USDC) dispatched to a verified tree planting cause on every letter transaction, creating verifiable carbon-negative AI operations.

---

## 🎯 Being Upfront About Scope

Given hackathon time constraints, we prioritized getting one core payment flow (address verification & mailbox registration) fully real and verifiable end-to-end — genuinely signed, settled, and checkable on-chain via Pera Explorer — rather than three partially-working ones. We are extending the same verified x402 pattern across all secondary service endpoints.

---

## 📦 Monorepo Architecture

```
d:\paygate
├── apps/
│   ├── agent-api/          # Autonomous buyer agent (Hono, SQLite, LLM brain, Guardrails, EcoGPT)
│   ├── service-api/        # Postal ops seller hub (x402 server, physical print queue, OCR engine)
│   ├── address-verify-api/ # Standalone x402 address verification microservice
│   ├── demo-ui/            # React 18 + Vite live telemetry dashboard & Pera wallet bridge
│   └── juicebag-mcp/       # Model Context Protocol (MCP) server for native AI tool calling
├── packages/
│   └── shared/             # Shared schemas, pricing constants, types & event contracts
└── scripts/                # Environment launchers and wallet automation utilities
```

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js >= 20
- `pnpm` >= 9 (`npm install -g pnpm`)

### 2. Install Dependencies & Build
```bash
pnpm install
pnpm build
```

### 3. Configure Environment Variables
Copy the template files:
```bash
cp .env.agent.example .env.agent
cp .env.service.example .env.service
```

- **`.env.agent`**: Contains paying Algorand TestNet mnemonic, Groq API Key (for LLM chat), and ports.
- **`.env.service`**: Contains seller payout address (`SELLER_ADDRESS`), master webhook key, and facilitator config.

### 4. Run Services
In separate terminal windows (or concurrently):
```bash
# Terminal 1: Postal Service Hub (Port 4021)
pnpm dev:service

# Terminal 2: Autonomous Agent API (Port 4022)
pnpm dev:agent

# Terminal 3: Demo Dashboard UI (Port 5173)
pnpm dev:ui
```

### 5. Access the Dashboard
Open your browser to: **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Interactive Pitch Diagrams

For visual presentations and architectural walk-throughs:
- **Interactive Visual Slide Deck:** Open [`presentation_diagram.html`](file:///d:/paygate/presentation_diagram.html) in any browser.
- **Full Architecture & Sequence Docs:** Read [`ARCHITECTURE_DATA_FLOW.md`](file:///d:/paygate/ARCHITECTURE_DATA_FLOW.md).
