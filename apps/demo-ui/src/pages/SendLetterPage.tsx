import React from "react";
import type {
  AgentSendLetterInput,
  AgentState,
} from "@juicebag-mail/shared";
import {
  ROUTE_PRICES,
  ROUTE_PRICES_EURD_DISPLAY,
} from "@juicebag-mail/shared";

interface SendLetterPageProps {
  letterForm: AgentSendLetterInput;
  onLetterFormChange: (updater: (prev: AgentSendLetterInput) => AgentSendLetterInput) => void;
  onSendLetter: () => Promise<void>;
  outboundLetters: AgentState["outboundLetters"];
  isRegistered: boolean;
  selectedCurrency: "usdc" | "eurd";
  busyActions: Set<string>;
  onSelectLetterModal: (letter: AgentState["outboundLetters"][number]) => void;
}

export function SendLetterPage({
  letterForm,
  onLetterFormChange,
  onSendLetter,
  outboundLetters,
  isRegistered,
  selectedCurrency,
  busyActions,
  onSelectLetterModal,
}: SendLetterPageProps) {
  const isSending = busyActions.has("send-letter");

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Send Physical Letter</h1>
          <p className="page-description">
            Generate, stamp, and queue physical paper letters dispatched via real postal hubs using Algorand micropayments.
          </p>
        </div>
      </div>

      <div className="dashboard-top-grid">
        {/* Left Column: Composition Studio */}
        <div className="grid-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Compose & Print Order</h3>
              <span className="card-meta">x402 Outbound Mail Gateway</span>
            </div>

            {!isRegistered ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <div className="empty-title">Mailbox Registration Required</div>
                <p className="empty-desc">
                  Please register your agent mailbox on the Agent Overview tab before dispatching outbound letters.
                </p>
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSendLetter();
                }}
              >
                <div className="form-section-label">1. Recipient Address</div>
                <div className="form-row-split">
                  <div className="form-field">
                    <label>Recipient Full Name / Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. Finanzamt Berlin"
                      value={letterForm.recipient.name}
                      onChange={(e) =>
                        onLetterFormChange((prev) => ({
                          ...prev,
                          recipient: { ...prev.recipient, name: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Street Address & Number</label>
                    <input
                      type="text"
                      placeholder="e.g. Finanzstrasse 5"
                      value={letterForm.recipient.street1}
                      onChange={(e) =>
                        onLetterFormChange((prev) => ({
                          ...prev,
                          recipient: { ...prev.recipient, street1: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row-split">
                  <div className="form-field">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 10117"
                      value={letterForm.recipient.postalCode}
                      onChange={(e) =>
                        onLetterFormChange((prev) => ({
                          ...prev,
                          recipient: { ...prev.recipient, postalCode: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Berlin"
                      value={letterForm.recipient.city}
                      onChange={(e) =>
                        onLetterFormChange((prev) => ({
                          ...prev,
                          recipient: { ...prev.recipient, city: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Country Code</label>
                    <input
                      type="text"
                      placeholder="DE"
                      value={letterForm.recipient.country}
                      onChange={(e) =>
                        onLetterFormChange((prev) => ({
                          ...prev,
                          recipient: { ...prev.recipient, country: e.target.value },
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-section-label" style={{ marginTop: "16px" }}>
                  2. Letter Content
                </div>
                <div className="form-field">
                  <label>Subject Line</label>
                  <input
                    type="text"
                    placeholder="e.g. Request for tax statement clarification"
                    value={letterForm.subject}
                    onChange={(e) =>
                      onLetterFormChange((prev) => ({
                        ...prev,
                        subject: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Body Text (Markdown supported)</label>
                  <textarea
                    rows={8}
                    placeholder="Dear Finanzamt,\n\nPlease find our quarterly filing enclosed..."
                    value={letterForm.bodyMarkdown}
                    onChange={(e) =>
                      onLetterFormChange((prev) => ({
                        ...prev,
                        bodyMarkdown: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                {/* Price Breakdown Preview Bar */}
                <div className="pricing-preview-bar">
                  <div>
                    <span className="price-label">Estimated x402 Fee:</span>
                    <strong className="price-value">
                      {selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter}
                    </strong>
                    <span className="price-meta"> (Includes PDF generation, print queueing & postage)</span>
                  </div>

                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={isSending || !isRegistered}
                  >
                    {isSending
                      ? "Paying on Algorand & Sending..."
                      : `Send Physical Letter (${selectedCurrency === "eurd" ? ROUTE_PRICES_EURD_DISPLAY.outboundLetter : ROUTE_PRICES.outboundLetter})`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Outbound Mail Dispatch Queue */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Outbound History</h3>
              <span className="card-meta">{outboundLetters.length} letters</span>
            </div>

            {outboundLetters.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✉️</div>
                <div className="empty-title">No outbound letters yet</div>
                <p className="empty-desc">Compose and send your first postal letter using the form on the left.</p>
              </div>
            ) : (
              <div className="letter-item-list">
                {outboundLetters.map((letter) => (
                  <div
                    key={letter.id}
                    className="letter-item-row"
                    onClick={() => onSelectLetterModal(letter)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="letter-left-info">
                      <div className="letter-title-row">
                        <strong className="letter-from-name">{letter.subject}</strong>
                        <span className={`status-pill status-pill--${letter.status}`}>
                          {letter.status}
                        </span>
                      </div>
                      <p className="letter-summary-text">To: {letter.recipient.name} ({letter.recipient.city})</p>
                      <div className="letter-meta-row">
                        <span>Created: {new Date(letter.createdAt).toLocaleDateString()}</span>
                        {letter.paymentTxid && (
                          <span className="proof-tag" onClick={(e) => e.stopPropagation()}>
                            <span>⛓️</span>
                            <a
                              href={`https://testnet.explorer.perawallet.app/tx/${letter.paymentTxid}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Tx: {letter.paymentTxid.slice(0, 8)}... ↗
                            </a>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="letter-right-actions">
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => onSelectLetterModal(letter)}
                      >
                        Inspect ↗
                      </button>
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
