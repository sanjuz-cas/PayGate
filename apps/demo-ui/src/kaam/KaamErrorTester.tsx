import React from "react";

interface KaamErrorTesterProps {
  currentErrorMode: "none" | "budget_exceeded" | "verification_failed" | "capability_unavailable";
  onSelectErrorMode: (mode: "none" | "budget_exceeded" | "verification_failed" | "capability_unavailable") => void;
}

export function KaamErrorTester({
  currentErrorMode,
  onSelectErrorMode,
}: KaamErrorTesterProps) {
  return (
    <div className="kaam-error-tester-bar">
      <span style={{ fontWeight: 700, color: "var(--km-text-muted)" }}>
        🧪 Evaluator Edge-Case Simulator:
      </span>
      <button
        type="button"
        className={`kaam-error-pill-btn ${currentErrorMode === "none" ? "active" : ""}`}
        onClick={() => onSelectErrorMode("none")}
      >
        Normal Flow (✓)
      </button>
      <button
        type="button"
        className={`kaam-error-pill-btn ${currentErrorMode === "budget_exceeded" ? "active" : ""}`}
        onClick={() => onSelectErrorMode("budget_exceeded")}
        title="Simulate exceeding the ₹2.00 task budget limit"
      >
        Budget Exceeded (₹2.00 Guardrail)
      </button>
      <button
        type="button"
        className={`kaam-error-pill-btn ${currentErrorMode === "verification_failed" ? "active" : ""}`}
        onClick={() => onSelectErrorMode("verification_failed")}
        title="Simulate an illegible or mismatched document"
      >
        Verification Failed
      </button>
      <button
        type="button"
        className={`kaam-error-pill-btn ${currentErrorMode === "capability_unavailable" ? "active" : ""}`}
        onClick={() => onSelectErrorMode("capability_unavailable")}
        title="Simulate an offline service capability"
      >
        Capability Offline (₹0.00 Charged)
      </button>
    </div>
  );
}
