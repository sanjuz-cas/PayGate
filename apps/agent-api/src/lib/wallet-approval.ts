import { randomUUID } from "node:crypto";

/** The small portion of the x402 signer contract used by the AVM SDK. */
export type AvmSigner = {
  address: string;
  signTransactions(transactions: Uint8Array[], indexesToSign?: number[]): Promise<(Uint8Array | null)[]>;
};

export type SignatureRequest = {
  id: string;
  walletAddress: string;
  unsignedTransactionsBase64: string[];
  indexesToSign: number[];
  description: string;
  expiresAt: string;
};

type PendingRequest = SignatureRequest & {
  resolve: (signed: (Uint8Array | null)[]) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

/**
 * Keeps wallet authority in the browser: the API can construct a payment but
 * must wait for Pera to return a signature. Requests are one-time and expire.
 */
export function createWalletApprovalManager(options: {
  onSignatureRequired: (request: SignatureRequest) => Promise<void> | void;
  onSignatureApproved: (request: SignatureRequest) => Promise<void> | void;
}) {
  let walletAddress: string | null = null;
  const pending = new Map<string, PendingRequest>();

  function requireWalletAddress() {
    if (!walletAddress) {
      throw new Error("Connect a Pera wallet before authorizing an x402 payment");
    }
    return walletAddress;
  }

  return {
    connect(address: string) {
      walletAddress = address;
      return { address };
    },
    disconnect() {
      walletAddress = null;
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error("Wallet disconnected while approval was pending"));
      }
      pending.clear();
    },
    status() {
      return { connected: Boolean(walletAddress), address: walletAddress };
    },
    signer(description = "Approve x402 payment in Pera Wallet"): AvmSigner {
      return {
        get address() {
          return requireWalletAddress();
        },
        async signTransactions(transactions, indexesToSign) {
          const address = requireWalletAddress();
          const id = randomUUID();
          const expiresAt = new Date(Date.now() + 120_000).toISOString();
          const indexes = indexesToSign ?? transactions.map((_, index) => index);

          return await new Promise<(Uint8Array | null)[]>((resolve, reject) => {
            const request: PendingRequest = {
              id,
              walletAddress: address,
              unsignedTransactionsBase64: transactions.map((transaction) => Buffer.from(transaction).toString("base64")),
              indexesToSign: indexes,
              description,
              expiresAt,
              resolve,
              reject,
              timeout: setTimeout(() => {
                pending.delete(id);
                reject(new Error("Wallet approval timed out after 2 minutes"));
              }, 120_000),
            };
            pending.set(id, request);
            void options.onSignatureRequired(request);
          });
        },
      };
    },
    getRequest(id: string) {
      const request = pending.get(id);
      if (!request) return null;
      return {
        id: request.id,
        walletAddress: request.walletAddress,
        unsignedTransactionsBase64: request.unsignedTransactionsBase64,
        indexesToSign: request.indexesToSign,
        description: request.description,
        expiresAt: request.expiresAt,
      } satisfies SignatureRequest;
    },
    pendingRequests() {
      return [...pending.values()].map((request) => ({
        id: request.id,
        walletAddress: request.walletAddress,
        unsignedTransactionsBase64: request.unsignedTransactionsBase64,
        indexesToSign: request.indexesToSign,
        description: request.description,
        expiresAt: request.expiresAt,
      } satisfies SignatureRequest));
    },
    async approve(id: string, signedTransactionsBase64: string[]) {
      const request = pending.get(id);
      if (!request) throw new Error("Signature request was not found or has expired");
      if (Date.now() >= Date.parse(request.expiresAt)) throw new Error("Signature request has expired");
      let signed: (Uint8Array | null)[];
      if (signedTransactionsBase64.length === request.unsignedTransactionsBase64.length) {
        signed = signedTransactionsBase64.map((encoded, index) =>
          request.indexesToSign.includes(index) && encoded ? new Uint8Array(Buffer.from(encoded, "base64")) : null,
        );
      } else if (signedTransactionsBase64.length === request.indexesToSign.length) {
        let signedIdx = 0;
        signed = request.unsignedTransactionsBase64.map((_, index) => {
          if (request.indexesToSign.includes(index)) {
            const encoded = signedTransactionsBase64[signedIdx++];
            return encoded ? new Uint8Array(Buffer.from(encoded, "base64")) : null;
          }
          return null;
        });
      } else {
        throw new Error("Signed transaction count does not match the requested transaction group");
      }
      clearTimeout(request.timeout);
      pending.delete(id);
      request.resolve(signed);
      await options.onSignatureApproved(request);
    },
    reject(id: string, reason = "Wallet owner rejected the signature request") {
      const request = pending.get(id);
      if (!request) return;
      clearTimeout(request.timeout);
      pending.delete(id);
      request.reject(new Error(reason));
    },
  };
}
