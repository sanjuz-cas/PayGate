import React from "react";

interface KaamHeaderProps {
  currentView: "home" | "task" | "providers";
  onSelectView: (view: "home" | "task" | "providers") => void;
  onSwitchToPayGate: () => void;
  onResetDemo: () => void;
  taskBudgetInr: number;
  totalSpentInr: number;
}

export function KaamHeader({
  currentView,
  onSelectView,
  onSwitchToPayGate,
  onResetDemo,
  taskBudgetInr,
  totalSpentInr,
}: KaamHeaderProps) {
  return (
    <header className="kaam-header">
      <div className="kaam-header-inner">
        {/* Left: Brand Logo */}
        <div
          className="kaam-logo-group"
          onClick={() => onSelectView("home")}
          role="button"
          tabIndex={0}
        >
          <div className="kaam-logo-mark">K</div>
          <div className="kaam-logo-text">
            <div className="kaam-brand-name">
              Kaam
              <span className="kaam-brand-badge">Build What Moves India</span>
            </div>
          </div>
        </div>

        {/* Right: Navigation & Developer Mode Switch */}
        <div className="kaam-header-nav">
          <button
            type="button"
            className={`kaam-nav-pill ${currentView === "home" ? "active" : ""}`}
            onClick={() => onSelectView("home")}
          >
            Citizen Task
          </button>
          <button
            type="button"
            className={`kaam-nav-pill ${currentView === "providers" ? "active" : ""}`}
            onClick={() => onSelectView("providers")}
          >
            Capabilities
          </button>
          <button
            type="button"
            className="kaam-nav-pill"
            onClick={onResetDemo}
            title="Reset to fresh demo state"
          >
            ↻ Reset
          </button>
          <button
            type="button"
            className="kaam-dev-switch-btn"
            onClick={onSwitchToPayGate}
            title="Open underlying PayGate Developer & Postal Ops Console"
          >
            <span>⚙ PayGate Engine</span>
          </button>
        </div>
      </div>
    </header>
  );
}
