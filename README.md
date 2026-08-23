# PayGate — Autonomous Trust-Services & Micropayment Protocol for AI Agents

[![Algorand](https://img.shields.io/badge/Blockchain-Algorand%20TestNet%20%7C%20MainNet-000000?style=for-the-badge&logo=algorand&logoColor=white)](https://testnet.explorer.perawallet.app/)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402%20AVM%20Standard-10b981?style=for-the-badge)](https://github.com/x402/protocol)
[![Token](https://img.shields.io/badge/Settlement-USDC%20%7C%20Quantoz%20EURD-2775ca?style=for-the-badge)](https://quantoz.com/eurd)
[![EcoGPT](https://img.shields.io/badge/EcoGPT-Carbon%20Negative%20AI%20🌱-059669?style=for-the-badge)](https://testnet.explorer.perawallet.app/address/JJUHJKQ2VQJAA4FK5CPKUHGK5BXY5FF2IREWFN64N62JZFHL3UPMBGAFZE)
[![Pera Wallet](https://img.shields.io/badge/Non--Custodial-Pera%20Connect-ffe600?style=for-the-badge&logoColor=black&labelColor=1a1a1a)](https://perawallet.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **One-Liner:** PayGate is an autonomous trust-services agent that eliminates API keys and SaaS subscriptions by discovering, negotiating, and purchasing real-time processing capabilities (OCR, address verification, postal dispatch) on-demand using **x402 micropayments on Algorand** under human-defined guardrails.

---

## 🛑 The Core Problem: The AI Agent Subscription Bottleneck

As AI agents evolve from conversational chatbots to autonomous task-executors, they inevitably require external, specialized capabilities:
* 🔍 **Document OCR & parsing**
* 📍 **Official Address & Business Identity Verification**
* 📬 **Physical Document Dispatch & Notarization**
* ⚖️ **Compliance, KYC & Sanction Screenings**
* 🌐 **Specialized translation & proprietary LLM endpoints**

### ❌ How It Works Today (The Broken Web2 Model):
1. **API Key & Pre-Registration Overhead:** The human owner must manually create accounts, complete KYC, and provision API keys for *every single service* an agent might ever need.
2. **Wasteful Monthly SaaS Subscriptions:** Agents needing an occasional OCR scan or address lookup force companies to pay $50–$500/month subscriptions for rare, sporadic calls.
3. **Custodial Risk & Card Leaks:** Giving autonomous agents raw credit cards or unrestricted corporate bank access is a catastrophic security liability.
4. **Agent Friction & Stalled Workflows:** When an agent encounters an unconfigured external tool mid-execution, it halts completely because it cannot pay for its own tools.

---

## 💡 The Solution: PayGate Autonomous Trust & Micropayment Protocol

PayGate fundamentally changes how autonomous agents consume external utility by implementing **HTTP 402 Payment Required (x402)** on the Algorand blockchain:

```
                      ┌─────────────────────────────────────────┐
                      │          Incoming Trigger / Task        │
                      │  (Physical Letter, PDF, Invoice, Email) │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │       PayGate AI Agent Brain (LLM)      │
                      │   • Evaluates document context          │
                      │   • Detects missing capabilities        │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │      Dynamic Service Discovery          │
                      │  Discovers pricing & x402 endpoints     │
                      │  (e.g., Address Verify = $0.02 USDC)    │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Human Policy Guardrail & Approval    │
                      │  • Enforces Daily Cap ($10.00 USDC)     │
                      │  • Non-Custodial Pera Wallet Signing    │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    x402 On-Chain Micropayment Probe     │
                      │  • Algorand TestNet (USDC ASA 10458941) │
                      │  • MainNet (Quantoz EURD ASA 1221682136)│
                      │  • Settled via Plausible Facilitator    │
                      └────────────────────┬────────────────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
    ┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
    │     Decoupled Service Execution      │ │     EcoGPT Climate Action Engine     │
    │  Unlocks verified OCR, address checks│ │  Streams on-chain micro-donation to  │
    │  and queues physical postal delivery │ │  verified tree-planting cause ($0.01)│
    └──────────────────────────────────────┘ └──────────────────────────────────────┘
```

### ✨ Key Capabilities:
* **Zero Pre-Registration / No API Keys:** The agent pays per request ($0.02 USDC / €0.05 EURD) directly over HTTP headers without accounts or credit cards.
* **Non-Custodial Spending Policy:** The agent never holds custody of private keys. A human sets a spending cap (e.g., $10/day), and transactions are signed via **Pera Mobile Wallet** or secure ephemeral AVM signers.
* **LLM Tool-Use Harness:** Powered by Groq / Llama 3 / Mixtral, the agent autonomously reasons about whether an external service is worth the price before spending money.
* **Input-Agnostic Trust Layer:** Physical postal mail serves as our flagship real-world demo, but the protocol natively ingests Gmails, PDFs, webhooks, or Slack messages.

---

## 🌱 EcoGPT: Verifiable Carbon-Negative AI Operations

AI workloads consume vast amounts of energy. PayGate turns AI execution into an active force for ecological restoration through **EcoGPT**:

* **Automated Micro-Donations:** On every settled x402 transaction (letter dispatch, verification, unlock), PayGate routes an automated on-chain micro-contribution ($0.01 USDC) directly to the **EcoGPT Verified Forest Cause Wallet**.
* **On-Chain Carbon Offsetting:** Each contribution directly finances real-world verified reforestation initiatives.
* **Transparent Verifiability:** View every single tree planted in real-time directly on Algorand Pera Explorer:
  * **EcoGPT Cause Address:** [`JJUHJKQ2VQJAA4FK5CPKUHGK5BXY5FF2IREWFN64N62JZFHL3UPMBGAFZE`](https://testnet.explorer.perawallet.app/address/JJUHJKQ2VQJAA4FK5CPKUHGK5BXY5FF2IREWFN64N62JZFHL3UPMBGAFZE)
* **Gamified Dashboard Widget:** Features an interactive scenic travel card tracking live tree-count metrics and ecological impact.

---

## ⚡ Technical Proofs & Blockchain Specifications

| Component | TestNet Standard | MainNet Standard |
| :--- | :--- | :--- |
| **Blockchain** | Algorand TestNet | Algorand MainNet |
| **Settlement Asset** | Circle USDC (`10458941`) | Quantoz EURD (`1221682136`) |
| **x402 Facilitator** | `https://facilitator.goplausible.xyz` | Plausible Production Gateway |
| **Wallet Protocol** | Pera Connect v1.6 | Pera Mobile / Web |
| **Payment Standard** | HTTP 402 / AVM Payment Payload | RFC 9110 / x402 Standard |
| **Agent Reasoning** | Groq Llama 3.3 70B Versatile | Groq / Anthropic Tool-Use |

---

## 📦 Monorepo Architecture

```
paygate/
├── apps/
│   ├── agent-api/          # Autonomous buyer agent (Hono, SQLite, LLM brain, Guardrails, EcoGPT)
│   ├── service-api/        # Postal ops seller hub (x402 server, physical print queue, OCR engine)
│   ├── address-verify-api/ # Standalone x402 address verification microservice
│   ├── demo-ui/            # React 18 + Vite live telemetry dashboard & Pera wallet bridge
│   └── juicebag-mcp/       # Model Context Protocol (MCP) server for native AI tool calling
├── packages/
│   └── shared/             # Shared schemas, pricing constants, types & event contracts
├── scripts/                # Vercel & Render build pipelines and environment helpers
├── ARCHITECTURE_DATA_FLOW.md  # Detailed sequence and architecture diagrams
└── presentation_diagram.html # Standalone glassmorphic slide deck for judges
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js** >= 20.x
* **pnpm** >= 9.x (`npm install -g pnpm`)
* **Pera Mobile Wallet** (configured on Algorand TestNet)

### 2. Installation & Build
```bash
git clone https://github.com/sanjuz-cas/PayGate.git
cd PayGate
pnpm install
pnpm build
```

### 3. Setup Environment Variables
```bash
cp .env.agent.example .env.agent
cp .env.service.example .env.service
```

* In `.env.agent`: Paste your 25-word Algorand TestNet paying mnemonic and optional `GROQ_API_KEY`.
* In `.env.service`: Paste your receiving `SELLER_ADDRESS` (Pera Wallet public key).

### 4. Run the Full Suite Locally
```bash
# Terminal 1: Service API (Port 4021)
pnpm dev:service

# Terminal 2: Agent API (Port 4022)
pnpm dev:agent

# Terminal 3: Telemetry Dashboard UI (Port 5173)
pnpm dev:ui
```

Visit **`http://localhost:5173`** to access the live PayGate mission control.

---

## 🌐 Cloud Deployment

* **Frontend Dashboard:** Deployed on **Vercel** (`apps/demo-ui`) with SPA routing and zero-config root mirroring.
* **Backend Services:** Deployed on **Render** (`paygate-service` and `paygate-agent`) with persistent SQLite storage and x402 event webhooks.

For complete cloud deployment walkthroughs, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 👥 Hackathon Team & Presentation Assets

* 📊 **Presentation Deck:** Open [`presentation_diagram.html`](./presentation_diagram.html) for an interactive visual slide deck.
* 📐 **System Diagrams:** View complete Mermaid sequence diagrams in [`ARCHITECTURE_DATA_FLOW.md`](./ARCHITECTURE_DATA_FLOW.md).

---

## 📜 License
Distributed under the **MIT License**. See `LICENSE` for more information.
