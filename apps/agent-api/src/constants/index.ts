/**
 * Centralized constants for the agent API
 * Eliminates magic numbers and strings throughout the codebase
 */

// Port configurations
export const DEFAULT_AGENT_PORT = 3001;
export const DEFAULT_SERVICE_PORT = 3000;

// Algorand network URLs
export const ALGOD_TESTNET_URL = "https://testnet-api.algonode.cloud";
export const ALGOD_MAINNET_URL = "https://mainnet-api.algonode.cloud";

// Default configuration values
export const DEFAULT_DAILY_CAP_USDC = 5.0;

// Default autonomy keywords
export const DEFAULT_PRIORITY_KEYWORDS = [
  "tax",
  "invoice",
  "urgent",
  "landlord",
  "government",
  "official",
  "court",
  "bank",
  "security",
  "notice",
  "receipt",
  "bill",
];

export const DEFAULT_SKIP_KEYWORDS = [
  "promo",
  "promotion",
  "lottery",
  "marketing",
  "advertisement",
  "newsletter",
  "discount",
  "special offer",
  "free gift",
  "casino",
  "spam",
  "deal",
];

export const DEFAULT_ALLOWLIST_SENDERS = [
  "Tax Office",
  "Landlord",
  "City Government",
  "Bürgeramt",
  "Finanzamt",
  "Bank",
  "State Revenue",
  "City Tax Office",
];

// Cost constants (in USD)
export const COSTS = {
  REGISTRATION_USDC: 1.0,
  REGISTRATION_EURD: 0.05,
  SEND_LETTER_USDC: 0.05,
  SEND_LETTER_EURD: 0.01,
  ADDRESS_VERIFICATION: 0.02,
  INBOUND_UNLOCK: 0.01,
} as const;

// Time windows
export const TIME_WINDOWS = {
  SPEND_WINDOW_HOURS: 24,
  SPEND_WINDOW_MS: 24 * 60 * 60 * 1000,
} as const;

// Confidence thresholds for autonomy decisions
export const AUTONOMY_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.90,
  MEDIUM_CONFIDENCE: 0.70,
  LOW_CONFIDENCE: 0.50,
} as const;

// Retry configurations
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Database defaults
export const DB_DEFAULTS = {
  QUERY_TIMEOUT_MS: 5000,
  CONNECTION_POOL_SIZE: 10,
} as const;

// Rate limiting
export const RATE_LIMITS = {
  DEFAULT_WINDOW_MS: 60000, // 1 minute
  DEFAULT_MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 300000, // 5 minutes
  AUTH_MAX_REQUESTS: 10,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;
