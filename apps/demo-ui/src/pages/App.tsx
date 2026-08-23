import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useState,
} from "react";

import type {
  Address,
  AgentRegistrationInput,
  AgentState,
  AgentSendLetterInput,
  InternalInboundLetterScanExtractResponse,
  ServiceState,
} from "@juicebag-mail/shared";

import { api } from "../api/client";
import demoLetterImageUrl from "../../demo_assets/letter_demo.jpg";
import { useAgentEvents } from "../hooks/useAgentEvents";
import { usePollingResource } from "../hooks/usePollingResource";
import { Navigation, type NavPage } from "../components/Navigation";
import { Sidebar } from "../components/Sidebar";
import { HeroPage } from "./HeroPage";
import { AgentPage } from "./AgentPage";
import { SendLetterPage } from "./SendLetterPage";
import { OpsConsolePage } from "./OpsConsolePage";
import { GuardrailsPage } from "./GuardrailsPage";
import { StatusStepper, type StepItem } from "../components/StatusStepper";
import { AutonomyBadge } from "../components/AutonomyBadge";
import { ReasoningCallout } from "../components/ReasoningCallout";
import { AgentChatDrawer } from "../components/AgentChatDrawer";

type ModalContent =
  | { kind: "agent-inbound"; letter: AgentState["inboundLetters"][number] }
  | { kind: "agent-outbound"; letter: AgentState["outboundLetters"][number] }
  | { kind: "service-inbound"; letter: ServiceState["inboundLetters"][number] }
  | { kind: "service-outbound"; letter: ServiceState["outboundLetters"][number] };

type InboundMode = "text" | "scan";

const initialRegistration: AgentRegistrationInput = {
  agentName: "Acme Filing Agent",
  entityType: "company",
  legalIdentity: {
    name: "Acme GmbH",
    street1: "Musterstrasse 1",
    postalCode: "10115",
    city: "Berlin",
    country: "DE",
  },
  currency: "usdc",
};

const initialLetter: AgentSendLetterInput = {
  recipient: {
    name: "Finanzamt Berlin",
    street1: "Finanzstrasse 5",
    postalCode: "10117",
    city: "Berlin",
    country: "DE",
  },
  subject: "Request for clarification",
  bodyMarkdown:
    "Dear Finanzamt,\n\nPlease share the status of our filing.\n\nBest regards,\nAcme Filing Agent",
  currency: "usdc",
};

export function App() {
  const [activePage, setActivePage] = useState<NavPage>("agent");
  const [agentStateInterval, setAgentStateInterval] = useState(3_000);

  const agent = usePollingResource(api.getAgentState, agentStateInterval);
  const agentBalances = usePollingResource(api.getAgentBalances, 2_000);
  const service = usePollingResource(api.getServiceState, 8_000);
  const serviceBalances = usePollingResource(api.getServiceBalances, 2_000);
  const liveAgentEvent = useAgentEvents();

  useEffect(() => {
    if (agent.data?.registration && agentStateInterval !== 8_000) {
      setAgentStateInterval(8_000);
    }
  }, [agent.data?.registration, agentStateInterval]);

  const [currency, setCurrency] = useState<"usdc" | "eurd">("usdc");
  const [registrationForm, setRegistrationForm] = useState<AgentRegistrationInput>(initialRegistration);
  const [letterForm, setLetterForm] = useState<AgentSendLetterInput>(initialLetter);
  const [inboundMode, setInboundMode] = useState<InboundMode>("text");
  const [inboundForm, setInboundForm] = useState({
    mailboxId: "",
    fromName: "Finanzamt Berlin",
    envelopeSummary: "Musterstrasse 1, 10115 Berlin",
    ocrText: "Sehr geehrte Damen und Herren,\n\nwir bitten um eine kurze Rückmeldung.\n",
    scanDraftId: "",
    scanFileName: "",
  });
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [sentToPrinterIds, setSentToPrinterIds] = useState<Set<string>>(new Set());
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
  const [actionResults, setActionResults] = useState<Record<string, "success" | "error">>({});
  const [modal, setModal] = useState<ModalContent | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  // Member 2 State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [budgetBlockedAlert, setBudgetBlockedAlert] = useState<{
    message?: string;
    requestedAmount?: number;
    currentSpend?: number;
    cap?: number;
  } | null>(null);
  const [isUpdatingCap, setIsUpdatingCap] = useState(false);

  const defaultMailboxId =
    agent.data?.registration?.mailboxId ?? service.data?.agents[0]?.mailboxId ?? "";

  // Listen to SSE events for budget block and autonomy decisions
  useEffect(() => {
    if (liveAgentEvent) {
      const ev = liveAgentEvent as any;
      if (ev.type === "budget_blocked") {
        setBudgetBlockedAlert({
          message: ev.message,
          requestedAmount: ev.requestedAmount,
          currentSpend: ev.currentSpend,
          cap: ev.cap,
        });
        void agent.refresh();
      } else if (ev.type === "autonomy_decision") {
        void agent.refresh();
      }
    }
  }, [liveAgentEvent]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultScan() {
      try {
        const response = await fetch(demoLetterImageUrl);
        const blob = await response.blob();
        if (!response.ok) {
          throw new Error("Failed to load bundled demo letter");
        }

        if (!cancelled) {
          setScanFile((current) => current ?? new File([blob], "letter_demo.jpg", { type: blob.type || "image/jpeg" }));
        }
      } catch (error) {
        if (!cancelled) {
          setUiError(error instanceof Error ? error.message : "Failed to load demo letter");
        }
      }
    }

    void loadDefaultScan();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction<T>(actionKey: string, task: () => Promise<T>) {
    setBusyActions((prev) => new Set([...prev, actionKey]));
    let succeeded = false;
    let value: T | undefined;
    try {
      value = await task();
      succeeded = true;
      setUiError(null);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusyActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
    setActionResults((prev) => ({ ...prev, [actionKey]: succeeded ? "success" : "error" }));
    setTimeout(() => {
      setActionResults((prev) => {
        const { [actionKey]: _, ...rest } = prev;
        return rest;
      });
    }, 3_000);
    if (succeeded) {
      void Promise.all([agent.refresh(), service.refresh()]);
    }

    return value;
  }

  async function handleUpdateCap(newCap: number) {
    setIsUpdatingCap(true);
    try {
      await api.setDailyCap(newCap);
      await agent.refresh();
      if (budgetBlockedAlert && newCap > (agent.data?.guardrail?.currentSpendUsdc ?? 0)) {
        setBudgetBlockedAlert(null);
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Failed to update daily cap");
    } finally {
      setIsUpdatingCap(false);
    }
  }

  function applyExtractedScan(result: InternalInboundLetterScanExtractResponse) {
    setInboundForm((current) => ({
      ...current,
      fromName: result.fromName,
      envelopeSummary: result.envelopeSummary,
      ocrText: result.ocrText,
      scanDraftId: result.scanDraftId,
      scanFileName: result.scanFileName,
    }));
  }

  async function handleScanExtract() {
    const mailboxId = inboundForm.mailboxId || defaultMailboxId;
    if (!mailboxId) {
      setUiError("Choose a mailbox before extracting a scan.");
      return;
    }

    if (!scanFile) {
      setUiError("Choose a PNG or JPEG scan first.");
      return;
    }

    const result = await runAction("extract-scan", () =>
      api.extractInboundLetterFromScan({
        mailboxId,
        scan: scanFile,
      }),
    );

    if (result) {
      applyExtractedScan(result);
    }
  }

  function getInboundStepper(
    letter: AgentState["inboundLetters"][number],
    decision?: import("@juicebag-mail/shared").AutonomyDecision,
  ): StepItem[] {
    const isUnlocked = letter.agentStatus === "received" && !!letter.ocrText;
    const isIgnored = letter.agentStatus === "ignored" || decision?.decision === "ignore";

    return [
      {
        id: "ingest",
        label: "Ingested",
        timestamp: letter.receivedAt,
        state: "completed",
      },
      {
        id: "evaluate",
        label: isIgnored
          ? "Spam Ignored"
          : decision?.decision === "unlock"
          ? "Auto-Unlock"
          : decision?.decision === "defer"
          ? "Deferred"
          : "Evaluated",
        timestamp: decision?.evaluatedAt,
        state: isIgnored ? "skipped" : decision ? "completed" : letter.agentStatus === "pending" ? "current" : "completed",
      },
      {
        id: "unlock",
        label: isUnlocked ? "x402 Unlocked" : isIgnored ? "Skipped" : "x402 Unlock",
        timestamp: isUnlocked ? letter.notifiedAt ?? letter.receivedAt : undefined,
        state: isUnlocked ? "completed" : isIgnored ? "skipped" : "upcoming",
      },
    ];
  }

  function getOutboundStepper(letter: AgentState["outboundLetters"][number]): StepItem[] {
    const isSent = letter.status === "sent";

    return [
      {
        id: "created",
        label: "Created & Paid",
        timestamp: letter.createdAt,
        state: "completed",
      },
      {
        id: "stamped",
        label: "PDF Stamped",
        timestamp: letter.createdAt,
        state: "completed",
      },
      {
        id: "mailed",
        label: isSent ? "Printed & Mailed" : "Queued at Hub",
        timestamp: letter.sentAt,
        state: isSent ? "completed" : "current",
      },
    ];
  }

  const currentAgentEvent = liveAgentEvent ?? (agent.data?.lastEvent ? {
    id: "snapshot",
    ...agent.data.lastEvent,
  } : null);

  const currentServiceEvent = service.data?.lastEvent ?? null;
  const displayedBalances: AgentState["balances"] =
    agentBalances.data ?? agent.data?.balances ?? {
      algo: 0,
      usdc: 0,
      eurd: 0,
      address: "",
    };
  const eurdEnabled = service.data?.paymentOptions.eurd ?? false;
  const selectedCurrency: "usdc" | "eurd" = eurdEnabled ? currency : "usdc";

  const unreadCount = (agent.data?.inboundLetters ?? []).filter((l) => l.agentStatus === "pending").length;
  const isBlocked = agent.data?.guardrail?.blocked ?? false;

  return (
    <div className="app-shell">
      {/* 1. Dark Hero Section (Black Background, No Images) */}
      {activePage === "hero" && (
        <HeroPage
          onNavigate={setActivePage}
          onOpenChat={() => setIsChatOpen(true)}
          agentState={agent.data}
          agentBalances={displayedBalances}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setCurrency}
          eurdEnabled={eurdEnabled}
          unreadCount={unreadCount}
        />
      )}

      {/* 2. Dashboard Shell Layout */}
      {activePage !== "hero" && (
        <>
          <Navigation
            activePage={activePage}
            onSelectPage={setActivePage}
            currency={selectedCurrency}
            onCurrencyChange={setCurrency}
            eurdEnabled={eurdEnabled}
            onOpenChat={() => setIsChatOpen(true)}
            unreadInboundCount={unreadCount}
            guardrailBlocked={isBlocked}
          />
          <div className="dashboard-shell-layout">
            <Sidebar
              activePage={activePage}
              onSelectPage={setActivePage}
              agentState={agent.data}
              unreadInboundCount={unreadCount}
              guardrailBlocked={isBlocked}
            />
            <main className="dashboard-main-pane">
              {activePage === "agent" && (
                <AgentPage
              agentState={agent.data}
              agentBalances={displayedBalances}
              selectedCurrency={selectedCurrency}
              registrationForm={registrationForm}
              onRegistrationChange={setRegistrationForm}
              onRegister={async () => {
                await runAction("register", () =>
                  api.registerAgent({ ...registrationForm, currency: selectedCurrency }),
                );
              }}
              onUnlockLetter={async (id) => {
                await runAction(`unlock-${id}`, () =>
                  api.unlockLetter(id, selectedCurrency),
                );
              }}
              onIgnoreLetter={async (id) => {
                await runAction(`ignore-${id}`, () =>
                  api.ignoreLetter(id),
                );
              }}
              onSelectLetterModal={(letter) => setModal({ kind: "agent-inbound", letter })}
              onUpdateCap={handleUpdateCap}
              isUpdatingCap={isUpdatingCap}
              busyActions={busyActions}
              budgetBlockedAlert={budgetBlockedAlert}
              onDismissBudgetAlert={() => setBudgetBlockedAlert(null)}
              currentAgentEvent={currentAgentEvent}
              onNavigateToSend={() => setActivePage("send")}
              onNavigateToOps={() => setActivePage("ops")}
            />
          )}

          {activePage === "send" && (
            <SendLetterPage
              letterForm={letterForm}
              onLetterFormChange={setLetterForm}
              onSendLetter={async () => {
                await runAction("send-letter", () =>
                  api.sendLetter({ ...letterForm, currency: selectedCurrency }),
                );
              }}
              outboundLetters={agent.data?.outboundLetters ?? []}
              isRegistered={!!agent.data?.registration}
              selectedCurrency={selectedCurrency}
              busyActions={busyActions}
              onSelectLetterModal={(letter) => setModal({ kind: "agent-outbound", letter })}
            />
          )}

          {activePage === "ops" && (
            <OpsConsolePage
              serviceState={service.data}
              serviceBalances={serviceBalances.data ?? { usdc: 0, eurd: 0, address: "" }}
              inboundForm={inboundForm}
              onInboundFormChange={setInboundForm}
              inboundMode={inboundMode}
              onInboundModeChange={setInboundMode}
              scanFile={scanFile}
              onScanFileChange={setScanFile}
              onExtractScan={handleScanExtract}
              onIngestLetter={async () => {
                await runAction("ingest", () =>
                  api.ingestInboundLetter({
                    mailboxId: inboundForm.mailboxId || defaultMailboxId,
                    fromName: inboundForm.fromName,
                    pageCount: 1,
                    envelopeSummary: inboundForm.envelopeSummary,
                    ocrText: inboundForm.ocrText,
                    scanDraftId: inboundMode === "scan" ? inboundForm.scanDraftId || undefined : undefined,
                    scanFileName: inboundMode === "scan" ? inboundForm.scanFileName || undefined : undefined,
                  }),
                );
              }}
              onMarkOutboundSent={(id) =>
                runAction(`mark-${id}`, () => api.markOutboundSent(id)).then(() => {
                  setSentToPrinterIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                })
              }
              sentToPrinterIds={sentToPrinterIds}
              onSendToPrinter={(id) => setSentToPrinterIds((prev) => new Set([...prev, id]))}
              busyActions={busyActions}
              actionResults={actionResults}
              onSelectInboundModal={(letter) => setModal({ kind: "service-inbound", letter })}
              onSelectOutboundModal={(letter) => setModal({ kind: "service-outbound", letter })}
              currentServiceEvent={currentServiceEvent}
              defaultMailboxId={defaultMailboxId}
            />
          )}

          {activePage === "guardrails" && (
            <GuardrailsPage
              guardrail={agent.data?.guardrail}
              decisions={agent.data?.recentAutonomyDecisions ?? []}
              recentPayments={agent.data?.recentPayments ?? []}
              onUpdateCap={handleUpdateCap}
              isUpdatingCap={isUpdatingCap}
            />
          )}
        </main>
      </div>
    </>
  )}

  {/* Global Error Banner */}
  {activePage !== "hero" && (uiError || (agent.error && agent.error !== "Failed to fetch") || (service.error && service.error !== "Failed to fetch")) && (
        <footer className="error-strip">
          {agent.error && agent.error !== "Failed to fetch" && <span>Agent Error: {agent.error}</span>}
          {service.error && service.error !== "Failed to fetch" && <span>Service Error: {service.error}</span>}
          {uiError && <span>Notice: {uiError}</span>}
          <button
            type="button"
            onClick={() => setUiError(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700 }}
          >
            ✕ Dismiss
          </button>
        </footer>
      )}

      {/* Detail Inspection Modal */}
      {modal && (
        <Modal
          title={
            modal.kind === "agent-inbound" || modal.kind === "service-inbound"
              ? modal.letter.fromName
              : modal.letter.subject
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "agent-inbound" && (() => {
            const modalDecision = agent.data?.recentAutonomyDecisions?.find((d) => d.letterId === modal.letter.id);
            return (
              <>
                <StatusStepper steps={getInboundStepper(modal.letter, modalDecision)} />
                {modalDecision && (
                  <div style={{ margin: "12px 0" }}>
                    <AutonomyBadge decision={modalDecision.decision} confidence={modalDecision.confidence} />
                    <ReasoningCallout reason={modalDecision.reason} evaluatedAt={modalDecision.evaluatedAt} defaultExpanded />
                  </div>
                )}
                <ModalField label="Sender Address" value={modal.letter.envelopeSummary} />
                <ModalField label="Status" value={modal.letter.agentStatus} />
                <ModalField label="Received At" value={new Date(modal.letter.receivedAt).toLocaleString()} />
                {modal.letter.unlockPaymentTxid && (
                  <div className="modal-field">
                    <span className="modal-field-label">On-Chain Settlement Proof</span>
                    <a
                      href={`https://testnet.explorer.perawallet.app/tx/${modal.letter.unlockPaymentTxid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="tx-link"
                    >
                      {modal.letter.unlockPaymentTxid} ↗
                    </a>
                  </div>
                )}
                <ModalField
                  label="Full OCR Letter Text"
                  value={modal.letter.ocrText ?? "Not yet unlocked. Pay on-chain to reveal scanned letter contents."}
                  preformatted={!!modal.letter.ocrText}
                />
              </>
            );
          })()}

          {modal.kind === "agent-outbound" && (
            <>
              <StatusStepper steps={getOutboundStepper(modal.letter)} />
              <ModalField label="Recipient" value={formatAddress(modal.letter.recipient)} preformatted />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Created At" value={new Date(modal.letter.createdAt).toLocaleString()} />
              {modal.letter.paymentTxid && (
                <div className="modal-field">
                  <span className="modal-field-label">x402 Payment Settlement Proof</span>
                  <a
                    href={`https://testnet.explorer.perawallet.app/tx/${modal.letter.paymentTxid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    {modal.letter.paymentTxid} ↗
                  </a>
                </div>
              )}
              {modal.letter.sentAt && (
                <ModalField label="Sent At" value={new Date(modal.letter.sentAt).toLocaleString()} />
              )}
              <ModalField label="Letter Body" value={modal.letter.bodyMarkdown} preformatted />
            </>
          )}

          {modal.kind === "service-inbound" && (
            <>
              <ModalField label="Sender Address" value={modal.letter.envelopeSummary} />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Received At" value={new Date(modal.letter.receivedAt).toLocaleString()} />
              <ModalField label="Destination Mailbox ID" value={modal.letter.mailboxId} />
              {modal.letter.unlockPaymentTxid && (
                <div className="modal-field">
                  <span className="modal-field-label">Unlock Payment Txid</span>
                  <a
                    href={`https://testnet.explorer.perawallet.app/tx/${modal.letter.unlockPaymentTxid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    {modal.letter.unlockPaymentTxid} ↗
                  </a>
                </div>
              )}
              <ModalField label="OCR Letter Text" value={modal.letter.ocrText} preformatted />
            </>
          )}

          {modal.kind === "service-outbound" && (
            <>
              <ModalField label="Recipient" value={formatAddress(modal.letter.recipient)} preformatted />
              <ModalField label="Status" value={modal.letter.status} />
              <ModalField label="Created At" value={new Date(modal.letter.createdAt).toLocaleString()} />
              {modal.letter.paymentTxid && (
                <div className="modal-field">
                  <span className="modal-field-label">Payment Txid</span>
                  <a
                    href={`https://testnet.explorer.perawallet.app/tx/${modal.letter.paymentTxid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    {modal.letter.paymentTxid} ↗
                  </a>
                </div>
              )}
              {modal.letter.sentAt && (
                <ModalField label="Sent At" value={new Date(modal.letter.sentAt).toLocaleString()} />
              )}
              <ModalField label="Letter Body" value={modal.letter.bodyMarkdown} preformatted />
            </>
          )}
        </Modal>
      )}

      {/* Floating MCP AI Chat Assistant Drawer */}
      <AgentChatDrawer
        isOpen={isChatOpen}
        onOpen={() => setIsChatOpen(true)}
        onClose={() => setIsChatOpen(false)}
        agentState={agent.data}
        onStateRefresh={() => void agent.refresh()}
        hideFloatingLauncher={activePage === "hero"}
      />
    </div>
  );
}

function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{props.title}</h3>
          <button className="modal-close" onClick={props.onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          {props.children}
        </div>
      </div>
    </div>
  );
}

function ModalField(props: { label: string; value: string; preformatted?: boolean }) {
  return (
    <div className="modal-field">
      <span className="modal-field-label">{props.label}</span>
      {props.preformatted ? (
        <pre className="modal-text-block">{props.value}</pre>
      ) : (
        <span className="modal-field-value">{props.value}</span>
      )}
    </div>
  );
}

function formatAddress(addr: Address): string {
  const parts = [addr.street1];
  if (addr.street2) parts.push(addr.street2);
  parts.push(`${addr.postalCode} ${addr.city}`);
  parts.push(addr.country);
  return parts.join("\n");
}
