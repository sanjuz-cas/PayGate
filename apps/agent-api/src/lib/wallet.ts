import algosdk from "algosdk";

export function mnemonicToPrivateKeyBase64(mnemonic: string) {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  return Buffer.from(account.sk).toString("base64");
}

export function mnemonicToAddress(mnemonic: string) {
  return algosdk.mnemonicToSecretKey(mnemonic).addr.toString();
}

type AccountData = {
  amount?: number;
  assets?: Array<{ "asset-id": number; amount: number }>;
};

async function fetchAccount(algodUrl: string, address: string): Promise<AccountData> {
  const response = await fetch(`${algodUrl}/v2/accounts/${address}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.status}`);
  }
  return (await response.json()) as AccountData;
}

function findAsset(data: AccountData, asaId: number, decimals: number): number {
  const entry = data.assets?.find((a) => a["asset-id"] === asaId);
  return Number((((entry?.amount ?? 0) as number) / Math.pow(10, decimals)).toFixed(decimals));
}

export async function fetchBalances(
  address: string,
  algodTestnetUrl: string,
  algodMainnetUrl: string,
) {
  const [testnet, mainnet] = await Promise.all([
    fetchAccount(algodTestnetUrl, address),
    fetchAccount(algodMainnetUrl, address),
  ]);

  return {
    algo: Number(((testnet.amount ?? 0) / 1_000_000).toFixed(6)),
    usdc: findAsset(testnet, 10458941, 6),
    eurd: findAsset(mainnet, 1221682136, 2),
  };
}
