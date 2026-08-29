export const ROUTE_PRICES = {
  registration: "$1.00",
  outboundLetter: "$0.05",
  inboundUnlock: "$0.20",
} as const;

export const EURD_ASA_ID = "1221682136";
export const ROUTE_PRICES_EURD = {
  registration: { amount: "4", asset: EURD_ASA_ID },
  outboundLetter: { amount: "1", asset: EURD_ASA_ID },
  inboundUnlock: { amount: "2", asset: EURD_ASA_ID },
} as const;

export const ROUTE_PRICES_EURD_DISPLAY = {
  registration: "€0.04",
  outboundLetter: "€0.01",
  inboundUnlock: "€0.02",
} as const;

export const ROUTE_KEYS = {
  registration: "registration",
  outboundLetter: "outbound_letter",
  inboundUnlock: "inbound_unlock",
} as const;

export const SERVICE_PORT = 4021;
export const AGENT_PORT = 4022;
export const UI_PORT = 5173;

export const ALGOD_TESTNET_URL = "https://testnet-api.4160.nodely.dev";
export const ALGOD_MAINNET_URL = "https://mainnet-api.algonode.cloud";

export const ALGORAND_EXPLORER_BASE_URL = "https://testnet.explorer.perawallet.app/tx/";
export const ALGORAND_MAINNET_EXPLORER_BASE_URL = "https://explorer.perawallet.app/tx/";

export const EURD_FACILITATOR_URL = "https://x402algo.ai.quantozpay.com";
export const ALGORAND_MAINNET_QUANTOZ = "algorand:mainnet";

export const ECO_CAUSE_ADDRESS = "JJUHJKQ2VQJAA4FK5CPKUHGK5BXY5FF2IREWFN64N62JZFHL3UPMBGAFZE";
export const ECO_CONTRIBUTION_USDC = 0.01;
export const USDC_TESTNET_ASA_ID = 10458941;

// ─── Kaam Capability Pricing (Build What Moves India) ──────────────────────
export const KAAM_PRICES_INR = {
  passportRequirementLookup: "₹0.10",
  documentVerification: "₹0.25",
  passportFormAssistance: "₹0.20",
  taskBudgetCap: "₹2.00",
} as const;

export const KAAM_PRICES_NUMERIC_INR = {
  passportRequirementLookup: 0.10,
  documentVerification: 0.25,
  passportFormAssistance: 0.20,
  taskBudgetCap: 2.00,
} as const;

export const KAAM_PRICES_USDC = {
  passportRequirementLookup: 0.0012, // ~$0.0012 USDC (~₹0.10)
  documentVerification: 0.003,       // ~$0.003 USDC (~₹0.25)
  passportFormAssistance: 0.0025,    // ~$0.0025 USDC (~₹0.20)
  taskBudgetCap: 0.024,              // ~$0.024 USDC (~₹2.00)
} as const;

export const KAAM_ROUTE_KEYS = {
  passportRequirementLookup: "passport_requirement_lookup",
  documentVerification: "document_verification",
  passportFormAssistance: "passport_form_assistance",
} as const;

