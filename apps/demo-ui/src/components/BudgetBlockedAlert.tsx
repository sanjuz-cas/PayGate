import React from "react";

interface BudgetBlockedAlertProps {
  message?: string;
  requestedAmount?: number;
  currentSpend?: number;
  cap?: number;
  onDismiss: () => void;
  onIncreaseCap?: () => void;
}

export function BudgetBlockedAlert({
  message,
  requestedAmount,
  currentSpend,
  cap,
  onDismiss,
  onIncreaseCap,
}: BudgetBlockedAlertProps) {
  return (
    <div className="budget-blocked-alert" role="alert">
      <div className="alert-icon-wrap">
        <span className="alert-icon">🛡️</span>
      </div>
      <div className="alert-content">
        <h4 className="alert-title">Payment Prevented by Spending Guardrail</h4>
        <p className="alert-message">
          {message ||
            `Attempted payment of $${requestedAmount ?? 0.20} USDC was blocked because 24h spend ($${currentSpend ?? 0}) exceeds daily cap ($${cap ?? 0}).`}
        </p>
        <div className="alert-meta">
          <span>Zero Algorand fees wasted</span> • <span>State preserved safely</span>
        </div>
      </div>
      <div className="alert-actions">
        {onIncreaseCap && (
          <button type="button" onClick={onIncreaseCap} className="alert-action-btn">
            Increase Cap
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="alert-dismiss-btn"
          title="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
