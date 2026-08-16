# Juicebag Mail

Algorand agentic commerce hackathon project for June 2026.

# Links

It's hard to deploy a live demo because a lot needs to be done on agent's side and UI dashboard is much harder to setup properly. 

Feel free to deploy locally, or watch demo video.

- Quantoz: please check out an addendum to my video (after 4:28), I managed to make EURD work!
- Pitch deck: <https://sergeyshemyakov.github.io/juicebagmail/pitch/pitchdeck.html>.
- Video: <https://drive.google.com/file/d/1A5ojSIJ3fCmVwbay1mOZybQ_TWTKKvNz/view?usp=sharing>.
- Skill for agentic interacting with Juicebag Mail: <https://github.com/sergeyshemyakov/juicebagmail/blob/main/skills/juicebag-mail/SKILL.md>.

## What’s here

- `apps/service-api`: Juicebag Mail seller service with SQLite state, webhook delivery, local file storage, and three x402-paid routes.
- `apps/agent-api`: server-side buyer agent with an Algorand wallet, signed webhook handling, local inbox state, and SSE events.
- `apps/demo-ui`: two-pane React dashboard for the agent and Juicebag operator flows.
- `apps/juicebag-mcp`: thin MCP server that exposes the agent actions as native tools.
- `packages/shared`: shared schemas, statuses, pricing constants, and event types.
- `skills/juicebag-mail`: local guidance for agents using the MCP tools.

## Required env

Env is split between the two backend apps. Copy the example files and fill in the required values:

```bash
cp .env.agent.example apps/agent-api/.env
cp .env.service.example apps/service-api/.env
```

**`apps/agent-api/.env`** (based on `.env.agent.example`):

- `AGENT_MNEMONIC` *(required)*: the paying TestNet wallet mnemonic for `agent-api`
- `VITE_AGENT_UI_TOKEN`, `AGENT_BASE_URL`, `SERVICE_BASE_URL`, `ALGOD_URL` *(optional)*

**`apps/service-api/.env`** (based on `.env.service.example`):

- `SELLER_ADDRESS` *(required)*: the TestNet USDC-enabled address that `service-api` should receive payments on
- `WEBHOOK_SECRET_MASTER_KEY` *(required)*: encryption key seed for stored webhook secrets
- `VITE_ADMIN_UI_TOKEN`, `SERVICE_BASE_URL`, `FACILITATOR_URL` *(optional)*

## Install and build

```bash
pnpm install
pnpm build
```

## Run locally

In separate terminals:

```bash
pnpm dev:service
pnpm dev:agent
pnpm dev:ui
pnpm dev:mcp
```

Default ports:

- `service-api`: `4021`
- `agent-api`: `4022`
- `demo-ui`: `5173`

## Demo flow

1. Open the UI at `http://localhost:5173`.
2. Register the agent mailbox from the left pane.
3. Send an outbound letter from the left pane.
4. Ingest an inbound letter from the right pane.
5. Unlock the OCR text from the left pane.

## Validation

The current workspace build passes with:

```bash
pnpm build
```
