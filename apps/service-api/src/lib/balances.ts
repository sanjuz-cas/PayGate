import type { ServiceEnv } from "./env.js";

type ServiceBalances = {
  usdc: number;
  eurd: number;
  address: string;
};

const balanceCache = new Map<string, ServiceBalances>();
const inFlightRefreshes = new Map<string, Promise<ServiceBalances>>();

export function getCachedServiceBalances(env: ServiceEnv): ServiceBalances {
  return balanceCache.get(env.SELLER_ADDRESS) ?? { usdc: 0, eurd: 0, address: env.SELLER_ADDRESS };
}

export function refreshServiceBalances(env: ServiceEnv) {
  const address = env.SELLER_ADDRESS;
  const existing = inFlightRefreshes.get(address);
  if (existing) return existing;

  const refresh = Promise.all([
    fetch(`${env.ALGOD_URL}/v2/accounts/${address}`),
    fetch(`${env.ALGOD_MAINNET_URL}/v2/accounts/${env.SELLER_ADDRESS}`),
  ])
    .then(async ([testnetRes, mainnetRes]) => {
      if (!testnetRes.ok) throw new Error(`Algod testnet responded with ${testnetRes.status}`);
      if (!mainnetRes.ok) throw new Error(`Algod mainnet responded with ${mainnetRes.status}`);
      const [testnetData, mainnetData] = (await Promise.all([
        testnetRes.json(),
        mainnetRes.json(),
      ])) as Array<{ assets?: Array<{ "asset-id": number; amount: number }> }>;
      const usdcAsset = testnetData.assets?.find((a) => a["asset-id"] === 10458941);
      const eurdAsset = mainnetData.assets?.find((a) => a["asset-id"] === 1221682136);
      const parsed: ServiceBalances = {
        usdc: Number((((usdcAsset?.amount ?? 0) as number) / 1_000_000).toFixed(6)),
        eurd: Number((((eurdAsset?.amount ?? 0) as number) / 100).toFixed(2)),
        address,
      };
      balanceCache.set(address, parsed);
      return parsed;
    })
    .catch((error: unknown) => {
      const cached = balanceCache.get(address);
      if (cached) return cached;
      throw error;
    })
    .finally(() => {
      inFlightRefreshes.delete(address);
    });

  inFlightRefreshes.set(address, refresh);
  return refresh;
}
