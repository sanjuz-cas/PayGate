import React from "react";
import {
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";

export type NavPage = "hero" | "agent" | "send" | "guardrails" | "ops";

interface NavigationProps {
  activePage: string;
  onSelectPage: (page: any) => void;
  currency: "usdc" | "eurd";
  onCurrencyChange: (currency: "usdc" | "eurd") => void;
  eurdEnabled: boolean;
  onOpenChat: () => void;
  unreadInboundCount: number;
  guardrailBlocked?: boolean;
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
}: NavigationProps) {
  const navItems: Array<{ id: string; label: string }> = [
    { id: "agent", label: "Overview" },
    { id: "send", label: "Send Letter" },
    { id: "guardrails", label: "Guardrails & Ledger" },
    { id: "ops", label: "Postal Ops Hub" },
  ];

  return (
    <header className="app-nav-header">
      {/* Left: Brand Logo */}
      <div className="nav-brand-wrap">
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
      </div>

      {/* Center: Underlined Navigation Tabs with Green Active Indicator */}
      <nav className="nav-tabs-clean" role="tablist" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = activePage === item.id || (activePage === "hero" && item.id === "agent");
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              className={`nav-tab-clean ${isActive ? "is-active" : ""}`}
              onClick={() => onSelectPage(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              {isActive && <div className="nav-active-pill-bar" />}
              {item.id === "agent" && unreadInboundCount > 0 && (
                <span className="nav-tab-badge">{unreadInboundCount}</span>
              )}
              {item.id === "guardrails" && guardrailBlocked && (
                <span className="nav-tab-alert-dot" title="Guardrail Blocked">!</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Currency Toggle, Fee Rates, and Agent Chat Button */}
      <div className="nav-utilities">
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
