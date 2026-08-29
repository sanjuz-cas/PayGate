import React from "react";

export function KaamFooter() {
  return (
    <footer className="kaam-footer">
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div>
          <strong style={{ color: "#e2e8f0" }}>Kaam</strong> — Autonomous citizen task agent powered by PayGate capability discovery &amp; x402 on Algorand.
        </div>
        <div>
          Submission for <span style={{ color: "#a5b4fc", fontWeight: 600 }}>Build What Moves India</span>.
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
          ⚠️ <strong>Synthetic Demonstration Environment:</strong> Kaam does not connect to or submit data to live government systems (e.g. Passport Seva). All documents and workflow rules in this demonstration are synthetic.
        </div>
      </div>
    </footer>
  );
}
