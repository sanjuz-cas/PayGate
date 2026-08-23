import React, { useState } from "react";
import type {
  AgentRegistrationInput,
  AgentState,
  AgentBalances,
} from "@juicebag-mail/shared";
import { AutonomyBadge } from "../components/AutonomyBadge";
import { ReasoningCallout } from "../components/ReasoningCallout";
import { BudgetBlockedAlert } from "../components/BudgetBlockedAlert";
import bannerImageUrl from "../../demo_assets/dashboard_banner.png";

interface AgentPageProps {
  agentState?: AgentState | null;
  agentBalances: AgentBalances;
  selectedCurrency: "usdc" | "eurd";
  registrationForm: AgentRegistrationInput;
  onRegistrationChange: (updater: (prev: AgentRegistrationInput) => AgentRegistrationInput) => void;
  onRegister: () => Promise<void>;
  onUnlockLetter: (letterId: string) => Promise<void>;
  onIgnoreLetter: (letterId: string) => Promise<void>;
  onSelectLetterModal: (letter: AgentState["inboundLetters"][number]) => void;
  onUpdateCap: (newCap: number) => Promise<void>;
  isUpdatingCap: boolean;
  busyActions: Set<string>;
  budgetBlockedAlert: any;
  onDismissBudgetAlert: () => void;
  currentAgentEvent: any;
  onNavigateToSend: () => void;
  onNavigateToOps?: () => void;
}

export function AgentPage({
  agentState,
  agentBalances,
  selectedCurrency,
  registrationForm,
  onRegistrationChange,
  onRegister,
  onUnlockLetter,
  onIgnoreLetter,
  onSelectLetterModal,
  onUpdateCap,
  isUpdatingCap,
  busyActions,
  budgetBlockedAlert,
  onDismissBudgetAlert,
  currentAgentEvent,
  onNavigateToSend,
  onNavigateToOps,
}: AgentPageProps) {
  const [inboundFilter, setInboundFilter] = useState<"all" | "unlocked" | "pending" | "ignored">("all");
  const [customCapInput, setCustomCapInput] = useState("");
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const inboundLetters = agentState?.inboundLetters ?? [];
  const isRegistered = !!agentState?.registration;
  const agentName = agentState?.registration?.agentName ?? registrationForm.agentName ?? "Acme Filing Agent";
  const guardrail = agentState?.guardrail;

  const currentSpend = guardrail?.currentSpendUsdc ?? 0;
  const dailyCap = guardrail?.dailyCapUsdc ?? 5.0;
  const remaining = Math.max(0, dailyCap - currentSpend);
  const isBlocked = guardrail?.blocked ?? false;
  const percentUsed = dailyCap > 0 ? Math.min(100, Math.round((currentSpend / dailyCap) * 100)) : 0;

  const unlockedCount = inboundLetters.filter((l) => l.agentStatus === "received").length;
  const pendingCount = inboundLetters.filter((l) => l.agentStatus === "pending").length;
  const ignoredCount = inboundLetters.filter((l) => l.agentStatus === "ignored").length;

  const filteredInbound = inboundLetters.filter((letter) => {
    if (inboundFilter === "unlocked") return letter.agentStatus === "received";
    if (inboundFilter === "pending") return letter.agentStatus === "pending";
    if (inboundFilter === "ignored") return letter.agentStatus === "ignored";
    return true;
  });

  const handleCopyAddress = () => {
    if (agentBalances?.address) {
      void navigator.clipboard.writeText(agentBalances.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleCustomCapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customCapInput);
    if (!isNaN(val) && val >= 0.01) {
      void onUpdateCap(val);
      setIsEditingCustom(false);
    }
  };

  return (
    <div className="dashboard-content-area">
      {/* 1. Top Welcome Banner with Landscape Artwork Background & Rich Typography */}
      <div className="dash-welcome-banner">
        <div className="welcome-banner-bg" style={{ backgroundImage: `url(${bannerImageUrl})` }} />
        <div className="welcome-banner-overlay" />
        <div className="welcome-banner-content">
          <div className="welcome-orb" />
          <h1 className="welcome-heading">
            Welcome back,
            <br />
            <span className="welcome-name-green">{agentName}.</span>
          </h1>
          <p className="welcome-subtext">
            Monitor autonomous mail intake, wallet balances, and pre-payment budget limits on Algorand.
          </p>
          <button
            type="button"
            className="welcome-compose-btn"
            onClick={onNavigateToSend}
          >
            <span className="btn-icon">✍</span>
            <span>Compose Outbound Letter</span>
          </button>
        </div>
      </div>

      {/* Real-time Budget Block Alert Banner */}
      {budgetBlockedAlert && (
        <BudgetBlockedAlert
          message={budgetBlockedAlert.message}
          requestedAmount={budgetBlockedAlert.requestedAmount}
          currentSpend={budgetBlockedAlert.currentSpend}
          cap={budgetBlockedAlert.cap}
          onDismiss={onDismissBudgetAlert}
          onIncreaseCap={() => void onUpdateCap(5.0)}
        />
      )}

      {/* 2. Top Two-Column Grid: 24h Spending Guardrail & Agent Wallet Balances */}
      <div className="dash-two-col-grid">
        {/* Left Card: 24h Spending Guardrail */}
        <div className="dash-card guardrail-card">
          <div className="dash-card-header">
            <div className="card-header-left">
              <div className="card-header-icon-box green-icon-box">🛡️</div>
              <div>
                <h2 className="card-title">24h Spending Guardrail</h2>
                <p className="card-subtitle">Pre-payment Autonomous Budget Safety</p>
              </div>
            </div>
            <div className={`status-pill ${isBlocked ? "status-pill--blocked" : "status-pill--active"}`}>
              <span className="pill-dot">●</span>
              <span>{isBlocked ? "BUDGET BLOCKED" : "ACTIVE & PROTECTED"}</span>
            </div>
          </div>

          {/* Metric Triplets */}
          <div className="guardrail-metrics-row">
            <div className="metric-cell">
              <span className="metric-label">24H SPENT</span>
              <div className="metric-val-wrap">
                <span className="metric-num">${currentSpend.toFixed(2)}</span>
                <span className="metric-unit">USDC</span>
              </div>
            </div>
            <div className="metric-cell">
              <span className="metric-label">DAILY CAP</span>
              <div className="metric-val-wrap">
                <span className="metric-num">${dailyCap.toFixed(2)}</span>
                <span className="metric-unit">USDC</span>
              </div>
            </div>
            <div className="metric-cell">
              <span className="metric-label">REMAINING</span>
              <div className="metric-val-wrap">
                <span className="metric-num remaining-val">${remaining.toFixed(2)}</span>
                <span className="metric-unit">USDC</span>
              </div>
            </div>
          </div>

          {/* Progress Bar with Limit Label */}
          <div className="guardrail-progress-section">
            <div className="progress-label-row">
              <span className="progress-consumed-text">{percentUsed}% of daily limit consumed</span>
              <span className="progress-window-text">Rolling 24-hour window</span>
            </div>
            <div className="dash-progress-track">
              <div
                className={`dash-progress-bar ${isBlocked ? "is-blocked" : percentUsed > 75 ? "is-warning" : "is-healthy"}`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="progress-scale-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quick-Cap Presets Row */}
          <div className="quick-cap-row">
            <span className="quick-cap-label">Demo Quick-Cap:</span>
            <div className="quick-cap-buttons">
              <button
                type="button"
                className="cap-btn cap-btn--red"
                onClick={() => void onUpdateCap(0.05)}
                disabled={isUpdatingCap}
                title="Drop cap to $0.05 to trigger block rejection"
              >
                Trigger Block ($0.05)
              </button>
              <button
                type="button"
                className={`cap-btn ${dailyCap === 1.0 ? "is-selected" : ""}`}
                onClick={() => void onUpdateCap(1.0)}
                disabled={isUpdatingCap}
              >
                $1.00
              </button>
              <button
                type="button"
                className={`cap-btn ${dailyCap === 5.0 ? "is-selected-dark" : ""}`}
                onClick={() => void onUpdateCap(5.0)}
                disabled={isUpdatingCap}
              >
                $5.00 (Default)
              </button>
              {isEditingCustom ? (
                <form onSubmit={handleCustomCapSubmit} className="custom-cap-form">
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    max="100"
                    placeholder="USD"
                    value={customCapInput}
                    onChange={(e) => setCustomCapInput(e.target.value)}
                    className="custom-cap-input"
                    autoFocus
                  />
                  <button type="submit" className="custom-cap-submit">Set</button>
                  <button type="button" onClick={() => setIsEditingCustom(false)} className="custom-cap-cancel">✕</button>
                </form>
              ) : (
                <button
                  type="button"
                  className="cap-btn"
                  onClick={() => setIsEditingCustom(true)}
                  disabled={isUpdatingCap}
                >
                  Custom...
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Agent Wallet Balances */}
        <div className="dash-card balances-card">
          <div className="dash-card-header">
            <h2 className="card-title">Agent Wallet Balances</h2>
            <span className="card-right-label">TestNet / MainNet</span>
          </div>

          {/* 3 Token Balance Cards in a Row */}
          <div className="tokens-row">
            {/* USDC Card */}
            <div className="token-cell">
              <div className="token-cell-header">
                <div className="token-icon usdc-icon">$</div>
                <div className="token-name-wrap">
                  <span className="token-symbol">USDC</span>
                  <span className="token-network">(TESTNET)</span>
                </div>
              </div>
              <div className="token-amount">
                ${agentBalances?.usdc?.toFixed(3) ?? "0.000"}
              </div>
              <div className="token-currency-label">USDC</div>
            </div>

            {/* ALGO Card */}
            <div className="token-cell">
              <div className="token-cell-header">
                <div className="token-icon algo-icon">▲</div>
                <div className="token-name-wrap">
                  <span className="token-symbol">ALGO</span>
                  <span className="token-network">(GAS)</span>
                </div>
              </div>
              <div className="token-amount">
                {agentBalances?.algo?.toFixed(3) ?? "0.000"}
              </div>
              <div className="token-currency-label">ALGO</div>
            </div>

            {/* EURD Card */}
            <div className="token-cell">
              <div className="token-cell-header">
                <div className="token-icon eurd-icon">€</div>
                <div className="token-name-wrap">
                  <span className="token-symbol">EURD</span>
                  <span className="token-network">(QUANTOZ)</span>
                </div>
              </div>
              <div className="token-amount">
                €{agentBalances?.eurd?.toFixed(2) ?? "0.00"}
              </div>
              <div className="token-currency-label">EURD</div>
            </div>
          </div>

          {/* Wallet Address Row with Copy Tool */}
          <div className="wallet-address-bar">
            <span className="address-bar-title">Wallet Address</span>
            <div className="address-bar-content" onClick={handleCopyAddress} role="button" tabIndex={0}>
              <span className="address-hash-text">
                {agentBalances?.address
                  ? `${agentBalances.address.slice(0, 10)}••••••••••••••••••••••••••••••••${agentBalances.address.slice(-6)}`
                  : "••••••••••••••••••••••••••••••••"}
              </span>
              <button
                type="button"
                className="copy-address-btn"
                title={copiedAddress ? "Copied!" : "Copy Wallet Address"}
              >
                {copiedAddress ? "✓" : "⧉"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Two-Column Grid: Physical Mailbox Identity & Inbound Physical Mailbox */}
      <div className="dash-two-col-grid middle-grid">
        {/* Left Card: Physical Mailbox Identity */}
        <div className="dash-card identity-card">
          <div className="dash-card-header">
            <div className="card-header-left">
              <div className="card-header-icon-box green-icon-box">📇</div>
              <div>
                <h2 className="card-title">Physical Mailbox Identity</h2>
                <p className="card-subtitle">
                  {isRegistered
                    ? "Agent registered and active with physical mailbox hub."
                    : "Register this agent with the physical mail hub via an on-chain x402 payment."}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onRegister();
            }}
            className="identity-form-body"
          >
            <div className="form-input-group">
              <label className="form-input-label">Agent Name</label>
              <input
                type="text"
                className="dash-text-input"
                placeholder="e.g. Acme Filing Agent"
                value={registrationForm.agentName}
                onChange={(e) =>
                  onRegistrationChange((prev) => ({
                    ...prev,
                    agentName: e.target.value,
                  }))
                }
                disabled={isRegistered}
              />
            </div>

            <div className="form-input-group">
              <label className="form-input-label">Legal Entity Name</label>
              <input
                type="text"
                className="dash-text-input"
                placeholder="e.g. Acme Corporation LLC"
                value={registrationForm.legalIdentity.name}
                onChange={(e) =>
                  onRegistrationChange((prev) => ({
                    ...prev,
                    legalIdentity: {
                      ...prev.legalIdentity,
                      name: e.target.value,
                    },
                  }))
                }
                disabled={isRegistered}
              />
            </div>

            <button
              type="submit"
              className="dash-full-btn"
              disabled={isRegistered || busyActions.has("register")}
            >
              <span className="btn-icon">🔏</span>
              <span>{isRegistered ? "Identity Registered & Locked" : "Save Identity"}</span>
            </button>
          </form>
        </div>

        {/* Right Card: Inbound Physical Mailbox */}
        <div className="dash-card inbound-card">
          <div className="dash-card-header">
            <div className="card-header-left">
              <div className="card-header-icon-box green-icon-box">📬</div>
              <div>
                <h2 className="card-title">Inbound Physical Mailbox</h2>
                <p className="card-subtitle">{inboundLetters.length} total letters received &amp; triage-evaluated</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="inbound-filter-pills" role="tablist">
              <button
                type="button"
                className={`filter-pill ${inboundFilter === "all" ? "is-active" : ""}`}
                onClick={() => setInboundFilter("all")}
              >
                All ({inboundLetters.length})
              </button>
              <button
                type="button"
                className={`filter-pill filter-pill--blue ${inboundFilter === "unlocked" ? "is-active" : ""}`}
                onClick={() => setInboundFilter("unlocked")}
              >
                🛡️ Auto-Unlocked ({unlockedCount})
              </button>
              <button
                type="button"
                className={`filter-pill filter-pill--amber ${inboundFilter === "pending" ? "is-active" : ""}`}
                onClick={() => setInboundFilter("pending")}
              >
                ⏳ Pending ({pendingCount})
              </button>
              <button
                type="button"
                className={`filter-pill filter-pill--red ${inboundFilter === "ignored" ? "is-active" : ""}`}
                onClick={() => setInboundFilter("ignored")}
              >
                🚫 Ignored ({ignoredCount})
              </button>
            </div>
          </div>

          {/* Inbound Letters Container */}
          <div className="inbound-mailbox-container">
            {filteredInbound.length === 0 ? (
              <div className="inbound-empty-state">
                <div className="empty-mailbox-icon">📭</div>
                <h3 className="empty-state-heading">No letters matching filter</h3>
                <p className="empty-state-text">
                  Switch to &ldquo;Postal Ops Hub&rdquo; in the top navigation to view and manage operations.
                </p>
                {onNavigateToOps && (
                  <button
                    type="button"
                    className="empty-state-link-btn"
                    onClick={onNavigateToOps}
                  >
                    Go to Postal Ops Hub ↗
                  </button>
                )}
              </div>
            ) : (
              <div className="inbound-letters-list">
                {filteredInbound.map((letter) => {
                  const decision = agentState?.recentAutonomyDecisions?.find((d) => d.letterId === letter.id);
                  const isReceived = letter.agentStatus === "received";
                  const isIgnored = letter.agentStatus === "ignored";

                  return (
                    <div
                      key={letter.id}
                      className="inbound-item-card"
                      onClick={() => onSelectLetterModal(letter)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="inbound-item-top">
                        <div className="inbound-item-title-group">
                          <span className="inbound-sender-name">{letter.fromName}</span>
                          <span className="inbound-item-date">{new Date(letter.receivedAt).toLocaleDateString()}</span>
                        </div>
                        {decision && (
                          <AutonomyBadge decision={decision.decision} confidence={decision.confidence} />
                        )}
                      </div>

                      <p className="inbound-item-summary">{letter.envelopeSummary}</p>

                      {decision && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ReasoningCallout reason={decision.reason} evaluatedAt={decision.evaluatedAt} />
                        </div>
                      )}

                      <div className="inbound-item-footer" onClick={(e) => e.stopPropagation()}>
                        <span className={`status-badge status-badge--${letter.agentStatus}`}>
                          {letter.agentStatus.toUpperCase()}
                        </span>

                        <div className="inbound-item-actions">
                          {!isReceived && !isIgnored && (
                            <>
                              <button
                                type="button"
                                className="dash-small-btn dash-small-btn--unlock"
                                onClick={() => void onUnlockLetter(letter.id)}
                                disabled={busyActions.has(`unlock-${letter.id}`)}
                              >
                                Unlock OCR ($0.20)
                              </button>
                              <button
                                type="button"
                                className="dash-small-btn dash-small-btn--ignore"
                                onClick={() => void onIgnoreLetter(letter.id)}
                                disabled={busyActions.has(`ignore-${letter.id}`)}
                              >
                                Ignore
                              </button>
                            </>
                          )}
                          {isReceived && (
                            <button
                              type="button"
                              className="dash-small-btn dash-small-btn--view"
                              onClick={() => onSelectLetterModal(letter)}
                            >
                              View Scanned OCR Text
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
