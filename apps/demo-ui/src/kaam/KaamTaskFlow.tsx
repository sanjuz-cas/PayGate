import React, { useState } from "react";
import type { KaamSessionState, SyntheticDocumentData } from "./types";

interface KaamTaskFlowProps {
  session: KaamSessionState;
  onExecuteCheckRequirements: () => Promise<void>;
  onSelectDocument: (doc: SyntheticDocumentData) => void;
  onExecuteVerifyDocument: () => Promise<void>;
  onExecutePrepareForm: () => Promise<void>;
  onReset: () => void;
}

export function KaamTaskFlow({
  session,
  onExecuteCheckRequirements,
  onSelectDocument,
  onExecuteVerifyDocument,
  onExecutePrepareForm,
  onReset,
}: KaamTaskFlowProps) {
  const [isTechDrawerOpen, setIsTechDrawerOpen] = useState(false);

  // Stepper state mapping
  const currentStepNumber =
    session.step === "understanding"
      ? 1
      : session.step === "requirements"
      ? 2
      : session.step === "document_selection" || session.step === "verification"
      ? 3
      : session.step === "form_preparation"
      ? 4
      : 4;

  return (
    <div className="kaam-task-container">
      {/* Top Stepper & Task Header */}
      <div className="kaam-stepper-card">
        <div className="kaam-stepper-header">
          <div className="kaam-task-title">
            <span>Passport Reissue</span>
            <span className="kaam-task-reason-pill">Address Change</span>
          </div>
          <div className="kaam-budget-meter">
            <span className="kaam-budget-label">Task Budget:</span>
            <span className="kaam-budget-val">
              ₹{session.totalSpentInr.toFixed(2)} / ₹{session.taskBudgetInr.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="kaam-stepper-track">
          <div className={`kaam-step-item ${currentStepNumber >= 1 ? (currentStepNumber > 1 ? "completed" : "active") : ""}`}>
            <span className="kaam-step-dot">{currentStepNumber > 1 ? "✓" : "1"}</span>
            <span>Understand request</span>
          </div>
          <div className={`kaam-step-item ${currentStepNumber >= 2 ? (currentStepNumber > 2 ? "completed" : "active") : ""}`}>
            <span className="kaam-step-dot">{currentStepNumber > 2 ? "✓" : "2"}</span>
            <span>Check requirements</span>
          </div>
          <div className={`kaam-step-item ${currentStepNumber >= 3 ? (currentStepNumber > 3 ? "completed" : "active") : ""}`}>
            <span className="kaam-step-dot">{currentStepNumber > 3 ? "✓" : "3"}</span>
            <span>Check documents</span>
          </div>
          <div className={`kaam-step-item ${currentStepNumber >= 4 ? (session.step === "completed" ? "completed" : "active") : ""}`}>
            <span className="kaam-step-dot">{session.step === "completed" ? "✓" : "4"}</span>
            <span>Prepare application</span>
          </div>
        </div>
      </div>

      {/* ─── STAGE 1: Request Interpreted ──────────────────────────────── */}
      {session.step === "understanding" && (
        <div className="kaam-flow-card">
          <h2 className="kaam-card-heading">
            <span>🎯</span>
            <span>Kaam understood your request</span>
          </h2>
          <p className="kaam-card-desc">
            You requested: <strong style={{ color: "#ffffff" }}>"{session.userPrompt}"</strong>
          </p>

          <div style={{ background: "var(--km-bg-subtle)", padding: "1.25rem", borderRadius: "var(--km-radius-md)", border: "1px solid var(--km-border)", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--km-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem" }}>
              Identified Objective:
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#a5b4fc" }}>
              {session.interpretedGoal}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--km-text-secondary)", marginTop: "0.5rem" }}>
              Kaam will now check the official requirements for an address-change passport reissue.
            </div>
          </div>

          <div className="kaam-capability-banner">
            <div className="kaam-cap-info">
              <span className="kaam-cap-icon">🔍</span>
              <div>
                <div className="kaam-cap-name">Passport Rules Capability</div>
                <div className="kaam-cap-tag">passport_requirement_lookup</div>
              </div>
            </div>
            <div className="kaam-cap-price">₹0.10</div>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onExecuteCheckRequirements}
            disabled={session.isExecuting}
          >
            {session.isExecuting ? (
              <span>Discovering capability &amp; checking requirements...</span>
            ) : (
              <>
                <span>Check Requirements</span>
                <span>(₹0.10) →</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── STAGE 2: Requirements Checked ────────────────────────────── */}
      {session.step === "requirements" && (
        <div className="kaam-flow-card">
          <h2 className="kaam-card-heading">
            <span>📋</span>
            <span>Here's what you need</span>
          </h2>
          <p className="kaam-card-desc">
            Because your current address is different from the address on your existing passport, you need proof of your current residence.
          </p>

          <div className="kaam-req-box">
            <div className="kaam-req-title">Acceptable Proof of Address Examples:</div>
            <div className="kaam-doc-pills-list">
              <span className="kaam-doc-proof-pill">⚡ Electricity Bill (within 3 months)</span>
              <span className="kaam-doc-proof-pill">🏦 Bank Account Statement</span>
              <span className="kaam-doc-proof-pill">📄 Registered Rent Agreement</span>
              <span className="kaam-doc-proof-pill">💧 Water Bill</span>
              <span className="kaam-doc-proof-pill">📶 Broadband / Landline Bill</span>
            </div>

            <div className="kaam-synthetic-disclaimer">
              {session.requirements?.disclaimer || "Demo guidance based on synthetic rules. Not an official government determination."}
            </div>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => onSelectDocument(session.selectedDocument)}
          >
            <span>Check my document →</span>
          </button>
        </div>
      )}

      {/* ─── STAGE 3: Synthetic Document Selection ──────────────────────── */}
      {session.step === "document_selection" && (
        <div className="kaam-flow-card">
          <h2 className="kaam-card-heading">
            <span>📄</span>
            <span>Address Proof Document</span>
          </h2>
          <p className="kaam-card-desc">
            To ensure zero friction for evaluation, a synthetic address proof document is pre-loaded for you.
          </p>

          <div className="kaam-doc-preview-card">
            <span className="kaam-doc-status-badge">Synthetic Demo Document</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
              {session.selectedDocument.documentTypeLabel}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--km-text-secondary)", marginTop: "0.2rem" }}>
              Issued by: {session.selectedDocument.authority}
            </div>

            <div className="kaam-doc-meta-grid">
              <div className="kaam-doc-meta-field">
                <span className="kaam-doc-meta-label">Applicant Name</span>
                <span className="kaam-doc-meta-val">{session.selectedDocument.name}</span>
              </div>
              <div className="kaam-doc-meta-field">
                <span className="kaam-doc-meta-label">Bill / Issue Date</span>
                <span className="kaam-doc-meta-val">{session.selectedDocument.date}</span>
              </div>
              <div className="kaam-doc-meta-field" style={{ gridColumn: "1 / -1" }}>
                <span className="kaam-doc-meta-label">Current Residential Address</span>
                <span className="kaam-doc-meta-val">{session.selectedDocument.address}</span>
              </div>
            </div>

            <div className="kaam-doc-raw-preview">
              {session.selectedDocument.rawText}
            </div>
          </div>

          <div className="kaam-capability-banner">
            <div className="kaam-cap-info">
              <span className="kaam-cap-icon">🛡️</span>
              <div>
                <div className="kaam-cap-name">Document Verification Capability</div>
                <div className="kaam-cap-tag">document_verification</div>
              </div>
            </div>
            <div className="kaam-cap-price">₹0.25</div>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onExecuteVerifyDocument}
            disabled={session.isExecuting}
          >
            {session.isExecuting ? (
              <span>Verifying address proof on-chain...</span>
            ) : (
              <>
                <span>Verify Document (₹0.25) →</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── STAGE 4: Document Verified ───────────────────────────────── */}
      {session.step === "verification" && (
        <div className="kaam-flow-card">
          <div className="kaam-verification-success-banner">
            <div className="kaam-check-big-icon">✓</div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>
                Document looks ready
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--km-text-secondary)", marginTop: "0.25rem" }}>
                Address proof extracted and verified with {((session.verificationResult?.confidence ?? 0.98) * 100).toFixed(0)}% confidence.
              </div>
            </div>
          </div>

          <div className="kaam-verify-checklist">
            <div className="kaam-check-item">
              <span className="icon">✓</span>
              <span>Name detected: <strong>{session.verificationResult?.detectedName || "Arjun Menon"}</strong></span>
            </div>
            <div className="kaam-check-item">
              <span className="icon">✓</span>
              <span>Address detected: <strong>Kochi, Kerala 682001</strong></span>
            </div>
            <div className="kaam-check-item">
              <span className="icon">✓</span>
              <span>Document readable &amp; legible</span>
            </div>
            <div className="kaam-check-item">
              <span className="icon">✓</span>
              <span>Required PIN code format valid</span>
            </div>
          </div>

          <div className="kaam-why-callout">
            <div className="kaam-why-title">Why did Kaam use this capability?</div>
            <div className="kaam-why-text">
              {session.verificationResult?.reasonForSelection || "Kaam selected DocumentCheck because the current task required address-document verification before preparing government forms."}
            </div>
          </div>

          <div className="kaam-capability-banner">
            <div className="kaam-cap-info">
              <span className="kaam-cap-icon">✍️</span>
              <div>
                <div className="kaam-cap-name">Passport Form Assistant</div>
                <div className="kaam-cap-tag">passport_form_assistance</div>
              </div>
            </div>
            <div className="kaam-cap-price">₹0.20</div>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onExecutePrepareForm}
            disabled={session.isExecuting}
          >
            {session.isExecuting ? (
              <span>Preparing application summary...</span>
            ) : (
              <>
                <span>Prepare Application (₹0.20) →</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── STAGE 5: Application Prepared / Form Assistant ───────────── */}
      {session.step === "form_preparation" && (
        <div className="kaam-flow-card">
          <h2 className="kaam-card-heading">
            <span>📝</span>
            <span>Application information prepared</span>
          </h2>
          <p className="kaam-card-desc">
            Kaam structured your verified application information according to synthetic passport guidelines.
          </p>

          <div className="kaam-form-summary-card">
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Application Draft ID</span>
              <span className="kaam-form-row-val" style={{ fontFamily: "JetBrains Mono", color: "#a5b4fc" }}>
                {session.formDraft?.applicationId || "KAAM-PASSPORT-2026"}
              </span>
            </div>
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Applicant Name</span>
              <span className="kaam-form-row-val">{session.formDraft?.applicantName || "Arjun Menon"}</span>
            </div>
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Service Type</span>
              <span className="kaam-form-row-val">{session.formDraft?.serviceTypeDisplay || "Passport Reissue"}</span>
            </div>
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Reason for Reissue</span>
              <span className="kaam-form-row-val">{session.formDraft?.reasonDisplay || "Change of Address"}</span>
            </div>
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Current Address</span>
              <span className="kaam-form-row-val" style={{ maxWidth: "300px" }}>
                {session.formDraft?.currentAddressFormatted || "12 Lake View Road, Kochi, Kerala 682001"}
              </span>
            </div>
            <div className="kaam-form-row">
              <span className="kaam-form-row-label">Supporting Document</span>
              <span className="kaam-form-row-val" style={{ color: "#34d399" }}>
                {session.formDraft?.supportingDocumentDisplay || "Electricity Bill — Verified"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="kaam-start-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              session.step = "completed";
              // trigger re-render
              onSelectDocument(session.selectedDocument);
            }}
          >
            <span>Review Outcome &amp; Finish →</span>
          </button>
        </div>
      )}

      {/* ─── STAGE 6: Final Citizen Outcome ("You're ready.") ─────────── */}
      {session.step === "completed" && (
        <div className="kaam-flow-card">
          <div className="kaam-outcome-hero">
            <div className="kaam-outcome-badge">✓</div>
            <h1 className="kaam-outcome-title">You're ready.</h1>
            <p style={{ color: "var(--km-text-secondary)", fontSize: "1rem" }}>
              Your passport reissue checklist, address proof, and application details are prepared.
            </p>
          </div>

          <div style={{ background: "var(--km-bg-subtle)", padding: "1.25rem", borderRadius: "var(--km-radius-md)", border: "1px solid var(--km-border)", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.75rem" }}>
              Completed Steps:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#34d399" }}>
                <span>✓</span> Requirements checked
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#34d399" }}>
                <span>✓</span> Address proof verified (Electricity Bill)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#34d399" }}>
                <span>✓</span> Application draft prepared
              </div>
            </div>
          </div>

          {/* Pay-Per-Use Itemized Receipt */}
          <div className="kaam-receipt-card">
            <div className="kaam-receipt-header">
              <span className="kaam-receipt-title">Capabilities Used</span>
              <span style={{ fontSize: "0.75rem", color: "var(--km-text-muted)" }}>Pay-per-use x402</span>
            </div>

            <div className="kaam-receipt-items">
              <div className="kaam-receipt-item">
                <span className="kaam-receipt-item-name">Passport Rules Lookup</span>
                <span className="kaam-receipt-item-price">₹0.10</span>
              </div>
              <div className="kaam-receipt-item">
                <span className="kaam-receipt-item-name">Document Verification</span>
                <span className="kaam-receipt-item-price">₹0.25</span>
              </div>
              <div className="kaam-receipt-item">
                <span className="kaam-receipt-item-name">Form Assistant</span>
                <span className="kaam-receipt-item-price">₹0.20</span>
              </div>
            </div>

            <div className="kaam-receipt-total-row">
              <span>Total Used</span>
              <span className="kaam-receipt-total-price">₹{session.totalSpentInr.toFixed(2)}</span>
            </div>

            <div className="kaam-pay-per-use-callout">
              You only paid for the capabilities Kaam actually used. No monthly subscription.
            </div>
          </div>

          {/* Official Next Step Guidance */}
          <div className="kaam-next-steps-card">
            <div className="kaam-next-steps-title">Next Step for Submission:</div>
            <div className="kaam-next-steps-text">
              Review your prepared application details above and submit them through the official Passport Seva portal or your nearest Passport Seva Kendra (PSK).
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.6rem", fontStyle: "italic" }}>
              Kaam does not interact with or submit information to live government systems.
            </div>
          </div>

          {/* Expandable Technical Deep Dive: How Kaam Worked */}
          <div className="kaam-tech-drawer">
            <button
              type="button"
              className="kaam-tech-toggle"
              onClick={() => setIsTechDrawerOpen(!isTechDrawerOpen)}
            >
              <span>🔬 How Kaam Worked Under the Hood</span>
              <span>{isTechDrawerOpen ? "▲" : "▼"}</span>
            </button>

            {isTechDrawerOpen && (
              <div className="kaam-tech-body">
                <p>
                  Kaam doesn't contain every capability itself. The agent discovered each required capability dynamically via the PayGate service registry and executed it within your defined spending budget:
                </p>

                <div className="kaam-tech-diag">
{`Citizen Goal: "Renew passport. Address changed."
       │
       ▼
   Kaam Agent (Autonomous Brain)
       │
       ├─► 1. Discover capability: "passport_requirement_lookup" (₹0.10)
       │      └─► Check spending budget: Approved (Remaining: ₹1.90)
       │
       ├─► 2. Discover capability: "document_verification" (₹0.25)
       │      └─► Check spending budget: Approved (Remaining: ₹1.65)
       │
       └─► 3. Discover capability: "passport_form_assistance" (₹0.20)
              └─► Check spending budget: Approved (Remaining: ₹1.45)
       │
       ▼
   Final Outcome: "You're ready" (Total Spent: ₹0.55 / ₹2.00 Budget)`}
                </div>

                <p style={{ margin: "0.5rem 0" }}>
                  <strong>PayGate Infrastructure:</strong> PayGate provides the underlying decentralized service discovery, non-custodial wallet authorization, and x402 payment settlement on Algorand.
                </p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              className="kaam-start-btn"
              style={{ flex: 1, justifyContent: "center", background: "rgba(255, 255, 255, 0.1)" }}
              onClick={onReset}
            >
              <span>Start Another Task</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
