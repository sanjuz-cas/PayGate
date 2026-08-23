import React from "react";
import type { NavPage } from "../components/Navigation";
import type { AgentState, AgentBalances } from "@juicebag-mail/shared";
import { ROUTE_PRICES, ROUTE_PRICES_EURD_DISPLAY } from "@juicebag-mail/shared";
import heroBgUrl from "../../demo_assets/hero_bg.jpg";

interface HeroPageProps {
  onNavigate: (page: NavPage) => void;
  onOpenChat: () => void;
  agentState?: AgentState | null;
  agentBalances?: AgentBalances | null;
  selectedCurrency: "usdc" | "eurd";
  onCurrencyChange: (currency: "usdc" | "eurd") => void;
  eurdEnabled: boolean;
  unreadCount: number;
}

export function HeroPage({
  onNavigate,
  onOpenChat,
  agentState,
  agentBalances,
  selectedCurrency,
  onCurrencyChange,
  eurdEnabled,
  unreadCount,
}: HeroPageProps) {
  const dailyCap = agentState?.guardrail?.dailyCapUsdc ?? 5.0;

  return (
    <div className="hero-viewport-root">
      {/* 3D Green Sculptural Background Asset */}
      <div className="hero-bg-canvas">
        <img
          src={heroBgUrl}
          alt="PayGate 3D Background"
          className="hero-bg-image"
        />
      </div>

      {/* 1. Top Black Floating Capsule Navbar */}
      <header className="hero-top-nav-wrap">
        <nav className="hero-capsule-navbar" aria-label="Main Navigation">
          <div
            className="hero-nav-brand"
            onClick={() => onNavigate("hero")}
            role="button"
            tabIndex={0}
          >
            <span className="hero-nav-star">✦</span>
            <span className="hero-nav-title">PayGate</span>
          </div>

          <div className="hero-nav-links">
            <button type="button" className="hero-nav-link" onClick={() => onNavigate("agent")}>
              <span>Console</span>
            </button>
            <button type="button" className="hero-nav-link" onClick={() => onNavigate("send")}>
              <span>Send Letter</span>
            </button>
            <button type="button" className="hero-nav-link" onClick={() => onNavigate("guardrails")}>
              <span>Guardrails</span>
            </button>
            <button type="button" className="hero-nav-link" onClick={() => onNavigate("ops")}>
              <span>Postal Ops</span>
            </button>
          </div>

          <div className="hero-nav-action">
            <button
              type="button"
              className="hero-launch-btn"
              onClick={() => onNavigate("agent")}
            >
              <span>Launch Console</span>
              <span className="hero-nav-arrow-circle" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* 2. Main Left-Aligned Editorial Content */}
      <main className="hero-content-main">
        {/* Protocol Live Pill Badge */}
        <div className="hero-protocol-badge">
          <span className="protocol-green-dot">●</span>
          <span className="protocol-network-text">Algorand MainNet &amp; TestNet</span>
          <span className="protocol-badge-divider" />
          <span className="protocol-status-text">x402 Protocol Live</span>
        </div>

        {/* Big Editorial Headline */}
        <h1 className="hero-headline">
          Autonomous Physical Mail
          <br />
          for the <span className="hero-green-text">AI Agent Economy.</span>
        </h1>

        {/* Subtitle Description */}
        <p className="hero-subdescription">
          Equip autonomous AI agents with physical postal mailboxes, real paper letter printing,
          and verified on-chain x402 micropayments on Algorand. Zero gas management, strict 24h budget guardrails.
        </p>

        {/* Action Button */}
        <div className="hero-actions-row">
          <button
            type="button"
            className="hero-btn-dark-pill"
            onClick={() => onNavigate("agent")}
          >
            <span>Open Agent Console</span>
            <span className="hero-btn-arrow-circle" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </span>
          </button>
        </div>
      </main>

      {/* 3. Bottom Centered Live Protocol Rates Pill */}
      <footer className="hero-bottom-rates-wrap">
        <div className="hero-rates-capsule-card">
          <div className="rate-col">
            <div className="rate-col-header">
              <span className="rate-dot">●</span>
              <span className="rate-col-lbl">Send Letter</span>
            </div>
            <div className="rate-col-val">
              {selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter}
            </div>
          </div>

          <div className="rate-card-divider" />

          <div className="rate-col">
            <div className="rate-col-header">
              <span className="rate-dot">●</span>
              <span className="rate-col-lbl">Unlock OCR</span>
            </div>
            <div className="rate-col-val">
              {selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock}
            </div>
          </div>

          <div className="rate-card-divider" />

          <div className="rate-col">
            <div className="rate-col-header">
              <span className="rate-dot">●</span>
              <span className="rate-col-lbl">Gas Fee</span>
            </div>
            <div className="rate-col-val">Zero (Sponsored)</div>
          </div>

          <div className="rate-card-divider" />

          <div className="rate-col">
            <div className="rate-col-header">
              <span className="rate-dot">●</span>
              <span className="rate-col-lbl">24h Guardrail</span>
            </div>
            <div className="rate-col-val">${dailyCap.toFixed(2)} Cap</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
