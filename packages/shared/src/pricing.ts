export const ROUTE_PRICES = {
  registration: "$1.00",
  outboundLetter: "$0.05",
  inboundUnlock: "$0.20",
} as const;

export const EURD_ASA_ID = "1221682136";
export const ROUTE_PRICES_EURD = {
  registration:   { amount: "4", asset: EURD_ASA_ID },
  outboundLetter: { amount: "1", asset: EURD_ASA_ID },
  inboundUnlock:  { amount: "2", asset: EURD_ASA_ID },
} as const;

export const ROUTE_PRICES_EURD_DISPLAY = {
  registration:   "€0.04",
  outboundLetter: "€0.01",
  inboundUnlock:  "€0.02",
} as const;

export const ROUTE_KEYS = {
  registration: "registration",
  outboundLetter: "outbound_letter",
  inboundUnlock: "inbound_unlock",
} as const;

export const SERVICE_PORT = 4021;
export const AGENT_PORT = 4022;
export const UI_PORT = 5173;

export const ALGOD_TESTNET_URL = "https://testnet-api.algonode.cloud";
export const ALGOD_MAINNET_URL = "https://mainnet-api.algonode.cloud";

export const ALGORAND_EXPLORER_BASE_URL = "https://testnet.explorer.perawallet.app/tx/";
export const ALGORAND_MAINNET_EXPLORER_BASE_URL = "https://explorer.perawallet.app/tx/";

export const EURD_FACILITATOR_URL = "https://x402algo.ai.quantozpay.com";
export const ALGORAND_MAINNET_QUANTOZ = "algorand:mainnet";
