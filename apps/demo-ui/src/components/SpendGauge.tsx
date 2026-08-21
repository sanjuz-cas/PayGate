import React, { useState } from "react";
import type { AgentGuardrail } from "@juicebag-mail/shared";

interface SpendGaugeProps {
  guardrail?: AgentGuardrail;
  onUpdateCap?: (newCap: number) => Promise<void>;
  isUpdatingCap?: boolean;
}

export function SpendGauge({ guardrail, onUpdateCap, isUpdatingCap }: SpendGaugeProps) {
  const [customCapInput, setCustomCapInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const currentSpend = guardrail?.currentSpendUsdc ?? 0;
  const dailyCap = guardrail?.dailyCapUsdc ?? 5.0;
  const remaining = guardrail?.remainingUsdc ?? Math.max(0, dailyCap - currentSpend);
  const isBlocked = guardrail?.blocked ?? false;

  const percentage = dailyCap > 0 ? Math.min(100, Math.round((currentSpend / dailyCap) * 100)) : 100;

  const handlePresetCap = (cap: number) => {
    if (onUpdateCap) {
      void onUpdateCap(cap);
    }
  };

  const handleCustomCapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customCapInput);
    if (!isNaN(val) && val > 0 && onUpdateCap) {
      void onUpdateCap(val);
      setIsEditing(false);
      setCustomCapInput("");
    }
  };

  return (
    <div className={`spend-gauge-card ${isBlocked ? "is-blocked" : ""}`}>
      <div className="spend-gauge-header">
        <div className="spend-gauge-title-wrap">
          <span className="spend-gauge-icon">🛡️</span>
          <div>
            <h4 className="spend-gauge-title">24h Spending Guardrail</h4>
            <span className="spend-gauge-subtitle">Pre-payment Autonomous Budget Safety</span>
          </div>
        </div>
        <span className={`guardrail-status-pill ${isBlocked ? "is-blocked" : "is-active"}`}>
          {isBlocked ? "BUDGET BLOCKED" : "ACTIVE & PROTECTED"}
        </span>
      </div>

      <div className="spend-gauge-stats">
        <div className="spend-stat">
          <span className="spend-stat-label">24h Spent</span>
          <span className="spend-stat-value">${currentSpend.toFixed(2)} <small>USDC</small></span>
        </div>
        <div className="spend-stat spend-stat--divider">/</div>
        <div className="spend-stat">
          <span className="spend-stat-label">Daily Cap</span>
          <span className="spend-stat-value">${dailyCap.toFixed(2)} <small>USDC</small></span>
        </div>
        <div className="spend-stat spend-stat--right">
          <span className="spend-stat-label">Remaining</span>
          <span className={`spend-stat-value ${remaining <= 0.05 ? "is-low" : ""}`}>
            ${remaining.toFixed(2)} <small>USDC</small>
          </span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="spend-progress-track">
        <div
          className={`spend-progress-fill ${
            isBlocked || percentage >= 100
              ? "is-full"
              : percentage > 75
              ? "is-warning"
              : "is-normal"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="spend-progress-meta">
        <span>{percentage}% of daily limit consumed</span>
        <span>Rolling 24-hour window</span>
      </div>

      {/* Cap Adjustment Toolbar for Live Demos */}
      <div className="cap-modifier-bar">
        <span className="cap-modifier-label">Demo Quick-Cap:</span>
        <div className="cap-modifier-presets">
          <button
            type="button"
            className={`cap-preset-button cap-preset-button--danger ${dailyCap === 0.05 ? "is-selected" : ""}`}
            onClick={() => handlePresetCap(0.05)}
            disabled={isUpdatingCap}
            title="Set cap to $0.05 to trigger Guardrail Block on next auto-unlock"
          >
            Trigger Block ($0.05)
          </button>
          <button
            type="button"
            className={`cap-preset-button ${dailyCap === 1.0 ? "is-selected" : ""}`}
            onClick={() => handlePresetCap(1.0)}
            disabled={isUpdatingCap}
          >
            $1.00
          </button>
          <button
            type="button"
            className={`cap-preset-button ${dailyCap === 5.0 ? "is-selected" : ""}`}
            onClick={() => handlePresetCap(5.0)}
            disabled={isUpdatingCap}
          >
            $5.00 (Default)
          </button>
          <button
            type="button"
            className="cap-preset-button cap-preset-button--custom"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancel" : "Custom..."}
          </button>
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleCustomCapSubmit} className="cap-custom-form">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 2.50"
            value={customCapInput}
            onChange={(e) => setCustomCapInput(e.target.value)}
            className="cap-custom-input"
            autoFocus
          />
          <button type="submit" className="cap-custom-submit" disabled={isUpdatingCap || !customCapInput}>
            Set Cap
          </button>
        </form>
      )}
    </div>
  );
}
