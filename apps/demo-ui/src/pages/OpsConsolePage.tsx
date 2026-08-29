import React, { useState } from "react";
import type {
  ServiceState,
  InternalInboundLetterScanExtractResponse,
} from "@juicebag-mail/shared";

interface OpsConsolePageProps {
  serviceState?: ServiceState | null;
  serviceBalances: { usdc: number; eurd: number; address: string };
  inboundForm: {
    mailboxId: string;
    fromName: string;
    envelopeSummary: string;
    ocrText: string;
    scanDraftId: string;
    scanFileName: string;
  };
  onInboundFormChange: (updater: (prev: any) => any) => void;
  inboundMode: "text" | "scan" | "email";
  onInboundModeChange: (mode: "text" | "scan" | "email") => void;
  scanFile: File | null;
  onScanFileChange: (file: File | null) => void;
  onExtractScan: () => Promise<void>;
  onIngestLetter: () => Promise<void>;
  onMarkOutboundSent: (letterId: string) => Promise<void>;
  sentToPrinterIds: Set<string>;
  onSendToPrinter: (letterId: string) => void;
  busyActions: Set<string>;
  actionResults: Record<string, "success" | "error">;
  onSelectInboundModal: (letter: ServiceState["inboundLetters"][number]) => void;
  onSelectOutboundModal: (letter: ServiceState["outboundLetters"][number]) => void;
  currentServiceEvent: any;
  defaultMailboxId: string;
}

export function OpsConsolePage({
  serviceState,
  serviceBalances,
  inboundForm,
  onInboundFormChange,
  inboundMode,
  onInboundModeChange,
  scanFile,
  onScanFileChange,
  onExtractScan,
  onIngestLetter,
  onMarkOutboundSent,
  sentToPrinterIds,
  onSendToPrinter,
  busyActions,
  actionResults,
  onSelectInboundModal,
  onSelectOutboundModal,
  currentServiceEvent,
  defaultMailboxId,
}: OpsConsolePageProps) {
  const mailboxId = inboundForm.mailboxId || defaultMailboxId;
  const canSubmit =
    mailboxId.length > 0 &&
    (inboundMode === "text" || inboundMode === "email" || inboundForm.scanDraftId.length > 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Postal Ops & Ingestion Hub</h1>
          <p className="page-description">
            Operator station for scanning incoming physical mail, running OCR parsing, and dispatching print queues.
          </p>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Registered Agents</span>
          <strong className="stat-value">{serviceState?.counters.registeredAgents ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Inbound</span>
          <strong className="stat-value">{serviceState?.counters.pendingInboundLetters ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Queued Outbound</span>
          <strong className="stat-value">{serviceState?.counters.queuedOutboundLetters ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Merchant USDC Balance</span>
          <strong className="stat-value">${(serviceBalances.usdc ?? 0).toFixed(3)} <small>USDC</small></strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Merchant EURD Balance</span>
          <strong className="stat-value">€{(serviceBalances.eurd ?? 0).toFixed(2)} <small>EURD</small></strong>
        </div>
      </div>

      <div className="dashboard-top-grid">
        {/* Left Column: Inbound Mail Ingestion Station */}
        <div className="grid-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Ingest Inbound Physical Letter</h3>
              <span className="card-meta">Operator Scanner Station</span>
            </div>

            {/* 1-Click Quick Scenario Presets */}
            <div style={{ marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #71717a)", display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
                ⚡ Quick Demo Presets (1-Click Fill):
              </span>
              {inboundMode === "email" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Finanzamt Berlin <tax-notice@finanzamt-berlin.de>",
                        envelopeSummary: "Formal Tax Inquiry — Corporate Tax Return Assessment",
                        ocrText: "Sehr geehrte Damen und Herren,\n\nwir bitten um die Einreichung der fehlenden Unterlagen für das Geschäftsjahr 2025 bis zum 30. September.\n\nMit freundlichen Grüßen,\nFinanzamt Berlin",
                      }))
                    }
                  >
                    🏛️ Urgent Tax Notice Email (98% Priority)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "AWS Billing <no-reply-billing@amazon.com>",
                        envelopeSummary: "Invoice Available: AWS Cloud Services - August 2026",
                        ocrText: "Dear AWS Customer,\n\nYour monthly billing statement for August 2026 is now available. Total amount: $142.50 USD.\n\nAmazon Web Services",
                      }))
                    }
                  >
                    🧾 Cloud Invoice Email ($0.20 Unlock)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Marketing Deals <promo@weekly-deals-direct.com>",
                        envelopeSummary: "Claim your 70% discount on office coffee machines!",
                        ocrText: "Unbeatable promotion! Save 70% on premium espresso machines for your startup. Unsubscribe anytime.",
                      }))
                    }
                  >
                    📢 Marketing Spam (Auto-Ignored by AI)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Notary Office Frankfurt <legal@notar-frankfurt.de>",
                        envelopeSummary: "Commercial Register Filing - Signature Required",
                        ocrText: "Dear Directors,\n\nPlease review the enclosed commercial registry extract and confirm the authorized signatory change.\n\nNotariat Frankfurt",
                      }))
                    }
                  >
                    ⚖️ Legal Compliance Notice
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Finanzamt Berlin",
                        envelopeSummary: "Musterstrasse 1, 10115 Berlin — Formal Tax Inquiry",
                        ocrText: "Sehr geehrte Damen und Herren,\n\nwir bitten um die Einreichung der fehlenden Unterlagen für das Geschäftsjahr.\n\nMit freundlichen Grüßen,\nFinanzamt Berlin",
                      }))
                    }
                  >
                    🏛️ Tax Office (Urgent - 98% Priority)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Deutsche Bank AG",
                        envelopeSummary: "Taunusanlage 12, 60325 Frankfurt — Account Verification",
                        ocrText: "Dear Customer,\n\nPlease verify your corporate account details before the end of the quarter.\n\nBest regards,\nDeutsche Bank AG",
                      }))
                    }
                  >
                    🏦 Bank Notice (Priority)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "SuperStore Marketing GmbH",
                        envelopeSummary: "Werbestrasse 99, 10117 Berlin — 50% Off Flyer",
                        ocrText: "Special Offer! Get 50% off on all office supplies this week only. Visit our store or order online today!",
                      }))
                    }
                  >
                    📢 Marketing Flyer (Junk - Auto-Ignore)
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Finanzamt Berlin",
                        envelopeSummary: "Response to Acme Filing Agent: Confirmation Received",
                        ocrText: "Sehr geehrte Damen und Herren,\n\nIhre Antwort vom heutigen Tage ist bei uns eingegangen und wird bearbeitet.\n\nMit freundlichen Grüßen,\nFinanzamt Berlin",
                      }))
                    }
                  >
                    ↩️ Reply from Tax Office
                  </button>
                </div>
              )}
            </div>

            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void onIngestLetter();
              }}
            >
              <div className="form-field">
                <label>Target Mailbox ID</label>
                <input
                  type="text"
                  placeholder="e.g. mbx_..."
                  value={mailboxId}
                  onChange={(e) =>
                    onInboundFormChange((prev: any) => ({
                      ...prev,
                      mailboxId: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* Mode Switcher */}
              <div className="form-field">
                <label>Ingestion Source</label>
                <div className="segmented-toggle">
                  <button
                    type="button"
                    className={`segmented-btn ${inboundMode === "text" ? "is-active" : ""}`}
                    onClick={() => onInboundModeChange("text")}
                  >
                    Direct Letter Text
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${inboundMode === "scan" ? "is-active" : ""}`}
                    onClick={() => onInboundModeChange("scan")}
                  >
                    📷 Scan Image & Auto-OCR
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${inboundMode === "email" ? "is-active" : ""}`}
                    onClick={() => {
                      onInboundModeChange("email");
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: "Finanzamt Berlin <tax-notice@finanzamt-berlin.de>",
                        envelopeSummary: "Formal Tax Inquiry — Corporate Tax Return Assessment",
                        ocrText: "Sehr geehrte Damen und Herren,\n\nwir bitten um die Einreichung der fehlenden Unterlagen für das Geschäftsjahr 2025 bis zum 30. September.\n\nMit freundlichen Grüßen,\nFinanzamt Berlin",
                      }));
                    }}
                  >
                    📧 Gmail & Digital Inbox
                  </button>
                </div>
              </div>

              {/* Scan Upload Section */}
              {inboundMode === "scan" && (
                <div className="scan-upload-zone">
                  <div className="form-field">
                    <label>Upload Scan Image (PNG / JPEG)</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        onScanFileChange(file);
                      }}
                    />
                    {scanFile && <span className="file-name-tag">Attached: {scanFile.name}</span>}
                  </div>

                  <div className="scan-trigger-row">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={busyActions.has("extract-scan") || !scanFile || !mailboxId}
                      onClick={() => void onExtractScan()}
                    >
                      {busyActions.has("extract-scan")
                        ? "Running Tesseract OCR..."
                        : actionResults["extract-scan"] === "success"
                        ? "✓ OCR Extracted Successfully"
                        : "Run Automated OCR Scan"}
                    </button>
                    <span className="helper-note">
                      Extracts sender, address, and letter body text automatically via Tesseract.js.
                    </span>
                  </div>

                  {inboundForm.scanDraftId && (
                    <div className="ocr-ready-callout">
                      <strong>✓ OCR Text Ready for Operator Review</strong>
                      <p>Draft saved as {inboundForm.scanFileName}. Review the extracted text below before submitting.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Email Explanation Callout */}
              {inboundMode === "email" && (
                <div className="ocr-ready-callout" style={{ borderLeft: "3px solid #3b82f6" }}>
                  <strong>📧 Live Gmail / Email Webhook Bridge Active</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>
                    Simulates incoming messages received via Gmail API, Google Cloud Pub/Sub, or incoming IMAP webhooks. The AI agent evaluates urgency, checks spending guardrails, and triggers non-custodial x402 payment!
                  </p>
                </div>
              )}

              <div className="form-row-split">
                <div className="form-field">
                  <label>{inboundMode === "email" ? "Sender Email / Organization" : "Sender Name / Institution"}</label>
                  <input
                    type="text"
                    placeholder={inboundMode === "email" ? "e.g. billing@company.com" : "e.g. City Tax Office"}
                    value={inboundForm.fromName}
                    onChange={(e) =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        fromName: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <label>{inboundMode === "email" ? "Email Subject Line" : "Sender Address / Envelope Preview"}</label>
                  <input
                    type="text"
                    placeholder={inboundMode === "email" ? "e.g. Urgent Tax Assessment Notice" : "e.g. Musterstrasse 1, 10115 Berlin"}
                    value={inboundForm.envelopeSummary}
                    onChange={(e) =>
                      onInboundFormChange((prev: any) => ({
                        ...prev,
                        envelopeSummary: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>{inboundMode === "email" ? "Email Body & Attachment Content" : "Scanned Letter Text (OCR Output)"}</label>
                <textarea
                  rows={6}
                  placeholder={inboundMode === "email" ? "Full email text or PDF attachment payload..." : "Extracted letter body text..."}
                  value={inboundForm.ocrText}
                  onChange={(e) =>
                    onInboundFormChange((prev: any) => ({
                      ...prev,
                      ocrText: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full"
                disabled={busyActions.has("ingest") || !canSubmit}
              >
                {busyActions.has("ingest")
                  ? "Ingesting & Notifying Agent..."
                  : actionResults["ingest"] === "success"
                  ? "✓ Ingested & Webhook Dispatched!"
                  : inboundMode === "email"
                  ? "Ingest Incoming Email via Webhook"
                  : "Ingest Inbound Letter"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Registered Agents Directory & Ops Stream */}
        <div>
          {/* Registered Agents Directory */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="card-header">
              <h3 className="card-title">Registered Agent Mailboxes</h3>
              <span className="card-meta">{serviceState?.agents.length ?? 0} agents</span>
            </div>
            {(!serviceState?.agents || serviceState.agents.length === 0) ? (
              <p className="empty-desc">No agents registered yet.</p>
            ) : (
              <div className="agents-directory-list">
                {serviceState.agents.map((agent) => (
                  <div key={agent.id} className="agent-dir-item">
                    <div className="agent-dir-name">{agent.displayName}</div>
                    <div className="agent-dir-meta">
                      <span>Mailbox: <code>{agent.mailboxId}</code></span>
                      <span className="webhook-tag">Webhook: {agent.webhookUrl}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Live Event Stream */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Latest Postal Ops Event</h3>
              <span className="live-indicator">● LIVE SSE</span>
            </div>
            <div className="event-stream-body">
              <p className="event-msg">{currentServiceEvent?.message ?? "Waiting for operator transactions..."}</p>
              {currentServiceEvent?.txid && (
                <div className="event-txid-row">
                  <span>Tx:</span>
                  <a
                    href={`https://testnet.explorer.perawallet.app/tx/${currentServiceEvent.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    {currentServiceEvent.txid.slice(0, 14)}... ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Queues Table Section */}
      <div className="dashboard-top-grid" style={{ marginTop: "24px" }}>
        {/* Inbound Hub Queue */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Service Inbound Queue</h3>
            <span className="card-meta">{serviceState?.inboundLetters.length ?? 0} letters</span>
          </div>
          {(!serviceState?.inboundLetters || serviceState.inboundLetters.length === 0) ? (
            <p className="empty-desc">No inbound letters in service queue.</p>
          ) : (
            <div className="letter-item-list">
              {serviceState.inboundLetters.map((letter) => (
                <div
                  key={letter.id}
                  className="letter-item-row"
                  onClick={() => onSelectInboundModal(letter)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="letter-left-info">
                    <div className="letter-title-row">
                      <strong>{letter.fromName}</strong>
                      <span className={`status-pill status-pill--${letter.status}`}>{letter.status}</span>
                    </div>
                    <p className="letter-summary-text">{letter.envelopeSummary}</p>
                    <span className="meta-text">Mailbox: {letter.mailboxId}</span>
                  </div>
                  <div className="letter-right-actions">
                    <button type="button" className="btn btn--sm btn--ghost">Inspect ↗</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outbound Print & Mail Queue */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Service Outbound Print Queue</h3>
            <span className="card-meta">{serviceState?.outboundLetters.length ?? 0} letters</span>
          </div>
          {(!serviceState?.outboundLetters || serviceState.outboundLetters.length === 0) ? (
            <p className="empty-desc">No outbound letters in print queue.</p>
          ) : (
            <div className="letter-item-list">
              {serviceState.outboundLetters.map((letter) => (
                <div
                  key={letter.id}
                  className="letter-item-row"
                  onClick={() => onSelectOutboundModal(letter)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="letter-left-info">
                    <div className="letter-title-row">
                      <strong>{letter.subject}</strong>
                      <span className={`status-pill status-pill--${letter.status}`}>{letter.status}</span>
                    </div>
                    <p className="letter-summary-text">Recipient: {letter.recipient.name}</p>
                  </div>
                  <div className="letter-right-actions" onClick={(e) => e.stopPropagation()}>
                    {letter.status === "queued" && (
                      sentToPrinterIds.has(letter.id) ? (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={busyActions.has(`mark-${letter.id}`)}
                          onClick={() => void onMarkOutboundSent(letter.id)}
                        >
                          {busyActions.has(`mark-${letter.id}`) ? "Marking..." : "✓ Mark as Sent"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          onClick={() => onSendToPrinter(letter.id)}
                        >
                          Send to Printer
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
