import React from "react";
import type {
  AgentState,
  AgentGuardrail,
  AutonomyDecision,
} from "@juicebag-mail/shared";
import { SpendGauge } from "../components/SpendGauge";
import { AutonomyBadge } from "../components/AutonomyBadge";

interface GuardrailsPageProps {
  guardrail?: AgentGuardrail;
  decisions: AutonomyDecision[];
  recentPayments: AgentState["recentPayments"];
  onUpdateCap: (newCap: number) => Promise<void>;
  isUpdatingCap: boolean;
}

export function GuardrailsPage({
  guardrail,
  decisions,
  recentPayments,
  onUpdateCap,
  isUpdatingCap,
}: GuardrailsPageProps) {
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Spending Guardrails & Decision Ledger</h1>
          <p className="page-description">
            Transparent audit logs, safety limits, and autonomous decision history governing all agent payments.
          </p>
        </div>
      </div>

      {/* Main Guardrail Control Card */}
      <div style={{ marginBottom: "24px" }}>
        <SpendGauge
          guardrail={guardrail}
          onUpdateCap={onUpdateCap}
          isUpdatingCap={isUpdatingCap}
        />
      </div>

      <div className="dashboard-top-grid">
        {/* Left Column: Autonomous Decision Engine Audit Trail */}
        <div className="grid-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Autonomous Mail Decision History</h3>
              <span className="card-meta">{decisions.length} evaluations recorded</span>
            </div>

            {decisions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🧠</div>
                <div className="empty-title">No decisions recorded yet</div>
                <p className="empty-desc">
                  Incoming mail notifications will be automatically evaluated here with confidence scoring and keyword matching.
                </p>
              </div>
            ) : (
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Sender / Envelope</th>
                      <th>Decision</th>
                      <th>Confidence</th>
                      <th>Reasoning</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((d, i) => (
                      <tr key={`${d.letterId}-${i}`}>
                        <td>
                          <strong>{d.fromName}</strong>
                          <small style={{ display: "block", color: "var(--muted)" }}>{d.envelopeSummary}</small>
                        </td>
                        <td>
                          <AutonomyBadge decision={d.decision} confidence={d.confidence} compact />
                        </td>
                        <td>
                          <span className="confidence-pill">
                            {Math.round(d.confidence * 100)}%
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8rem", maxWidth: "300px" }}>
                          &ldquo;{d.reason}&rdquo;
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(d.evaluatedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent On-Chain x402 Settlement Payments */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent x402 Payments</h3>
              <span className="card-meta">{recentPayments.length} txns</span>
            </div>

            {recentPayments.length === 0 ? (
              <p className="empty-desc">No payments recorded yet.</p>
            ) : (
              <div className="letter-item-list">
                {recentPayments.map((p) => (
                  <div key={p.id} className="payment-log-row">
                    <div className="payment-log-header">
                      <strong className="payment-route">{p.routeKey}</strong>
                      <span className="payment-amount">${p.amountUsd} USDC</span>
                    </div>
                    <div className="payment-tx-row">
                      <span className="meta-text">Algorand TxID:</span>
                      <a
                        href={`https://testnet.explorer.perawallet.app/tx/${p.txid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="tx-link"
                      >
                        {p.txid.slice(0, 14)}... ↗
                      </a>
                    </div>
                    <div className="payment-time">
                      {new Date(p.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
