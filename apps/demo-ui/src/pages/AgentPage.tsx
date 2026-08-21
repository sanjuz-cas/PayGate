import React, { useState, type ReactNode } from "react";
import type {
  AgentRegistrationInput,
  AgentState,
  AgentBalances,
} from "@juicebag-mail/shared";
import {
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";
import { AutonomyBadge } from "../components/AutonomyBadge";
import { ReasoningCallout } from "../components/ReasoningCallout";
import { BudgetBlockedAlert } from "../components/BudgetBlockedAlert";
import { SpendGauge } from "../components/SpendGauge";

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
}: AgentPageProps) {
  const [inboundFilter, setInboundFilter] = useState<"all" | "unlocked" | "pending" | "ignored">("all");

  const inboundLetters = agentState?.inboundLetters ?? [];
  const isRegistered = !!agentState?.registration;

  const filteredInbound = inboundLetters.filter((letter) => {
    if (inboundFilter === "unlocked") return letter.agentStatus === "received";
    if (inboundFilter === "pending") return letter.agentStatus === "pending";
    if (inboundFilter === "ignored") return letter.agentStatus === "ignored";
    return true;
  });

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Agent Console & Mailbox</h1>
          <p className="page-description">
            Monitor autonomous mail intake, wallet balances, and pre-payment budget limits on Algorand.
          </p>
        </div>
        <div className="page-actions-group">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNavigateToSend}
            disabled={!isRegistered}
          >
            <span>✉️</span>
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

      {/* Top Metrics & Guardrail Grid */}
      <div className="dashboard-top-grid">
        {/* Spending Guardrail Card */}
        <div className="grid-span-2">
          <SpendGauge
            guardrail={agentState?.guardrail}
            onUpdateCap={onUpdateCap}
            isUpdatingCap={isUpdatingCap}
          />
        </div>

        {/* Live Wallet Balances */}
        <div className="card balance-card">
          <div className="card-header">
            <h3 className="card-title">Agent Wallet Balances</h3>
            <span className="card-meta">TestNet / MainNet</span>
          </div>
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">USDC (TestNet)</span>
              <div className="balance-val">
                <strong>${agentBalances.usdc.toFixed(3)}</strong>
                <small>USDC</small>
              </div>
            </div>
            <div className="balance-item">
              <span className="balance-label">ALGO (Gas)</span>
              <div className="balance-val">
                <strong>{agentBalances.algo.toFixed(3)}</strong>
                <small>ALGO</small>
              </div>
            </div>
            <div className="balance-item">
              <span className="balance-label">EURD (Quantoz)</span>
              <div className="balance-val">
                <strong>€{agentBalances.eurd.toFixed(2)}</strong>
                <small>EURD</small>
              </div>
            </div>
          </div>
          <div className="wallet-address-strip">
            <span className="wallet-address-label">Wallet Address:</span>
            <span className="wallet-address-val">
              {agentBalances.address ? `${agentBalances.address.slice(0, 10)}...${agentBalances.address.slice(-6)}` : "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* Identity & Inbound Section */}
      <div className="dashboard-main-grid">
        {/* Left Column: Mailbox Identity */}
        <div className="col-identity">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Physical Mailbox Identity</h3>
              {isRegistered && (
                <span className="badge badge--success">Registered</span>
              )}
            </div>

            {isRegistered ? (
              <div className="identity-details">
                <div className="mailbox-id-banner">
                  <span className="label">Mailbox ID</span>
                  <strong className="val">{agentState.registration?.mailboxId}</strong>
                </div>
                <div className="address-box">
                  <div className="address-name">{agentState.registration?.agentName}</div>
                  <div className="address-line">{agentState.registration?.legalIdentity.name}</div>
                  <div className="address-line">{agentState.registration?.legalIdentity.street1}</div>
                  <div className="address-line">
                    {agentState.registration?.legalIdentity.postalCode}{" "}
                    {agentState.registration?.legalIdentity.city}
                  </div>
                  <div className="address-line country-pill">
                    {agentState.registration?.legalIdentity.country}
                  </div>
                </div>
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onRegister();
                }}
              >
                <p className="form-helper-text">
                  Register this agent with the physical mail hub via an on-chain x402 payment.
                </p>
                <div className="form-field">
                  <label>Agent Name</label>
                  <input
                    type="text"
                    value={registrationForm.agentName}
                    onChange={(e) =>
                      onRegistrationChange((prev) => ({ ...prev, agentName: e.target.value }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Legal Entity Name</label>
                  <input
                    type="text"
                    value={registrationForm.legalIdentity.name}
                    onChange={(e) =>
                      onRegistrationChange((prev) => ({
                        ...prev,
                        legalIdentity: { ...prev.legalIdentity, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={registrationForm.legalIdentity.street1}
                    onChange={(e) =>
                      onRegistrationChange((prev) => ({
                        ...prev,
                        legalIdentity: { ...prev.legalIdentity, street1: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="form-row-split">
                  <div className="form-field">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={registrationForm.legalIdentity.postalCode}
                      onChange={(e) =>
                        onRegistrationChange((prev) => ({
                          ...prev,
                          legalIdentity: { ...prev.legalIdentity, postalCode: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>City</label>
                    <input
                      type="text"
                      value={registrationForm.legalIdentity.city}
                      onChange={(e) =>
                        onRegistrationChange((prev) => ({
                          ...prev,
                          legalIdentity: { ...prev.legalIdentity, city: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn--primary btn--full"
                  disabled={busyActions.has("register")}
                >
                  {busyActions.has("register")
                    ? "Registering On-Chain..."
                    : `Register Mailbox (${selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.registration : ROUTE_PRICES.registration})`}
                </button>
              </form>
            )}
          </div>

          {/* Latest Agent Event */}
          <div className="card event-stream-card">
            <div className="card-header">
              <h3 className="card-title">Live x402 Agent Event</h3>
              <span className="live-indicator">● LIVE SSE</span>
            </div>
            <div className="event-stream-body">
              <p className="event-msg">{currentAgentEvent?.message ?? "Waiting for incoming mail or payments..."}</p>
              {currentAgentEvent?.txid && (
                <div className="event-txid-row">
                  <span>Tx:</span>
                  <a
                    href={`https://testnet.explorer.perawallet.app/tx/${currentAgentEvent.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    {currentAgentEvent.txid.slice(0, 14)}... ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Inbound Mail Inbox */}
        <div className="col-inbox">
          <div className="card">
            <div className="card-header-with-actions">
              <div>
                <h3 className="card-title">Inbound Physical Mailbox</h3>
                <span className="card-subtitle">
                  {inboundLetters.length} total letters received & triage-evaluated
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="filter-tab-bar">
                <button
                  type="button"
                  className={`filter-tab ${inboundFilter === "all" ? "is-active" : ""}`}
                  onClick={() => setInboundFilter("all")}
                >
                  All ({inboundLetters.length})
                </button>
                <button
                  type="button"
                  className={`filter-tab ${inboundFilter === "unlocked" ? "is-active" : ""}`}
                  onClick={() => setInboundFilter("unlocked")}
                >
                  🛡️ Auto-Unlocked ({inboundLetters.filter((l) => l.agentStatus === "received").length})
                </button>
                <button
                  type="button"
                  className={`filter-tab ${inboundFilter === "pending" ? "is-active" : ""}`}
                  onClick={() => setInboundFilter("pending")}
                >
                  ⏳ Pending ({inboundLetters.filter((l) => l.agentStatus === "pending").length})
                </button>
                <button
                  type="button"
                  className={`filter-tab ${inboundFilter === "ignored" ? "is-active" : ""}`}
                  onClick={() => setInboundFilter("ignored")}
                >
                  🚫 Ignored ({inboundLetters.filter((l) => l.agentStatus === "ignored").length})
                </button>
              </div>
            </div>

            {/* Inbound Letters List */}
            {filteredInbound.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No letters matching filter</div>
                <p className="empty-desc">
                  Switch to &ldquo;Postal Ops Hub&rdquo; in the top navigation to ingest and scan inbound postal mail.
                </p>
              </div>
            ) : (
              <div className="letter-item-list">
                {filteredInbound.map((letter) => {
                  const decision = agentState?.recentAutonomyDecisions?.find((d) => d.letterId === letter.id);
                  const isUnlocked = letter.agentStatus === "received";
                  const isPending = letter.agentStatus === "pending";
                  const isIgnored = letter.agentStatus === "ignored";

                  return (
                    <div
                      key={letter.id}
                      className={`letter-item-row ${isUnlocked ? "is-unlocked" : isIgnored ? "is-ignored" : "is-pending"}`}
                      onClick={() => onSelectLetterModal(letter)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="letter-left-info">
                        <div className="letter-title-row">
                          <strong className="letter-from-name">{letter.fromName}</strong>
                          <AutonomyBadge decision={decision?.decision} confidence={decision?.confidence} compact />
                          <span className={`status-pill status-pill--${letter.agentStatus}`}>
                            {letter.agentStatus}
                          </span>
                        </div>
                        <p className="letter-summary-text">{letter.envelopeSummary}</p>

                        {/* Expandable Reasoning Note */}
                        {decision && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ReasoningCallout reason={decision.reason} evaluatedAt={decision.evaluatedAt} />
                          </div>
                        )}

                        <div className="letter-meta-row">
                          <span>Received: {new Date(letter.receivedAt).toLocaleString()}</span>
                          {letter.unlockPaymentTxid && (
                            <span className="proof-tag" onClick={(e) => e.stopPropagation()}>
                              <span>⛓️</span>
                              <a
                                href={`https://testnet.explorer.perawallet.app/tx/${letter.unlockPaymentTxid}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Tx: {letter.unlockPaymentTxid.slice(0, 8)}... ↗
                              </a>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="letter-right-actions" onClick={(e) => e.stopPropagation()}>
                        {!isUnlocked && !isIgnored && (
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            disabled={busyActions.has(`unlock-${letter.id}`)}
                            onClick={() => void onUnlockLetter(letter.id)}
                          >
                            {busyActions.has(`unlock-${letter.id}`)
                              ? "Unlocking..."
                              : `Unlock ($${selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.inboundUnlock : ROUTE_PRICES.inboundUnlock})`}
                          </button>
                        )}
                        {isPending && (
                          <button
                            type="button"
                            className="btn btn--sm btn--outline"
                            disabled={busyActions.has(`ignore-${letter.id}`)}
                            onClick={() => void onIgnoreLetter(letter.id)}
                          >
                            Ignore
                          </button>
                        )}
                        {isUnlocked && (
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => onSelectLetterModal(letter)}
                          >
                            Read Full Text ↗
                          </button>
                        )}
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
