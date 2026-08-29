import React from "react";
import {
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";
import { useWalletConnect } from "../wallet/WalletConnectContext";
import { NavEcoTreeBadge } from "./NavEcoTreeBadge";

export type NavPage = "kaam" | "hero" | "agent" | "send" | "guardrails" | "ops";

interface NavigationProps {
  activePage: string;
  onSelectPage: (page: any) => void;
  currency: "usdc" | "eurd";
  onCurrencyChange: (currency: "usdc" | "eurd") => void;
  eurdEnabled: boolean;
  onOpenChat: () => void;
  unreadInboundCount: number;
  guardrailBlocked?: boolean;
  treesCount?: number;
  lastEvent?: any;
}

export function Navigation({
  activePage,
  onSelectPage,
  currency,
  onCurrencyChange,
  eurdEnabled,
  onOpenChat,
  unreadInboundCount,
  guardrailBlocked,
  treesCount = 0,
  lastEvent,
}: NavigationProps) {
  const wallet = useWalletConnect();

  const pageTitles: Record<string, string> = {
    kaam: "Kaam Citizen App",
    hero: "Overview",
    agent: "Overview",
    send: "Send Letter",
    guardrails: "Guardrails & Ledger",
    ops: "Postal Ops Hub",
  };

  const currentTitle = pageTitles[activePage] || "Overview";

  return (
    <header className="app-nav-header">
      {/* Left: Brand Logo & Context Breadcrumb */}
      <div className="nav-brand-wrap">
        <button
          type="button"
          onClick={() => onSelectPage("kaam")}
          className="nav-chat-pill-btn"
          style={{ background: "linear-gradient(135deg, #6366f1, #3b82f6)", color: "white", fontWeight: 700 }}
          title="Switch to Kaam Citizen Experience"
        >
          ← Kaam Citizen App
        </button>

        <div
          className="nav-brand-logo"
          onClick={() => onSelectPage("hero")}
          role="button"
          tabIndex={0}
          title="Return to Hero Page"
        >
          <div className="brand-symbol">PG</div>
          <div>
            <div className="brand-title">PayGate</div>
            <div className="brand-subtitle">Autonomous Mail &amp; x402</div>
          </div>
        </div>

        {/* Global Breadcrumb Separator & Active Workspace */}
        <div className="nav-breadcrumb-divider">/</div>
        <div className="nav-breadcrumb-crumb">
          <span className="nav-breadcrumb-section">Workspace</span>
          <span className="nav-breadcrumb-sub">›</span>
          <span className="nav-breadcrumb-current">{currentTitle}</span>
        </div>

        {/* Global Network Pill Badge */}
        <div className="nav-protocol-pill" title="Connected to Algorand TestNet via x402 facilitator">
          <span className="protocol-dot">●</span>
          <span className="protocol-text">Algorand TestNet</span>
          <span className="protocol-tag">x402</span>
        </div>
      </div>

      {/* Right: Tree Growing Badge, Wallet, Currency Toggle, Fee Rates, and Agent Chat Button */}
      <div className="nav-utilities">
        {/* Dynamic Tree Growing Animation Badge */}
        <NavEcoTreeBadge
          treesCount={treesCount}
          lastEvent={lastEvent}
          onClick={() => onSelectPage("agent")}
        />

        {/* Pera Wallet Connect / Disconnect */}
        <button
          type="button"
          className="nav-chat-pill-btn"
          onClick={() => void (wallet.address ? wallet.disconnect() : wallet.connect())}
          title={wallet.error ?? "Pera Wallet signs each x402 payment; PayGate never receives its private key."}
        >
          {wallet.status === "awaiting_approval" ? "Approve in Pera…" : wallet.status === "settling" ? "Settling…" : wallet.address ? `Wallet ${wallet.address.slice(0, 5)}…${wallet.address.slice(-4)}` : "Connect Wallet"}
        </button>

        {/* Segmented Currency Selector */}
        <div className="currency-selector" role="group" aria-label="Payment Token">
          <button
            type="button"
            className={`currency-btn ${currency === "usdc" ? "is-active" : ""}`}
            onClick={() => onCurrencyChange("usdc")}
          >
            USDC
          </button>
          <button
            type="button"
            className={`currency-btn ${currency === "eurd" ? "is-active" : ""}`}
            disabled={!eurdEnabled}
            onClick={() => onCurrencyChange("eurd")}
            title={eurdEnabled ? "Pay in EURD (Mainnet)" : "EURD unavailable"}
          >
            EURD
          </button>
        </div>

        {/* Fee Indicator Chips */}
        <div className="nav-pricing-pills">
          <div className="nav-fee-col">
            <span className="fee-label">Reg. Fee</span>
            <span className="fee-val">
              {currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration}
              <span className="info-icon" title="Mailbox Registration fee">ⓘ</span>
            </span>
          </div>
          <div className="nav-fee-col">
            <span className="fee-label">Send Fee</span>
            <span className="fee-val">
              {currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter}
              <span className="info-icon" title="Send letter fee">ⓘ</span>
            </span>
          </div>
          <div className="nav-fee-col">
            <span className="fee-label">Unlock Fee</span>
            <span className="fee-val">
              {currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock}
              <span className="info-icon" title="Unlock letter fee">ⓘ</span>
            </span>
          </div>
        </div>

        {/* Agent Chat Profile Pill Button */}
        <button
          type="button"
          onClick={onOpenChat}
          className="nav-chat-pill-btn"
          aria-label="Open AI Agent Chat"
        >
          <span className="chat-btn-icon">💬</span>
          <span className="chat-btn-text">Agent Chat</span>
        </button>
      </div>
    </header>
  );
}
