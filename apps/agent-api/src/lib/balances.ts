import type { AgentEnv } from "./env.js";
import { fetchBalances, mnemonicToAddress } from "./wallet.js";

type AgentBalances = {
  algo: number;
  usdc: number;
  eurd: number;
  address: string;
};

const balanceCache = new Map<string, AgentBalances>();
const inFlightRefreshes = new Map<string, Promise<AgentBalances>>();

function defaultBalances(address: string): AgentBalances {
  return {
    algo: 0,
    usdc: 0,
    eurd: 0,
    address,
  };
}

export function getCachedAgentBalances(env: AgentEnv): AgentBalances {
  const address = mnemonicToAddress(env.mnemonic);
  return balanceCache.get(address) ?? defaultBalances(address);
}

export function refreshAgentBalances(env: AgentEnv) {
  const address = mnemonicToAddress(env.mnemonic);
  const existing = inFlightRefreshes.get(address);
  if (existing) {
    return existing;
  }

  const refresh = fetchBalances(address, env.ALGOD_URL, env.ALGOD_MAINNET_URL)
    .then((next) => {
      const parsed: AgentBalances = {
        ...next,
        address,
      };
      balanceCache.set(address, parsed);
      return parsed;
    })
    .catch((error) => {
      const cached = balanceCache.get(address);
      if (cached) {
        return cached;
      }
      throw error;
    })
    .finally(() => {
      inFlightRefreshes.delete(address);
    });

  inFlightRefreshes.set(address, refresh);
  return refresh;
}
