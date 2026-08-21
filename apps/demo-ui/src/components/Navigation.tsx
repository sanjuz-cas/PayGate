import React from "react";
import {
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";

export type NavPage = "agent" | "send" | "ops" | "guardrails";

interface NavigationProps {
  activePage: NavPage;
  onSelectPage: (page: NavPage) => void;
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
  const navItems: Array<{ id: NavPage; label: string; icon: string; badge?: number | string; alert?: boolean }> = [
    { id: "agent", label: "Agent Overview", icon: "🤖", badge: unreadInboundCount > 0 ? unreadInboundCount : undefined },
    { id: "send", label: "Send Letter", icon: "✉️" },
    { id: "guardrails", label: "Guardrails & Ledger", icon: "🛡️", alert: guardrailBlocked },
    { id: "ops", label: "Postal Ops Hub", icon: "🏢" },
  ];

  return (
    <header className="app-nav-header">
      <div className="nav-brand-wrap">
        <div className="nav-brand-logo" onClick={() => onSelectPage("agent")} role="button" tabIndex={0}>
          <div className="brand-symbol">PG</div>
          <div>
            <div className="brand-title">PayGate</div>
            <div className="brand-subtitle">Autonomous Physical Mail & x402</div>
          </div>
        </div>

        {/* Network & Protocol Status Pill */}
        <div className="protocol-badge">
          <span className="protocol-dot">●</span>
          <span>Algorand TestNet • x402</span>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="nav-tabs" role="tablist" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              className={`nav-tab ${isActive ? "is-active" : ""} ${item.alert ? "is-alert" : ""}`}
              onClick={() => onSelectPage(item.id)}
              type="button"
            >
              <span className="nav-tab-icon">{item.icon}</span>
              <span className="nav-tab-label">{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-tab-badge">{item.badge}</span>
              )}
              {item.alert && (
                <span className="nav-tab-alert-dot" title="Guardrail Blocked">!</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Utility Bar */}
      <div className="nav-utilities">
        {/* Currency Switcher */}
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

        {/* Price Strip */}
        <div className="nav-pricing-pills">
          <span className="nav-price-chip" title="Mailbox Registration fee">
            Reg: <strong>{currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration}</strong>
          </span>
          <span className="nav-price-chip" title="Send letter fee">
            Send: <strong>{currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter}</strong>
          </span>
          <span className="nav-price-chip" title="Unlock letter fee">
            Unlock: <strong>{currency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock}</strong>
          </span>
        </div>

        {/* AI Agent Chat Launcher */}
        <button
          type="button"
          onClick={onOpenChat}
          className="nav-chat-btn"
          aria-label="Open AI Agent Chat"
        >
          <span className="nav-chat-icon">💬</span>
          <span>Agent Chat</span>
        </button>
      </div>
    </header>
  );
}
