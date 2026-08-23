import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";

type WalletStatus = "disconnected" | "connecting" | "connected" | "awaiting_approval" | "settling" | "error";
type WalletContextValue = { address: string | null; status: WalletStatus; error: string | null; connect(): Promise<void>; disconnect(): Promise<void> };
const WalletContext = createContext<WalletContextValue | null>(null);

function bytesToBase64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value: string) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }

export function WalletConnectProvider({ children }: { children: ReactNode }) {
  const connector = useRef(new PeraWalletConnect({ chainId: 416002 }));
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const signing = useRef(false);
  const disconnect = async () => { try { await connector.current.disconnect(); } catch {} await api.clearWalletSession().catch(() => {}); setAddress(null); setStatus("disconnected"); };
  const connect = async () => { setError(null); setStatus("connecting"); try { const accounts = await connector.current.connect(); const connectedAddress = accounts[0]; if (!connectedAddress) throw new Error("Pera Wallet did not provide an Algorand account"); await api.walletSession(connectedAddress); setAddress(connectedAddress); setStatus("connected"); } catch (cause) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Unable to connect Pera Wallet"); } };
  useEffect(() => { void connector.current.reconnectSession().then(async (accounts: string[]) => { if (!accounts?.[0]) return; await api.walletSession(accounts[0]); setAddress(accounts[0]); setStatus("connected"); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!address) return;
    const interval = window.setInterval(() => { if (signing.current) return; void (async () => {
      const { requests } = await api.pendingSignatureRequests(); const request = requests.find((item) => item.walletAddress === address); if (!request) return;
      signing.current = true; setStatus("awaiting_approval");
      try {
        const group = request.unsignedTransactionsBase64.map((encoded, index) => {
          const bytes = base64ToBytes(encoded);
          const txn = algosdk.decodeUnsignedTransaction(bytes);
          return {
            txn,
            signers: request.indexesToSign.includes(index) ? [address] : []
          };
        });
        const signed = await connector.current.signTransaction([group] as any, address);
        const signedBase64 = signed.map((item: Uint8Array | null) => (item ? bytesToBase64(item) : ""));
        await api.approveSignatureRequest(request.id, signedBase64);
        setStatus("settling");
        window.setTimeout(() => setStatus("connected"), 1500);
      } catch (cause) {
        await api.rejectSignatureRequest(request.id, cause instanceof Error ? cause.message : "Wallet approval rejected").catch(() => {});
        setStatus("connected");
        setError(cause instanceof Error ? cause.message : "Wallet approval rejected");
      }
      finally { signing.current = false; }
    })().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not check wallet requests")); }, 1000);
    return () => window.clearInterval(interval);
  }, [address]);
  const value = useMemo(() => ({ address, status, error, connect, disconnect }), [address, status, error]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWalletConnect() { const value = useContext(WalletContext); if (!value) throw new Error("useWalletConnect must be used within WalletConnectProvider"); return value; }
